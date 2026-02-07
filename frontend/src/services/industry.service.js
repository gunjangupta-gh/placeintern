/**
 * Industry Service - STUBBED
 * Industry portal has been removed - only self-identified internships are supported
 */
export const industryService = {
  // Dashboard
  async getDashboard() {
    throw new Error('Industry portal no longer available - only self-identified internships supported');
  },

  // Internship Postings
  async getMyPostings(params = {}) {
    return [];
  },

  async getPostingById(id) {
    throw new Error('Industry portal no longer available - only self-identified internships supported');
  },

  async createPosting(data) {
    throw new Error('Industry portal no longer available - only self-identified internships supported');
  },

  async updatePosting(id, data) {
    throw new Error('Industry portal no longer available - only self-identified internships supported');
  },

  async deletePosting(id) {
    throw new Error('Industry portal no longer available - only self-identified internships supported');
  },

  async togglePostingStatus(id, isActive) {
    throw new Error('Industry portal no longer available - only self-identified internships supported');
  },

  // Applications
  async getMyApplications(params = {}) {
    return [];
  },

  async getApplicationById(id) {
    throw new Error('Industry portal no longer available - only self-identified internships supported');
  },

  async updateApplicationStatus(id, status, rejectionReason = null) {
    throw new Error('Industry portal no longer available - only self-identified internships supported');
  },

  async shortlistApplication(id) {
    throw new Error('Industry portal no longer available - only self-identified internships supported');
  },

  async selectApplication(id, joiningDate = null) {
    throw new Error('Industry portal no longer available - only self-identified internships supported');
  },

  async rejectApplication(id, reason) {
    throw new Error('Industry portal no longer available - only self-identified internships supported');
  },

  // Profile
  async getProfile() {
    throw new Error('Industry portal no longer available - only self-identified internships supported');
  },

  async updateProfile(data, logo = null) {
    throw new Error('Industry portal no longer available - only self-identified internships supported');
  },

  // Statistics
  async getStatistics() {
    return {
      totalPostings: 0,
      activePostings: 0,
      totalApplications: 0,
      pendingApplications: 0,
    };
  },
};

export default industryService;
