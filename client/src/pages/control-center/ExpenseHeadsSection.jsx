import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useForm } from 'react-hook-form';
import { notifications } from '@mantine/notifications';
import {
  createExpenseHead,
  deleteExpenseHead,
  fetchExpenseHeads,
  updateExpenseHead,
} from '../../store/slices/expenseHeadsSlice';
import { fetchLookups } from '../../store/slices/commonSlice';
import ConfirmModal from '../../components/common/ConfirmModal';
import Skeleton from '../../components/common/Skeleton';
import ControlCenterToolbar from './ControlCenterToolbar';
import { isAdmin } from '../../constants/roles';

const emptyForm = {
  name: '',
  category: '',
  isActive: true,
};

export default function ExpenseHeadsSection() {
  const dispatch = useDispatch();
  const { items = [], total = 0, loading = false, error } = useSelector(
    (state) => state.expenseHeads ?? {},
  );
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
    dispatch(fetchExpenseHeads({ search, activeOnly: 'false' }));
  }, [dispatch, search]);

  const openCreate = () => {
    setEditItem(null);
    reset(emptyForm);
    setShowForm(true);
  };

  const openEdit = (item) => {
    setEditItem(item);
    reset({
      name: item.name || '',
      category: item.category || '',
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
      name: String(values.name || '').trim(),
      category: String(values.category || '').trim(),
      isActive: values.isActive !== false,
    };

    const result = editItem
      ? await dispatch(updateExpenseHead({ id: editItem._id, data: payload }))
      : await dispatch(createExpenseHead(payload));

    const matched = editItem
      ? updateExpenseHead.fulfilled.match(result)
      : createExpenseHead.fulfilled.match(result);
    if (matched) {
      notifications.show({
        message: editItem ? 'Expense head updated' : 'Expense head added',
        color: 'green',
      });
      closeForm();
      dispatch(fetchExpenseHeads({ search, activeOnly: 'false' }));
      dispatch(fetchLookups());
    } else {
      notifications.show({ message: result.payload || 'Save failed', color: 'red' });
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const result = await dispatch(deleteExpenseHead(confirmDelete.id));
    setConfirmDelete(null);
    if (deleteExpenseHead.fulfilled.match(result)) {
      notifications.show({ message: 'Expense head deleted', color: 'green' });
      dispatch(fetchLookups());
    } else {
      notifications.show({ message: result.payload || 'Delete failed', color: 'red' });
    }
  };

  return (
    <div>
      <ControlCenterToolbar
        title="Expense Heads"
        subtitle={`Used on bills and expenses · ${total} head${total !== 1 ? 's' : ''}`}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search expense heads..."
        showAction={canManage}
        actionLabel="Add Expense Head"
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
          <p className="company-empty-title">No expense heads yet</p>
          <p className="company-empty-desc">Add heads to show them in bill and expense forms</p>
          {canManage && (
            <button type="button" onClick={openCreate} className="btn-primary mt-4">
              Add Expense Head
            </button>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th className="text-left">Name</th>
                  <th className="text-left">Category</th>
                  <th className="text-center">Status</th>
                  {canManage && <th className="text-center">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item._id}>
                    <td className="text-left align-middle font-semibold">{item.name}</td>
                    <td className="text-left align-middle">{item.category || '—'}</td>
                    <td className="text-center align-middle">
                      <span className={item.isActive ? 'company-status-active' : 'company-status-inactive'}>
                        {item.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {canManage && (
                      <td className="text-center align-middle">
                        <div className="inline-flex items-center justify-center gap-2">
                          <button
                            type="button"
                            className="company-action-btn company-action-btn--edit"
                            onClick={() => openEdit(item)}
                            title="Edit"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="company-action-btn company-action-btn--delete"
                            onClick={() => setConfirmDelete({ id: item._id, name: item.name })}
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
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="card w-full max-w-lg p-6">
            <h3 className="text-lg font-semibold mb-4">{editItem ? 'Edit Expense Head' : 'Add Expense Head'}</h3>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  className="input-field"
                  placeholder="e.g. Stationary"
                  {...register('name', { required: 'Name is required' })}
                />
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category (optional)</label>
                <input className="input-field" placeholder="e.g. Office" {...register('category')} />
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
        title="Delete Expense Head"
        message={`Delete "${confirmDelete?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
