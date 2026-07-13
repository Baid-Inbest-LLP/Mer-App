import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { notifications } from '@mantine/notifications';
import { fetchCompanies, deleteCompany } from '../../store/slices/companiesSlice';
import { fetchLookups } from '../../store/slices/commonSlice';
import CompanyForm from './CompanyForm';
import ConfirmModal from '../../components/common/ConfirmModal';
import PageBanner from '../../components/common/PageBanner';
import Skeleton, { SkeletonText } from '../../components/common/Skeleton';
import ControlCenterToolbar from '../control-center/ControlCenterToolbar';
import { isAdmin } from '../../constants/roles';

export default function CompanyListPage({ embedded = false }) {
  const dispatch = useDispatch();
  const { companies = [], total = 0, loading = false, error } = useSelector(
    (state) => state.companies ?? {},
  );
  const { user } = useSelector((state) => state.auth);
  const canManage = isAdmin(user?.role);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editCompany, setEditCompany] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    dispatch(fetchCompanies({ search }));
  }, [dispatch, search]);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const result = await dispatch(deleteCompany(confirmDelete.id));
    setConfirmDelete(null);
    if (deleteCompany.fulfilled.match(result)) {
      notifications.show({ message: 'Company deleted', color: 'green' });
      dispatch(fetchLookups());
    } else {
      notifications.show({ message: result.payload || 'Delete failed', color: 'red' });
    }
  };

  const cancelDelete = useCallback(() => setConfirmDelete(null), []);

  const handleEdit = (company) => {
    setEditCompany(company);
    setShowForm(true);
  };

  const handleClose = () => {
    setShowForm(false);
    setEditCompany(null);
    dispatch(fetchCompanies({ search }));
    dispatch(fetchLookups());
  };

  const subtitle = `Legal entities and branch locations · ${total} compan${total !== 1 ? 'ies' : 'y'}`;

  return (
    <div>
      {!embedded && (
        <PageBanner
          className="mb-4"
          title="Companies"
          subtitle={subtitle}
          action={
            canManage
              ? { onClick: () => setShowForm(true), label: 'Add Company' }
              : undefined
          }
        />
      )}

      {embedded ? (
        <ControlCenterToolbar
          title="Companies"
          subtitle={subtitle}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search companies..."
          showAction={canManage}
          actionLabel="Add Company"
          onAction={() => setShowForm(true)}
        />
      ) : (
        <div className="card p-4 mb-4 flex justify-end">
          <input
            className="input-field max-w-sm"
            placeholder="Search companies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {error && (
        <div className="card p-4 mb-4 company-error-alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[0, 1].map((card) => (
            <div key={card} className="card p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-xl" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <div className="flex gap-2">
                      <Skeleton className="h-4 w-16 rounded-md" />
                      <Skeleton className="h-4 w-24 rounded-md" />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-8 w-8 rounded-full" />
                </div>
              </div>
              <div>
                <Skeleton className="h-3 w-32 mb-3" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[0, 1, 2].map((loc) => (
                    <div key={loc} className="company-location-card">
                      <div className="flex items-center justify-between mb-2">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-4 w-12 rounded-full" />
                      </div>
                      <SkeletonText lines={3} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : companies.length === 0 ? (
        <div className="card text-center py-16">
          <svg className="w-12 h-12 company-empty-icon mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <p className="company-empty-title">No companies yet</p>
          <p className="company-empty-desc">Add your first company for expense entries</p>
          {canManage && (
            <button type="button" onClick={() => setShowForm(true)} className="btn-primary mt-4">
              Add Company
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {companies.map((company) => (
            <div key={company._id} className="card p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="company-card-icon">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
                      <h3 className="company-card-title">{company.name}</h3>
                      {company.companyCode && (
                        <span className="company-code-badge">
                          {company.companyCode}
                        </span>
                      )}
                      <span
                        className={
                          company.hasStamp ? 'company-stamp-badge--yes' : 'company-stamp-badge--no'
                        }
                      >
                        {company.hasStamp ? 'Stamp on file' : 'No stamp'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {company.email && (
                        <span className="company-meta-chip">
                          {company.email}
                        </span>
                      )}
                      {company.phone && (
                        <span className="company-meta-chip">
                          {company.phone}
                        </span>
                      )}
                      {company.taxId && (
                        <span className="company-gst-chip">
                          GST: {company.taxId}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={company.isActive ? 'company-status-active' : 'company-status-inactive'}>
                    {company.isActive ? 'Active' : 'Inactive'}
                  </span>
                  {canManage && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleEdit(company)}
                        className="company-action-btn company-action-btn--edit"
                        title="Edit"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete({ id: company._id, name: company.name })}
                        className="company-action-btn company-action-btn--delete"
                        title="Delete"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div>
                <p className="company-section-label">Locations</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {company.locations?.map((loc) => (
                    <div
                      key={loc._id}
                      className={`company-location-card ${
                        loc.isDefault ? 'company-location-card--default' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="company-location-name">{loc.label?.toUpperCase?.() || ''}</span>
                        {loc.isDefault && (
                          <span className="company-location-default-badge">
                            Default
                          </span>
                        )}
                      </div>
                      {loc.street && <p className="company-location-text">{loc.street}</p>}
                      {loc.city && (
                        <p className="company-location-text">
                          {loc.city}
                          {loc.state ? `, ${loc.state}` : ''} {loc.zipCode}
                        </p>
                      )}
                      {loc.country && <p className="company-location-text-muted">{loc.country}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && <CompanyForm company={editCompany} onClose={handleClose} />}

      <ConfirmModal
        open={!!confirmDelete}
        title="Delete Company"
        message={`Are you sure you want to delete "${confirmDelete?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
}
