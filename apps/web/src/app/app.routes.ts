import { Route } from '@angular/router';
import { authGuard } from './auth.guard';

export const appRoutes: Route[] = [
  {
    path: 'entrar',
    loadComponent: () => import('./entrar/entrar').then((m) => m.Entrar),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./shell/shell').then((m) => m.Shell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./inicio/inicio').then((m) => m.Inicio),
      },
      {
        path: 'transacoes',
        loadComponent: () =>
          import('./transacoes/transacoes').then((m) => m.Transacoes),
      },
      {
        path: 'orcamento',
        loadComponent: () =>
          import('./orcamento/orcamento').then((m) => m.Orcamento),
      },
      {
        path: 'categorias',
        loadComponent: () =>
          import('./categorias/categorias').then((m) => m.Categorias),
      },
      {
        path: 'avaliacoes',
        loadComponent: () =>
          import('./avaliacoes/avaliacoes').then((m) => m.Avaliacoes),
      },
      {
        path: 'projecoes',
        loadComponent: () =>
          import('./projecoes/projecoes').then((m) => m.Projecoes),
      },
      {
        path: 'recorrencias',
        loadComponent: () =>
          import('./recorrencias/recorrencias').then((m) => m.Recorrencias),
      },
      {
        path: 'conta',
        loadComponent: () => import('./conta/conta').then((m) => m.Conta),
      },
      {
        path: 'novidades',
        loadComponent: () =>
          import('./versao/novidades').then((m) => m.Novidades),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
