import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { dashboardApi, analyticsApi } from '../../api/dashboard.api';

const chartDataKeys = {
  company: 'companyChart',
  expenseTypes: 'expenseTypes',
  paymentMethods: 'paymentMethods',
  head: 'headAnalytics',
};

const createChartThunk = (name, apiFn, chartKey) =>
  createAsyncThunk(`dashboard/${name}`, async ({ month }, { rejectWithValue }) => {
    try {
      const { data } = await apiFn({ month });
      return { chartKey, ...data.data };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load chart');
    }
  });

export const fetchDashboard = createAsyncThunk(
  'dashboard/fetch',
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await dashboardApi.get(params);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load dashboard');
    }
  },
);

export const fetchCompanyChart = createChartThunk(
  'fetchCompanyChart',
  analyticsApi.companyChart,
  'company',
);
export const fetchExpenseTypesChart = createChartThunk(
  'fetchExpenseTypesChart',
  analyticsApi.expenseTypes,
  'expenseTypes',
);
export const fetchPaymentMethodsChart = createChartThunk(
  'fetchPaymentMethodsChart',
  analyticsApi.paymentMethods,
  'paymentMethods',
);
export const fetchHeadChart = createChartThunk('fetchHeadChart', analyticsApi.heads, 'head');

const chartThunks = [
  [fetchCompanyChart, 'company'],
  [fetchExpenseTypesChart, 'expenseTypes'],
  [fetchPaymentMethodsChart, 'paymentMethods'],
  [fetchHeadChart, 'head'],
];

const chartThunkByKey = {
  company: fetchCompanyChart,
  expenseTypes: fetchExpenseTypesChart,
  paymentMethods: fetchPaymentMethodsChart,
  head: fetchHeadChart,
};

export { chartThunkByKey };

const initialChartLoading = {
  company: false,
  expenseTypes: false,
  paymentMethods: false,
  head: false,
};

const initialState = {
  data: null,
  loading: false,
  chartLoading: { ...initialChartLoading },
  error: null,
};

const applyChartPayload = (state, payload) => {
  if (!state.data || !payload) return;
  const { chartKey, selectedMonth, data } = payload;
  const dataKey = chartDataKeys[chartKey];
  if (dataKey) state.data[dataKey] = data;
  if (selectedMonth) {
    state.data.selectedMonths = {
      ...state.data.selectedMonths,
      [chartKey]: selectedMonth,
    };
  }
};

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboard.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDashboard.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchDashboard.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    chartThunks.forEach(([thunk, chartKey]) => {
      builder
        .addCase(thunk.pending, (state) => {
          state.chartLoading[chartKey] = true;
        })
        .addCase(thunk.fulfilled, (state, action) => {
          state.chartLoading[chartKey] = false;
          applyChartPayload(state, action.payload);
        })
        .addCase(thunk.rejected, (state, action) => {
          state.chartLoading[chartKey] = false;
          state.error = action.payload;
        });
    });
  },
});

export default dashboardSlice.reducer;
