import axios from 'axios';

let accessTokenInMemory = '';

export const getAccessTokenInMemory = () => accessTokenInMemory;
export const setAccessTokenInMemory = (token: string) => {
  accessTokenInMemory = token;
};

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = getAccessTokenInMemory();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle auto-refresh
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Avoid infinite loop if refreshing fails
    if (originalRequest.url?.includes('/auth/refresh-token')) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const localRefreshToken = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;

      if (!localRefreshToken) {
        isRefreshing = false;
        return Promise.reject(error);
      }

      try {
        // Read current context from localStorage so we can re-request token under same context
        const savedProfile = typeof window !== 'undefined' ? localStorage.getItem('activeProfile') : null;
        let tenantId = undefined;
        let role = undefined;

        if (savedProfile) {
          try {
            const parsed = JSON.parse(savedProfile);
            tenantId = parsed.tenantId;
            role = parsed.role;
          } catch (_) { }
        }

        const response = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/auth/refresh-token`,
          {
            refreshToken: localRefreshToken,
            tenantId,
            role,
          }
        );

        const { token, refreshToken: newRefreshToken, profile } = response.data;

        setAccessTokenInMemory(token);

        if (typeof window !== 'undefined') {
          localStorage.setItem('refreshToken', newRefreshToken);
          if (profile) {
            localStorage.setItem('activeProfile', JSON.stringify(profile));
          }
        }

        processQueue(null, token);
        isRefreshing = false;

        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;

        // Clear tokens on error and trigger logout event/redirect
        if (typeof window !== 'undefined') {
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('activeProfile');
          localStorage.removeItem('user');
          window.dispatchEvent(new Event('auth-logout'));
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
