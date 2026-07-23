export const ROLES = {
  SUPERADMIN: 'superadmin',
  ADMIN: 'admin',
  USER: 'user',
};

/** Flow: Pending → Completed (admin) → Approved (superadmin). */
export const APPROVAL_STATUS = {
  PENDING: 'Pending',
  COMPLETED: 'Completed',
  APPROVED: 'Approved',
};

export const APPROVAL_STATUSES = Object.values(APPROVAL_STATUS);

export const ADMIN_ROLES = [ROLES.SUPERADMIN, ROLES.ADMIN];

export const isAdminRole = (role) => ADMIN_ROLES.includes(role);

export const isSuperAdmin = (role) => role === ROLES.SUPERADMIN;
