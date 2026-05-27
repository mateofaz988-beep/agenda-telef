import { inject } from '@angular/core';

import {
  CanActivateFn,
  Router
} from '@angular/router';

import { AuthService } from '../services/auth';

export const authGuard: CanActivateFn = () => {

  const authService = inject(AuthService);

  const router = inject(Router);

  // Verifica sesión válida
  const autenticado =
    authService.estaAutenticado();

  if (autenticado) {

    return true;

  }

  // Limpia sesión inválida o expirada
  authService.limpiarSesion();

  // Redirige al login
  router.navigate([
    '/admin/login'
  ]);

  return false;

};