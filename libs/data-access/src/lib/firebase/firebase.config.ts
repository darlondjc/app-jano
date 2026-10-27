import { InjectionToken } from '@angular/core';

/** Configuração pública do app Web do Firebase (não é segredo; a segurança vem das regras). */
export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
}

export const FIREBASE_CONFIG = new InjectionToken<FirebaseWebConfig>(
  'FIREBASE_CONFIG',
);
