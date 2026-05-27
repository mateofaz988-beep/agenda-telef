import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpHeaders,
  HttpParams
} from '@angular/common/http';

import { Observable } from 'rxjs';

import { Contacto } from '../interfaces/contacto.interface';
import { AuthService } from './auth'; // 🔥 Se importa el servicio de autenticación

@Injectable({
  providedIn: 'root'
})
export class ContactosService {

  private readonly API_URL = 'http://127.0.0.1:5050/api';
  private readonly TOKEN_KEY = 'auth_token';

  constructor(
    private http: HttpClient,
    private authService: AuthService // 🔥 Se inyecta AuthService para obtener el token en tiempo real
  ) {}

  private getToken(): string {
    return this.authService.getToken(); // 🔥 Lee directamente el token sincronizado
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.getToken()}`
    });
  }

  listar(): Observable<Contacto[]> {
    return this.http.get<Contacto[]>(
      `${this.API_URL}/admin/contactos`,
      {
        headers: this.getHeaders()
      }
    );
  }

  listarPublicos(): Observable<Contacto[]> {
    return this.http.get<Contacto[]>(
      `${this.API_URL}/contactos`
    );
  }

  buscarPublicos(
    q: string = '',
    ciudad: string = 'Todos'
  ): Observable<Contacto[]> {
    const params = new HttpParams()
      .set('q', q || '')
      .set('ciudad', ciudad || 'Todos');

    return this.http.get<Contacto[]>(
      `${this.API_URL}/contactos/buscar`,
      { params }
    );
  }

  obtenerPorId(id: number): Observable<Contacto> {
    return this.http.get<Contacto>(
      `${this.API_URL}/contactos/${id}`
    );
  }

  crear(contacto: Contacto): Observable<any> {
    return this.http.post<any>(
      `${this.API_URL}/admin/contactos`,
      this.limpiarContacto(contacto),
      {
        headers: this.getHeaders()
      }
    );
  }

  actualizar(
    id: number,
    contacto: Contacto
  ): Observable<any> {
    return this.http.put<any>(
      `${this.API_URL}/admin/contactos/${id}`,
      this.limpiarContacto(contacto),
      {
        headers: this.getHeaders()
      }
    );
  }

  eliminar(id: number): Observable<any> {
    return this.http.delete<any>(
      `${this.API_URL}/admin/contactos/${id}`,
      {
        headers: this.getHeaders()
      }
    );
  }

  cambiarEstado(
    id: number,
    estado: 'activo' | 'inactivo'
  ): Observable<any> {
    return this.http.patch<any>(
      `${this.API_URL}/admin/contactos/${id}/estado`,
      { estado },
      {
        headers: this.getHeaders()
      }
    );
  }

  private limpiarContacto(contacto: Contacto): Contacto {
    return {
      ...contacto,
      nombres: this.normalizar(contacto.nombres),
      apellidos: this.normalizar(contacto.apellidos),
      cargo: this.normalizar(contacto.cargo),
      unidad: this.normalizar(contacto.unidad),
      ciudad: this.normalizar(contacto.ciudad),
      telefono: (contacto.telefono || '').replace(/\D/g, '').slice(0, 10),
      extension: (contacto.extension || '').replace(/\D/g, '').slice(0, 5),
      correo: (contacto.correo || '').trim().toLowerCase().replace(/\s/g, ''),
      estado: contacto.estado || 'activo',
      observacion: (contacto.observacion || '').trim()
    };
  }

  private normalizar(valor: string | undefined): string {
    return (valor || '').trim().replace(/\s+/g, ' ');
  }

}