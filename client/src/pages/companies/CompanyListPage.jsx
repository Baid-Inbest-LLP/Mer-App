import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { notifications } from '@mantine/notifications';
import { fetchCompanies, deleteCompany } from '../../store/slices/companiesSlice';
import { fetchLookups } from '../../store/slices/commonSlice';
import CompanyForm from './CompanyForm';
import ConfirmModal from '../../components/common/ConfirmModal';
import PageBanner from '../../components/common/PageBanner';
import Skeleton, { SkeletonText } from '../../components/common/Skeleton';
import { isAdmin } from '../../constants/roles';

export default function CompanyListPage() {
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

  return (
    <div>
      <PageBanner
        className="mb-4"
        title="Companies"
        subtitle={`Legal entities and branch locations · ${total} compan${total !== 1 ? 'ies' : 'y'}`}
        action={
          canManage
            ? { onClick: () => setShowForm(true), label: 'Add Company' }
            : undefined
        }
      />

      <div className="card p-4 mb-4 flex justify-end">
        <input
          className="input-field max-w-sm"
          placeholder="Search companies..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && (
        <div className="card p-4 mb-4 border border-red-200 bg-red-50 text-red-700 text-sm">
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
                    <div key={loc} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
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
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <p className="text-gray-500 font-medium">No companies yet</p>
          <p className="text-sm text-gray-400 mt-1">Add your first company for expense entries</p>
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
                  <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-primary-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
                      <h3 className="font-bold text-gray-900 text-base">{company.name}</h3>
                      {company.companyCode && (
                        <span className="font-mono bg-primary-50 text-primary-700 border border-primary-200 px-2 py-0.5 rounded-md text-xs font-semibold tracking-wide">
                          {company.companyCode}
                        </span>
                      )}
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-md ${
                          company.hasStamp
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-gray-50 text-gray-500 border border-gray-200'
                        }`}
                      >
                        {company.hasStamp ? 'Stamp on file' : 'No stamp'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {company.email && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1">
                          {company.email}
                        </span>
                      )}
                      {company.phone && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1">
                          {company.phone}
                        </span>
                      )}
                      {company.taxId && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1">
                          GST: {company.taxId}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge ${company.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {company.isActive ? 'Active' : 'Inactive'}
                  </span>
                  {canManage && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleEdit(company)}
                        className="text-gray-400 hover:text-primary-700 rounded transition-colors"
                        title="Edit"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete({ id: company._id, name: company.name })}
                        className="text-gray-400 hover:text-red-600 rounded transition-colors"
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
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Locations</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {company.locations?.map((loc) => (
                    <div
                      key={loc._id}
                      className={`rounded-lg border p-3 text-sm ${
                        loc.isDefault ? 'border-primary-300 bg-primary-50' : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-gray-800">{loc.label?.toUpperCase?.() || ''}</span>
                        {loc.isDefault && (
                          <span className="text-xs bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded font-medium">
                            Default
                          </span>
                        )}
                      </div>
                      {loc.street && <p className="text-gray-600">{loc.street}</p>}
                      {loc.city && (
                        <p className="text-gray-600">
                          {loc.city}
                          {loc.state ? `, ${loc.state}` : ''} {loc.zipCode}
                        </p>
                      )}
                      {loc.country && <p className="text-gray-500">{loc.country}</p>}
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
