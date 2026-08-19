import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { masterApi } from '../../api/master.api';

export const fetchExpenseHeads = createAsyncThunk(
  'expenseHeads/fetchAll',
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await masterApi.expenseHeads(params);
      return {
        items: data.data,
        total: data.data?.length ?? 0,
      };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch expense heads');
    }
  },
);

export const createExpenseHead = createAsyncThunk(
  'expenseHeads/create',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await masterApi.createExpenseHead(payload);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to create expense head');
    }
  },
);

export const updateExpenseHead = createAsyncThunk(
  'expenseHeads/update',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const { data: res } = await masterApi.updateExpenseHead(id, data);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update expense head');
    }
  },
);

export const deleteExpenseHead = createAsyncThunk(
  'expenseHeads/delete',
  async (id, { rejectWithValue }) => {
    try {
      await masterApi.deleteExpenseHead(id);
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete expense head');
    }
  },
);

const expenseHeadsSlice = createSlice({
  name: 'expenseHeads',
  initialState: {
    items: [],
    total: 0,
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchExpenseHeads.pending, (state) => {
        state.loading = state.items.length === 0;
        state.error = null;
      })
      .addCase(fetchExpenseHeads.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.items;
        state.total = action.payload.total;
      })
      .addCase(fetchExpenseHeads.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(createExpenseHead.fulfilled, (state, action) => {
        state.items.unshift(action.payload);
        state.total += 1;
      })
      .addCase(updateExpenseHead.fulfilled, (state, action) => {
        const idx = state.items.findIndex((item) => item._id === action.payload._id);
        if (idx !== -1) state.items[idx] = action.payload;
      })
      .addCase(deleteExpenseHead.fulfilled, (state, action) => {
        state.items = state.items.filter((item) => item._id !== action.payload);
        state.total -= 1;
      });
  },
});

export default expenseHeadsSlice.reducer;
