export interface Contacto {
  id?: number;
  nombres: string;
  apellidos: string;
  cargo: string;
  unidad: string;
  ciudad: string;
  telefono: string;
  extension?: string;
  correo?: string;
  estado: 'activo' | 'inactivo';
  observacion?: string;
  created_at?: string;
  updated_at?: string;
}