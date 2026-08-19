export const downloadBlob = (blob, filename) => {
  const file = blob instanceof Blob ? blob : new Blob([blob]);
  const url = window.URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || 'download';
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
};

/** Swap a filename's extension (e.g. report.xlsx -> report.pdf). */
export const withExtension = (filename, ext) =>
  String(filename || 'report').replace(/\.[^.]+$/i, '') + `.${ext}`;

/** Read an error message from an axios blob (JSON or text) response. */
export const readBlobError = async (error) => {
  const data = error?.response?.data;
  if (data instanceof Blob) {
    const text = await data.text();
    try {
      const json = JSON.parse(text);
      return json.message || json.error || 'Download failed';
    } catch {
      return text.slice(0, 180) || 'Download failed';
    }
  }
  return error?.response?.data?.message || error?.message || 'Download failed';
};
