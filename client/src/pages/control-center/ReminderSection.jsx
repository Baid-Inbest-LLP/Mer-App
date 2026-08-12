import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { notifications } from '@mantine/notifications';
import { notificationApi } from '../../api/notification.api';
import ConfirmModal from '../../components/common/ConfirmModal';
import Skeleton from '../../components/common/Skeleton';
import ControlCenterToolbar from './ControlCenterToolbar';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const emptyForm = {
  name: '',
  email: '',
  whatsapp: '',
};

const normalizeWhatsappInput = (value) => String(value || '').replace(/[\s\-()]/g, '');

const isValidWhatsapp = (value) => {
  const digits = normalizeWhatsappInput(value).replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
};

export default function ReminderSection() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [sendingId, setSendingId] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: emptyForm });

  useEffect(() => {
    let cancelled = false;

    notificationApi
      .getDueConfig()
      .then(({ data }) => {
        if (cancelled) return;
        setUsers(data.data?.recipients || []);
      })
      .catch((err) => {
        if (cancelled) return;
        notifications.show({
          message: err.response?.data?.message || 'Failed to load reminder recipients',
          color: 'red',
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) => {
      const name = String(user.name || '').toLowerCase();
      const email = String(user.email || '').toLowerCase();
      const whatsapp = String(user.whatsapp || '').toLowerCase();
      return name.includes(q) || email.includes(q) || whatsapp.includes(q);
    });
  }, [users, search]);

  const persistUsers = async (nextUsers, successMessage) => {
    try {
      setSaving(true);
      const { data } = await notificationApi.updateDueConfig({ recipients: nextUsers });
      setUsers(data.data?.recipients || nextUsers);
      notifications.show({ message: successMessage, color: 'green' });
      return true;
    } catch (err) {
      notifications.show({
        message: err.response?.data?.message || 'Failed to save reminder recipients',
        color: 'red',
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const openCreate = () => {
    setEditUser(null);
    reset(emptyForm);
    setShowForm(true);
  };

  const openEdit = (user) => {
    setEditUser(user);
    reset({
      name: user.name || '',
      email: user.email || '',
      whatsapp: user.whatsapp || '',
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditUser(null);
    reset(emptyForm);
  };

  const onSubmit = async (values) => {
    const payload = {
      id: editUser?.id || crypto.randomUUID(),
      name: values.name.trim(),
      email: values.email.trim().toLowerCase(),
      whatsapp: values.whatsapp.trim(),
    };

    if (!EMAIL_PATTERN.test(payload.email)) {
      notifications.show({ message: 'Enter a valid email address', color: 'red' });
      return;
    }
    if (payload.whatsapp && !isValidWhatsapp(payload.whatsapp)) {
      notifications.show({ message: 'Enter a valid WhatsApp number', color: 'red' });
      return;
    }

    const duplicate = users.some(
      (u) => u.email.toLowerCase() === payload.email && u.id !== editUser?.id,
    );
    if (duplicate) {
      notifications.show({ message: 'This email is already in the list', color: 'red' });
      return;
    }

    const nextUsers = editUser
      ? users.map((u) => (u.id === editUser.id ? payload : u))
      : [...users, payload];

    const ok = await persistUsers(
      nextUsers,
      editUser ? 'Recipient updated' : 'Recipient added',
    );
    if (ok) closeForm();
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const nextUsers = users.filter((u) => u.id !== confirmDelete.id);
    const ok = await persistUsers(nextUsers, 'Recipient removed');
    if (ok) setConfirmDelete(null);
  };

  const handleSendReminder = async (user) => {
    try {
      setSendingId(user.id);
      const { data } = await notificationApi.sendToRecipient(user.id);
      const result = data.data || {};
      if (result.skipped) {
        notifications.show({
          message: result.reason || 'No bill reminders due today',
          color: 'yellow',
        });
      } else {
        notifications.show({
          message: `Sent ${result.sentCount || 0} reminder email(s) to ${user.email}`,
          color: 'green',
        });
      }
    } catch (err) {
      notifications.show({
        message: err.response?.data?.message || 'Failed to send reminders',
        color: 'red',
      });
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div>
      <ControlCenterToolbar
        title="Due Bills Reminders"
        subtitle={`${filteredUsers.length} of ${users.length} recipient${users.length === 1 ? '' : 's'}`}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search recipients..."
        showAction
        actionLabel="Add recipient"
        onAction={openCreate}
      />

      {loading ? (
        <div className="card p-4 space-y-3 mb-4">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="card text-center py-14 mb-4">
          <p className="company-empty-title">No reminder recipients yet</p>
          <p className="company-empty-desc">Add people who should receive bill reminder emails</p>
          <button type="button" onClick={openCreate} className="btn-primary mt-4">
            Add recipient
          </button>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="card text-center py-14 mb-4">
          <p className="company-empty-title">No matching recipients</p>
          <p className="company-empty-desc">Try a different name, email, or WhatsApp number</p>
        </div>
      ) : (
        <div className="card overflow-hidden mb-4">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th className="text-left">Recipient</th>
                  <th className="text-left">Email</th>
                  <th className="text-left">WhatsApp</th>
                  <th className="text-center">Send</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td className="text-left align-middle font-semibold">{user.name}</td>
                    <td className="text-left align-middle">{user.email}</td>
                    <td className="text-left align-middle">{user.whatsapp || '—'}</td>
                    <td className="text-center align-middle">
                      <button
                        type="button"
                        className="reminder-send-btn"
                        onClick={() => handleSendReminder(user)}
                        disabled={saving || sendingId === user.id}
                      >
                        {sendingId === user.id ? 'Sending…' : 'Send Reminder'}
                      </button>
                    </td>
                    <td className="text-center align-middle">
                      <div className="inline-flex items-center justify-center gap-2">
                        <button
                          type="button"
                          className="company-action-btn company-action-btn--edit"
                          onClick={() => openEdit(user)}
                          title="Edit"
                          disabled={saving}
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="company-action-btn company-action-btn--delete"
                          onClick={() => setConfirmDelete(user)}
                          title="Delete"
                          disabled={saving}
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card p-6">
        <h3 className="text-sm font-semibold text-slate-900">Reminder schedule</h3>
        <ul className="mt-2 space-y-1.5 text-sm text-slate-600 list-disc list-inside">
          <li>Overdue bills: one email per bill every day until fully paid</li>
          <li>Upcoming bills: separate emails at 7 days, 3 days, and 1 day before due date</li>
        </ul>
      </div>

      <ConfirmModal
        open={!!confirmDelete}
        title="Remove recipient"
        message={`Remove ${confirmDelete?.name || 'this recipient'} from bill reminders?`}
        confirmLabel="Remove"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div
            className="company-form-panel max-w-lg border border-gray-100"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reminder-user-title"
          >
            <div className="company-form-header">
              <div>
                <h2 id="reminder-user-title" className="company-form-title">
                  {editUser ? 'Edit recipient' : 'Add recipient'}
                </h2>
                <p className="company-form-subtitle">
                  Name and email are required; WhatsApp is optional
                </p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                disabled={isSubmitting || saving}
                className="company-form-close-btn"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div>
                <label className="company-form-field-label">Name</label>
                <input
                  className="input-field"
                  placeholder="Full name"
                  {...register('name', { required: 'Name is required' })}
                />
                {errors.name && (
                  <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="company-form-field-label">Email</label>
                <input
                  className="input-field"
                  type="email"
                  placeholder="name@company.com"
                  {...register('email', { required: 'Email is required' })}
                />
                {errors.email && (
                  <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label className="company-form-field-label">
                  WhatsApp number <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  className="input-field"
                  placeholder="+91 98765 43210"
                  {...register('whatsapp')}
                />
                <p className="company-form-section-hint mt-1">
                  Include country code or enter a 10-digit Indian mobile number.
                </p>
              </div>

              <div className="company-form-footer">
                <button type="button" onClick={closeForm} className="btn-secondary" disabled={isSubmitting || saving}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isSubmitting || saving}>
                  {isSubmitting || saving ? 'Saving…' : editUser ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
