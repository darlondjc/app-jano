import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@jano/data-access';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  await auth.whenReady();
  return auth.state() === 'logado'
    ? true
    : inject(Router).createUrlTree(['/entrar']);
};
