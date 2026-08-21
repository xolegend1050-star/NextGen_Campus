import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD
    ? 'https://nextgen-campus-api.onrender.com/api'
    : '/api');

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor — always read token from localStorage
api.interceptors.request.use(
  (config) => {
    try {
      const raw = localStorage.getItem('nextgen-auth');
      if (raw) {
        const auth = JSON.parse(raw);
        if (auth.state?.token) {
          config.headers.Authorization = `Bearer ${auth.state.token}`;
        }
      }
    } catch (e) {
      // corrupted storage, ignore
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle 401 with one refresh attempt
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
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

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }).catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const raw = localStorage.getItem('nextgen-auth');
        if (!raw) {
          isRefreshing = false;
          processQueue(error);
          return Promise.reject(error);
        }
        const auth = JSON.parse(raw);
        if (!auth?.state?.refreshToken) {
          isRefreshing = false;
          processQueue(error);
          return Promise.reject(error);
        }

        const response = await axios.post(`${API_URL}/auth/refresh`, {
          refreshToken: auth.state.refreshToken
        });

        const { token, refreshToken } = response.data;

        // Update stored tokens
        auth.state.token = token;
        auth.state.refreshToken = refreshToken;
        localStorage.setItem('nextgen-auth', JSON.stringify(auth));

        isRefreshing = false;
        processQueue(null, token);

        // Retry original request
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        processQueue(refreshError);
        // Refresh failed — only clear if we're sure token is expired
        // Don't wipe storage on network errors
        if (refreshError.response?.status === 401) {
          localStorage.removeItem('nextgen-auth');
          window.dispatchEvent(new Event('auth:logout'));
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
