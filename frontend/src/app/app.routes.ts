import { Routes } from '@angular/router';
import { firstRunGuard, roleGuard, setupGuard } from './core/guards';
import { unsavedGuard } from './core/unsaved.guard';

const profile = { path: 'profile', title: 'Profile · SignSpell', canDeactivate: [unsavedGuard], loadComponent: () => import('./pages/profile/profile').then((m) => m.Profile) };
const shell = () => import('./layout/shell/shell').then((m) => m.Shell);

export const routes: Routes = [
  { path: '', pathMatch: 'full', title: 'SignSpell: learn fingerspelling with your webcam', loadComponent: () => import('./landing/landing').then((m) => m.Landing) },
  { path: 'login', title: 'Log in · SignSpell', canActivate: [firstRunGuard], loadComponent: () => import('./pages/auth/login/login').then((m) => m.Login) },
  { path: 'register', title: 'Create account · SignSpell', canActivate: [firstRunGuard], loadComponent: () => import('./pages/auth/register/register').then((m) => m.Register) },
  { path: 'setup', title: 'Set up · SignSpell', canActivate: [setupGuard], loadComponent: () => import('./pages/auth/setup/setup').then((m) => m.Setup) },
  {
    path: 'app', canActivate: [roleGuard('learner')], loadComponent: shell,
    children: [
      { path: '', title: 'Home · SignSpell', loadComponent: () => import('./pages/learner/dashboard/dashboard').then((m) => m.Dashboard) },
      { path: 'guide', title: 'Sign guide · SignSpell', loadComponent: () => import('./pages/learner/guide/guide').then((m) => m.SignGuide) },
      { path: 'practice/:id', title: 'Practice · SignSpell', loadComponent: () => import('./pages/learner/practice/practice').then((m) => m.Practice) },
      { path: 'progress', title: 'My progress · SignSpell', loadComponent: () => import('./pages/learner/progress/progress').then((m) => m.Progress) },
      profile,
    ],
  },
  {
    path: 'teacher', canActivate: [roleGuard('teacher')], loadComponent: shell,
    children: [
      { path: '', title: 'Learners · SignSpell', loadComponent: () => import('./pages/teacher/students/students').then((m) => m.Students) },
      { path: 'donate', title: 'Donate signs · SignSpell', canDeactivate: [unsavedGuard], loadComponent: () => import('./pages/teacher/donate/donate').then((m) => m.Donate) },
      profile,
    ],
  },
  {
    path: 'admin', canActivate: [roleGuard('admin', 'super_admin')], loadComponent: shell,
    children: [
      { path: '', title: 'Accounts · SignSpell', loadComponent: () => import('./pages/admin/accounts/accounts').then((m) => m.Accounts) },
      { path: 'signs', title: 'Signs · SignSpell', loadComponent: () => import('./pages/admin/signs/signs').then((m) => m.Signs) },
      { path: 'signs/new', title: 'Add a sign · SignSpell', canDeactivate: [unsavedGuard], canActivate: [roleGuard('super_admin')], loadComponent: () => import('./pages/admin/sign-studio/sign-studio').then((m) => m.SignStudio) },
      { path: 'signs/:id/edit', title: 'Edit sign · SignSpell', canDeactivate: [unsavedGuard], canActivate: [roleGuard('super_admin')], loadComponent: () => import('./pages/admin/sign-studio/sign-studio').then((m) => m.SignStudio) },
      { path: 'audit', title: 'Audit logs · SignSpell', canActivate: [roleGuard('super_admin')], loadComponent: () => import('./pages/admin/audit/audit').then((m) => m.Audit) },
      profile,
    ],
  },
  { path: '**', title: 'Not found · SignSpell', loadComponent: () => import('./pages/not-found/not-found').then((m) => m.NotFound) },
];
