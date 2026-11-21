import { Role } from './models';

/** UI-only role helpers for what to show; the backend must enforce the real rules. */

/** Friendly names for the role chips and the account menu. */
export const ROLE_LABEL: Record<Role, string> = {
  learner: 'Learner',
  teacher: 'Teacher',
  admin: 'Admin',
  super_admin: 'Super admin',
};

/** Admins and the Super Admin both use the admin screens. */
export const isAdminRole = (role: Role | null | undefined): boolean => role === 'admin' || role === 'super_admin';

/** Only the Super Admin sees the "Manage admins" controls. The backend must enforce this too. */
export const canManageAdmins = (role: Role | null | undefined): boolean => role === 'super_admin';

/** The roles a person may pick when creating or editing an account (admins only for super admins). */
export function assignableRoles(viewer: Role | null | undefined): Role[] {
  return canManageAdmins(viewer) ? ['learner', 'teacher', 'admin'] : ['learner', 'teacher'];
}
