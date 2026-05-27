import { Routes } from '@angular/router';

import { Inicio } from './pages/inicio/inicio';
import { Directorio } from './pages/directorio/directorio';
import { AdminLogin } from './pages/admin-login/admin-login';
import { AdminDashboard } from './pages/admin-dashboard/admin-dashboard';
import { authGuard } from './core/guards/auth-guard';


export const routes: Routes = [
  {
    path: '',
    component: Inicio,
    title: 'Agenda Telefónica | INAMHI'
  },
  {
    path: 'directorio',
    component: Directorio,
    title: 'Directorio Telefónico | INAMHI'
  },
  {
    path: 'admin/login',
    component: AdminLogin,
    title: 'Login Administrador | INAMHI'
  },
  {
    path: 'admin/dashboard',
    component: AdminDashboard,
    canActivate: [authGuard],
    title: 'Panel Administrativo | INAMHI'
  },
  {
    path: '**',
    redirectTo: ''
  }
];