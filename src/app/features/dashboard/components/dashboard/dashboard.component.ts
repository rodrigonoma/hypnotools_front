import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService, UsuarioInfo } from '../../../../core/services/auth.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    MatToolbarModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  currentUser$: Observable<UsuarioInfo | null>;
  empresa$: Observable<string | null>;

  // Cards de funcionalidades disponíveis
  funcionalidades = [
    {
      titulo: 'Importar Produtos ERP',
      descricao: 'Importar estrutura de produtos do ERP UAU para o sistema Transacional',
      icone: 'cloud_download',
      rota: '/erp/importar-produtos',
      cor: 'primary',
      disponivel: true
    },
    {
      titulo: 'Importar Clientes',
      descricao: 'Importar clientes a partir de planilhas Excel ou CSV',
      icone: 'people',
      rota: '/import-clients-test',
      cor: 'primary',
      disponivel: true
    },
    {
      titulo: 'Excluir Clientes',
      descricao: 'Exclusão em massa de clientes com controle de dependências',
      icone: 'delete_forever',
      rota: '/clients/delete',
      cor: 'warn',
      disponivel: true
    },
    {
      titulo: 'Configurações ERP',
      descricao: 'Configurar conexões e credenciais do ERP',
      icone: 'settings',
      rota: '/erp/configuracoes',
      cor: 'accent',
      disponivel: false // Funcionalidade futura
    },
    {
      titulo: 'Histórico de Importações',
      descricao: 'Visualizar histórico de importações realizadas',
      icone: 'history',
      rota: '/erp/historico',
      cor: 'warn',
      disponivel: false // Funcionalidade futura
    },
    {
      titulo: 'Relatórios',
      descricao: 'Gerar relatórios de integração e sincronização',
      icone: 'assessment',
      rota: '/relatorios',
      cor: 'primary',
      disponivel: false // Funcionalidade futura
    }
  ];

  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    this.currentUser$ = this.authService.currentUser$;
    this.empresa$ = this.authService.empresa$;
  }

  ngOnInit(): void {
    // Verificar se está autenticado
    if (!this.authService.isAuthenticated) {
      this.router.navigate(['/login']);
    }
  }

  navegarPara(rota: string, disponivel: boolean): void {
    console.log('Navegando para:', rota, 'Disponível:', disponivel);
    if (disponivel) {
      console.log('Tentando navegar para:', rota);
      this.router.navigate([rota]);
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) {
      return 'Bom dia';
    } else if (hour < 18) {
      return 'Boa tarde';
    } else {
      return 'Boa noite';
    }
  }

  getCurrentDate(): Date {
    return new Date();
  }
}