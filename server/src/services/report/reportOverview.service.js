import { Expense } from '../../models/Expense.js';
import { Company } from '../../models/Company.js';
import { buildExpenseQuery } from '../../utils/queryBuilder.js';
import { getFinancialYear } from '../../config/index.js';
import {
  buildMonthlyReportNo,
  buildFyReportNo,
} from '../../utils/merReportSerial.js';
import { reportMerTypeAddFieldsStage, REPORT_MER_TYPES } from '../../utils/reportMerType.js';
import {
  baseMatch,
  REPORT_MONEY_GROUP,
  pickMoney,
  emptyTotals,
  sortMonthlyRows,
  sortFyRows,
} from './reportShared.js';

export const getMonthlyReport = async (query) => {
  const filter = buildExpenseQuery(query);
  const financialYear = query.financialYear || getFinancialYear();

  const [typedRows, combinedRows, companies] = await Promise.all([
    Expense.aggregate([
      { $match: baseMatch(filter) },
      reportMerTypeAddFieldsStage,
      {
        $group: {
          _id: { company: '$company', month: '$month', merType: '$reportMerType' },
          ...REPORT_MONEY_GROUP,
        },
      },
    ]),
    Expense.aggregate([
      { $match: baseMatch(filter) },
      {
        $group: {
          _id: { company: '$company', month: '$month' },
          ...REPORT_MONEY_GROUP,
        },
      },
    ]),
    Company.find({ isActive: { $ne: false } }).select('name code').lean(),
  ]);

  const codeByName = Object.fromEntries(
    companies.filter((c) => c.name && c.code).map((c) => [c.name, c.code]),
  );

  const statsByKey = new Map();

  for (const row of combinedRows) {
    if (!row._id?.company || !row._id?.month) continue;
    const key = `${row._id.company}|${row._id.month}`;
    statsByKey.set(`${key}|combined`, {
      company: row._id.company,
      month: row._id.month,
      merType: 'combined',
      ...pickMoney(row),
    });
  }

  for (const row of typedRows) {
    if (!row._id?.company || !row._id?.month) continue;
    const merType = row._id.merType;
    if (merType !== 'bank' && merType !== 'cash') continue;
    const key = `${row._id.company}|${row._id.month}|${merType}`;
    statsByKey.set(key, {
      company: row._id.company,
      month: row._id.month,
      merType,
      ...pickMoney(row),
    });
  }

  const companyMonths = [...statsByKey.values()]
    .filter((row) => row.merType === 'combined')
    .map((row) => ({ company: row.company, month: row.month }));

  const mapped = [];

  for (const { company, month } of companyMonths) {
    const companyCode = codeByName[company] || '';
    const prefix = `${company}|${month}`;

    for (const merType of REPORT_MER_TYPES) {
      const stats = statsByKey.get(`${prefix}|${merType}`) || {
        ...emptyTotals(),
        company,
        month,
        merType,
      };

      mapped.push({
        company,
        month,
        companyCode,
        merType,
        ...pickMoney(stats),
        reportNo: buildMonthlyReportNo({
          companyCode,
          month,
          financialYear,
          merType,
          reportScope: query.reportScope,
        }),
      });
    }
  }

  return sortMonthlyRows(mapped);
};

export const getFinancialYearReport = async (query) => {
  const filter = buildExpenseQuery(query);

  const [typedRows, combinedRows, companies] = await Promise.all([
    Expense.aggregate([
      { $match: baseMatch(filter) },
      reportMerTypeAddFieldsStage,
      {
        $group: {
          _id: {
            company: '$company',
            financialYear: '$financialYear',
            merType: '$reportMerType',
          },
          ...REPORT_MONEY_GROUP,
        },
      },
    ]),
    Expense.aggregate([
      { $match: baseMatch(filter) },
      {
        $group: {
          _id: { company: '$company', financialYear: '$financialYear' },
          ...REPORT_MONEY_GROUP,
        },
      },
    ]),
    Company.find({ isActive: { $ne: false } }).select('name code').lean(),
  ]);

  const codeByName = Object.fromEntries(
    companies.filter((c) => c.name && c.code).map((c) => [c.name, c.code]),
  );

  const statsByKey = new Map();

  for (const row of combinedRows) {
    if (!row._id?.company || !row._id?.financialYear) continue;
    const key = `${row._id.company}|${row._id.financialYear}`;
    statsByKey.set(`${key}|combined`, {
      company: row._id.company,
      financialYear: row._id.financialYear,
      merType: 'combined',
      ...pickMoney(row),
    });
  }

  for (const row of typedRows) {
    if (!row._id?.company || !row._id?.financialYear) continue;
    const merType = row._id.merType;
    if (merType !== 'bank' && merType !== 'cash') continue;
    const key = `${row._id.company}|${row._id.financialYear}|${merType}`;
    statsByKey.set(key, {
      company: row._id.company,
      financialYear: row._id.financialYear,
      merType,
      ...pickMoney(row),
    });
  }

  const companyYears = [...statsByKey.values()]
    .filter((row) => row.merType === 'combined')
    .map((row) => ({ company: row.company, financialYear: row.financialYear }));

  const mapped = [];

  for (const { company, financialYear } of companyYears) {
    const companyCode = codeByName[company] || '';
    const prefix = `${company}|${financialYear}`;

    for (const merType of REPORT_MER_TYPES) {
      const stats = statsByKey.get(`${prefix}|${merType}`) || {
        ...emptyTotals(),
        company,
        financialYear,
        merType,
      };

      mapped.push({
        company,
        financialYear,
        companyCode,
        merType,
        ...pickMoney(stats),
        reportNo: buildFyReportNo({
          companyCode,
          financialYear,
          merType,
          reportScope: query.reportScope,
        }),
      });
    }
  }

  return sortFyRows(mapped);
};
