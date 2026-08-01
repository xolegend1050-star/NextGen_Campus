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

      setUser: (user) => set({ user }),

      login: async (email, password, rememberMe = true) => {
        set({ isLoading: true });
        try {
          const response = await api.post('/auth/login', { email, password });
          const { user, token, refreshToken } = response.data;

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
          const { token } = response.data;

          set({ token });
        } catch (error) {
          get().logout();
        }
      },

      fetchUser: async () => {
        try {
          const response = await api.get('/auth/me');
          set({ user: response.data.user });
        } catch (error) {
          get().logout();
        }
      },

      initializeAuth: () => {
        const { token, refreshToken } = get();
        if (token && !isTokenExpired(token)) {
          return;
        }
        if (refreshToken && !isTokenExpired(refreshToken)) {
          get().refreshAccessToken();
        } else {
          get().logout();
        }
      }
    }),
    {
      name: 'nextgen-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
);
