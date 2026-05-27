import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private readonly TOKEN_KEY = 'auth_token';
  private readonly ADMIN_KEY = 'admin_user';

  // 🔥 Estado reactivo del token para evitar condiciones de carrera
  private tokenSubject = new BehaviorSubject<string>(this.getTokenFromStorage());
  public token$: Observable<string> = this.tokenSubject.asObservable();

  constructor(
    private router: Router
  ) {}

  guardarSesion(token: string, admin: any): void {
    if (!token) {
      return;
    }

    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.ADMIN_KEY, JSON.stringify(admin || {}));
    
    // 🔥 Notifica el nuevo token inmediatamente a toda la app
    this.tokenSubject.next(token);
  }

  // Mantiene compatibilidad síncrona por si la necesitas
  getToken(): string {
    return this.tokenSubject.value;
  }

  private getTokenFromStorage(): string {
    return localStorage.getItem(this.TOKEN_KEY) || '';
  }

  getAdmin(): any {
    const admin = localStorage.getItem(this.ADMIN_KEY);
    try {
      return admin ? JSON.parse(admin) : null;
    } catch {
      return null;
    }
  }

  isLoggedIn(): boolean {
    const token = this.getToken();
    if (!token) {
      return false;
    }
    return !this.tokenExpirado(token);
  }

  estaAutenticado(): boolean {
    return this.isLoggedIn();
  }

  private tokenExpirado(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (!payload.exp) {
        return false;
      }
      const fechaActual = Math.floor(Date.now() / 1000);
      return payload.exp < fechaActual;
    } catch {
      return true;
    }
  }

  obtenerHeadersAuth(): { [key: string]: string } {
    return {
      Authorization: `Bearer ${this.getToken()}`
    };
  }

  limpiarSesion(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.ADMIN_KEY);
    
    // 🔥 Limpia el flujo reactivo
    this.tokenSubject.next('');
  }

  logout(): void {
    this.limpiarSesion();
    this.router.navigate(['/admin/login']);
  }
}