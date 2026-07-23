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

export const isAdmin = (role) => role === ROLES.ADMIN || role === ROLES.SUPERADMIN;
export const isSuperAdmin = (role) => role === ROLES.SUPERADMIN;
