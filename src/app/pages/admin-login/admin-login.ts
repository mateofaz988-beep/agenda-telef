import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';

import { AuthService } from '../../core/services/auth';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './admin-login.html',
  styleUrl: './admin-login.scss'
})
export class AdminLogin {

  usuario = '';
  password = '';
  cargando = false;
  error = '';

  private readonly API_URL = 'http://127.0.0.1:5050/api';

  constructor(
    private router: Router,
    private authService: AuthService,
    private http: HttpClient
  ) {}

  login(): void {
    this.error = '';

    if (!this.usuario.trim()) {
      this.error = 'Ingrese el usuario.';
      return;
    }

    if (!this.password.trim()) {
      this.error = 'Ingrese la contraseña.';
      return;
    }

    this.cargando = true;

    this.http.post<any>(`${this.API_URL}/auth/login`, {
      usuario: this.usuario.trim(),
      password: this.password.trim()
    }).subscribe({
      next: (response) => {
        this.authService.guardarSesion(
          response.data.token,
          response.data.admin
        );

        this.router.navigate(['/admin/dashboard']);
        this.cargando = false;
      },
      error: (error) => {
        this.error = error?.error?.message || 'Credenciales incorrectas.';
        this.cargando = false;
      }
    });
  }
}