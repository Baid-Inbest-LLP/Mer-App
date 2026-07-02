import { lazy } from 'react';
import { withChartSuspense } from './LazyChartBoundary';

export const ExpenseTrendChart = withChartSuspense(lazy(() => import('./ExpenseTrendChart')));
export const CompanyWiseChart = withChartSuspense(lazy(() => import('./CompanyWiseChart')));
export const PieChartCard = withChartSuspense(lazy(() => import('./PieChartCard')));
export const BarChartCard = withChartSuspense(lazy(() => import('./BarChartCard')));
