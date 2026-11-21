import { assignableRoles, canManageAdmins, isAdminRole } from './permissions';

describe('UI-level role helpers', () => {
  it('only the super admin manages admins', () => {
    expect(canManageAdmins('super_admin')).toBe(true);
    for (const r of ['admin', 'teacher', 'learner'] as const) expect(canManageAdmins(r)).toBe(false);
    expect(canManageAdmins(null)).toBe(false);
  });

  it('admin screens are for admin and super admin', () => {
    expect(isAdminRole('admin') && isAdminRole('super_admin')).toBe(true);
    expect(isAdminRole('teacher')).toBe(false);
  });

  it('an admin is never offered the admin role when creating an account', () => {
    expect(assignableRoles('admin')).toEqual(['learner', 'teacher']);
    expect(assignableRoles('super_admin')).toEqual(['learner', 'teacher', 'admin']);
  });
});
