import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useSelector } from 'react-redux';
import { notifications } from '@mantine/notifications';
import { authApi } from '../../api/auth.api';
import { masterApi } from '../../api/master.api';
import ConfirmModal from '../../components/common/ConfirmModal';
import PageBanner from '../../components/common/PageBanner';
import Skeleton, { SkeletonText } from '../../components/common/Skeleton';
import { isAdmin, isSuperAdmin } from '../../constants/roles';

const CREATE_ROLE_OPTIONS = [
  { value: 'user', label: 'User' },
  { value: 'admin', label: 'Admin' },
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_POLICY_LABEL = 'Min 8 chars, with uppercase, lowercase, number, special character';
const STRONG_PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[ !"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]).{8,}$/;

const roleLabel = (role) => {
  if (role === 'superadmin') return 'Superadmin';
  if (role === 'admin') return 'Admin';
  if (role === 'user') return 'User';
  return role || '';
};

export default function SettingsPage() {
  const { user } = useSelector((state) => state.auth);
  const isSuperadmin = isSuperAdmin(user?.role);
  const isMerAdmin = user?.role === 'admin';
  const canManageUsers = isAdmin(user?.role);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data } = await masterApi.users();
      setUsers(data.data || []);
    } catch (err) {
      notifications.show({
        message: err.response?.data?.message || 'Failed to load users',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canManageUsers) fetchUsers();
  }, [canManageUsers]);

  const {
    register: registerCreate,
    handleSubmit: handleSubmitCreate,
    reset: resetCreate,
    formState: { errors: createErrors, isSubmitting: createSubmitting },
  } = useForm({
    defaultValues: {
      name: '',
      email: '',
      password: '',
      role: 'user',
    },
  });

  const {
    register: registerPwd,
    handleSubmit: handleSubmitPwd,
    reset: resetPwd,
    watch: watchPwd,
    formState: { errors: pwdErrors, isSubmitting: pwdSubmitting },
  } = useForm({
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    reset: resetEdit,
    control: controlEdit,
    formState: { errors: editErrors, isSubmitting: editSubmitting },
  } = useForm({
    defaultValues: { name: '', email: '', isActive: true },
  });

  const onCreateUser = async (data) => {
    try {
      await authApi.register({
        name: data.name,
        email: data.email,
        password: data.password,
        role: isSuperadmin ? (data.role || 'user') : 'user',
      });
      notifications.show({
        message: `${roleLabel(isSuperadmin ? data.role : 'user')} account created`,
        color: 'green',
      });
      setShowCreate(false);
      resetCreate();
      fetchUsers();
    } catch (err) {
      notifications.show({
        message: err.response?.data?.message || 'Failed to create user',
        color: 'red',
      });
    }
  };

  const onChangePassword = async (data) => {
    if (data.newPassword !== data.confirmPassword) {
      notifications.show({ message: 'New passwords do not match', color: 'red' });
      return;
    }
    try {
      await authApi.changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      notifications.show({ message: 'Password updated successfully', color: 'green' });
      resetPwd();
      setShowPasswordModal(false);
    } catch (err) {
      notifications.show({
        message: err.response?.data?.message || 'Failed to update password',
        color: 'red',
      });
    }
  };

  const closeCreateModal = () => {
    setShowCreate(false);
    resetCreate({ name: '', email: '', password: '', role: 'user' });
  };

  const closePasswordModal = () => {
    setShowPasswordModal(false);
    resetPwd();
  };

  const openEditUser = (u) => {
    setEditingUser(u);
    resetEdit({
      name: u.name || '',
      email: u.email || '',
      isActive: u.isActive !== false,
    });
  };

  const closeEditUser = () => {
    setEditingUser(null);
    resetEdit({ name: '', email: '', isActive: true });
  };

  const onUpdateUser = async (data) => {
    if (!editingUser) return;
    try {
      await masterApi.updateUser(editingUser._id, {
        name: data.name,
        email: data.email,
        isActive: Boolean(data.isActive),
      });
      notifications.show({ message: 'User updated', color: 'green' });
      closeEditUser();
      fetchUsers();
    } catch (err) {
      notifications.show({
        message: err.response?.data?.message || 'Failed to update user',
        color: 'red',
      });
    }
  };

  const canDelete = useMemo(() => {
    if (!confirmDelete) return false;
    if (confirmDelete._id === user?._id) return false;
    if (confirmDelete.role === 'superadmin') return false;
    if (isMerAdmin && confirmDelete.role === 'admin') return false;
    return true;
  }, [confirmDelete, user?._id, isMerAdmin]);

  const handleDelete = async () => {
    if (!confirmDelete || !canDelete) return;
    try {
      await masterApi.deleteUser(confirmDelete._id);
      notifications.show({ message: 'User deleted', color: 'green' });
      setConfirmDelete(null);
      fetchUsers();
    } catch (err) {
      notifications.show({
        message: err.response?.data?.message || 'Failed to delete user',
        color: 'red',
      });
    }
  };

  const disabledReason = isSuperadmin
    ? 'Superadmin user cannot be modified here'
    : 'Admin can edit/delete only regular users';

  return (
    <div>
      <PageBanner
        className="mb-4"
        title="Settings"
        subtitle={
          isSuperadmin
            ? 'User management and account security'
            : canManageUsers
              ? 'User management and account security'
              : 'Account security'
        }
        action={[
          { onClick: () => setShowPasswordModal(true), label: 'Change password', icon: 'key' },
          ...(canManageUsers ? [{ onClick: () => setShowCreate(true), label: 'Create User' }] : []),
        ]}
      />

      {canManageUsers && (
        <>
          {showCreate && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
              <div className="company-form-panel max-w-lg">
                <div className="company-form-header">
                  <div>
                    <h2 className="company-form-title">Create User</h2>
                    <p className="company-form-subtitle">
                      {isSuperadmin
                        ? 'Superadmin can create Admin or User accounts'
                        : 'Admin can create User accounts'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeCreateModal}
                    className="company-form-close-btn"
                    aria-label="Close create user modal"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <form onSubmit={handleSubmitCreate(onCreateUser)} className="p-6 space-y-4">
                  <div>
                    <label className="company-form-field-label">Full Name</label>
                    <input
                      className="input-field"
                      placeholder="Enter full name"
                      {...registerCreate('name', { required: 'Name is required' })}
                    />
                    {createErrors.name && (
                      <p className="text-red-500 text-xs mt-1">{createErrors.name.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="company-form-field-label">Email</label>
                    <input
                      className="input-field"
                      placeholder="user@company.com"
                      type="email"
                      {...registerCreate('email', {
                        required: 'Email is required',
                        pattern: { value: EMAIL_PATTERN, message: 'Enter a valid email address' },
                      })}
                    />
                    {createErrors.email && (
                      <p className="text-red-500 text-xs mt-1">{createErrors.email.message}</p>
                    )}
                  </div>

                  {isSuperadmin ? (
                    <div>
                      <label className="company-form-field-label">Role</label>
                      <select
                        className="input-field"
                        {...registerCreate('role', { required: 'Role is required' })}
                      >
                        {CREATE_ROLE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      {createErrors.role && (
                        <p className="text-red-500 text-xs mt-1">{createErrors.role.message}</p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <label className="company-form-field-label">Role</label>
                      <input className="settings-readonly-role" value="User" readOnly />
                    </div>
                  )}

                  <div>
                    <label className="company-form-field-label">Password</label>
                    <input
                      className="input-field"
                      placeholder="At least 8 characters"
                      type="password"
                      autoComplete="new-password"
                      {...registerCreate('password', {
                        required: 'Password is required',
                        pattern: { value: STRONG_PASSWORD_PATTERN, message: PASSWORD_POLICY_LABEL },
                      })}
                    />
                    {createErrors.password && (
                      <p className="text-red-500 text-xs mt-1">{createErrors.password.message}</p>
                    )}
                    <p className="company-form-section-hint mt-1">{PASSWORD_POLICY_LABEL}</p>
                  </div>

                  <div className="company-form-footer">
                    <button type="button" onClick={closeCreateModal} className="btn-secondary">
                      Cancel
                    </button>
                    <button type="submit" disabled={createSubmitting} className="btn-primary">
                      {createSubmitting ? 'Creating user...' : 'Create User'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="card overflow-hidden">
            {loading ? (
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-8 w-24" />
                </div>
                <div className="space-y-3">
                  {[0, 1, 2].map((row) => (
                    <div
                      key={row}
                      className="grid grid-cols-[2fr,2fr,1.5fr,1.2fr,1.2fr] gap-3 items-center py-2 border-b border-gray-100 last:border-0"
                    >
                      <Skeleton className="h-3 w-40" />
                      <SkeletonText lines={1} />
                      <Skeleton className="h-6 w-20 rounded-full mx-auto" />
                      <Skeleton className="h-6 w-16 rounded-full mx-auto" />
                      <div className="flex justify-center gap-2">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <Skeleton className="h-8 w-8 rounded-full" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-16">
                <p className="company-empty-title">No users found</p>
                <p className="company-empty-desc">Create a user to get started</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th className="text-left">Name</th>
                      <th className="text-center">Email</th>
                      <th className="text-center">Role</th>
                      <th className="text-center">Status</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => {
                      const isTargetSuperadmin = u.role === 'superadmin';
                      const isTargetAdmin = u.role === 'admin';
                      const isSelf = u._id === user?._id;
                      const canEdit = isSuperadmin
                        ? !isTargetSuperadmin
                        : !isSelf && !isTargetSuperadmin && !isTargetAdmin;
                      const deleteDisabled = !canEdit;
                      return (
                        <tr key={u._id}>
                          <td className="settings-user-name">{u.name}</td>
                          <td className="settings-user-email">{u.email}</td>
                          <td className="text-center">
                            <span className="settings-role-badge">{roleLabel(u.role)}</span>
                          </td>
                          <td className="text-center">
                            <span className={u.isActive ? 'company-status-active' : 'company-status-inactive'}>
                              {u.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="text-center">
                            <div className="flex items-center justify-center gap-0.5">
                              <button
                                type="button"
                                disabled={!canEdit}
                                onClick={() => openEditUser(u)}
                                className={`settings-action-btn ${
                                  canEdit ? 'settings-action-btn--enabled' : 'settings-action-btn--disabled'
                                }`}
                                title={canEdit ? 'Edit user' : disabledReason}
                                aria-label={canEdit ? `Edit ${u.name}` : undefined}
                              >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                  />
                                </svg>
                              </button>
                              <button
                                type="button"
                                disabled={deleteDisabled}
                                onClick={() => setConfirmDelete({ _id: u._id, name: u.name, role: u.role })}
                                className={`settings-action-btn ${
                                  deleteDisabled
                                    ? 'settings-action-btn--disabled'
                                    : 'settings-action-btn--delete-enabled'
                                }`}
                                title={deleteDisabled ? disabledReason : 'Delete'}
                              >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <ConfirmModal
            open={!!confirmDelete}
            title="Delete User"
            message={`Are you sure you want to delete "${confirmDelete?.name}"? This action cannot be undone.`}
            confirmLabel="Delete"
            variant="danger"
            onConfirm={handleDelete}
            onCancel={() => setConfirmDelete(null)}
          />

          {editingUser && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
              <div
                className="company-form-panel max-w-lg border border-gray-100"
                role="dialog"
                aria-modal="true"
                aria-labelledby="edit-user-title"
              >
                <div className="company-form-header">
                  <div>
                    <h2 id="edit-user-title" className="company-form-title">Edit user</h2>
                    <p className="company-form-subtitle">Update name, email, or account status</p>
                  </div>
                  <button
                    type="button"
                    onClick={closeEditUser}
                    disabled={editSubmitting}
                    className="company-form-close-btn"
                    aria-label="Close"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <form onSubmit={handleSubmitEdit(onUpdateUser)} className="p-6 space-y-4">
                  <div>
                    <label className="company-form-field-label">Full name</label>
                    <input
                      className="input-field"
                      {...registerEdit('name', { required: 'Name is required' })}
                    />
                    {editErrors.name && (
                      <p className="text-red-500 text-xs mt-1">{editErrors.name.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="company-form-field-label">Email</label>
                    <input
                      type="email"
                      className="input-field"
                      autoComplete="off"
                      {...registerEdit('email', { required: 'Email is required' })}
                    />
                    {editErrors.email && (
                      <p className="text-red-500 text-xs mt-1">{editErrors.email.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="company-form-field-label">Status</label>
                    <Controller
                      name="isActive"
                      control={controlEdit}
                      render={({ field }) => (
                        <select
                          className="input-field"
                          value={field.value ? 'true' : 'false'}
                          onChange={(e) => field.onChange(e.target.value === 'true')}
                          disabled={editSubmitting}
                        >
                          <option value="true">Active</option>
                          <option value="false">Inactive</option>
                        </select>
                      )}
                    />
                    <p className="company-form-section-hint mt-1">Inactive users cannot sign in.</p>
                  </div>
                  <div className="company-form-footer">
                    <button type="button" onClick={closeEditUser} disabled={editSubmitting} className="btn-secondary">
                      Cancel
                    </button>
                    <button type="submit" disabled={editSubmitting} className="btn-primary">
                      {editSubmitting ? 'Saving…' : 'Save changes'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div
            className="company-form-panel max-w-lg border border-gray-100"
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-password-title"
          >
            <div className="company-form-header">
              <div>
                <h2 id="change-password-title" className="company-form-title">Change password</h2>
                <p className="company-form-subtitle">
                  Enter your current password, then choose a new one (min. 6 characters).
                </p>
              </div>
              <button
                type="button"
                onClick={closePasswordModal}
                disabled={pwdSubmitting}
                className="company-form-close-btn"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmitPwd(onChangePassword)} className="p-6 space-y-4">
              <div>
                <label className="company-form-field-label">Current password</label>
                <input
                  type="password"
                  className="input-field"
                  autoComplete="current-password"
                  {...registerPwd('currentPassword', { required: 'Current password is required' })}
                />
                {pwdErrors.currentPassword && (
                  <p className="text-red-500 text-xs mt-1">{pwdErrors.currentPassword.message}</p>
                )}
              </div>
              <div>
                <label className="company-form-field-label">New password</label>
                <input
                  type="password"
                  className="input-field"
                  autoComplete="new-password"
                  {...registerPwd('newPassword', {
                    required: 'New password is required',
                    minLength: { value: 6, message: 'Minimum 6 characters' },
                  })}
                />
                {pwdErrors.newPassword && (
                  <p className="text-red-500 text-xs mt-1">{pwdErrors.newPassword.message}</p>
                )}
              </div>
              <div>
                <label className="company-form-field-label">Confirm new password</label>
                <input
                  type="password"
                  className="input-field"
                  autoComplete="new-password"
                  {...registerPwd('confirmPassword', {
                    required: 'Please confirm your new password',
                    validate: (val) => val === watchPwd('newPassword') || 'Does not match new password',
                  })}
                />
                {pwdErrors.confirmPassword && (
                  <p className="text-red-500 text-xs mt-1">{pwdErrors.confirmPassword.message}</p>
                )}
              </div>
              <div className="company-form-footer">
                <button type="button" onClick={closePasswordModal} disabled={pwdSubmitting} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={pwdSubmitting} className="btn-primary">
                  {pwdSubmitting ? 'Updating…' : 'Update password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
