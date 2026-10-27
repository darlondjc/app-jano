import { Route } from '@angular/router';
import { authGuard } from './auth.guard';

export const appRoutes: Route[] = [
  {
    path: 'entrar',
    loadComponent: () => import('./entrar/entrar').then((m) => m.Entrar),
  },
  {
    path: '',
    pathMatch: 'full',
    canActivate: [authGuard],
    loadComponent: () => import('./inicio/inicio').then((m) => m.Inicio),
  },
  {
    path: 'transacoes',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./transacoes/transacoes').then((m) => m.Transacoes),
  },
  { path: '**', redirectTo: '' },
];
