import API from './api';

export const helpSupportService = {
  // ==================== SUPPORT TICKETS ====================

  /**
   * Create a new support ticket
   * @param {Object} data - Ticket data (subject, description, category, priority, attachments)
   * @returns {Promise} - Created ticket
   */
  async createTicket(data) {
    const response = await API.post('/support/tickets', data);
    return response.data;
  },

  /**
   * Get current user's tickets
   * @returns {Promise} - List of user's tickets
   */
  async getMyTickets() {
    const response = await API.get('/support/tickets/my-tickets');
    return response.data;
  },

  /**
   * Get all tickets (admin only)
   * @param {Object} filters - Optional filters (status, category, priority, assignedToId, fromDate, toDate)
   * @returns {Promise} - List of all tickets
   */
  async getAllTickets(filters = {}) {
    const queryParams = new URLSearchParams(filters).toString();
    const response = await API.get(`/support/tickets?${queryParams}`);
    return response.data;
  },

  /**
   * Get ticket by ID
   * @param {string} id - Ticket ID
   * @returns {Promise} - Ticket details
   */
  async getTicketById(id) {
    const response = await API.get(`/support/tickets/${id}`);
    return response.data;
  },

  /**
   * Respond to a ticket
   * @param {string} id - Ticket ID
   * @param {string} message - Response message
   * @param {string[]} attachments - Optional attachments
   * @param {boolean} isInternal - Internal note flag (admin only)
   * @returns {Promise} - Created response
   */
  async respondToTicket(id, message, attachments = [], isInternal = false) {
    const response = await API.post(`/support/tickets/${id}/respond`, {
      message,
      attachments,
      isInternal,
    });
    return response.data;
  },

  /**
   * Assign ticket to a user (admin only)
   * @param {string} id - Ticket ID
   * @param {string} assigneeId - User ID to assign to
   * @param {string} remarks - Optional remarks
   * @returns {Promise} - Updated ticket
   */
  async assignTicket(id, assigneeId, remarks = null) {
    const data = { assigneeId };
    if (remarks) data.remarks = remarks;
    const response = await API.patch(`/support/tickets/${id}/assign`, data);
    return response.data;
  },

  /**
   * Update ticket status (admin only)
   * @param {string} id - Ticket ID
   * @param {string} status - New status
   * @param {string} remarks - Optional remarks
   * @returns {Promise} - Updated ticket
   */
  async updateTicketStatus(id, status, remarks = null) {
    const data = { status };
    if (remarks) data.remarks = remarks;
    const response = await API.patch(`/support/tickets/${id}/status`, data);
    return response.data;
  },

  /**
   * Resolve a ticket (admin only)
   * @param {string} id - Ticket ID
   * @param {string} resolution - Resolution description
   * @param {string} remarks - Optional remarks
   * @returns {Promise} - Updated ticket
   */
  async resolveTicket(id, resolution, remarks = null) {
    const data = { resolution };
    if (remarks) data.remarks = remarks;
    const response = await API.patch(`/support/tickets/${id}/resolve`, data);
    return response.data;
  },

  /**
   * Close a ticket (admin only)
   * @param {string} id - Ticket ID
   * @param {string} closureRemarks - Optional closure remarks
   * @returns {Promise} - Updated ticket
   */
  async closeTicket(id, closureRemarks = null) {
    const data = closureRemarks ? { closureRemarks } : {};
    const response = await API.patch(`/support/tickets/${id}/close`, data);
    return response.data;
  },

  /**
   * Get ticket statistics (admin only)
   * @returns {Promise} - Statistics object
   */
  async getTicketStatistics() {
    const response = await API.get('/support/tickets/statistics');
    return response.data;
  },

  /**
   * Get assignable users for ticket assignment (admin only)
   * @returns {Promise} - List of assignable users
   */
  async getAssignableUsers() {
    const response = await API.get('/support/tickets/assignable-users');
    return response.data;
  },

  // ==================== FAQ / KNOWLEDGE BASE ====================

  /**
   * Get all published FAQ articles
   * @returns {Promise} - List of published FAQs
   */
  async getPublishedFAQs() {
    const response = await API.get('/support/faq');
    return response.data;
  },

  /**
   * Search FAQ articles
   * @param {string} query - Search query
   * @returns {Promise} - Search results
   */
  async searchFAQs(query) {
    const response = await API.get(`/support/faq/search?q=${encodeURIComponent(query)}`);
    return response.data;
  },

  /**
   * Get FAQ categories with article counts
   * @returns {Promise} - Categories with counts
   */
  async getFAQCategories() {
    const response = await API.get('/support/faq/categories');
    return response.data;
  },

  /**
   * Get popular FAQ articles
   * @param {number} limit - Number of articles to return
   * @returns {Promise} - List of popular FAQs
   */
  async getPopularFAQs(limit = 10) {
    const response = await API.get(`/support/faq/popular?limit=${limit}`);
    return response.data;
  },

  /**
   * Get FAQs by category
   * @param {string} category - Category name
   * @returns {Promise} - List of FAQs in category
   */
  async getFAQsByCategory(category) {
    const response = await API.get(`/support/faq/category/${category}`);
    return response.data;
  },

  /**
   * Get FAQ by slug (for public view)
   * @param {string} slug - Article slug
   * @returns {Promise} - FAQ article
   */
  async getFAQBySlug(slug) {
    const response = await API.get(`/support/faq/slug/${slug}`);
    return response.data;
  },

  /**
   * Mark FAQ as helpful
   * @param {string} id - FAQ ID
   * @returns {Promise} - Updated FAQ
   */
  async markFAQHelpful(id) {
    const response = await API.post(`/support/faq/${id}/helpful`);
    return response.data;
  },

  // ==================== FAQ ADMIN ENDPOINTS ====================

  /**
   * Get all FAQ articles including drafts (admin only)
   * @returns {Promise} - All FAQs
   */
  async getAllFAQsAdmin() {
    const response = await API.get('/support/faq/admin/all');
    return response.data;
  },

  /**
   * Get FAQ by ID (admin only)
   * @param {string} id - FAQ ID
   * @returns {Promise} - FAQ article
   */
  async getFAQById(id) {
    const response = await API.get(`/support/faq/admin/${id}`);
    return response.data;
  },

  /**
   * Create FAQ article (admin only)
   * @param {Object} data - FAQ data
   * @returns {Promise} - Created FAQ
   */
  async createFAQ(data) {
    const response = await API.post('/support/faq', data);
    return response.data;
  },

  /**
   * Update FAQ article (admin only)
   * @param {string} id - FAQ ID
   * @param {Object} data - Updated data
   * @returns {Promise} - Updated FAQ
   */
  async updateFAQ(id, data) {
    const response = await API.put(`/support/faq/${id}`, data);
    return response.data;
  },

  /**
   * Delete FAQ article (admin only)
   * @param {string} id - FAQ ID
   * @returns {Promise} - Delete result
   */
  async deleteFAQ(id) {
    const response = await API.delete(`/support/faq/${id}`);
    return response.data;
  },
};

