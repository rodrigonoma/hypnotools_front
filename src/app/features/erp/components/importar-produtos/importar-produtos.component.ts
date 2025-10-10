import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatStepperModule } from '@angular/material/stepper';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { SelectionModel } from '@angular/cdk/collections';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { ErpService, ObraAtivaModel, UnidadeDetalhadaModel, CampoPersonalizadoModel } from '../../../../core/services/erp.service';
import { ImportacaoProdutoService, ImportacaoERPRequest } from '../../../../core/services/importacao-produto.service';

@Component({
  selector: 'app-importar-produtos',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatToolbarModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatStepperModule,
    MatTableModule,
    MatCheckboxModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule
  ],
  templateUrl: './importar-produtos.component.html',
  styleUrls: ['./importar-produtos.component.scss']
})
export class ImportarProdutosComponent implements OnInit {
  // Estados da aplicação
  isLoading = false;
  currentStep = 1;
  empresa: string | null = null;

  // Dados ERP
  obrasAtivas: ObraAtivaModel[] = [];
  obraSelecionada: ObraAtivaModel | null = null;
  unidadesDetalhadas: UnidadeDetalhadaModel[] = [];
  camposPersonalizados: CampoPersonalizadoModel[] = [];

  // ID do produto para atualização
  idProdutoManual: number | null = null;

  // Filtros
  filtroNome = '';
  filtroObra = '';
  filtroEmpresa = '';
  obrasFiltradasCount = 0;

  // Seleção de unidades
  selectionModel = new SelectionModel<UnidadeDetalhadaModel>(true, []);

  // Colunas da tabela de unidades
  displayedColumns: string[] = [
    'select',
    'codigoUnidade',
    'descricaoUnidade',
    'tipoUnidade',
    'andar',
    'areaPrivativa',
    'areaTotal',
    'valorVenda',
    'status'
  ];

  constructor(
    private authService: AuthService,
    private erpService: ErpService,
    private importacaoService: ImportacaoProdutoService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.empresa = this.authService.empresaValue;

    if (!this.empresa) {
      this.snackBar.open('Empresa não selecionada. Faça login novamente.', 'Fechar', {
        duration: 5000,
        panelClass: ['error-snackbar']
      });
      this.router.navigate(['/login']);
      return;
    }

    this.carregarObrasAtivas();
  }

