export interface Administrador {
  id?: number;
  nombres: string;
  apellidos: string;
  usuario: string;
  correo: string;
  estado: 'activo' | 'inactivo';
  ultimo_acceso?: string;
}