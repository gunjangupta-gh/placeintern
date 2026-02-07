/**
 * Utility functions for handling image URLs in the application
 */

import API from '../services/api';

// Determine the base URL for uploads based on environment
const getUploadsBaseUrl = () => {
  // Use environment variable if available
  if (import.meta.env.VITE_UPLOADS_URL) {
    return import.meta.env.VITE_UPLOADS_URL;
  }
  
  // Use MinIO endpoint and bucket for both dev and production
  const minioEndpoint = import.meta.env.VITE_MINIO_ENDPOINT || 'http://localhost:9000';
  const minioBucket = import.meta.env.VITE_MINIO_BUCKET || 'cms-uploads';
  return `${minioEndpoint}/${minioBucket}`;
};

const UPLOADS_BASE_URL = getUploadsBaseUrl();

// Cache for presigned URLs (1 hour expiry)
const presignedUrlCache = new Map();
const CACHE_TTL = 55 * 60 * 1000; // 55 minutes (slightly less than 1 hour)

/**
 * Convert relative file path to full URL
 * @param {string} relativePath - Relative path from database (e.g., "profile/profile-123456.jpg")
 * @returns {string|null} - Full URL or null if no path provided
 */
export const getImageUrl = (relativePath) => {
  if (!relativePath) return null;

  // If it's already a full URL (old Cloudinary URLs), return as is
  if (relativePath.startsWith('http')) return relativePath;

  // Otherwise, prepend the uploads base URL
  return `${UPLOADS_BASE_URL}/${relativePath}`;
};

/**
 * Alias for getImageUrl - works for any file type (documents, PDFs, etc.)
 * @param {string} relativePath - Relative path from database
 * @returns {string|null} - Full URL or null if no path provided
 */
export const getFileUrl = getImageUrl;

/**
 * Get presigned URL for a MinIO file
 * Use this for files that need authenticated access
 * @param {string} fileUrl - The original MinIO file URL
 * @param {number} expiresIn - URL expiry time in seconds (default 1 hour)
 * @returns {Promise<string>} - Presigned URL
 */
export const getPresignedUrl = async (fileUrl, expiresIn = 3600) => {
  if (!fileUrl) return null;

  // Check cache first
  const cacheKey = fileUrl;
  const cached = presignedUrlCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.url;
  }

  try {
    const response = await API.get('/shared/documents/presigned-url', {
      params: { url: fileUrl, expiresIn },
    });
    const presignedUrl = response.data?.url;

    // Cache the URL
    if (presignedUrl) {
      presignedUrlCache.set(cacheKey, {
        url: presignedUrl,
        timestamp: Date.now(),
      });
    }

    return presignedUrl;
  } catch (error) {
    console.error('Failed to get presigned URL:', error);
    // Fallback to original URL
    return fileUrl;
  }
};

/**
 * Open a file in a new tab using presigned URL
 * @param {string} fileUrl - The original file URL
 */
export const openFileWithPresignedUrl = async (fileUrl) => {
  if (!fileUrl) return;

  try {
    const presignedUrl = await getPresignedUrl(fileUrl);
    if (presignedUrl) {
      window.open(presignedUrl, '_blank');
    }
  } catch (error) {
    console.error('Failed to open file:', error);
    // Fallback to original URL
    window.open(fileUrl, '_blank');
  }
};
