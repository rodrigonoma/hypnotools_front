import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-import-test',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div style="padding: 20px;">
      <h1>Teste de Importação de Clientes</h1>
      <p>Se você está vendo esta página, a rota está funcionando!</p>
      <p>Timestamp: {{ timestamp }}</p>
    </div>
  `
})
export class ImportTestComponent {
  timestamp = new Date().toISOString();
}