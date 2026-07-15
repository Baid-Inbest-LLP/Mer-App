export const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
};

/** Swap a filename's extension (e.g. report.xlsx -> report.pdf). */
export const withExtension = (filename, ext) =>
  String(filename || 'report').replace(/\.[^.]+$/i, '') + `.${ext}`;
