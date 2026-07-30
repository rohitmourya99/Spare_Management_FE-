import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';

// Helper: retrieve Auth Token from Zustand store or directly from localStorage
const getStoredToken = (): string | null => {
  const storeToken = useAuthStore.getState().token;
  if (storeToken) return storeToken;
  try {
    const raw = localStorage.getItem('spare-ims-auth');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.state?.token) return parsed.state.token;
    }
  } catch (e) {
    // Ignore parse error
  }
  return localStorage.getItem('token') || localStorage.getItem('accessToken');
};

const getApiBaseUrl = (): string => {
  return (
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    'https://spare-ims-backend.onrender.com/api'
  );
};

const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach token automatically to all outbound requests
api.interceptors.request.use(
  (config) => {
    const token = getStoredToken();
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401 Unauthorized gracefully & prevent infinite re-fetch loops
let isRedirectingToLogin = false;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isAuthRoute =
      originalRequest?.url?.includes('/auth/login') ||
      originalRequest?.url?.includes('/auth/refresh-token');

    if (error.response?.status === 401 && !isAuthRoute) {
      if (!originalRequest._retry) {
        originalRequest._retry = true;
        const refreshToken = useAuthStore.getState().refreshToken;

        if (refreshToken) {
          try {
            const baseURL = getApiBaseUrl();
            const res = await axios.post(`${baseURL}/auth/refresh-token`, { refreshToken });
            const { accessToken, refreshToken: newRefreshToken } = res.data.data;

            useAuthStore.getState().setTokens(accessToken, newRefreshToken);
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            }
            return api(originalRequest);
          } catch (refreshError) {
            // Refresh failed
          }
        }
      }

      // Logout cleanly & redirect once to /login
      useAuthStore.getState().logout();
      if (!isRedirectingToLogin && window.location.pathname !== '/login') {
        isRedirectingToLogin = true;
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;
