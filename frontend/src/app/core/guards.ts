import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, HOME_BY_ROLE } from './auth.service';
import { Role } from './models';

/** Route guard that only lets the listed roles in; everyone else goes to their own home. */
export const roleGuard = (...roles: Role[]): CanActivateFn => () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const me = auth.account();
  if (!me) return router.createUrlTree(['/login']);
  return roles.includes(me.role) ? true : router.createUrlTree([HOME_BY_ROLE[me.role]]);
};

/** Login and register are only for people who are not signed in. */
export const guestGuard: CanActivateFn = () => {
  const me = inject(AuthService).account();
  return me ? inject(Router).createUrlTree([HOME_BY_ROLE[me.role]]) : true;
};

/** The setup screen only exists on the very first run. After that it sends people to the login. */
export const setupGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const me = auth.account();
  if (me) return router.createUrlTree([HOME_BY_ROLE[me.role]]);
  return (await auth.needsSetup()) ? true : router.createUrlTree(['/login']);
};

/** On the first run there is nobody to log in as, so login and register lead to the setup screen. */
export const firstRunGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const me = auth.account();
  if (me) return router.createUrlTree([HOME_BY_ROLE[me.role]]);
  return (await auth.needsSetup()) ? router.createUrlTree(['/setup']) : true;
};
