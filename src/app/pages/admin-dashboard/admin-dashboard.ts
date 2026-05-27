import { Component, OnInit, ChangeDetectorRef } from '@angular/core'; // <-- 1. AQUÍ CAMBIÓ
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { Contacto } from '../../core/interfaces/contacto.interface';
import { AuthService } from '../../core/services/auth';
import { ContactosService } from '../../core/services/contactos';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss'
})
export class AdminDashboard implements OnInit {

  searchText = '';
  contactos: Contacto[] = [];
  cargandoContactos = false;
  modalAbierto = false;
  modoEdicion = false;
  contactoEditandoId: number | null = null;
  errorFormulario = '';
  guardando = false;

  provinciasEcuador: string[] = [
    'Azuay', 'Bolívar', 'Cañar', 'Carchi', 'Chimborazo', 'Cotopaxi', 
    'El Oro', 'Esmeraldas', 'Galápagos', 'Guayas', 'Imbabura', 'Loja', 
    'Los Ríos', 'Manabí', 'Morona Santiago', 'Napo', 'Orellana', 'Pastaza', 
    'Pichincha', 'Santa Elena', 'Santo Domingo de los Tsáchilas', 
    'Sucumbíos', 'Tungurahua', 'Zamora Chinchipe'
  ];

  contactoForm: Contacto = this.nuevoContacto();

  // 2. AQUÍ SE INYECTÓ EL CDR EN EL CONSTRUCTOR
  constructor(
    private contactosService: ContactosService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef // <--- Agregado
  ) {}

  ngOnInit(): void {
    this.cargarContactos(); // Llama directo aquí sin retrasos ni setTimeout
  }

  cargarContactos(): void {
    const token = this.authService.getToken();

    if (!token) {
      console.warn('No existe token. Redirigiendo al login.');
      this.authService.logout();
      return;
    }

    this.cargandoContactos = true;

    this.contactosService.listar().subscribe({
      next: (data) => {
        this.contactos = data || [];
        this.cargandoContactos = false;
        this.cdr.detectChanges(); // <--- OBLIGA A ANGULAR A RENDERIZAR LA TABLA DE INMEDIATO
      },
      error: (error) => {
        console.error('ERROR AL CARGAR CONTACTOS:', error);
        this.cargandoContactos = false;
        this.cdr.detectChanges(); // <--- También aquí por seguridad
        if (error?.status === 401) {
          this.authService.logout();
        }
      }
    });
  }

  get contactosFiltrados(): Contacto[] {
    const texto = this.normalizarTexto(this.searchText).toLowerCase();

    return this.contactos.filter((contacto) => {
      const contenido = `
        ${contacto.nombres || ''}
        ${contacto.apellidos || ''}
        ${contacto.cargo || ''}
        ${contacto.unidad || ''}
        ${contacto.ciudad || ''}
        ${contacto.telefono || ''}
        ${contacto.extension || ''}
        ${contacto.correo || ''}
        ${contacto.estado || ''}
      `.toLowerCase();

      return contenido.includes(texto);
    });
  }

  get totalContactos(): number {
    return this.contactos.length;
  }

  get contactosActivos(): number {
    return this.contactos.filter(c => c.estado === 'activo').length;
  }

  get ciudadesRegistradas(): number {
    return new Set(
      this.contactos
        .map(c => this.normalizarTexto(c.ciudad))
        .filter(c => c.length > 0)
    ).size;
  }

  get unidadesRegistradas(): number {
    return new Set(
      this.contactos
        .map(c => this.normalizarTexto(c.unidad))
        .filter(u => u.length > 0)
    ).size;
  }

  nuevoContacto(): Contacto {
    return {
      nombres: '',
      apellidos: '',
      cargo: '',
      unidad: '',
      ciudad: '',
      telefono: '',
      extension: '',
      correo: '',
      estado: 'activo',
      observacion: ''
    };
  }

  agregar(): void {
    this.modalAbierto = true;
    this.modoEdicion = false;
    this.contactoEditandoId = null;
    this.errorFormulario = '';
    this.guardando = false;
    this.contactoForm = this.nuevoContacto();
  }