// Constants for use in components
export const SUPPORT_CATEGORIES = {
  TECHNICAL_ISSUES: { value: 'TECHNICAL_ISSUES', label: 'Technical Issues', color: 'red' },
  ACCOUNT_PROFILE: { value: 'ACCOUNT_PROFILE', label: 'Account & Profile', color: 'blue' },
  FEATURE_GUIDANCE: { value: 'FEATURE_GUIDANCE', label: 'Feature Guidance', color: 'green' },
  DATA_REPORTS: { value: 'DATA_REPORTS', label: 'Data & Reports', color: 'orange' },
  INTERNSHIP_QUERIES: { value: 'INTERNSHIP_QUERIES', label: 'Internship Queries', color: 'purple' },
  GENERAL_INQUIRIES: { value: 'GENERAL_INQUIRIES', label: 'General Inquiries', color: 'cyan' },
};

export const TICKET_STATUS = {
  OPEN: { value: 'OPEN', label: 'Open', color: 'blue' },
  ASSIGNED: { value: 'ASSIGNED', label: 'Assigned', color: 'geekblue' },
  IN_PROGRESS: { value: 'IN_PROGRESS', label: 'In Progress', color: 'processing' },
  PENDING_USER: { value: 'PENDING_USER', label: 'Pending User', color: 'warning' },
  RESOLVED: { value: 'RESOLVED', label: 'Resolved', color: 'success' },
  CLOSED: { value: 'CLOSED', label: 'Closed', color: 'default' },
};

export const TICKET_PRIORITY = {
  LOW: { value: 'LOW', label: 'Low', color: 'green' },
  MEDIUM: { value: 'MEDIUM', label: 'Medium', color: 'orange' },
  HIGH: { value: 'HIGH', label: 'High', color: 'red' },
  URGENT: { value: 'URGENT', label: 'Urgent', color: 'magenta' },
};

export default helpSupportService;
