import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import { Api } from './core/api/api';
import { HttpApi } from './core/api/http-api';
import { AuthService } from './core/auth.service';
import { loadContent } from './core/content.loader';
import { authInterceptor } from './core/auth.interceptor';
import { HintRepository } from './data/hint.repository';
import { HttpHintRepository } from './data/http-hint.repository';
import { HttpLessonMediaRepository } from './data/http-lesson-media.repository';
import { LessonMediaRepository } from './data/lesson-media.repository';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' })),
    provideHttpClient(withInterceptors([authInterceptor])),
    { provide: Api, useClass: HttpApi },
    { provide: HintRepository, useClass: HttpHintRepository },
    { provide: LessonMediaRepository, useClass: HttpLessonMediaRepository },
    provideAppInitializer(() => loadContent()),
    provideAppInitializer(() => inject(AuthService).restore()),
  ],
};
