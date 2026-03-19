import axios, { AxiosInstance } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      timeout: 30000,
    });

    this.client.interceptors.request.use((config) => {
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('rakshak_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('rakshak_token');
            localStorage.removeItem('rakshak_user');
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  async login(email: string, password: string) {
    const res = await this.client.post('/auth/login', { email, password });
    return res.data;
  }

  async register(data: { email: string; full_name: string; password: string; role: string; department?: string }) {
    const res = await this.client.post('/auth/register', data);
    return res.data;
  }

  async getMe() {
    const res = await this.client.get('/auth/me');
    return res.data;
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────
  async getDashboardStats() {
    const res = await this.client.get('/dashboard/stats');
    return res.data;
  }

  async getAllAlerts(limit = 20, unreadOnly = false) {
    const res = await this.client.get('/dashboard/alerts', { params: { limit, unread_only: unreadOnly } });
    return res.data;
  }

  async markAlertRead(alertId: string) {
    const res = await this.client.patch(`/dashboard/alerts/${alertId}/read`);
    return res.data;
  }

  async getAuditLogs(limit = 50) {
    const res = await this.client.get('/dashboard/audit-logs', { params: { limit } });
    return res.data;
  }

  // ── Projects ──────────────────────────────────────────────────────────────
  async getMapProjects() {
    const res = await this.client.get('/projects/map');
    return res.data;
  }

  async getProjects(filters?: { status?: string; risk_level?: string; state?: string }) {
    const res = await this.client.get('/projects', { params: filters });
    return res.data;
  }

  async createProject(data: Record<string, unknown>) {
    const res = await this.client.post('/projects', data);
    return res.data;
  }

  async getProject(id: string) {
    const res = await this.client.get(`/projects/${id}`);
    return res.data;
  }

  async updateProject(id: string, data: Record<string, unknown>) {
    const res = await this.client.patch(`/projects/${id}`, data);
    return res.data;
  }

  async getProjectRisk(id: string) {
    const res = await this.client.get(`/projects/${id}/risk`);
    return res.data;
  }

  async getHistory(id: string, limit = 30) {
    const res = await this.client.get(`/projects/${id}/risk/history`, { params: { limit } });
    return res.data;
  }

  async createMilestone(projectId: string, data: Record<string, unknown>) {
    const res = await this.client.post(`/projects/${projectId}/milestones`, data);
    return res.data;
  }

  async updateMilestone(projectId: string, milestoneId: string, data: Record<string, unknown>) {
    const res = await this.client.patch(`/projects/${projectId}/milestones/${milestoneId}`, data);
    return res.data;
  }

  async getProjectAlerts(projectId: string) {
    const res = await this.client.get(`/projects/${projectId}/alerts`);
    return res.data;
  }

  async simulateFailure(projectId: string, scenario: string) {
    const res = await this.client.post(`/projects/${projectId}/simulate-failure`, {
      project_id: projectId,
      scenario,
    });
    return res.data;
  }

  async assignOfficer(projectId: string, officerId: string) {
    const res = await this.client.post(`/projects/${projectId}/assign-officer`, null, {
      params: { officer_id: officerId },
    });
    return res.data;
  }

  // ── Evidence ──────────────────────────────────────────────────────────────
  async uploadEvidence(formData: FormData) {
    const res = await this.client.post('/evidence/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  }

  async getProjectEvidence(projectId: string, validOnly = false) {
    const res = await this.client.get(`/evidence/project/${projectId}`, { params: { valid_only: validOnly } });
    return res.data;
  }

  // ── Contractors ───────────────────────────────────────────────────────────
  async getContractors() {
    const res = await this.client.get('/contractors');
    return res.data;
  }

  async createContractor(data: Record<string, unknown>) {
    const res = await this.client.post('/contractors', data);
    return res.data;
  }
}

export const api = new ApiClient();
