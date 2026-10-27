import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: 'entrar',
    loadComponent: () => import('./entrar/entrar').then((m) => m.Entrar),
  },
  { path: '', pathMatch: 'full', redirectTo: 'entrar' },
];
