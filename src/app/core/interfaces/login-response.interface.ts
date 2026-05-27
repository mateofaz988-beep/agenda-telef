import { Administrador } from './administrador.interface';

export interface LoginResponse {
  success: boolean;
  message: string;
  token: string;
  admin: Administrador;
}