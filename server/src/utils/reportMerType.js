/**
 * MER monthly report bucketing (bank | cash | combined).
 * Keep aggregation ($addFields) and find() filters in sync.
 */

export const REPORT_MER_TYPES = ['bank', 'cash', 'combined'];

/** Matches expenses classified as cash in monthly report aggregation. */
export const cashReportMerTypeMatch = {
  $or: [
    { merType: 'Cash' },
    {
      $and: [
        { merType: { $ne: 'Bank' } },
        { paymentMethod: 'Cash' },
      ],
    },
  ],
};

/** Matches expenses classified as bank in monthly report aggregation. */
export const bankReportMerTypeMatch = {
  $nor: [
    { merType: 'Cash' },
    {
      $and: [
        { merType: { $ne: 'Bank' } },
        { paymentMethod: 'Cash' },
      ],
    },
  ],
};

export const buildReportMerTypeFilter = (merType) => {
  const param = String(merType || '').trim().toLowerCase();
  if (!param || param === 'combined') return null;
  if (param === 'cash') return cashReportMerTypeMatch;
  if (param === 'bank' || param === 'bnk') return bankReportMerTypeMatch;
  return null;
};

/** MongoDB aggregation stage — adds reportMerType field (bank | cash). */
export const reportMerTypeAddFieldsStage = {
  $addFields: {
    reportMerType: {
      $switch: {
        branches: [
          { case: { $eq: ['$merType', 'Cash'] }, then: 'cash' },
          { case: { $eq: ['$merType', 'Bank'] }, then: 'bank' },
          { case: { $eq: ['$paymentMethod', 'Cash'] }, then: 'cash' },
        ],
        default: 'bank',
      },
    },
  },
};
