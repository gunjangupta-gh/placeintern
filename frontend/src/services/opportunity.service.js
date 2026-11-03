import API from './api';

const resolveRawFile = (file) => file?.originFileObj || file;

const clean = (params = {}) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));

const uploadForm = (file) => {
  const formData = new FormData();
  formData.append('file', resolveRawFile(file));
  return formData;
};

/** Pull a readable message out of an API error (handles string / array / object messages). */
export const getErrorMessage = (err, fallback = 'Something went wrong') => {
  const data = err?.response?.data;
  const msg = data?.message ?? data?.error?.message ?? err?.message;
  if (Array.isArray(msg)) return msg.join(', ');
  if (msg && typeof msg === 'object') return msg.message || fallback;
  return msg || fallback;
};

/**
 * Internship opportunities: State Directorate management, student browsing/applying,
 * and read-only principal / faculty views. Response unwrapping is done centrally in api.js.
 */
export const opportunityService = {
  // ---------------- State Directorate ----------------
  async downloadTemplate() {
    const response = await API.get('/state/opportunities/template', { responseType: 'blob' });
    return response.data;
  },
  async previewImport(file) {
    const response = await API.post('/state/opportunities/import/preview', uploadForm(file), {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  async confirmImport(file, skipInvalid = false) {
    const response = await API.post(
      `/state/opportunities/import/confirm?skipInvalid=${skipInvalid ? 'true' : 'false'}`,
      uploadForm(file),
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  },
  async list(params) {
    const response = await API.get('/state/opportunities', { params: clean(params) });
    return response.data;
  },
  async update(id, body) {
    const response = await API.patch(`/state/opportunities/${id}`, body);
    return response.data;
  },
  async remove(id) {
    const response = await API.delete(`/state/opportunities/${id}`);
    return response.data;
  },
  async listApplications(params) {
    const response = await API.get('/state/opportunities/applications', { params: clean(params) });
    return response.data;
  },
  async getOne(id) {
    const response = await API.get(`/state/opportunities/${id}`);
    return response.data;
  },
  /** Excel with Applications, Selected Students and Opportunities sheets (same filters as the list). */
  async exportApplications(params) {
    const response = await API.get('/state/opportunities/applications/export', {
      params: clean(params),
      responseType: 'blob',
      timeout: 120000,
    });
    return response.data;
  },
  /** action: APPROVE | REJECT | DELETE */
  async decideApplications(action, applicationIds, remarks) {
    const response = await API.post('/state/opportunities/applications/bulk', {
      action,
      applicationIds,
      ...(remarks ? { remarks } : {}),
    });
    return response.data;
  },

  // ---------------- Student ----------------
  async listEligible(params) {
    const response = await API.get('/internships/eligible', { params: clean(params) });
    return response.data;
  },
  async apply(id) {
    const response = await API.post(`/internships/${id}/apply`);
    return response.data;
  },

  // ---------------- Principal / Teacher / Faculty Coordinator (read-only) ----------------
  async institutionList(base, params) {
    const response = await API.get(`/${base}/opportunities`, { params: clean(params) });
    return response.data;
  },
  async institutionApplications(base, params) {
    const response = await API.get(`/${base}/opportunities/applications`, { params: clean(params) });
    return response.data;
  },
  async institutionIncompleteProfiles(base, params) {
    const response = await API.get(`/${base}/opportunities/incomplete-profiles`, { params: clean(params) });
    return response.data;
  },
};

export const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      })
    : '-';