  editar(contacto: Contacto): void {
    this.modalAbierto = true;
    this.modoEdicion = true;
    this.contactoEditandoId = contacto.id || null;
    this.errorFormulario = '';
    this.guardando = false;
    this.contactoForm = {
      ...contacto,
      extension: contacto.extension || '',
      correo: contacto.correo || '',
      observacion: contacto.observacion || ''
    };
  }

  cerrarModal(): void {
    this.modalAbierto = false;
    this.modoEdicion = false;
    this.contactoEditandoId = null;
    this.errorFormulario = '';
    this.guardando = false;
    this.contactoForm = this.nuevoContacto();
  }

  guardarContacto(): void {
    this.errorFormulario = '';
    this.limpiarFormulario();

    const validacion = this.validarFormulario();
    if (!validacion.ok) {
      this.errorFormulario = validacion.mensaje;
      return;
    }

    this.guardando = true;

    if (this.modoEdicion && this.contactoEditandoId) {
      this.contactosService.actualizar(this.contactoEditandoId, this.contactoForm).subscribe({
        next: () => {
          this.cargarContactos();
          this.cerrarModal();
        },
        error: (error) => {
          console.error('ERROR COMPLETO AL ACTUALIZAR CONTACTO:', error);
          this.errorFormulario =
            error?.error?.message ||
            error?.error?.mensaje ||
            `Error ${error?.status}: No se pudo actualizar el contacto.`;
          this.guardando = false;
        }
      });
      return;
    }

    this.contactosService.crear(this.contactoForm).subscribe({
      next: () => {
        this.cargarContactos();
        this.cerrarModal();
      },
      error: (error) => {
        console.error('ERROR COMPLETO AL CREAR CONTACTO:', error);
        this.errorFormulario =
          error?.error?.message ||
          error?.error?.mensaje ||
          `Error ${error?.status}: No se pudo guardar el contacto.`;
        this.guardando = false;
      }
    });
  }

  eliminar(contacto: Contacto): void {
    if (!contacto.id) return;

    const confirmar = confirm(`¿Eliminar a ${contacto.nombres} ${contacto.apellidos}?`);
    if (!confirmar) return;

    this.contactosService.eliminar(contacto.id).subscribe({
      next: () => {
        this.cargarContactos();
      },
      error: (error) => {
        console.error('ERROR AL ELIMINAR CONTACTO:', error);
      }
    });
  }