  carregarObrasAtivas(): void {
    if (!this.empresa) return;

    this.isLoading = true;
    this.erpService.getObrasAtivas(this.empresa).subscribe({
      next: (obras) => {

        this.obrasAtivas = obras;
        this.filtrarObras(); // Aplicar filtro inicial
        this.isLoading = false;

        if (obras.length === 0) {
          this.snackBar.open('Nenhuma obra ativa encontrada no ERP.', 'Fechar', {
            duration: 5000,
            panelClass: ['warning-snackbar']
          });
        }
      },
      error: (error) => {
        console.error('Erro ao carregar obras ativas:', error);
        this.isLoading = false;
        this.snackBar.open('Erro ao carregar obras do ERP.', 'Fechar', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
      }
    });
  }

  selecionarObra(obra: ObraAtivaModel): void {
    this.obraSelecionada = obra;
    this.currentStep = 2;
    this.carregarUnidadesDetalhadas();
  }

  carregarUnidadesDetalhadas(): void {
    if (!this.empresa || !this.obraSelecionada) return;

    this.isLoading = true;

    // Carregar unidades e campos personalizados em paralelo
    const unidades$ = this.erpService.getUnidadesDetalhadas(this.empresa, this.obraSelecionada.codigoObra);
    const campos$ = this.erpService.getCamposPersonalizados(this.empresa, this.obraSelecionada.codigoObra);

    // Usar forkJoin para executar ambas as chamadas em paralelo

    forkJoin({
      unidades: unidades$,
      campos: campos$
    }).subscribe({
      next: ({ unidades, campos }) => {
        this.unidadesDetalhadas = unidades;
        this.camposPersonalizados = campos;
        this.selectionModel.clear();
        this.isLoading = false;
        this.currentStep = 3;

        console.log('Campos personalizados carregados:', campos);

        if (unidades.length === 0) {
          this.snackBar.open('Nenhuma unidade encontrada para esta obra.', 'Fechar', {
            duration: 5000,
            panelClass: ['warning-snackbar']
          });
        }
      },
      error: (error) => {
        console.error('Erro ao carregar dados da obra:', error);
        this.isLoading = false;
        this.snackBar.open('Erro ao carregar dados da obra.', 'Fechar', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
      }
    });
  }

  // Métodos de seleção da tabela
  isAllSelected(): boolean {
    const numSelected = this.selectionModel.selected.length;
    const numRows = this.unidadesDetalhadas.length;
    return numSelected === numRows;
  }

  masterToggle(): void {
    this.isAllSelected() ?
      this.selectionModel.clear() :
      this.unidadesDetalhadas.forEach(row => this.selectionModel.select(row));
  }

  importarUnidades(): void {
    if (!this.empresa || !this.obraSelecionada || this.selectionModel.selected.length === 0) {
      this.snackBar.open('Selecione pelo menos uma unidade para importar.', 'Fechar', {
        duration: 3000,
        panelClass: ['warning-snackbar']
      });
      return;
    }

    this.isLoading = true;

    const request: ImportacaoERPRequest = {
      empresa: this.empresa,
      codigoObra: this.obraSelecionada.codigoObra,
      unidades: this.selectionModel.selected
    };

    this.importacaoService.importarProdutoERP(request).subscribe({
      next: (resultado) => {
        this.isLoading = false;

        if (resultado.success) {
          this.snackBar.open(
            `Importação concluída! ${resultado.unidadesImportadas}/${resultado.totalUnidades} unidades importadas.`,
            'Fechar',
            {
              duration: 7000,
              panelClass: ['success-snackbar']
            }
          );

          // Limpar seleções após importação bem-sucedida
          this.selectionModel.clear();
        } else {
          this.snackBar.open(resultado.message || 'Falha na importação.', 'Ver detalhes', {
            duration: 10000,
            panelClass: ['error-snackbar']
          });

          if (resultado.erros && resultado.erros.length > 0) {
            console.error('Erros de importação:', resultado.erros);
          }
        }
      },
      error: (error) => {
        console.error('Erro durante importação:', error);
        this.isLoading = false;
        this.snackBar.open('Erro interno durante a importação.', 'Fechar', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
      }
    });
  }

  voltarEtapa(): void {
    if (this.currentStep === 3) {
      // Da tela de unidades volta direto para a tela de obras
      this.currentStep = 1;
      this.obraSelecionada = null;
      this.unidadesDetalhadas = [];
      this.camposPersonalizados = [];
      this.selectionModel.clear();
    } else if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  voltarDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  formatarValor(valor?: number): string {
    if (!valor) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  }

  formatarArea(area?: number): string {
    if (!area) return '-';
    return `${area.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`;
  }

  // Método para track by na lista de unidades
  trackByUnidade(index: number, unidade: UnidadeDetalhadaModel): string {
    return `${unidade.codigoObra}-${unidade.codigoUnidade}`;
  }

  // Método para toggle de seleção ao clicar no card
  toggleUnidadeSelection(unidade: UnidadeDetalhadaModel): void {
    this.selectionModel.toggle(unidade);
  }

  // Método para obter classe CSS do status
  getStatusClass(status: string | undefined): string {
    const statusLower = (status ?? '').toLowerCase();

    if (statusLower.includes('disponível')) return 'status-disponivel';
    if (statusLower.includes('vendida')) return 'status-vendida';
    if (statusLower.includes('reservada')) return 'status-reservada';
    if (statusLower.includes('indisponível')) return 'status-indisponivel';

    return 'status-default';
  }

  // Métodos de filtro
  filtrarObras(): void {
    this.obrasFiltradasCount = this.obrasAtivas.filter(obra => this.passaFiltros(obra)).length;
  }

  passaFiltros(obra: ObraAtivaModel): boolean {
    const passaNome = !this.filtroNome.trim() ||
      obra.nomeObra.toLowerCase().includes(this.filtroNome.toLowerCase());

    const passaObra = !this.filtroObra.trim() ||
      obra.codigoObra.toLowerCase().includes(this.filtroObra.toLowerCase());

    const passaEmpresa = !this.filtroEmpresa.trim() ||
      obra.empresaObra.toString().includes(this.filtroEmpresa);

    return passaNome && passaObra && passaEmpresa;
  }

  limparFiltros(): void {
    this.filtroNome = '';
    this.filtroObra = '';
    this.filtroEmpresa = '';
    this.filtrarObras();
  }

  atualizarIdExterno(): void {
    if (!this.empresa || !this.obraSelecionada || this.selectionModel.selected.length === 0) {
      this.snackBar.open('Selecione pelo menos uma unidade para atualizar.', 'Fechar', {
        duration: 3000,
        panelClass: ['warning-snackbar']
      });
      return;
    }

    // Verificar se foi informado um ID de produto (manual ou automático)
    const idProduto = this.idProdutoManual || this.obraSelecionada.idProduto;

    if (!idProduto || idProduto <= 0) {
      this.snackBar.open('Informe o ID do Produto no campo abaixo para atualizar as unidades.', 'Fechar', {
        duration: 5000,
        panelClass: ['warning-snackbar']
      });
      return;
    }

    this.isLoading = true;

    // Mapear unidades selecionadas para o formato esperado pela API
    // O campo Identificador_unid vem dos campos dinâmicos da unidade
    const unidadesParaAtualizar = this.selectionModel.selected
      .map(unidade => ({
        identificador_unid: unidade.codigoUnidade || unidade.descricaoUnidade
      }))
      .filter(u => u.identificador_unid); // Filtrar apenas unidades com identificador válido

    if (unidadesParaAtualizar.length === 0) {
      this.isLoading = false;
      this.snackBar.open('Nenhuma unidade válida com Identificador_unid encontrada.', 'Fechar', {
        duration: 5000,
        panelClass: ['warning-snackbar']
      });
      return;
    }

    // Criar request com IdProduto e unidades
    const request = {
      idProduto: idProduto,
      unidades: unidadesParaAtualizar
    };

    this.erpService.atualizarIdExterno(request).subscribe({
      next: (resultado) => {
        this.isLoading = false;

        if (resultado.success) {
          this.snackBar.open(
            `Atualização concluída! ${resultado.totalAtualizados}/${resultado.totalRecebidos} unidades atualizadas.`,
            'Fechar',
            {
              duration: 7000,
              panelClass: ['success-snackbar']
            }
          );

          // Limpar seleções após atualização bem-sucedida
          this.selectionModel.clear();
        } else {
          this.snackBar.open(
            resultado.message || 'Falha na atualização do ID externo.',
            'Ver detalhes',
            {
              duration: 10000,
              panelClass: ['error-snackbar']
            }
          );

          if (resultado.error) {
            console.error('Erro na atualização:', resultado.error);
          }
        }
      },
      error: (error) => {
        console.error('Erro durante atualização de ID externo:', error);
        this.isLoading = false;
        this.snackBar.open('Erro interno durante a atualização.', 'Fechar', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
      }
    });
  }
}