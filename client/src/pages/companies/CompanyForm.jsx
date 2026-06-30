import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { notifications } from '@mantine/notifications';
import { createCompany, updateCompany } from '../../store/slices/companiesSlice';
import { companiesApi } from '../../api/company.api';

const readImageFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    if (!file) {
      resolve('');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read image file'));
    reader.readAsDataURL(file);
  });

const PHONE_REGEX = /^(\+91|91)?[6-9]\d{9}$/;
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const emptyLocation = (isFirst = false) => ({
  label: isFirst ? 'HQ' : '',
  street: '',
  city: '',
  state: '',
  zipCode: '',
  country: 'India',
  isDefault: isFirst,
});

const Field = ({ label, required, error, children }) => (
  <div>
    <label className="company-form-field-label">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
  </div>
);

export default function CompanyForm({ company, onClose }) {
  const dispatch = useDispatch();
  const isEdit = Boolean(company);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: '',
    companyCode: '',
    email: '',
    phone: '',
    taxId: '',
    isActive: true,
    locations: [emptyLocation(true)],
  });

  const [errors, setErrors] = useState({});
  const [stampFile, setStampFile] = useState(null);
  const [stampPreview, setStampPreview] = useState('');
  const [stampLoading, setStampLoading] = useState(false);
  const [clearStamp, setClearStamp] = useState(false);

  useEffect(() => {
    if (company) {
      setForm({
        name: company.name || '',
        companyCode: company.companyCode || '',
        email: company.email || '',
        phone: company.phone || '',
        taxId: company.taxId || '',
        isActive: company.isActive !== false,
        locations: company.locations?.length
          ? company.locations.map((l) => ({ ...l }))
          : [emptyLocation(true)],
      });
      setStampFile(null);
      setClearStamp(false);
      setStampPreview('');
      if (company.hasStamp) {
        setStampLoading(true);
        companiesApi
          .getStamp(company._id)
          .then((res) => setStampPreview(res.data?.data?.stampPreview || ''))
          .catch(() => notifications.show({ message: 'Could not load company stamp', color: 'red' }))
          .finally(() => setStampLoading(false));
      }
    } else {
      setStampFile(null);
      setStampPreview('');
      setClearStamp(false);
    }
  }, [company]);

  const onStampFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpeg|jpg|webp)$/i.test(file.type)) {
      notifications.show({ message: 'Stamp must be a PNG or JPEG image', color: 'red' });
      return;
    }
    if (file.size > 1024 * 1024) {
      notifications.show({ message: 'Stamp image must be 1 MB or smaller', color: 'red' });
      return;
    }
    setStampFile(file);
    setClearStamp(false);
    try {
      setStampPreview(await readImageFileAsDataUrl(file));
    } catch {
      notifications.show({ message: 'Could not preview stamp', color: 'red' });
    }
  };

  const validate = () => {
    const errs = {};

    if (!form.name.trim()) errs.name = 'Company name is required';
    if (!form.companyCode.trim()) errs.companyCode = 'Company code is required';
    if (!form.email.trim()) errs.email = 'Email is required';
    else if (!EMAIL_REGEX.test(form.email)) errs.email = 'Enter a valid email address';
    if (!form.phone.trim()) errs.phone = 'Phone number is required';
    else if (!PHONE_REGEX.test(form.phone.replace(/\s/g, ''))) {
      errs.phone = 'Enter a valid Indian phone number (e.g. 9876543210 or +919876543210)';
    }
    if (!form.taxId.trim()) errs.taxId = 'GST No is required';
    else if (!GST_REGEX.test(form.taxId.toUpperCase())) {
      errs.taxId = 'Enter a valid GST number (e.g. 27AAPFU0939F1ZV)';
    }

    form.locations.forEach((loc, i) => {
      if (!loc.label.trim()) errs[`loc_${i}_label`] = 'Location name is required';
      if (!loc.street.trim()) errs[`loc_${i}_street`] = 'Street address is required';
      if (!loc.city.trim()) errs[`loc_${i}_city`] = 'City is required';
      if (!loc.state.trim()) errs[`loc_${i}_state`] = 'State is required';
      if (!loc.zipCode.trim()) errs[`loc_${i}_zipCode`] = 'ZIP code is required';
      if (!loc.country.trim()) errs[`loc_${i}_country`] = 'Country is required';
    });

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleChange = (field, value) => {
    setForm((p) => ({ ...p, [field]: value }));
    if (errors[field]) setErrors((e) => { const n = { ...e }; delete n[field]; return n; });
  };

  const handleLocationChange = (idx, field, value) => {
    setForm((p) => {
      const locations = [...p.locations];
      locations[idx] = { ...locations[idx], [field]: value };
      return { ...p, locations };
    });
    const key = `loc_${idx}_${field}`;
    if (errors[key]) setErrors((e) => { const n = { ...e }; delete n[key]; return n; });
  };

  const setDefault = (idx) => {
    setForm((p) => ({
      ...p,
      locations: p.locations.map((l, i) => ({ ...l, isDefault: i === idx })),
    }));
  };

  const addLocation = () => {
    setForm((p) => ({ ...p, locations: [...p.locations, emptyLocation(false)] }));
  };

  const removeLocation = (idx) => {
    if (form.locations.length <= 1) {
      notifications.show({ message: 'At least one location required', color: 'red' });
      return;
    }
    setForm((p) => {
      const locations = p.locations.filter((_, i) => i !== idx);
      if (!locations.some((l) => l.isDefault)) locations[0].isDefault = true;
      return { ...p, locations };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      notifications.show({ message: 'Please fix the errors before submitting', color: 'red' });
      return;
    }

    setSubmitting(true);
    const payload = { ...form, taxId: form.taxId.toUpperCase() };
    if (clearStamp) {
      payload.clearStamp = true;
    } else if (stampFile) {
      try {
        payload.stampImage = await readImageFileAsDataUrl(stampFile);
      } catch {
        notifications.show({ message: 'Could not read stamp image', color: 'red' });
        setSubmitting(false);
        return;
      }
    }

    const action = isEdit
      ? dispatch(updateCompany({ id: company._id, data: payload }))
      : dispatch(createCompany(payload));

    const result = await action;
    setSubmitting(false);

    if ((isEdit ? updateCompany : createCompany).fulfilled.match(result)) {
      notifications.show({
        message: isEdit ? 'Company updated' : 'Company created',
        color: 'green',
      });
      onClose();
    } else {
      notifications.show({ message: result.payload || 'Something went wrong', color: 'red' });
    }
  };

  const inputCls = (err) =>
    `input-field text-sm ${err ? 'border-red-400 focus:ring-red-400' : ''}`;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 bg-black/40 backdrop-blur-sm overflow-y-auto">
      <div className="company-form-panel">
        <div className="company-form-header">
          <div>
            <h2 className="company-form-title">
              {isEdit ? 'Edit Company' : 'Add New Company'}
            </h2>
            <p className="company-form-subtitle">
              {isEdit ? 'Update company info and locations' : 'Add company details and branch locations'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="company-form-close-btn">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <h3 className="company-form-section-title mb-3">
              Company Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Field label="Company Name" required error={errors.name}>
                  <input
                    className={inputCls(errors.name)}
                    placeholder="Baid Inbest Llp"
                    value={form.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                  />
                </Field>
              </div>

              <Field label="Company Code" required error={errors.companyCode}>
                <input
                  className={`${inputCls(errors.companyCode)} font-mono`}
                  placeholder="e.g. BILLP"
                  value={form.companyCode}
                  onChange={(e) => handleChange('companyCode', e.target.value.toUpperCase())}
                />
              </Field>

              <Field label="Email" required error={errors.email}>
                <input
                  type="email"
                  className={inputCls(errors.email)}
                  placeholder="info@company.com"
                  value={form.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                />
              </Field>

              <Field label="Phone" required error={errors.phone}>
                <input
                  className={inputCls(errors.phone)}
                  placeholder="9876543210 or +919876543210"
                  maxLength={13}
                  value={form.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                />
              </Field>

              <Field label="GST No" required error={errors.taxId}>
                <input
                  className={`${inputCls(errors.taxId)} uppercase`}
                  placeholder="e.g. 27AAPFU0939F1ZV"
                  maxLength={15}
                  value={form.taxId}
                  onChange={(e) => handleChange('taxId', e.target.value.toUpperCase())}
                />
              </Field>
            </div>

            <div className="flex items-center gap-2 mt-3">
              <input
                type="checkbox"
                id="companyActive"
                className="rounded"
                checked={form.isActive}
                onChange={(e) => handleChange('isActive', e.target.checked)}
              />
              <label htmlFor="companyActive" className="company-form-checkbox-label">Active company</label>
            </div>

            <div className="mt-4 pt-4 company-form-divider">
              <label className="company-form-field-label">
                Company stamp <span className="company-form-stamp-hint">(optional)</span>
              </label>
              {stampLoading ? (
                <p className="company-form-stamp-loading">Loading stamp…</p>
              ) : (
                <>
                  {stampPreview && !clearStamp ? (
                    <div className="company-form-stamp-preview">
                      <img
                        src={stampPreview}
                        alt="Stamp preview"
                        className="max-h-24 max-w-full object-contain mx-auto"
                      />
                    </div>
                  ) : (
                    <p className="company-form-stamp-empty">No stamp on file</p>
                  )}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    className="input-field text-sm py-2"
                    onChange={onStampFileChange}
                  />
                  {stampPreview && !clearStamp ? (
                    <button
                      type="button"
                      className="company-form-stamp-remove"
                      onClick={() => {
                        setClearStamp(true);
                        setStampFile(null);
                        setStampPreview('');
                      }}
                    >
                      Remove stamp
                    </button>
                  ) : null}
                </>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="company-form-section-title">
                  Locations / Branch Addresses
                </h3>
                <p className="company-form-section-hint">Add one or more locations for this company</p>
              </div>
              <button type="button" onClick={addLocation} className="btn-secondary text-xs py-1.5 px-3">
                + Add Location
              </button>
            </div>

            <div className="space-y-4">
              {form.locations.map((loc, idx) => (
                <div
                  key={loc._id || `new-${idx}`}
                  className={`company-location-form-card ${
                    loc.isDefault ? 'company-location-form-card--default' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={`company-location-index ${
                          loc.isDefault ? 'company-location-index--default' : ''
                        }`}
                      >
                        {idx + 1}
                      </div>
                      <span className="company-location-form-title">
                        {(loc.label || `Location ${idx + 1}`)?.toUpperCase?.()}
                      </span>
                      {loc.isDefault && (
                        <span className="company-location-default-pill">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {!loc.isDefault && (
                        <button
                          type="button"
                          onClick={() => setDefault(idx)}
                          className="company-location-set-default"
                        >
                          Set as default
                        </button>
                      )}
                      {form.locations.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLocation(idx)}
                          className="company-location-remove-btn"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Field label="Location Name" required error={errors[`loc_${idx}_label`]}>
                        <input
                          className={inputCls(errors[`loc_${idx}_label`])}
                          placeholder='e.g. "HQ", "BRO 1"'
                          value={loc.label?.toUpperCase?.() || ''}
                          onChange={(e) => handleLocationChange(idx, 'label', e.target.value.toUpperCase())}
                        />
                      </Field>
                    </div>

                    <div className="col-span-2">
                      <Field label="Street Address" required error={errors[`loc_${idx}_street`]}>
                        <input
                          className={inputCls(errors[`loc_${idx}_street`])}
                          placeholder="123 Main Street"
                          value={loc.street}
                          onChange={(e) => handleLocationChange(idx, 'street', e.target.value)}
                        />
                      </Field>
                    </div>

                    <Field label="City" required error={errors[`loc_${idx}_city`]}>
                      <input
                        className={inputCls(errors[`loc_${idx}_city`])}
                        placeholder="City"
                        value={loc.city}
                        onChange={(e) => handleLocationChange(idx, 'city', e.target.value)}
                      />
                    </Field>

                    <Field label="State / Province" required error={errors[`loc_${idx}_state`]}>
                      <input
                        className={inputCls(errors[`loc_${idx}_state`])}
                        placeholder="State"
                        value={loc.state}
                        onChange={(e) => handleLocationChange(idx, 'state', e.target.value)}
                      />
                    </Field>

                    <Field label="ZIP / Postal Code" required error={errors[`loc_${idx}_zipCode`]}>
                      <input
                        className={inputCls(errors[`loc_${idx}_zipCode`])}
                        placeholder="ZIP Code"
                        value={loc.zipCode}
                        onChange={(e) => handleLocationChange(idx, 'zipCode', e.target.value)}
                      />
                    </Field>

                    <Field label="Country" required error={errors[`loc_${idx}_country`]}>
                      <input
                        className={inputCls(errors[`loc_${idx}_country`])}
                        placeholder="Country"
                        value={loc.country}
                        onChange={(e) => handleLocationChange(idx, 'country', e.target.value)}
                      />
                    </Field>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="company-form-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Saving...' : isEdit ? 'Update Company' : 'Create Company'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
