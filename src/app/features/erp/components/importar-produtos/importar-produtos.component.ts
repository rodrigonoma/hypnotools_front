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
import { ScrollingModule } from '@angular/cdk/scrolling';
import { SelectionModel } from '@angular/cdk/collections';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { ErpService, ObraAtivaModel, UnidadeDetalhadaModel, CampoPersonalizadoModel } from '../../../../core/services/erp.service';
import { ImportacaoProdutoService, ImportacaoERPRequest } from '../../../../core/services/importacao-produto.service';
import { ModalMapearCamposComponent } from '../modal-mapear-campos/modal-mapear-campos.component';
import { ImportacaoProdutoService as ImportacaoEstruturaService } from '../../services/importacao-produto.service';

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
    MatInputModule,
    ScrollingModule
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
  unidadesExibidas: UnidadeDetalhadaModel[] = [];
  camposPersonalizados: CampoPersonalizadoModel[] = [];

  // Paginação para renderização
  batchSize = 50; // Renderizar 50 cards por vez
  currentBatch = 1;

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
    private importacaoEstruturaService: ImportacaoEstruturaService,
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

        // Se não há campos do BuscaCamposPerson, usar detecção automática dos campos das unidades
        if ((!campos || campos.length === 0) && unidades.length > 0) {
          const todasChaves = Object.keys(unidades[0]);
          const camposC = todasChaves.filter(key => /^c\d+_unid$/i.test(key));

          if (camposC.length > 0) {
            // Criar campos personalizados automaticamente
            this.camposPersonalizados = camposC
              .sort((a, b) => {
                const numA = parseInt(a.match(/\d+/)?.[0] || '0');
                const numB = parseInt(b.match(/\d+/)?.[0] || '0');
                return numA - numB;
              })
              .map(campo => ({
                campo: campo,
                descricao: campo.replace(/_unid$/i, '').toUpperCase()
              }));
          }
        }

        // Renderizar primeiro lote de unidades
        this.currentBatch = 1;
        this.carregarMaisUnidades();
        this.currentStep = 3;

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

  // Método para carregar mais unidades (paginação)
  carregarMaisUnidades(): void {
    const startIndex = 0;
    const endIndex = this.currentBatch * this.batchSize;
    this.unidadesExibidas = this.unidadesDetalhadas.slice(startIndex, endIndex);
  }

  // Método chamado ao fazer scroll
  onScroll(event: any): void {
    const element = event.target;
    const threshold = 200; // pixels do final
    const position = element.scrollTop + element.offsetHeight;
    const height = element.scrollHeight;

    if (position > height - threshold && this.unidadesExibidas.length < this.unidadesDetalhadas.length) {
      this.currentBatch++;
      this.carregarMaisUnidades();
    }
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

  /**
   * Abre modal de mapeamento e importa estrutura completa
   */
  importarUnidades(): void {
    if (!this.empresa || !this.obraSelecionada || this.selectionModel.selected.length === 0) {
      this.snackBar.open('Selecione pelo menos uma unidade para importar.', 'Fechar', {
        duration: 3000,
        panelClass: ['warning-snackbar']
      });
      return;
    }

    // Verificar se foi informado um ID de produto
    const idProduto = this.idProdutoManual || this.obraSelecionada.idProduto;

    if (!idProduto || idProduto <= 0) {
      this.snackBar.open('Informe o ID do Produto no campo abaixo para importar.', 'Fechar', {
        duration: 5000,
        panelClass: ['warning-snackbar']
      });
      return;
    }

    // Abrir modal de mapeamento
    const dialogRef = this.dialog.open(ModalMapearCamposComponent, {
      width: '95vw',
      maxWidth: '1200px',
      maxHeight: '95vh',
      disableClose: false,
      data: {
        idProduto: idProduto,
        obraId: this.obraSelecionada.codigoObra,
        obraNome: this.obraSelecionada.nomeObra,
        dataEntregaObra: this.obraSelecionada.dtfim_obr, // Data de término da obra
        unidades: this.selectionModel.selected,
        camposPersonalizados: this.camposPersonalizados
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.sucesso) {
        // Processar importação com os mapeamentos
        this.processarImportacaoComMapeamento(
          idProduto,
          this.obraSelecionada!.codigoObra,
          this.obraSelecionada!.nomeObra,
          this.obraSelecionada!.dtfim_obr,
          result.unidades,
          result.mapeamentos,
          result.mapeamentosStatus || []
        );
      }
    });
  }

  /**
   * Processa importação com os mapeamentos configurados
   */
  private processarImportacaoComMapeamento(
    idProduto: number,
    obraId: string,
    obraNome: string,
    dataEntregaObra: string | undefined,
    unidades: UnidadeDetalhadaModel[],
    mapeamentos: any[],
    mapeamentosStatus: any[]
  ): void {
    this.isLoading = true;

    // Exibir mensagem de feedback para grandes volumes
    if (unidades.length > 500) {
      this.snackBar.open(
        `Processando ${unidades.length} unidades... Isso pode levar alguns minutos. Por favor, aguarde.`,
        '',
        {
          duration: 0, // Não fecha automaticamente
          panelClass: ['info-snackbar']
        }
      );
    }

    this.importacaoEstruturaService.importarEstruturaProduto(
      idProduto,
      obraId,
      obraNome,
      dataEntregaObra,
      unidades,
      mapeamentos,
      mapeamentosStatus
    ).subscribe({
      next: (resultado) => {
        this.isLoading = false;
        this.snackBar.dismiss(); // Fechar a mensagem de progresso

        if (resultado.success) {
          this.snackBar.open(
            `Estrutura importada com sucesso! ${resultado.totalUnidades || unidades.length} unidades processadas.`,
            'Fechar',
            {
              duration: 7000,
              panelClass: ['success-snackbar']
            }
          );

          // Limpar seleções após importação bem-sucedida
          this.selectionModel.clear();

          // Voltar para lista de obras
          this.voltarEtapa();
        } else {
          this.snackBar.open(
            resultado.message || 'Falha na importação da estrutura.',
            'Ver detalhes',
            {
              duration: 10000,
              panelClass: ['error-snackbar']
            }
          );

          if (resultado.error) {
            console.error('Erro na importação:', resultado.error);
          }
        }
      },
      error: (error) => {
        console.error('Erro durante importação da estrutura:', error);
        this.isLoading = false;
        this.snackBar.dismiss(); // Fechar a mensagem de progresso

        let mensagemErro = 'Erro interno durante a importação.';
        if (error.error && error.error.message) {
          mensagemErro = error.error.message;
        } else if (error.message) {
          mensagemErro = error.message;
        }

        this.snackBar.open(mensagemErro, 'Fechar', {
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

  // Método para obter valor de campo personalizado (otimizado)
  getValorCampoPersonalizado(unidade: UnidadeDetalhadaModel, nomeCampo: string): string | null {
    // Tentar busca direta primeiro (mais rápido)
    let valor = unidade[nomeCampo] ?? unidade[nomeCampo.toUpperCase()] ?? unidade[nomeCampo.toLowerCase()];

    // Se não encontrou, fazer busca case-insensitive nas chaves
    if (valor === undefined || valor === null || valor === 'null' || valor === '') {
      const todasChaves = Object.keys(unidade);
      const chaveEncontrada = todasChaves.find(k => k.toLowerCase() === nomeCampo.toLowerCase());
      if (chaveEncontrada) {
        valor = unidade[chaveEncontrada];
      }
    }

    // Se não encontrou e valor é inválido, retornar null
    if (valor === undefined || valor === null || valor === 'null' || valor === '') {
      return null;
    }

    return valor;
  }

  // Método para verificar se campo tem valor válido
  hasValorCampoPersonalizado(unidade: UnidadeDetalhadaModel, nomeCampo: string): boolean {
    const valor = this.getValorCampoPersonalizado(unidade, nomeCampo);
    return valor !== null && valor !== '';
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

    // Obter código da obra selecionada
    const codigoObra = this.obraSelecionada.codigoObra;

    // Chamar serviço com os parâmetros corretos (idProduto, codigoObra, unidades)
    this.erpService.atualizarIdExterno(idProduto, codigoObra, unidadesParaAtualizar).subscribe({
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