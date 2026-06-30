import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { expenseApi } from '../../api/expense.api';

export const fetchExpenses = createAsyncThunk(
  'expense/fetchList',
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await expenseApi.list(params);
      return { expenses: data.data, pagination: data.pagination };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load expenses');
    }
  },
);

export const fetchExpense = createAsyncThunk(
  'expense/fetchOne',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await expenseApi.get(id);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Expense not found');
    }
  },
);

export const createExpense = createAsyncThunk(
  'expense/create',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await expenseApi.create(payload);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to create expense');
    }
  },
);

export const updateExpense = createAsyncThunk(
  'expense/update',
  async ({ id, ...payload }, { rejectWithValue }) => {
    try {
      const { data } = await expenseApi.update(id, payload);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update expense');
    }
  },
);

export const deleteExpense = createAsyncThunk(
  'expense/delete',
  async (id, { rejectWithValue }) => {
    try {
      await expenseApi.remove(id);
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete expense');
    }
  },
);

export const approveExpense = createAsyncThunk(
  'expense/approve',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await expenseApi.approve(id);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to approve entry');
    }
  },
);

export const completeExpense = createAsyncThunk(
  'expense/complete',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await expenseApi.complete(id);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to complete entry');
    }
  },
);

const initialState = {
  list: [],
  current: null,
  pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
  loading: false,
  error: null,
  queryParams: {},
};

const expenseSlice = createSlice({
  name: 'expense',
  initialState,
  reducers: {
    setQueryParams: (state, action) => {
      state.queryParams = action.payload;
    },
    clearCurrent: (state) => {
      state.current = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchExpenses.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchExpenses.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload.expenses;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchExpenses.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchExpense.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.current = null;
      })
      .addCase(fetchExpense.fulfilled, (state, action) => {
        state.loading = false;
        state.current = action.payload;
      })
      .addCase(fetchExpense.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.current = null;
      })
      .addCase(createExpense.fulfilled, (state, action) => {
        state.list.unshift(action.payload);
      })
      .addCase(updateExpense.fulfilled, (state, action) => {
        state.current = action.payload;
        const idx = state.list.findIndex((e) => e._id === action.payload._id);
        if (idx >= 0) state.list[idx] = action.payload;
      })
      .addCase(deleteExpense.fulfilled, (state, action) => {
        state.list = state.list.filter((e) => e._id !== action.payload);
      })
      .addCase(approveExpense.fulfilled, (state, action) => {
        state.current = action.payload;
        const idx = state.list.findIndex((e) => e._id === action.payload._id);
        if (idx >= 0) state.list[idx] = action.payload;
      })
      .addCase(completeExpense.fulfilled, (state, action) => {
        state.current = action.payload;
        const idx = state.list.findIndex((e) => e._id === action.payload._id);
        if (idx >= 0) state.list[idx] = action.payload;
      });
  },
});

export const { setQueryParams, clearCurrent } = expenseSlice.actions;
export default expenseSlice.reducer;
