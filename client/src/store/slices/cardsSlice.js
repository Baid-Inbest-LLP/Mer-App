import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { cardsApi } from '../../api/card.api';

export const fetchCards = createAsyncThunk(
  'cards/fetchAll',
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await cardsApi.getAll(params);
      return {
        items: data.data,
        total: data.pagination?.total ?? data.data?.length ?? 0,
      };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch cards');
    }
  },
);

export const createCard = createAsyncThunk(
  'cards/create',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await cardsApi.create(payload);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to create card');
    }
  },
);

export const updateCard = createAsyncThunk(
  'cards/update',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const { data: res } = await cardsApi.update(id, data);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update card');
    }
  },
);

export const deleteCard = createAsyncThunk(
  'cards/delete',
  async (id, { rejectWithValue }) => {
    try {
      await cardsApi.delete(id);
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete card');
    }
  },
);

const cardsSlice = createSlice({
  name: 'cards',
  initialState: {
    items: [],
    total: 0,
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCards.pending, (state) => {
        state.loading = state.items.length === 0;
        state.error = null;
      })
      .addCase(fetchCards.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.items;
        state.total = action.payload.total;
      })
      .addCase(fetchCards.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(createCard.fulfilled, (state, action) => {
        state.items.unshift(action.payload);
        state.total += 1;
      })
      .addCase(updateCard.fulfilled, (state, action) => {
        const idx = state.items.findIndex((item) => item._id === action.payload._id);
        if (idx !== -1) state.items[idx] = action.payload;
      })
      .addCase(deleteCard.fulfilled, (state, action) => {
        state.items = state.items.filter((item) => item._id !== action.payload);
        state.total -= 1;
      });
  },
});

export default cardsSlice.reducer;