  soloLetrasInput(campo: 'nombres' | 'apellidos'): void {
    const valor = this.contactoForm[campo] || '';
    this.contactoForm[campo] = valor
      .replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]/g, '')
      .replace(/\s+/g, ' ');
  }

  telefonoInput(): void {
    this.contactoForm.telefono = (this.contactoForm.telefono || '')
      .replace(/\D/g, '')
      .slice(0, 10);
  }

  bloquearNoNumeros(event: KeyboardEvent): void {
    const teclasPermitidas = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (teclasPermitidas.includes(event.key)) return;
    if (!/^[0-9]$/.test(event.key)) {
      event.preventDefault();
      return;
    }
    if ((this.contactoForm.telefono || '').length >= 10) {
      event.preventDefault();
    }
  }

  extensionInput(): void {
    this.contactoForm.extension = (this.contactoForm.extension || '')
      .replace(/\D/g, '')
      .slice(0, 5);
  }

  bloquearExtension(event: KeyboardEvent): void {
    const teclasPermitidas = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (teclasPermitidas.includes(event.key)) return;
    if (!/^[0-9]$/.test(event.key)) {
      event.preventDefault();
      return;
    }
    if ((this.contactoForm.extension || '').length >= 5) {
      event.preventDefault();
    }
  }

  correoInput(): void {
    this.contactoForm.correo = (this.contactoForm.correo || '')
      .trim()
      .toLowerCase()
      .replace(/\s/g, '');
  }

  bloquearEspaciosCorreo(event: KeyboardEvent): void {
    if (event.key === ' ') {
      event.preventDefault();
    }
  }

  limpiarFormulario(): void {
    this.contactoForm.nombres = this.normalizarTexto(this.contactoForm.nombres);
    this.contactoForm.apellidos = this.normalizarTexto(this.contactoForm.apellidos);
    this.contactoForm.cargo = this.normalizarTexto(this.contactoForm.cargo);
    this.contactoForm.unidad = this.normalizarTexto(this.contactoForm.unidad);
    this.contactoForm.ciudad = this.normalizarTexto(this.contactoForm.ciudad);

    this.contactoForm.telefono = (this.contactoForm.telefono || '').replace(/\D/g, '').slice(0, 10);
    this.contactoForm.extension = (this.contactoForm.extension || '').replace(/\D/g, '').slice(0, 5);
    this.contactoForm.correo = (this.contactoForm.correo || '').trim().toLowerCase().replace(/\s/g, '');
    this.contactoForm.observacion = (this.contactoForm.observacion || '').trim();

    if (!this.contactoForm.estado) {
      this.contactoForm.estado = 'activo';
    }
  }

  normalizarTexto(valor: string | undefined | null): string {
    return (valor || '').trim().replace(/\s+/g, ' ');
  }

  validarFormulario(): { ok: boolean; mensaje: string; } {
    const nombres = this.contactoForm.nombres;
    const apellidos = this.contactoForm.apellidos;
    const cargo = this.contactoForm.cargo;
    const unidad = this.contactoForm.unidad;
    const ciudad = this.contactoForm.ciudad;
    const telefono = this.contactoForm.telefono;
    const extension = this.contactoForm.extension || '';
    const correo = this.contactoForm.correo || '';
    const estado = this.contactoForm.estado;

    if (!nombres) return { ok: false, mensaje: 'Ingrese los nombres.' };
    if (nombres.length < 2) return { ok: false, mensaje: 'Los nombres deben tener mínimo 2 caracteres.' };
    if (!this.soloLetras(nombres)) return { ok: false, mensaje: 'Los nombres solo pueden contener letras.' };

    if (!apellidos) return { ok: false, mensaje: 'Ingrese los apellidos.' };
    if (apellidos.length < 2) return { ok: false, mensaje: 'Los apellidos deben tener mínimo 2 caracteres.' };
    if (!this.soloLetras(apellidos)) return { ok: false, mensaje: 'Los apellidos solo pueden contener letras.' };

    if (!cargo) return { ok: false, mensaje: 'Ingrese el cargo.' };
    if (cargo.length < 3) return { ok: false, mensaje: 'El cargo debe tener mínimo 3 caracteres.' };

    if (!unidad) return { ok: false, mensaje: 'Ingrese la unidad.' };
    if (unidad.length < 3) return { ok: false, mensaje: 'La unidad debe tener mínimo 3 caracteres.' };

    if (!ciudad) return { ok: false, mensaje: 'Seleccione una provincia.' };

    if (!telefono) return { ok: false, mensaje: 'Ingrese el teléfono.' };
    if (!/^[0-9]+$/.test(telefono)) return { ok: false, mensaje: 'El teléfono solo puede contener números.' };
    if (telefono.length !== 10) return { ok: false, mensaje: 'El teléfono debe tener exactamente 10 números.' };

    if (extension && !/^[0-9]+$/.test(extension)) return { ok: false, mensaje: 'La extensión solo puede contener números.' };
    if (extension && extension.length > 5) return { ok: false, mensaje: 'La extensión debe tener máximo 5 números.' };

    if (correo && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(correo)) {
      return { ok: false, mensaje: 'Ingrese un correo válido.' };
    }

    if (estado !== 'activo' && estado !== 'inactivo') return { ok: false, mensaje: 'Seleccione un estado válido.' };

    if (this.existeDuplicado()) {
      return { ok: false, mensaje: 'Ya existe un contacto con el mismo correo o teléfono.' };
    }

    return { ok: true, mensaje: '' };
  }

  soloLetras(valor: string): boolean {
    return /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]+$/.test(valor);
  }

  existeDuplicado(): boolean {
    const correo = (this.contactoForm.correo || '').toLowerCase();
    const telefono = this.contactoForm.telefono;

    return this.contactos.some(contacto => {
      if (this.modoEdicion && contacto.id === this.contactoEditandoId) {
        return false;
      }
      const mismoCorreo = correo && (contacto.correo || '').toLowerCase() === correo;
      const mismoTelefono = contacto.telefono === telefono;

      return !!mismoCorreo || mismoTelefono;
    });
  }

  logout(): void {
    this.authService.logout();
  }
}
