/** BRO 1 → BRO1, hq → HQ */
export const normalizeBranchLabel = (label) =>
  String(label || '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
