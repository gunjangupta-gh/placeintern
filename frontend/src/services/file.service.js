import API from './api';
import { downloadBlob } from '../utils/downloadUtils';

/**
 * File Service
 * Centralized API methods for file and document operations
 */
const FileService = {
  /**
   * Upload a single file
   * @param {File} file - File to upload
   * @param {string} folder - Folder/category for the file (default: 'general')
   * @returns {Promise<Object>} Upload response with file URL and metadata
   */
  upload: (file, folder = 'general') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);

    return API.post('/shared/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  /**
   * Upload multiple files
   * @param {Array<File>} files - Array of files to upload
   * @param {string} folder - Folder/category for the files (default: 'general')
   * @returns {Promise<Object>} Upload response with array of file URLs and metadata
   */
  uploadMultiple: (files, folder = 'general') => {
    const formData = new FormData();

    files.forEach((file) => {
      formData.append('files', file);
    });
    formData.append('folder', folder);

    return API.post('/shared/documents/upload-multiple', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  /**
   * Get document details by ID
   * @param {string} id - Document ID
   * @returns {Promise<Object>} Document metadata and details
   */
  getDocument: (id) => {
    return API.get(`/shared/documents/${id}`);
  },

  /**
   * Delete a document by ID
   * @param {string} id - Document ID
   * @returns {Promise<Object>} Success response
   */
  deleteDocument: (id) => {
    return API.delete(`/shared/documents/${id}`);
  },

  /**
   * Get a signed URL for accessing a private file
   * @param {string} key - File key/path in storage
   * @returns {Promise<Object>} Response with signed URL
   */
  getSignedUrl: (key) => {
    return API.get('/shared/documents/signed-url', { params: { key } });
  },

  /**
   * Download a document by ID
   * @param {string} id - Document ID
   * @param {string} filename - Filename for the downloaded file
   * @returns {Promise<void>} Initiates browser download
   */
  downloadDocument: async (id, filename) => {
    try {
      const response = await API.get(`/shared/documents/${id}/download`, {
        responseType: 'blob',
      });

      // Extract filename from Content-Disposition header if not provided
      let downloadFilename = filename;
      if (!downloadFilename) {
        const contentDisposition = response.headers['content-disposition'];
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
          if (filenameMatch && filenameMatch[1]) {
            downloadFilename = filenameMatch[1].replace(/['"]/g, '');
          }
        }
      }

      // Fallback to default filename if still not available
      downloadFilename = downloadFilename || `document-${id}`;

      downloadBlob(response.data, downloadFilename);
    } catch (error) {
      console.error('Error downloading document:', error);
      throw error;
    }
  },

  /**
   * Download a file from a URL
   * @param {string} url - File URL
   * @param {string} filename - Filename for the downloaded file
   * @returns {Promise<void>} Initiates browser download
   */
  downloadFromUrl: async (url, filename) => {
    try {
      const response = await API.get(url, {
        responseType: 'blob',
      });

      downloadBlob(response.data, filename);
    } catch (error) {
      console.error('Error downloading file from URL:', error);
      throw error;
    }
  },

  /**
   * Get all documents for the current user
   * @param {Object} params - Query parameters (page, limit, folder, type, etc.)
   * @returns {Promise<Object>} Response with documents and pagination
   */
  getDocuments: (params = {}) => {
    return API.get('/shared/documents', { params });
  },

  /**
   * Update document metadata
   * @param {string} id - Document ID
   * @param {Object} data - Updated metadata
   * @param {string} data.name - Document name
   * @param {string} data.description - Document description
   * @param {string} data.folder - Document folder/category
   * @returns {Promise<Object>} Updated document
   */
  updateDocument: (id, data) => {
    return API.put(`/shared/documents/${id}`, data);
  },

  /**
   * Delete multiple documents
   * @param {Array<string>} ids - Array of document IDs
   * @returns {Promise<Object>} Success response
   */
  deleteMultiple: (ids) => {
    return API.post('/shared/documents/delete-multiple', { ids });
  },

  /**
   * Search documents
   * @param {string} query - Search query
   * @param {Object} filters - Additional filters (folder, type, dateRange, etc.)
   * @returns {Promise<Object>} Search results
   */
  searchDocuments: (query, filters = {}) => {
    return API.get('/shared/documents/search', {
      params: { q: query, ...filters },
    });
  },

  /**
   * Get document statistics
   * @returns {Promise<Object>} Document statistics (total size, count by type, etc.)
   */
  getStatistics: () => {
    return API.get('/shared/documents/statistics');
  },

  /**
   * Upload file with progress tracking
   * @param {File} file - File to upload
   * @param {string} folder - Folder/category for the file
   * @param {Function} onProgress - Progress callback function
   * @returns {Promise<Object>} Upload response
   */
  uploadWithProgress: (file, folder = 'general', onProgress) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);

    return API.post('/shared/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onProgress) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(percentCompleted);
        }
      },
    });
  },
};

export default FileService;
