import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { authApi } from '../../api/auth.api';
import { STORAGE_KEYS } from '../../constants';

export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const { data } = await authApi.login({ email, password });
      const { user, accessToken, refreshToken } = data.data;
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      return { user, accessToken, refreshToken };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Login failed');
    }
  },
);

export const fetchMe = createAsyncThunk('auth/fetchMe', async (_, { rejectWithValue }) => {
  try {
    const { data } = await authApi.getMe();
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.data));
    return data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to load profile');
  }
});

export const logout = createAsyncThunk('auth/logout', async () => {
  try {
    await authApi.logout();
  } catch {
    /* ignore */
  }
  localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.USER);
});

const storedUser = localStorage.getItem(STORAGE_KEYS.USER);
const initialState = {
  user: storedUser ? JSON.parse(storedUser) : null,
  isAuthenticated: !!localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN),
  loading: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    hydrateAuth: (state) => {
      const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      const user = localStorage.getItem(STORAGE_KEYS.USER);
      state.isAuthenticated = !!token;
      state.user = user ? JSON.parse(user) : null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.isAuthenticated = true;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.user = action.payload;
        state.isAuthenticated = true;
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.isAuthenticated = false;
      });
  },
});

export const { clearError, hydrateAuth } = authSlice.actions;
export default authSlice.reducer;
