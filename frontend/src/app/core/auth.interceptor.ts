import { HttpInterceptorFn } from '@angular/common/http';
import { Injector, inject } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { AuthService } from './auth.service';
import { tokenStore } from './token';

/** Adds the Bearer token (Laravel Sanctum) and signs the user out when the API says 401. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const injector = inject(Injector);
  const token = tokenStore.get();
  const authed = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }) : req.clone({ setHeaders: { Accept: 'application/json' } });
  return next(authed).pipe(
    tap({
      error: (e) => {
        if (e?.status === 401 && token && !req.url.includes('/auth/login')) {
          injector.get(AuthService).clear();
          injector.get(Router).navigateByUrl('/login');
        }
      },
    }),
  );
};
