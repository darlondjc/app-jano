import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { FIREBASE_CONFIG } from '@jano/data-access';
import { firebaseConfig } from '../environments/firebase';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes, withComponentInputBinding()),
    { provide: FIREBASE_CONFIG, useValue: firebaseConfig },
  ],
};
