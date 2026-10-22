import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD
    ? 'https://nextgen-campus-api.onrender.com/api'
    : '/api');

const api = axios.create({
  baseURL: API_URL,
  // A Render free-tier service that has been idle is asleep, and waking one takes
  // 30-90 seconds. This timeout has to sit well below that, or the first request
  // after a quiet period hangs the interface for the entire boot. 15 seconds is
  // far more than any warm request needs -- the busiest endpoint measured here
  // answers in about 600ms -- and short enough that a stalled call is noticed
  // quickly. The interceptor below retries a read once, which covers the boot.
  timeout: 15000,
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

export const resetAuthState = () => {
  isRefreshing = false;
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // The first request to a service that has been asleep wakes it, so that one
    // request times out while the boot is still running. Retrying once, after the
    // boot has had a few more seconds, usually lands. Only GET is retried: a POST,
    // PUT or DELETE may have been applied before the connection dropped, and
    // replaying it would charge a wallet twice or release an escrow twice.
    //
    // A 401 is not retried here because error.response exists, so it falls through
    // to the refresh logic below untouched.
    const canRetry = originalRequest
      && !originalRequest._retried
      && originalRequest.method === 'get'
      && (!error.response || error.code === 'ECONNABORTED');
    if (canRetry) {
      originalRequest._retried = true;
      await new Promise((resolve) => setTimeout(resolve, 3000));
      return api(originalRequest);
    }

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
          const raw = localStorage.getItem('nextgen-auth');
          let eventToken = null;
          try { eventToken = raw ? JSON.parse(raw).state?.token : null; } catch {}
          localStorage.removeItem('nextgen-auth');
          window.dispatchEvent(new CustomEvent('auth:logout', { detail: { token: eventToken } }));
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
