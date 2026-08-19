import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { reportApi } from '../../api/report.api';

export const fetchReportSummary = createAsyncThunk(
  'report/summary',
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await reportApi.summary(params);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load report');
    }
  },
);

export const fetchHeadSummary = createAsyncThunk(
  'report/heads',
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await reportApi.headSummary(params);
      return Array.isArray(data.data) ? data.data : [];
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load head summary');
    }
  },
);

export const fetchMonthlyReport = createAsyncThunk('report/monthly', async (params) => {
  const { data } = await reportApi.monthly(params);
  return data.data;
});

const initialState = {
  summary: null,
  headSummary: [],
  monthlyReport: [],
  loading: false,
  monthlyReportLoading: false,
  headSummaryLoading: false,
  error: null,
};

const reportSlice = createSlice({
  name: 'report',
  initialState,
  reducers: {
    clearReport: (state) => {
      state.summary = null;
      state.headSummary = [];
      state.monthlyReport = [];
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchReportSummary.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchReportSummary.fulfilled, (state, action) => {
        state.loading = false;
        state.summary = action.payload;
      })
      .addCase(fetchReportSummary.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchHeadSummary.pending, (state) => {
        state.headSummaryLoading = true;
      })
      .addCase(fetchHeadSummary.fulfilled, (state, action) => {
        state.headSummaryLoading = false;
        state.headSummary = action.payload;
      })
      .addCase(fetchHeadSummary.rejected, (state, action) => {
        state.headSummaryLoading = false;
        state.headSummary = [];
        state.error = action.payload || state.error;
      })
      .addCase(fetchMonthlyReport.pending, (state) => {
        state.monthlyReportLoading = true;
      })
      .addCase(fetchMonthlyReport.fulfilled, (state, action) => {
        state.monthlyReportLoading = false;
        state.monthlyReport = action.payload;
      })
      .addCase(fetchMonthlyReport.rejected, (state) => {
        state.monthlyReportLoading = false;
      });
  },
});

export const { clearReport } = reportSlice.actions;
export default reportSlice.reducer;
