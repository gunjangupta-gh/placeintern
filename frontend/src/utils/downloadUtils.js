/**
 * File Download Utilities
 * Consolidates blob download patterns across services
 */

/**
 * Downloads a blob as a file
 * @param {Blob} blob - The blob to download
 * @param {string} filename - The filename for the download
 */
export const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

/**
 * Downloads an Excel file from response data
 * @param {ArrayBuffer|Blob} data - The response data
 * @param {string} baseFilename - Base filename without extension
 */
export const downloadExcel = (data, baseFilename) => {
  const blob = data instanceof Blob ? data : new Blob([data]);
  const filename = `${baseFilename}-${new Date().toISOString().split('T')[0]}.xlsx`;
  downloadBlob(blob, filename);
};

/**
 * Downloads a PDF file from response data
 * @param {ArrayBuffer|Blob} data - The response data
 * @param {string} baseFilename - Base filename without extension
 */
export const downloadPdf = (data, baseFilename) => {
  const blob = data instanceof Blob ? data : new Blob([data], { type: 'application/pdf' });
  const filename = `${baseFilename}-${new Date().toISOString().split('T')[0]}.pdf`;
  downloadBlob(blob, filename);
};

export default { downloadBlob, downloadExcel, downloadPdf };
