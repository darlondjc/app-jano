import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@jano/data-access';

export const authGuard: CanActivateFn = async () => {
  // inject() só funciona de forma síncrona: pegue tudo antes do primeiro await.
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.whenReady();
  return auth.state() === 'logado' ? true : router.createUrlTree(['/entrar']);
};
