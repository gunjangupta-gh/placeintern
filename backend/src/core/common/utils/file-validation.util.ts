import { BadRequestException } from '@nestjs/common';

/**
 * File magic bytes signatures for common file types
 * SECURITY: Used to validate file content matches declared MIME type
 */
export const FILE_SIGNATURES: Record<string, { signature: number[]; offset?: number }[]> = {
  // Images
  'image/jpeg': [
    { signature: [0xFF, 0xD8, 0xFF] }, // JPEG/JFIF
  ],
  'image/png': [
    { signature: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] }, // PNG
  ],
  'image/gif': [
    { signature: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] }, // GIF87a
    { signature: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] }, // GIF89a
  ],
  'image/webp': [
    { signature: [0x52, 0x49, 0x46, 0x46] }, // RIFF (WebP container)
  ],
  // Documents
  'application/pdf': [
    { signature: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  ],
  // Microsoft Office (OOXML)
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    { signature: [0x50, 0x4B, 0x03, 0x04] }, // ZIP (docx is a ZIP archive)
  ],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
    { signature: [0x50, 0x4B, 0x03, 0x04] }, // ZIP (xlsx is a ZIP archive)
  ],
  // Legacy Microsoft Office
  'application/msword': [
    { signature: [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1] }, // OLE Compound Document
  ],
  'application/vnd.ms-excel': [
    { signature: [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1] }, // OLE Compound Document
  ],
};

/**
 * Allowed MIME types for different upload contexts
 */
export const ALLOWED_MIME_TYPES = {
  images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  documents: ['application/pdf'],
  visitDocuments: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'],
  joiningLetters: ['application/pdf', 'image/jpeg', 'image/png'],
  all: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
};

/**
 * Maximum file sizes for different upload contexts (in bytes)
 */
export const MAX_FILE_SIZES = {
  image: 5 * 1024 * 1024,        // 5MB
  document: 10 * 1024 * 1024,    // 10MB
  visitDocument: 10 * 1024 * 1024, // 10MB
  joiningLetter: 10 * 1024 * 1024, // 10MB
};

/**
 * Check if buffer starts with the given signature at the specified offset
 */
function matchesSignature(buffer: Buffer, signature: number[], offset = 0): boolean {
  if (buffer.length < offset + signature.length) {
    return false;
  }

  for (let i = 0; i < signature.length; i++) {
    if (buffer[offset + i] !== signature[i]) {
      return false;
    }
  }

  return true;
}

/**
 * Validate file content matches the declared MIME type using magic bytes
 * SECURITY: Prevents file type spoofing attacks
 */
export function validateFileMagicBytes(
  buffer: Buffer,
  declaredMimeType: string,
): { isValid: boolean; detectedType?: string } {
  const signatures = FILE_SIGNATURES[declaredMimeType];

  if (!signatures) {
    // For unknown types, we can't validate magic bytes
    // This is logged but allowed to pass (whitelist check happens elsewhere)
    return { isValid: true };
  }

  for (const { signature, offset = 0 } of signatures) {
    if (matchesSignature(buffer, signature, offset)) {
      return { isValid: true, detectedType: declaredMimeType };
    }
  }

  // Try to detect actual file type
  for (const [mimeType, sigs] of Object.entries(FILE_SIGNATURES)) {
    for (const { signature, offset = 0 } of sigs) {
      if (matchesSignature(buffer, signature, offset)) {
        return { isValid: false, detectedType: mimeType };
      }
    }
  }

  return { isValid: false };
}

/**
 * Comprehensive file validation for uploads
 * SECURITY: Validates MIME type whitelist, file size, and magic bytes
 */
export function validateUploadedFile(
  file: Express.Multer.File,
  options: {
    allowedTypes: string[];
    maxSize: number;
    context?: string;
  },
): void {
  const { allowedTypes, maxSize, context = 'file' } = options;

  // Validate MIME type is in whitelist
  if (!allowedTypes.includes(file.mimetype)) {
    throw new BadRequestException(
      `Invalid ${context} type. Allowed types: ${allowedTypes.map(t => t.split('/')[1]).join(', ')}`,
    );
  }

  // Validate file size
  if (file.size > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(0);
    throw new BadRequestException(
      `${context} size must be less than ${maxSizeMB}MB`,
    );
  }

  // Validate magic bytes match declared MIME type
  const magicValidation = validateFileMagicBytes(file.buffer, file.mimetype);

  if (!magicValidation.isValid) {
    const detected = magicValidation.detectedType
      ? ` (detected: ${magicValidation.detectedType})`
      : '';
    throw new BadRequestException(
      `File content does not match declared type${detected}. This may indicate a malformed or spoofed file.`,
    );
  }
}

/**
 * Helper for visit document validation
 */
export function validateVisitDocument(file: Express.Multer.File): void {
  validateUploadedFile(file, {
    allowedTypes: ALLOWED_MIME_TYPES.visitDocuments,
    maxSize: MAX_FILE_SIZES.visitDocument,
    context: 'Visit document',
  });
}

/**
 * Helper for joining letter validation
 */
export function validateJoiningLetter(file: Express.Multer.File): void {
  validateUploadedFile(file, {
    allowedTypes: ALLOWED_MIME_TYPES.joiningLetters,
    maxSize: MAX_FILE_SIZES.joiningLetter,
    context: 'Joining letter',
  });
}

/**
 * Helper for image validation
 */
export function validateImage(file: Express.Multer.File): void {
  validateUploadedFile(file, {
    allowedTypes: ALLOWED_MIME_TYPES.images,
    maxSize: MAX_FILE_SIZES.image,
    context: 'Image',
  });
}
