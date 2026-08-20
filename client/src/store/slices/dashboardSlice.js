import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { dashboardApi, analyticsApi } from '../../api/dashboard.api';

const chartDataKeys = {
  company: 'companyChart',
  expenseTypes: 'expenseTypes',
  paymentMethods: 'paymentMethods',
  head: 'headAnalytics',
  trends: 'trends',
  daysToClear: 'daysToClear',
  quarterly: 'quarterly',
};

const MONTH_CHART_KEYS = new Set(['company', 'expenseTypes', 'paymentMethods', 'head']);

const createChartThunk = (name, apiFn, chartKey) =>
  createAsyncThunk(`dashboard/${name}`, async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await apiFn(params);
      const body = data.data;
      // Most chart endpoints return { data, selectedMonth, financialYear, ... }.
      // Quarterly still returns a bare array for report-page compatibility.
      if (Array.isArray(body)) {
        return {
          chartKey,
          financialYear: params.financialYear || '',
          data: body,
        };
      }
      return {
        chartKey,
        financialYear: body?.financialYear || params.financialYear || '',
        selectedMonth: body?.selectedMonth,
        fyMonthOptions: body?.fyMonthOptions,
        data: body?.data,
      };
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
export const fetchTrendsChart = createChartThunk('fetchTrendsChart', analyticsApi.trends, 'trends');
export const fetchDaysToClearChart = createChartThunk(
  'fetchDaysToClearChart',
  analyticsApi.daysToClear,
  'daysToClear',
);
export const fetchQuarterlyChart = createChartThunk(
  'fetchQuarterlyChart',
  analyticsApi.quarterly,
  'quarterly',
);

const chartThunks = [
  [fetchCompanyChart, 'company'],
  [fetchExpenseTypesChart, 'expenseTypes'],
  [fetchPaymentMethodsChart, 'paymentMethods'],
  [fetchHeadChart, 'head'],
  [fetchTrendsChart, 'trends'],
  [fetchDaysToClearChart, 'daysToClear'],
  [fetchQuarterlyChart, 'quarterly'],
];

const chartThunkByKey = {
  company: fetchCompanyChart,
  expenseTypes: fetchExpenseTypesChart,
  paymentMethods: fetchPaymentMethodsChart,
  head: fetchHeadChart,
  trends: fetchTrendsChart,
  daysToClear: fetchDaysToClearChart,
  quarterly: fetchQuarterlyChart,
};

export { chartThunkByKey };

const initialChartLoading = {
  company: false,
  expenseTypes: false,
  paymentMethods: false,
  head: false,
  trends: false,
  daysToClear: false,
  quarterly: false,
};

const initialState = {
  data: null,
  loading: false,
  chartLoading: { ...initialChartLoading },
  error: null,
};

const applyChartPayload = (state, payload) => {
  if (!state.data || !payload) return;
  const {
    chartKey,
    selectedMonth,
    financialYear,
    fyMonthOptions,
    data: chartData,
  } = payload;
  const dataKey = chartDataKeys[chartKey];
  if (dataKey && chartData != null) {
    state.data[dataKey] = chartData;
  }

  if (selectedMonth) {
    state.data.selectedMonths = {
      ...state.data.selectedMonths,
      [chartKey]: selectedMonth,
    };
  }

  if (financialYear) {
    state.data.selectedFys = {
      ...state.data.selectedFys,
      [chartKey]: financialYear,
    };
  }

  if (MONTH_CHART_KEYS.has(chartKey) && fyMonthOptions?.length) {
    state.data.chartMonthOptions = {
      ...state.data.chartMonthOptions,
      [chartKey]: fyMonthOptions,
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
