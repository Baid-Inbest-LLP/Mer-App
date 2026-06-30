export const ROLES = {
  SUPERADMIN: 'superadmin',
  ADMIN: 'admin',
  USER: 'user',
};

export const APPROVAL_STATUS = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  COMPLETED: 'Completed',
};

export const APPROVAL_STATUSES = Object.values(APPROVAL_STATUS);

export const ADMIN_ROLES = [ROLES.SUPERADMIN, ROLES.ADMIN];

export const isAdminRole = (role) => ADMIN_ROLES.includes(role);

export const isSuperAdmin = (role) => role === ROLES.SUPERADMIN;
