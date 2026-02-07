import API from './api';

/**
 * Lookup Service
 * API methods for shared lookup data (dropdowns, filters, etc.)
 * These endpoints return cached data optimized for filter/dropdown usage.
 */
export const lookupService = {
  /**
   * Get all institutions for filters/dropdowns
   * @param {boolean} includeInactive - Include inactive institutions (useful for reports)
   */
  async getInstitutions(includeInactive = false) {
    const url = includeInactive
      ? '/shared/lookup/institutions?includeInactive=true'
      : '/shared/lookup/institutions';
    const response = await API.get(url);
    return response.data;
  },

  /**
   * Get all batches for filters/dropdowns (global data)
   */
  async getBatches() {
    const response = await API.get('/shared/lookup/batches');
    return response.data;
  },

  /**
   * Get all departments for filters/dropdowns (global data)
   */
  async getDepartments() {
    const response = await API.get('/shared/lookup/departments');
    return response.data;
  },

  /**
   * Get all branches for filters/dropdowns (global data)
   */
  async getBranches() {
    const response = await API.get('/shared/lookup/branches');
    return response.data;
  },

  /**
   * Get all approved industries for filters/dropdowns
   */
  async getIndustries() {
    const response = await API.get('/shared/lookup/industries');
    return response.data;
  },

  /**
   * Get available user roles
   */
  async getRoles() {
    const response = await API.get('/shared/lookup/roles');
    return response.data;
  },

  // ==========================================
  // CRUD Operations (State Directorate / Principal)
  // ==========================================

  // Batch CRUD
  async createBatch(data) {
    const response = await API.post('/shared/lookup/batches', data);
    return response.data;
  },

  async updateBatch(id, data) {
    const response = await API.put(`/shared/lookup/batches/${id}`, data);
    return response.data;
  },

  async deleteBatch(id) {
    const response = await API.delete(`/shared/lookup/batches/${id}`);
    return response.data;
  },

  // Department CRUD
  async createDepartment(data) {
    const response = await API.post('/shared/lookup/departments', data);
    return response.data;
  },

  async updateDepartment(id, data) {
    const response = await API.put(`/shared/lookup/departments/${id}`, data);
    return response.data;
  },

  async deleteDepartment(id) {
    const response = await API.delete(`/shared/lookup/departments/${id}`);
    return response.data;
  },

  // Branch CRUD
  async createBranch(data) {
    const response = await API.post('/shared/lookup/branches', data);
    return response.data;
  },

  async updateBranch(id, data) {
    const response = await API.put(`/shared/lookup/branches/${id}`, data);
    return response.data;
  },

  async deleteBranch(id) {
    const response = await API.delete(`/shared/lookup/branches/${id}`);
    return response.data;
  },
};

export default lookupService;
