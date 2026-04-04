import axios, { type AxiosError, type AxiosInstance } from 'axios';
import type { BlueprintUploadResponse, DeviationReport } from './blueprints';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface User {
  id: string;
  email: string;
  username: string;
  full_name?: string;
  role: 'admin' | 'user' | 'viewer';
  is_active: boolean;
  created_at: string;
  last_login?: string;
}

export interface Scan {
  id: string;
  filename: string;
  status: string;
  created_at: string;
  detection_count?: number;
}

export interface ScanDetection {
  id: string;
  type: string;
  confidence: number;
  position: { x: number; y: number; z: number };
}

export interface ScanStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  error?: string;
}

export interface BlueprintCompareRequest {
  scan_id: string;
  blueprint_id: string;
  tolerance_mm?: number;
}

export interface RouteEstimateData {
  route_type: string;
  points: Array<{ x: number; y: number; z?: number }>;
  properties?: Record<string, unknown>;
}

export interface QuickEstimateData {
  route_type: string;
  length_feet: number;
}

export interface RouteTypeInfo {
  type: string;
  category: string;
  display_name: string;
  material_categories: string[];
}

class ApiClient {
  private client: AxiosInstance;
  private refreshPromise: Promise<string> | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor: attach Bearer token
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('survai_access_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Response interceptor: handle 401 with token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && originalRequest) {
          const refreshToken = localStorage.getItem('survai_refresh_token');

          if (refreshToken && !originalRequest.url?.includes('/auth/refresh')) {
            try {
              const newToken = await this.refreshAccessToken(refreshToken);
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              return this.client(originalRequest);
            } catch {
              this.clearTokens();
            }
          } else {
            this.clearTokens();
          }
        }

        return Promise.reject(error);
      }
    );
  }

  private async refreshAccessToken(refreshToken: string): Promise<string> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.client
      .post<AuthTokens>('/api/v1/auth/refresh', { refresh_token: refreshToken })
      .then((response) => {
        const { access_token, refresh_token } = response.data;
        localStorage.setItem('survai_access_token', access_token);
        localStorage.setItem('survai_refresh_token', refresh_token);
        return access_token;
      })
      .finally(() => {
        this.refreshPromise = null;
      });

    return this.refreshPromise;
  }

  private clearTokens(): void {
    localStorage.removeItem('survai_access_token');
    localStorage.removeItem('survai_refresh_token');
  }

  // ── Auth ──────────────────────────────────────────────

  async login(email: string, password: string): Promise<AuthTokens> {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    const response = await this.client.post<AuthTokens>('/api/v1/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    localStorage.setItem('survai_access_token', response.data.access_token);
    localStorage.setItem('survai_refresh_token', response.data.refresh_token);

    return response.data;
  }

  async register(email: string, password: string, username: string): Promise<User> {
    const response = await this.client.post<User>('/api/v1/auth/register', {
      email,
      username,
      password,
    });
    return response.data;
  }

  async logout(): Promise<void> {
    try {
      await this.client.post('/api/v1/auth/logout');
    } finally {
      this.clearTokens();
    }
  }

  async getMe(): Promise<User> {
    const response = await this.client.get<User>('/api/v1/auth/me');
    return response.data;
  }

  async exchangeGoogleToken(credential: string): Promise<AuthTokens> {
    const response = await this.client.post<AuthTokens>(
      '/api/v1/auth/oauth/google/token-exchange',
      { credential },
    );
    const tokens = response.data;
    localStorage.setItem('survai_access_token', tokens.access_token);
    localStorage.setItem('survai_refresh_token', tokens.refresh_token);
    return tokens;
  }

  // ── Scans ─────────────────────────────────────────────

  async uploadScan(file: File, onProgress?: (progress: number) => void): Promise<{ scan_id: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.client.post('/api/v1/scans/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });

    return response.data;
  }

  async getScan(id: string): Promise<Scan> {
    const response = await this.client.get<Scan>(`/api/v1/scans/${id}`);
    return response.data;
  }

  async getScans(): Promise<Scan[]> {
    const response = await this.client.get<Scan[]>('/api/v1/scans');
    return response.data;
  }

  async getScanDetections(id: string): Promise<ScanDetection[]> {
    const response = await this.client.get<ScanDetection[]>(`/api/v1/scans/${id}/detections`);
    return response.data;
  }

  async getScanStatus(id: string): Promise<ScanStatus> {
    const response = await this.client.get<ScanStatus>(`/api/v1/scans/${id}/status`);
    return response.data;
  }

  // ── Blueprints & Deviations ───────────────────────────

  async uploadBlueprint(scanId: string, file: File): Promise<BlueprintUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.client.post<BlueprintUploadResponse>(
      `/api/v1/scans/${scanId}/blueprints/upload`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );

    return response.data;
  }

  async compareBlueprint(req: BlueprintCompareRequest): Promise<DeviationReport> {
    const response = await this.client.post<DeviationReport>('/api/v1/blueprints/compare', req);
    return response.data;
  }

  async getDeviations(blueprintId: string): Promise<DeviationReport> {
    const response = await this.client.get<DeviationReport>(
      `/api/v1/blueprints/${blueprintId}/deviations`
    );
    return response.data;
  }

  async exportDeviationDXF(blueprintId: string): Promise<Blob> {
    const response = await this.client.get(
      `/api/v1/blueprints/${blueprintId}/deviations/export/dxf`,
      { responseType: 'blob' }
    );
    return response.data;
  }

  // ── Route Cost Estimation ─────────────────────────────

  async estimateRouteCost(data: RouteEstimateData): Promise<Record<string, unknown>> {
    const response = await this.client.post('/api/v1/materials/estimate', data);
    return response.data;
  }

  async quickEstimate(data: QuickEstimateData): Promise<Record<string, unknown>> {
    const response = await this.client.post('/api/v1/materials/estimate/quick', data);
    return response.data;
  }

  async getRouteTypes(): Promise<RouteTypeInfo[]> {
    const response = await this.client.get<RouteTypeInfo[]>('/api/v1/materials/route-types');
    return response.data;
  }

  async getLaborRates(): Promise<Record<string, number>> {
    const response = await this.client.get<Record<string, number>>('/api/v1/materials/labor-rates');
    return response.data;
  }

  /** Expose the raw axios instance for advanced use */
  get instance(): AxiosInstance {
    return this.client;
  }
}

export const api = new ApiClient();
export default api;
