import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { Navbar } from '../../shared/navbar/navbar';
import { Contacto } from '../../core/interfaces/contacto.interface';
import { ContactosService } from '../../core/services/contactos';

@Component({
  selector: 'app-directorio',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Navbar
  ],
  templateUrl: './directorio.html',
  styleUrl: './directorio.scss'
})
export class Directorio implements OnInit {

  contactos: Contacto[] = [];

  searchText = '';

  ciudadSeleccionada = 'Todos';

  cargando = false;

  error = '';

  contactoAbiertoId: number | null = null;

  constructor(
    private contactosService: ContactosService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargarContactos();
  }

  cargarContactos(): void {
    this.cargando = true;
    this.error = '';

    this.contactosService.listarPublicos().subscribe({
      next: (data) => {
        this.contactos = data || [];

        if (
          this.ciudadSeleccionada !== 'Todos' &&
          !this.ciudadesDisponibles.includes(this.ciudadSeleccionada)
        ) {
          this.ciudadSeleccionada = 'Todos';
        }

        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('ERROR CARGANDO DIRECTORIO:', error);

        this.error =
          error?.error?.message ||
          'No se pudieron cargar los contactos.';

        this.contactos = [];
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  get ciudadesDisponibles(): string[] {
    const ciudades = this.contactos
      .map(contacto => this.normalizarTexto(contacto.ciudad))
      .filter(ciudad => ciudad.length > 0);

    return Array.from(new Set(ciudades)).sort((a, b) =>
      a.localeCompare(b, 'es')
    );
  }

  filtrarCiudad(ciudad: string): void {
    this.ciudadSeleccionada = ciudad;
    this.contactoAbiertoId = null;
  }

  limpiarBusqueda(): void {
    this.searchText = '';
    this.ciudadSeleccionada = 'Todos';
    this.contactoAbiertoId = null;
  }

  toggleContacto(id: number | undefined): void {
    if (!id) return;

    this.contactoAbiertoId =
      this.contactoAbiertoId === id ? null : id;
  }

  estaAbierto(id: number | undefined): boolean {
    return !!id && this.contactoAbiertoId === id;
  }

  get contactosFiltrados(): Contacto[] {
    const texto = this.normalizarTexto(this.searchText).toLowerCase();

    return this.contactos.filter(contacto => {
      const ciudadContacto = this.normalizarTexto(contacto.ciudad);

      const coincideCiudad =
        this.ciudadSeleccionada === 'Todos' ||
        ciudadContacto === this.ciudadSeleccionada;

      const contenido = `
        ${contacto.nombres || ''}
        ${contacto.apellidos || ''}
        ${contacto.cargo || ''}
        ${contacto.unidad || ''}
        ${contacto.ciudad || ''}
        ${contacto.telefono || ''}
        ${contacto.extension || ''}
        ${contacto.correo || ''}
        ${contacto.observacion || ''}
      `.toLowerCase();

      return coincideCiudad && contenido.includes(texto);
    });
  }

  normalizarTexto(valor: string | undefined | null): string {
    return (valor || '').trim().replace(/\s+/g, ' ');
  }

}