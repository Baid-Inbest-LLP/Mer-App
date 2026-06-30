import { Company, Location, Expense } from '../models/index.js';
import { COMPANIES_SEED } from './companies.data.js';
import { buildLocationName, migrateLegacyLocationNames } from '../utils/locationFormat.js';

export { buildLocationName };

const dropLegacyLocationNameIndex = async () => {
  try {
    const indexes = await Location.collection.indexes();
    const legacy = indexes.find((idx) => idx.name === 'name_1' && idx.unique);
    if (legacy) {
      await Location.collection.dropIndex('name_1');
    }
  } catch {
    // Index may already be absent
  }
};

/**
 * Upserts production companies and their branches. Safe on every startup.
 */
export const ensureCompanies = async () => {
  await dropLegacyLocationNameIndex();

  for (const entry of COMPANIES_SEED) {
    const { locations, companyCode, ...fields } = entry;

    const company = await Company.findOneAndUpdate(
      { code: companyCode },
      {
        name: fields.name,
        code: companyCode,
        email: fields.email,
        phone: fields.phone,
        taxId: fields.taxId,
        website: fields.website || '',
        logo: fields.logo || '',
        isActive: fields.isActive !== false,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    for (const loc of locations) {
      const name = buildLocationName(loc.label);
      await Location.findOneAndUpdate(
        { company: company._id, label: loc.label },
        {
          company: company._id,
          label: loc.label,
          name,
          code: loc.label,
          street: loc.street,
          city: loc.city,
          state: loc.state,
          zipCode: loc.zipCode,
          country: loc.country,
          isDefault: Boolean(loc.isDefault),
          isActive: true,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }
  }

  await migrateLegacyLocationNames(Expense);
  await Location.updateMany(
    { $or: [{ name: { $regex: '—' } }, { name: { $regex: ' - ' } }] },
    { $set: { isActive: false } },
  );
};
