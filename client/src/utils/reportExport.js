import { notifications } from '@mantine/notifications';
import { reportApi } from '../api/report.api';
import { downloadBlob, readBlobError, withExtension } from './download';

/**
 * Download a monthly or FY detailed report as PDF or Excel.
 * @param {object} options
 * @param {Record<string, unknown>} options.params - Query params (already scoped if needed)
 * @param {'pdf' | 'excel'} options.format
 * @param {string} options.filename - Base filename without extension
 */
export async function exportMonthlyReport({ params, format, filename }) {
  const isPdf = format === 'pdf';
  const { data } = isPdf
    ? await reportApi.exportMonthlyPdf(params)
    : await reportApi.exportMonthlyExcel(params);

  if (isPdf && data instanceof Blob && data.type?.includes('json')) {
    throw Object.assign(new Error('PDF export failed'), { response: { data } });
  }

  downloadBlob(data, isPdf ? withExtension(filename, 'pdf') : filename);
}

/** Run export with Mantine toast notifications. */
export async function runMonthlyReportExport({ params, format, filename }) {
  const isPdf = format === 'pdf';
  try {
    await exportMonthlyReport({ params, format, filename });
    notifications.show({
      message: `${isPdf ? 'PDF' : 'Excel'} download started`,
      color: 'green',
    });
  } catch (err) {
    notifications.show({
      message: await readBlobError(err) || `Failed to download ${isPdf ? 'PDF' : 'Excel'}`,
      color: 'red',
    });
    throw err;
  }
}
