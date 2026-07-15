import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import * as reportService from '../services/report.service.js';

export const getSummary = asyncHandler(async (req, res) => {
  const summary = await reportService.getReportSummary(req.query);
  ApiResponse.success(res, summary);
});

export const getHeadSummary = asyncHandler(async (req, res) => {
  const data = await reportService.getExpenseHeadSummary(req.query);
  ApiResponse.success(res, data);
});

export const getMonthlyReport = asyncHandler(async (req, res) => {
  const data = await reportService.getMonthlyReport(req.query);
  ApiResponse.success(res, data);
});

export const getFinancialYearReport = asyncHandler(async (req, res) => {
  const data = await reportService.getFinancialYearReport(req.query);
  ApiResponse.success(res, data);
});

export const getMonthlyDetailed = asyncHandler(async (req, res) => {
  const data = await reportService.getMonthlyDetailedReport(req.query);
  ApiResponse.success(res, data);
});

export const exportSummaryExcel = asyncHandler(async (req, res) => {
  const workbook = await reportService.generateSummaryExcel(req.query);
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader('Content-Disposition', 'attachment; filename=mer-summary-report.xlsx');
  await workbook.xlsx.write(res);
  res.end();
});

export const exportMonthlyExcel = asyncHandler(async (req, res) => {
  const { workbook, filename } = await reportService.generateMonthlyExcel(req.query);
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=${filename}`,
  );
  await workbook.xlsx.write(res);
  res.end();
});

export const exportMonthlyPdf = asyncHandler(async (req, res) => {
  const { buffer, filename } = await reportService.generateMonthlyPdf(req.query);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  res.setHeader('Content-Length', String(buffer.length));
  res.end(buffer);
});
