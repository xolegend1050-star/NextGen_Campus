import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';
import { disconnectSocket } from '../utils/socket';

const isTokenExpired = (token) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
};

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      otpRequired: false,
      tempToken: null,

      setUser: (user) => set({ user }),

      login: async (email, password, rememberMe = true) => {
        set({ isLoading: true });
        try {
          const response = await api.post('/auth/login', { email, password });
          const { user, token, refreshToken, otp_required, tempToken, message } = response.data;

          // Company users need OTP verification
          if (otp_required) {
            set({
              isLoading: false,
              otpRequired: true,
              tempToken,
              user
            });
            return { success: true, otpRequired: true, message };
          }

          set({
            user,
            token,
            refreshToken,
            isAuthenticated: true,
            isLoading: false
          });

          if (!rememberMe) {
            localStorage.removeItem('nextgen-auth');
          }

          return { success: true };
        } catch (error) {
          set({ isLoading: false });
          return {
            success: false,
            error: error.response?.data?.error || 'Login failed'
          };
        }
      },

      verifyOtp: async (otp) => {
        set({ isLoading: true });
        try {
          const { tempToken } = get();
          const response = await api.post('/auth/verify-otp', { tempToken, otp });
          const { user, token, refreshToken } = response.data;

          set({
            user,
            token,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
            otpRequired: false,
            tempToken: null
          });

          return { success: true };
        } catch (error) {
          set({ isLoading: false });
          return {
            success: false,
            error: error.response?.data?.error || 'OTP verification failed'
          };
        }
      },

      resendOtp: async () => {
        try {
          const { tempToken } = get();
          const response = await api.post('/auth/send-otp', { tempToken });
          return { success: true, message: response.data.message };
        } catch (error) {
          return {
            success: false,
            error: error.response?.data?.error || 'Failed to resend OTP'
          };
        }
      },

      cancelOtp: () => {
        set({ otpRequired: false, tempToken: null, user: null, isLoading: false });
      },

      register: async (data) => {
        set({ isLoading: true });
        try {
          const response = await api.post('/auth/register', data);
          const { user, token, refreshToken } = response.data;

          if (user && token) {
            set({
              user,
              token,
              refreshToken,
              isAuthenticated: true,
              isLoading: false
            });
          } else {
            set({ isLoading: false });
          }

          return { success: true };
        } catch (error) {
          set({ isLoading: false });
          return {
            success: false,
            error: error.response?.data?.error || 'Registration failed'
          };
        }
      },

      googleLogin: async (code, role = 'student') => {
        set({ isLoading: true });
        try {
          const response = await api.post('/auth/google', { code, role });
          const { user, token, refreshToken } = response.data;
          set({ user, token, refreshToken, isAuthenticated: true, isLoading: false });
          return { success: true };
        } catch (error) {
          set({ isLoading: false });
          return { success: false, error: error.response?.data?.error || 'Google login failed' };
        }
      },

      githubLogin: async (code, role = 'student') => {
        set({ isLoading: true });
        try {
          const response = await api.post('/auth/github', { code, role });
          const { user, token, refreshToken } = response.data;
          set({ user, token, refreshToken, isAuthenticated: true, isLoading: false });
          return { success: true };
        } catch (error) {
          set({ isLoading: false });
          return { success: false, error: error.response?.data?.error || 'GitHub login failed' };
        }
      },

      logout: async () => {
        try {
          await api.post('/auth/logout');
        } catch (error) {
          // Logout even if API call fails
        } finally {
          disconnectSocket();
          set({
            user: null,
            token: null,
            refreshToken: null,
            isAuthenticated: false
          });
        }
      },

      refreshAccessToken: async () => {
        const { refreshToken } = get();
        if (!refreshToken) return;

        try {
          const response = await api.post('/auth/refresh', { refreshToken });
          const { token, refreshToken: newRefreshToken } = response.data;
          set({ token, refreshToken: newRefreshToken || refreshToken });
        } catch (error) {
          // Don't logout here — let ProtectedRoute handle it on next auth check
        }
      },

      fetchUser: async () => {
        try {
          const response = await api.get('/auth/me');
          set({ user: response.data.user });
        } catch (error) {
          // Don't logout — the interceptor handles token refresh on 401
        }
      },

      initializeAuth: () => {
        const { token, refreshToken, isAuthenticated } = get();
        // Skip if already authenticated with a valid token
        if (isAuthenticated && token && !isTokenExpired(token)) return;
        // If token is expired but refresh token is valid, attempt refresh
        if (refreshToken && !isTokenExpired(refreshToken)) {
          get().refreshAccessToken();
        } else {
          // Both tokens invalid — clear state
          set({ user: null, token: null, refreshToken: null, isAuthenticated: false });
        }
      }
    }),
    {
      name: 'nextgen-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        otpRequired: state.otpRequired,
        tempToken: state.tempToken
      })
    }
  )
);
