import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { bankAccountsApi } from '../../api/bankAccount.api';

export const fetchBankAccounts = createAsyncThunk(
  'bankAccounts/fetchAll',
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await bankAccountsApi.getAll(params);
      return {
        items: data.data,
        total: data.pagination?.total ?? data.data?.length ?? 0,
      };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch bank accounts');
    }
  },
);

export const createBankAccount = createAsyncThunk(
  'bankAccounts/create',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await bankAccountsApi.create(payload);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to create bank account');
    }
  },
);

export const updateBankAccount = createAsyncThunk(
  'bankAccounts/update',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const { data: res } = await bankAccountsApi.update(id, data);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update bank account');
    }
  },
);

export const deleteBankAccount = createAsyncThunk(
  'bankAccounts/delete',
  async (id, { rejectWithValue }) => {
    try {
      await bankAccountsApi.delete(id);
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete bank account');
    }
  },
);

const bankAccountsSlice = createSlice({
  name: 'bankAccounts',
  initialState: {
    items: [],
    total: 0,
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchBankAccounts.pending, (state) => {
        state.loading = state.items.length === 0;
        state.error = null;
      })
      .addCase(fetchBankAccounts.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.items;
        state.total = action.payload.total;
      })
      .addCase(fetchBankAccounts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(createBankAccount.fulfilled, (state, action) => {
        state.items.unshift(action.payload);
        state.total += 1;
      })
      .addCase(updateBankAccount.fulfilled, (state, action) => {
        const idx = state.items.findIndex((item) => item._id === action.payload._id);
        if (idx !== -1) state.items[idx] = action.payload;
      })
      .addCase(deleteBankAccount.fulfilled, (state, action) => {
        state.items = state.items.filter((item) => item._id !== action.payload);
        state.total -= 1;
      });
  },
});

export default bankAccountsSlice.reducer;
