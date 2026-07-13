import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useForm } from 'react-hook-form';
import { notifications } from '@mantine/notifications';
import {
  createCard,
  deleteCard,
  fetchCards,
  updateCard,
} from '../../store/slices/cardsSlice';
import { fetchLookups } from '../../store/slices/commonSlice';
import ConfirmModal from '../../components/common/ConfirmModal';
import Skeleton from '../../components/common/Skeleton';
import ControlCenterToolbar from './ControlCenterToolbar';
import { isAdmin } from '../../constants/roles';

const emptyForm = {
  issuer: '',
  last4: '',
  cardType: 'Credit',
  label: '',
  companyName: '',
  isActive: true,
};

export default function CardsSection() {
  const dispatch = useDispatch();
  const { items = [], total = 0, loading = false, error } = useSelector((state) => state.cards ?? {});
  const { companies = [] } = useSelector((state) => state.companies ?? {});
  const { user } = useSelector((state) => state.auth);
  const canManage = isAdmin(user?.role);

  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: emptyForm });

  useEffect(() => {
    dispatch(fetchCards({ search, activeOnly: 'false' }));
  }, [dispatch, search]);

  const openCreate = () => {
    setEditItem(null);
    reset(emptyForm);
    setShowForm(true);
  };

  const openEdit = (item) => {
    setEditItem(item);
    reset({
      issuer: item.issuer || '',
      last4: item.last4 || '',
      cardType: item.cardType || 'Credit',
      label: item.label || '',
      companyName: item.companyName || '',
      isActive: item.isActive !== false,
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditItem(null);
    reset(emptyForm);
  };

  const onSubmit = async (values) => {
    const payload = {
      ...values,
      last4: String(values.last4 || '').replace(/\D/g, '').slice(-4),
      issuer: String(values.issuer || '').trim().toUpperCase(),
    };

    const result = editItem
      ? await dispatch(updateCard({ id: editItem._id, data: payload }))
      : await dispatch(createCard(payload));

    const matched = editItem ? updateCard.fulfilled.match(result) : createCard.fulfilled.match(result);
    if (matched) {
      notifications.show({
        message: editItem ? 'Card updated' : 'Card added',
        color: 'green',
      });
      closeForm();
      dispatch(fetchCards({ search, activeOnly: 'false' }));
      dispatch(fetchLookups());
    } else {
      notifications.show({ message: result.payload || 'Save failed', color: 'red' });
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const result = await dispatch(deleteCard(confirmDelete.id));
    setConfirmDelete(null);
    if (deleteCard.fulfilled.match(result)) {
      notifications.show({ message: 'Card deleted', color: 'green' });
      dispatch(fetchLookups());
    } else {
      notifications.show({ message: result.payload || 'Delete failed', color: 'red' });
    }
  };

  return (
    <div>
      <ControlCenterToolbar
        title="Cards"
        subtitle={`Used for Card payments · ${total} Card${total !== 1 ? 's' : ''}`}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search cards..."
        showAction={canManage}
        actionLabel="Add Card"
        onAction={openCreate}
      />

      {error && <div className="card p-4 mb-4 company-error-alert">{error}</div>}

      {loading ? (
        <div className="card p-4 space-y-3">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="card text-center py-14">
          <p className="company-empty-title">No cards yet</p>
          <p className="company-empty-desc">Add credit/debit cards to show in the expense form</p>
          {canManage && (
            <button type="button" onClick={openCreate} className="btn-primary mt-4">
              Add Card
            </button>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3 font-medium">Card</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium">Label</th>
                <th className="px-4 py-3 font-medium">Status</th>
                {canManage && <th className="px-4 py-3 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item._id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-semibold text-gray-900">
                    {item.displayValue || `${item.issuer} - ${item.last4}`}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{item.cardType || 'Credit'}</td>
                  <td className="px-4 py-3 text-gray-700">{item.companyName || '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{item.label || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={item.isActive ? 'company-status-active' : 'company-status-inactive'}>
                      {item.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button type="button" className="company-action-btn company-action-btn--edit" onClick={() => openEdit(item)} title="Edit">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="company-action-btn company-action-btn--delete"
                          onClick={() => setConfirmDelete({ id: item._id, name: item.displayValue || `${item.issuer} - ${item.last4}` })}
                          title="Delete"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="card w-full max-w-lg p-6">
            <h3 className="text-lg font-semibold mb-4">{editItem ? 'Edit Card' : 'Add Card'}</h3>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Issuer</label>
                <input className="input-field" placeholder="e.g. ICICI" {...register('issuer', { required: 'Issuer is required' })} />
                {errors.issuer && <p className="text-xs text-red-500 mt-1">{errors.issuer.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last 4 Digits</label>
                <input
                  className="input-field"
                  placeholder="2404"
                  maxLength={4}
                  {...register('last4', {
                    required: 'Last 4 digits are required',
                    pattern: { value: /^\d{4}$/, message: 'Enter exactly 4 digits' },
                  })}
                />
                {errors.last4 && <p className="text-xs text-red-500 mt-1">{errors.last4.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Card Type</label>
                <select className="input-field" {...register('cardType')}>
                  <option value="Credit">Credit</option>
                  <option value="Debit">Debit</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company (optional)</label>
                <select className="input-field" {...register('companyName')}>
                  <option value="">Select company</option>
                  {companies.map((c) => (
                    <option key={c._id} value={c.name}>{c.companyCode || c.code || c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Label (optional)</label>
                <input className="input-field" placeholder="e.g. Travel card" {...register('label')} />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" {...register('isActive')} />
                Active
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn-secondary" onClick={closeForm}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : editItem ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!confirmDelete}
        title="Delete Card"
        message={`Delete "${confirmDelete?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
