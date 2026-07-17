import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { authApi } from '../../api/auth.api';
import { STORAGE_KEYS } from '../../constants';

const persistUser = (user) => {
  if (user) localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
};

export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const { data } = await authApi.login({ email, password });
      const { user, accessToken, refreshToken } = data.data;
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
      persistUser(user);
      return { user, accessToken, refreshToken };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Login failed');
    }
  },
);

export const fetchMe = createAsyncThunk('auth/fetchMe', async (_, { rejectWithValue }) => {
  try {
    const { data } = await authApi.getMe();
    persistUser(data.data);
    return data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to load profile');
  }
});

export const fetchAvatar = createAsyncThunk('auth/fetchAvatar', async (_, { getState, rejectWithValue }) => {
  try {
    if (!getState().auth.user?.hasAvatar) return '';
    const { data } = await authApi.getAvatar();
    return data.data?.avatarPreview || '';
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to load photo');
  }
});

export const updateProfile = createAsyncThunk(
  'auth/updateProfile',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await authApi.updateProfile(payload);
      const { user, avatarPreview } = data.data;
      persistUser(user);
      return { user, avatarPreview: avatarPreview || '' };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update profile');
    }
  },
);

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
  avatarPreview: '',
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
    clearAvatarPreview: (state) => {
      state.avatarPreview = '';
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
        state.avatarPreview = '';
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.user = action.payload;
        state.isAuthenticated = true;
        if (!action.payload?.hasAvatar) state.avatarPreview = '';
      })
      .addCase(fetchAvatar.fulfilled, (state, action) => {
        state.avatarPreview = action.payload || '';
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.avatarPreview = action.payload.avatarPreview || '';
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.avatarPreview = '';
        state.isAuthenticated = false;
      });
  },
});

export const { clearError, hydrateAuth, clearAvatarPreview } = authSlice.actions;
export default authSlice.reducer;
