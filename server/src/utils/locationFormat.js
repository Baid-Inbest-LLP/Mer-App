/** BRO 1 → BRO1, hq → HQ */
export const normalizeBranchLabel = (label) =>
  String(label || '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();

/** Branch label only — used in dropdowns, expenses, and MER serial */
export const buildLocationName = (label) => normalizeBranchLabel(label);

/** Normalize stored / submitted location to label-only */
export const toLocationLabel = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  if (raw.includes('—')) {
    return normalizeBranchLabel(raw.split('—')[0]);
  }
  if (raw.includes(' - ')) {
    return normalizeBranchLabel(raw.split(' - ')[0]);
  }
  return normalizeBranchLabel(raw);
};

const LEGACY_TO_LABEL = {
  'HQ — Kolkata': 'HQ',
  'BRO 1 — Jaipur': 'BRO1',
  'BRO 2 — Bengaluru': 'BRO2',
  'HQ - KOLKATA': 'HQ',
  'BRO1 - JAIPUR': 'BRO1',
  'BRO2 - BENGALURU': 'BRO2',
};

export const migrateLegacyLocationNames = async (Expense) => {
  for (const [oldName, label] of Object.entries(LEGACY_TO_LABEL)) {
    await Expense.updateMany({ location: oldName }, { $set: { location: label } });
  }

  const withCitySuffix = await Expense.find({
    location: { $regex: /\s[-—]\s/ },
  })
    .select('location')
    .lean();

  for (const { location } of withCitySuffix) {
    const label = toLocationLabel(location);
    if (label && label !== location) {
      await Expense.updateMany({ location }, { $set: { location: label } });
    }
  }
};
