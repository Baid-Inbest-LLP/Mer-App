import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import commonReducer from './slices/commonSlice';
import expenseReducer from './slices/expenseSlice';
import dashboardReducer from './slices/dashboardSlice';
import reportReducer from './slices/reportSlice';
import companiesReducer from './slices/companiesSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    common: commonReducer,
    expense: expenseReducer,
    dashboard: dashboardReducer,
    report: reportReducer,
    companies: companiesReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false }),
});
