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

export const isAdmin = (role) => role === ROLES.ADMIN || role === ROLES.SUPERADMIN;
export const isSuperAdmin = (role) => role === ROLES.SUPERADMIN;
