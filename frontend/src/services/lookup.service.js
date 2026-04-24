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
   * Get all scholarships for filters/dropdowns (global data)
   */
  async getScholarships() {
    const response = await API.get('/shared/lookup/scholarships');
    return response.data;
  },

  /**
   * Get all designation enum values for filters/dropdowns (global data)
   * Returns static list matching Prisma Designation enum
   */
  async getDesignations() {
    // Static list based on Prisma Designation enum - no API call needed
    const designations = [
      // Faculty/Teacher Designations
      { value: 'PRINCIPAL', label: 'Principal' },
      { value: 'HOD', label: 'HOD' },
      { value: 'SENIOR_LECTURER', label: 'Senior Lecturer' },
      { value: 'LECTURER', label: 'Lecturer' },
      { value: 'ASSISTANT_PROFESSOR', label: 'Assistant Professor' },
      { value: 'FOREMAN_INSTRUCTOR', label: 'Foreman Instructor' },
      { value: 'WORKSHOP_INSTRUCTOR', label: 'Workshop Instructor' },
      { value: 'WORKSHOP_SUPERINTENDENT', label: 'Workshop Superintendent' },
      { value: 'WORKSHOP_FOREMAN', label: 'Workshop Foreman' },
      { value: 'LAB_TECHNICIAN', label: 'Lab Technician' },
      { value: 'TECHNICIAN', label: 'Technician' },
      { value: 'INSTRUCTOR', label: 'Instructor' },
      { value: 'SYSTEM_ANALYST', label: 'System Analyst' },
      { value: 'SYSTEM_ADMINISTRATOR', label: 'System Administrator' },
      { value: 'SYSTEM_MANAGER', label: 'System Manager' },
      { value: 'PROGRAMMER', label: 'Programmer' },
      { value: 'NETWORK_ENGINEER', label: 'Network Engineer' },
      { value: 'COMPUTER_OPERATOR', label: 'Computer Operator' },
      { value: 'LIBRARIAN', label: 'Librarian' },
      { value: 'TPO', label: 'TPO' },
      { value: 'FASHION_DESIGNER', label: 'Fashion Designer' },
      { value: 'PEON', label: 'Peon' },
      // Admin Staff Designations
      { value: 'ASSTT_DIRECTOR', label: 'Asstt. Director' },
      { value: 'ADDITIONAL_DIRECTOR', label: 'Additional Director' },
      { value: 'DEPUTY_DIRECTOR_STAFF', label: 'Deputy Director (Staff)' },
      { value: 'DEPUTY_DIRECTOR_CONDUCT', label: 'Deputy Director (Conduct)' },
      { value: 'DEPUTY_DIRECTOR_PLANNING', label: 'Deputy Director (Planning)' },
      { value: 'DIRECTOR_ACADEMICS', label: 'Director Academics' },
      { value: 'REGISTRAR', label: 'Registrar' },
      { value: 'HOD_CONTROLLER_EXAMINATIONS', label: 'HOD Controller Examinations' },
      { value: 'DEMONSTRATOR', label: 'Demonstrator' },
      { value: 'STENOTYPIST', label: 'Stenotypist' },
      { value: 'CLERK', label: 'Clerk' },
      { value: 'JR_SCALE_STENOGRAPHER', label: 'Jr. Scale Stenographer' },
      { value: 'JUNIOR_ASSTT', label: 'Junior Asstt.' },
      { value: 'SR_ASSTT', label: 'Sr. Asstt.' },
      { value: 'SUPDT_GRADE_2', label: 'Supdt. Grade 2' },
      { value: 'OTHER', label: 'Other' },
    ];
    return { designations };
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
