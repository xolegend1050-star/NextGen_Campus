import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('nextgen-auth');
    if (token) {
      const auth = JSON.parse(token);
      if (auth.state?.token) {
        config.headers.Authorization = `Bearer ${auth.state.token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and not already retried
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Try to refresh token
        const auth = JSON.parse(localStorage.getItem('nextgen-auth'));
        if (auth?.state?.refreshToken) {
          const response = await api.post('/auth/refresh', {
            refreshToken: auth.state.refreshToken
          });

          const { token } = response.data;
          
          // Update stored token
          auth.state.token = token;
          localStorage.setItem('nextgen-auth', JSON.stringify(auth));

          // Retry original request
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, logout
        localStorage.removeItem('nextgen-auth');
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;
