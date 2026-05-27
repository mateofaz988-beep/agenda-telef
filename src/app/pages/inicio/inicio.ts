import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Navbar } from '../../shared/navbar/navbar';

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [RouterLink, Navbar],
  templateUrl: './inicio.html',
  styleUrl: './inicio.scss'
})
export class Inicio {}