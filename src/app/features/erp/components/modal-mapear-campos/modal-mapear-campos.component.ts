import { Component, Inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatStepperModule } from '@angular/material/stepper';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { CampoObrigatorio, MapeamentoCampo, ValidacaoMapeamento } from '../../models/importacao-produto.model';
import { MapeamentoCamposService } from '../../services/mapeamento-campos.service';
import { MapeamentoCamposConfig, MapeamentoResultado, PADROES_MAPEAMENTO, StatusUnidade, MapeamentoStatus } from '../../models/mapeamento-campos.model';
import { ModalVisualizarDadosErpComponent } from '../modal-visualizar-dados-erp/modal-visualizar-dados-erp';

export interface UnidadeDetalhadaModel {
  [key: string]: any;
  codigoUnidade: string;
  descricaoUnidade?: string;
  codigoObra: string;
  nomeObra?: string;
  areaPrivativa?: number;
  areaTotal?: number;
  valorVenda?: number;
  status?: string;
  tipoUnidade?: string;
  andar?: number;
}

export interface ModalMapearCamposData {
  idProduto: number;
  obraId: string;
  obraNome: string;
  dataEntregaObra?: string; // Dtfim_obr da obra
  unidades: UnidadeDetalhadaModel[];
  camposPersonalizados: any[];
}

@Component({
  selector: 'app-modal-mapear-campos',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatStepperModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatExpansionModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatCheckboxModule
  ],
  templateUrl: './modal-mapear-campos.component.html',
  styleUrls: ['./modal-mapear-campos.component.scss'],
  animations: [
    trigger('slideIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(-20px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateX(0)' }))
      ])
    ])
  ]
})
export class ModalMapearCamposComponent implements OnInit {
  // Campos obrigatórios para importação
  camposObrigatorios: CampoObrigatorio[] = [
    // Torre
    { propriedade: 'nomeTorre', mensagem: 'Nome da Torre', categoria: 'torre', valorPadrao: '' },
    // dataEntrega virá automaticamente da obra (dtfim_obr)

    // Tipologia
    { propriedade: 'nomeTipologia', mensagem: 'Nome da Tipologia', categoria: 'tipologia' },
    { propriedade: 'areaUtil', mensagem: 'Área Útil', categoria: 'tipologia' },
    { propriedade: 'areaTotal', mensagem: 'Área Total', categoria: 'tipologia' },

    // Unidade - Campos específicos do Transacional-Proposta
    { propriedade: 'unity_number', mensagem: 'Unity Number (Identificação)', categoria: 'unidade' },
    { propriedade: 'unity_number_custom', mensagem: 'Unity Number Custom (Exibição)', categoria: 'unidade' },
    { propriedade: 'floor', mensagem: 'Floor (Andar)', categoria: 'unidade' },
    { propriedade: 'tipoUnidade', mensagem: 'Tipo de Unidade', categoria: 'unidade' },
    { propriedade: 'situacao', mensagem: 'Situação', categoria: 'unidade', valorPadrao: '1' }
  ];

  // Campos opcionais recomendados
  camposOpcionais: CampoObrigatorio[] = [
    // Propriedades da tipologia
    { propriedade: 'qtdBanheiro', mensagem: 'Qtd de Banheiros', categoria: 'propriedade' },
    { propriedade: 'qtdQuarto', mensagem: 'Qtd de Quartos', categoria: 'propriedade' },
    { propriedade: 'qtdSuite', mensagem: 'Qtd de Suítes', categoria: 'propriedade' },
    { propriedade: 'qtdComodo', mensagem: 'Qtd de Cômodos', categoria: 'propriedade' },
    { propriedade: 'qtdSacada', mensagem: 'Qtd de Sacadas', categoria: 'propriedade' },
    { propriedade: 'qtdCozinha', mensagem: 'Qtd de Cozinhas', categoria: 'propriedade' },

    // Unidade
    { propriedade: 'vaga', mensagem: 'Vaga', categoria: 'unidade' },
    { propriedade: 'deposito', mensagem: 'Depósito', categoria: 'unidade' },
    { propriedade: 'areaDeposito', mensagem: 'Área do Depósito', categoria: 'unidade' },
    { propriedade: 'areaTotal', mensagem: 'Área Total da Unidade', categoria: 'unidade' },
    { propriedade: 'fracaoIdeal', mensagem: 'Fração Ideal', categoria: 'unidade' },
    { propriedade: 'fase', mensagem: 'Fase', categoria: 'unidade' }
  ];

  // Campos disponíveis do ERP
  camposDisponiveis: string[] = [];

  // Mapeamentos configurados pelo usuário
  mapeamentos: MapeamentoCampo[] = [];

  // Validação
  validacao: ValidacaoMapeamento = {
    valido: false,
    camposFaltantes: [],
    avisos: []
  };

  // Controles de UI
  etapaAtual: number = 1; // 1 = Mapeamento, 2 = Confirmação
  processando: boolean = false;
  progresso: number = 0;

  // Configuração Avançada com Templates
  mostrarConfigAvancada: boolean = false;
  exemploUnidadeTeste: string = '';
  templateConfig: MapeamentoCamposConfig = {
    patternExtracao: '',
    unityNumberTemplate: '',
    unityNumberCustomTemplate: '',
    floorTemplate: '',
    removerEspacos: true,
    removerZerosEsquerda: false
  };
  resultadoTemplateTeste: MapeamentoResultado | null = null;
  padroesProntos = PADROES_MAPEAMENTO;

  // Mapeamento de Status ERP -> TRS
  statusTRSDisponiveis: StatusUnidade[] = [];
  statusERPUnicos: string[] = [];
  mapeamentosStatus: MapeamentoStatus[] = [];
  carregandoStatus: boolean = false;

  // Visualização de exemplo de unidade do ERP
  unidadeExemplo: UnidadeDetalhadaModel | null = null;
  camposUnidadeExemplo: Array<{campo: string, valor: any}> = [];
  mostrarExemploERP: boolean = false;

  constructor(
    public dialogRef: MatDialogRef<ModalMapearCamposComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ModalMapearCamposData,
    private mapeamentoCamposService: MapeamentoCamposService,
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.inicializarCamposDisponiveis();
    this.inicializarMapeamentos();
    this.tentarMapeamentoAutomatico();
    this.carregarStatusTRS();
    this.extrairStatusERPUnicos();
    this.prepararExemploUnidade();
  }

  /**
   * Extrai todos os campos disponíveis das unidades do ERP
   */
  inicializarCamposDisponiveis(): void {
    if (!this.data.unidades || this.data.unidades.length === 0) return;

    const primeiraUnidade = this.data.unidades[0];
    const camposSet = new Set<string>();

    // Adiciona campos básicos
    Object.keys(primeiraUnidade).forEach(key => {
      if (key !== 'camposExtras') {
        camposSet.add(key);
      }
    });

    // Adiciona campos personalizados
    if (this.data.camposPersonalizados) {
      this.data.camposPersonalizados.forEach(campo => {
        camposSet.add(campo.campo);
      });
    }

    this.camposDisponiveis = Array.from(camposSet).sort();
  }

  /**
   * Inicializa a estrutura de mapeamentos
   */
  inicializarMapeamentos(): void {
    // Mapeamentos obrigatórios
    this.camposObrigatorios.forEach(campo => {
      this.mapeamentos.push({
        campoObrigatorio: campo.propriedade,
        campoERP: null,
        categoria: campo.categoria,
        valorManual: campo.valorPadrao,
        usarValorPadrao: !!campo.valorPadrao
      });
    });

    // Mapeamentos opcionais
    this.camposOpcionais.forEach(campo => {
      this.mapeamentos.push({
        campoObrigatorio: campo.propriedade,
        campoERP: null,
        categoria: campo.categoria,
        valorManual: '',
        usarValorPadrao: false
      });
    });
  }

  /**
   * Tenta mapear automaticamente campos com nomes similares
   */
  tentarMapeamentoAutomatico(): void {
    const mapeamentoAutomatico: { [key: string]: string[] } = {
      // Torre
      'nomeTorre': ['nomeObra', 'nome_obra', 'obra', 'torre', 'nome_torre'],
      'dataEntrega': ['dataEntrega', 'data_entrega', 'previsao_entrega', 'dataPrevisaoTermino'],

      // Tipologia
      'nomeTipologia': ['tipoUnidade', 'tipo_unidade', 'tipologia', 'nome_tipologia'],
      'areaUtil': ['areaPrivativa', 'area_privativa', 'area_util', 'areaUtil'],
      'areaTotal': ['areaTotal', 'area_total'],

      // Unidade - Campos específicos do Transacional-Proposta
      'unity_number': ['codigoUnidade', 'codigo_unidade', 'numero_unidade', 'unity_number', 'identificador_unid'],
      'unity_number_custom': ['descricaoUnidade', 'descricao_unidade', 'nome_unidade', 'unity_number_custom', 'unidade'],
      'floor': ['andar', 'floor', 'pavimento', 'quadra'],
      'tipoUnidade': ['tipoUnidade', 'tipo_unidade', 'tipo'],
      'situacao': ['status', 'situacao', 'statusUnidade'],
      'vaga': ['vaga', 'vagas', 'garagem'],
      'deposito': ['deposito', 'depositos'],
      'areaDeposito': ['areaDeposito', 'area_deposito'],
      'fracaoIdeal': ['fracaoIdeal', 'fracao_ideal'],
      'fase': ['fase', 'etapa']
    };

    this.mapeamentos.forEach(mapeamento => {
      const possiveisNomes = mapeamentoAutomatico[mapeamento.campoObrigatorio];
      if (!possiveisNomes) return;

      for (const nomeERP of possiveisNomes) {
        // Busca exata (case insensitive)
        const encontrado = this.camposDisponiveis.find(
          campo => campo.toLowerCase() === nomeERP.toLowerCase()
        );

        if (encontrado) {
          mapeamento.campoERP = encontrado;
          mapeamento.usarValorPadrao = false;
          break;
        }
      }
    });

    this.validarMapeamentos();
  }

  /**
   * Valida se todos os campos obrigatórios foram mapeados
   */
  validarMapeamentos(): void {
    const camposFaltantes: string[] = [];
    const avisos: string[] = [];

    // Valida campos obrigatórios
    this.camposObrigatorios.forEach(campo => {
      const mapeamento = this.mapeamentos.find(m => m.campoObrigatorio === campo.propriedade);

      if (!mapeamento || (!mapeamento.campoERP && !mapeamento.usarValorPadrao && !mapeamento.valorManual)) {
        camposFaltantes.push(campo.mensagem);
      }
    });

    // Gera avisos para campos opcionais não mapeados
    const opcionaisNaoMapeados = this.mapeamentos.filter(m => {
      const campo = this.camposOpcionais.find(c => c.propriedade === m.campoObrigatorio);
      return campo && !m.campoERP && !m.valorManual;
    });

    if (opcionaisNaoMapeados.length > 0) {
      avisos.push(`${opcionaisNaoMapeados.length} campos opcionais não foram mapeados`);
    }

    this.validacao = {
      valido: camposFaltantes.length === 0,
      camposFaltantes,
      avisos
    };
  }

  /**
   * Retorna a descrição de um campo obrigatório
   */
  getDescricaoCampo(propriedade: string): string {
    const campo = [...this.camposObrigatorios, ...this.camposOpcionais]
      .find(c => c.propriedade === propriedade);
    return campo ? campo.mensagem : propriedade;
  }

  /**
   * Retorna a categoria de um campo
   */
  getCategoriaCampo(propriedade: string): string {
    const campo = [...this.camposObrigatorios, ...this.camposOpcionais]
      .find(c => c.propriedade === propriedade);

    const categorias: { [key: string]: string } = {
      'torre': 'Torre',
      'tipologia': 'Tipologia',
      'unidade': 'Unidade',
      'propriedade': 'Propriedades'
    };

    return campo ? categorias[campo.categoria] || '' : '';
  }

  /**
   * Evento quando usuário altera mapeamento de um campo
   */
  onMapeamentoChange(mapeamento: MapeamentoCampo): void {
    if (mapeamento.campoERP) {
      mapeamento.usarValorPadrao = false;
      mapeamento.valorManual = '';
    }
    this.validarMapeamentos();
  }

  /**
   * Evento quando usuário altera valor manual
   */
  onValorManualChange(mapeamento: MapeamentoCampo): void {
    if (mapeamento.valorManual) {
      mapeamento.usarValorPadrao = true;
      mapeamento.campoERP = null;
    } else {
      mapeamento.usarValorPadrao = false;
    }
    this.validarMapeamentos();
  }

  /**
   * Avança para etapa de mapeamento de status
   */
  avancarParaStatus(): void {
    if (!this.validacao.valido) return;
    this.etapaAtual = 2;
  }

  /**
   * Avança para etapa de confirmação
   */
  avancarParaConfirmacao(): void {
    this.etapaAtual = 3;
  }

  /**
   * Volta para etapa de mapeamento de campos
   */
  voltarParaMapeamento(): void {
    this.etapaAtual = 1;
  }

  /**
   * Volta para etapa de mapeamento de status
   */
  voltarParaStatus(): void {
    this.etapaAtual = 2;
  }

  /**
   * Confirma e processa a importação
   */
  confirmarImportacao(): void {
    this.processando = true;
    this.progresso = 0;

    // Retorna os mapeamentos para o componente pai processar
    this.dialogRef.close({
      sucesso: true,
      mapeamentos: this.mapeamentos,
      mapeamentosStatus: this.mapeamentosStatus,
      unidades: this.data.unidades
    });
  }

  /**
   * Cancela e fecha o modal
   */
  cancelar(): void {
    this.dialogRef.close({ sucesso: false });
  }

  /**
   * Retorna exemplo de valor para preview
   */
  getExemploValor(mapeamento: MapeamentoCampo): string {
    if (mapeamento.usarValorPadrao && mapeamento.valorManual) {
      return mapeamento.valorManual;
    }

    if (!mapeamento.campoERP || !this.data.unidades || this.data.unidades.length === 0) {
      return '-';
    }

    const primeiraUnidade: any = this.data.unidades[0];
    const valor = primeiraUnidade[mapeamento.campoERP];

    if (valor === null || valor === undefined) return '-';

    // Formata valores especiais
    if (mapeamento.campoObrigatorio === 'dataEntrega' && valor) {
      const data = new Date(valor);
      return data.toLocaleDateString('pt-BR');
    }

    return String(valor);
  }

  /**
   * Agrupa mapeamentos por categoria para exibição
   */
  getMapeamentosPorCategoria(): { [key: string]: MapeamentoCampo[] } {
    const grupos: { [key: string]: MapeamentoCampo[] } = {
      'torre': [],
      'tipologia': [],
      'unidade': [],
      'propriedade': []
    };

    this.mapeamentos.forEach(mapeamento => {
      if (grupos[mapeamento.categoria]) {
        grupos[mapeamento.categoria].push(mapeamento);
      }
    });

    return grupos;
  }

  /**
   * Retorna mapeamentos de uma categoria específica
   */
  getMapeamentosCategoria(categoria: string): MapeamentoCampo[] {
    return this.mapeamentos.filter(m => m.categoria === categoria);
  }

  /**
   * Retorna quantidade de campos em uma categoria
   */
  getQuantidadeCamposCategoria(categoria: string): number {
    return this.mapeamentos.filter(m => m.categoria === categoria).length;
  }

  /**
   * Retorna label da categoria
   */
  getLabelCategoria(categoria: string): string {
    const labels: { [key: string]: string } = {
      'torre': 'Dados da Torre/Obra',
      'tipologia': 'Dados da Tipologia',
      'unidade': 'Dados da Unidade',
      'propriedade': 'Propriedades da Tipologia'
    };
    return labels[categoria] || categoria;
  }

  /**
   * Retorna ícone da categoria
   */
  getIconeCategoria(categoria: string): string {
    const icones: { [key: string]: string } = {
      'torre': 'location_city',
      'tipologia': 'category',
      'unidade': 'home',
      'propriedade': 'list'
    };
    return icones[categoria] || 'label';
  }

  /**
   * Verifica se campo é obrigatório
   */
  isCampoObrigatorio(propriedade: string): boolean {
    return this.camposObrigatorios.some(c => c.propriedade === propriedade);
  }

  /**
   * Conta quantos campos foram mapeados
   */
  getQuantidadeMapeados(): number {
    return this.mapeamentos.filter(m => m.campoERP || m.usarValorPadrao).length;
  }

  /**
   * Retorna tooltip explicativo para campos específicos
   */
  getTooltipCampo(propriedade: string): string {
    const tooltips: { [key: string]: string } = {
      'unity_number': '🔑 Identificador único da unidade no sistema. Ex: "3102" para "QUADRA 01 LOTE 02". Usado internamente para identificação.',
      'unity_number_custom': '👁️ Como a unidade será exibida para usuários e clientes. Ex: "QUADRA 01 LOTE 02" ou "QD 31 LT 02". Mantém formato legível.',
      'floor': '🏢 Andar/Quadra para organização. Ex: "31" para quadra 31, ou "15" para 15º andar. Usado para agrupar e filtrar unidades.',
    };
    return tooltips[propriedade] || '';
  }

  /**
   * Detecta padrão automaticamente baseado no exemplo
   */
  detectarPadraoAutomatico(): void {
    if (!this.exemploUnidadeTeste) return;

    // Tenta detectar o padrão
    for (const padrao of this.padroesProntos) {
      const regex = new RegExp(padrao.config.patternExtracao);
      if (regex.test(this.exemploUnidadeTeste)) {
        this.aplicarPadraoPronto(padrao);
        return;
      }
    }

    alert('Não conseguimos detectar o padrão automaticamente. Escolha um padrão manualmente ou configure o regex.');
  }

  /**
   * Aplica um padrão pronto
   */
  aplicarPadraoPronto(padrao: any): void {
    this.templateConfig = { ...padrao.config };
    this.testarTemplate();
  }

  /**
   * Testa o template com o exemplo fornecido
   */
  async testarTemplate(): Promise<void> {
    if (!this.templateConfig.patternExtracao || !this.exemploUnidadeTeste) {
      this.resultadoTemplateTeste = null;
      return;
    }

    try {
      this.resultadoTemplateTeste = await this.mapeamentoCamposService.testarMapeamento({
        configuracao: this.templateConfig,
        numeroUnidadeTeste: this.exemploUnidadeTeste
      });
    } catch (error) {
      console.error('Erro ao testar template:', error);
      this.resultadoTemplateTeste = {
        sucesso: false,
        numeroOriginal: this.exemploUnidadeTeste,
        unityNumber: '',
        unityNumberCustom: '',
        floor: '',
        erro: 'Erro ao processar template',
        gruposCapturados: []
      };
    }
  }

  /**
   * Aplica o template aos campos de mapeamento
   */
  aplicarTemplateTodos(): void {
    if (!this.resultadoTemplateTeste || !this.resultadoTemplateTeste.sucesso) {
      return;
    }

    // Encontra os mapeamentos e define valores fixos com templates
    const mapeamentoUnityNumber = this.mapeamentos.find(m => m.campoObrigatorio === 'unity_number');
    const mapeamentoUnityCustom = this.mapeamentos.find(m => m.campoObrigatorio === 'unity_number_custom');
    const mapeamentoFloor = this.mapeamentos.find(m => m.campoObrigatorio === 'floor');

    if (mapeamentoUnityNumber) {
      mapeamentoUnityNumber.valorManual = `TEMPLATE:${this.templateConfig.unityNumberTemplate}`;
      mapeamentoUnityNumber.usarValorPadrao = true;
      mapeamentoUnityNumber.campoERP = null;
      // Armazena a config completa em um campo especial
      (mapeamentoUnityNumber as any).templateConfig = this.templateConfig;
    }

    if (mapeamentoUnityCustom) {
      mapeamentoUnityCustom.valorManual = `TEMPLATE:${this.templateConfig.unityNumberCustomTemplate}`;
      mapeamentoUnityCustom.usarValorPadrao = true;
      mapeamentoUnityCustom.campoERP = null;
      (mapeamentoUnityCustom as any).templateConfig = this.templateConfig;
    }

    if (mapeamentoFloor) {
      mapeamentoFloor.valorManual = `TEMPLATE:${this.templateConfig.floorTemplate}`;
      mapeamentoFloor.usarValorPadrao = true;
      mapeamentoFloor.campoERP = null;
      (mapeamentoFloor as any).templateConfig = this.templateConfig;
    }

    this.validarMapeamentos();

    alert(`✅ Template aplicado com sucesso!

Os campos foram configurados para usar transformação automática:
• unity_number: ${this.templateConfig.unityNumberTemplate}
• unity_number_custom: ${this.templateConfig.unityNumberCustomTemplate}
• floor: ${this.templateConfig.floorTemplate}

Exemplo: "${this.exemploUnidadeTeste}" será transformado em:
• unity_number: "${this.resultadoTemplateTeste.unityNumber}"
• unity_number_custom: "${this.resultadoTemplateTeste.unityNumberCustom}"
• floor: "${this.resultadoTemplateTeste.floor}"`);

    // Fecha a config avançada
    this.mostrarConfigAvancada = false;
  }

  /**
   * Limpa a configuração de template
   */
  limparTemplate(): void {
    this.templateConfig = {
      patternExtracao: '',
      unityNumberTemplate: '',
      unityNumberCustomTemplate: '',
      floorTemplate: '',
      removerEspacos: true,
      removerZerosEsquerda: false
    };
    this.resultadoTemplateTeste = null;
    this.exemploUnidadeTeste = '';
  }

  /**
   * Retorna HTML para exibir grupo capturado (evita erro ICU)
   */
  getGrupoCapturadoHtml(indice: number, valor: string): string {
    return `{${indice}} = "${valor}"`;
  }

  /**
   * Carrega lista de status disponíveis no TRS
   */
  async carregarStatusTRS(): Promise<void> {
    try {
      this.carregandoStatus = true;
      this.cdr.detectChanges(); // Força detecção de mudanças
      this.statusTRSDisponiveis = await this.mapeamentoCamposService.obterStatusUnidades();
      console.log('Status TRS carregados:', this.statusTRSDisponiveis);
    } catch (error) {
      console.error('Erro ao carregar status do TRS:', error);
      this.statusTRSDisponiveis = [];
    } finally {
      this.carregandoStatus = false;
      this.cdr.detectChanges(); // Força detecção de mudanças
    }
  }

  /**
   * Extrai status únicos das unidades do ERP
   */
  extrairStatusERPUnicos(): void {
    if (!this.data.unidades || this.data.unidades.length === 0) return;

    const statusSet = new Set<string>();

    this.data.unidades.forEach(unidade => {
      if (unidade.status && unidade.status.trim() !== '') {
        statusSet.add(unidade.status.trim());
      }
    });

    this.statusERPUnicos = Array.from(statusSet).sort();

    // Inicializar mapeamentos com valores padrão
    this.mapeamentosStatus = this.statusERPUnicos.map(statusERP => ({
      statusERP,
      statusTRSId: 1 // Padrão: Disponível
    }));
  }

  /**
   * Obtém o status TRS ID mapeado para um status ERP
   */
  obterStatusTRSIdMapeado(statusERP: string): number {
    const mapeamento = this.mapeamentosStatus.find(m => m.statusERP === statusERP);
    return mapeamento?.statusTRSId || 1;
  }

  /**
   * Atualiza o mapeamento de um status específico
   */
  atualizarMapeamentoStatus(statusERP: string, statusTRSId: number): void {
    const mapeamento = this.mapeamentosStatus.find(m => m.statusERP === statusERP);
    if (mapeamento) {
      mapeamento.statusTRSId = statusTRSId;
    }
  }

  /**
   * Prepara exemplo de unidade do ERP para visualização
   */
  prepararExemploUnidade(): void {
    if (!this.data.unidades || this.data.unidades.length === 0) return;

    // Pega a primeira unidade como exemplo
    this.unidadeExemplo = this.data.unidades[0];

    // Converte todos os campos em array para exibição
    this.camposUnidadeExemplo = Object.keys(this.unidadeExemplo)
      .map(campo => ({
        campo,
        valor: this.unidadeExemplo![campo]
      }))
      .filter(item => {
        // Filtra campos com valores não-null e não-vazios
        const valor = item.valor;
        return valor !== null && valor !== undefined && valor !== '';
      })
      .sort((a, b) => {
        // Ordena: campos com valores primeiro, depois alfabético
        return a.campo.localeCompare(b.campo);
      });
  }

  /**
   * Formata valor para exibição
   */
  formatarValorExemplo(valor: any): string {
    if (valor === null || valor === undefined) {
      return 'null';
    }
    if (typeof valor === 'object') {
      return JSON.stringify(valor);
    }
    return String(valor);
  }

  /**
   * Toggle visualização do exemplo de ERP
   */
  toggleExemploERP(): void {
    this.mostrarExemploERP = !this.mostrarExemploERP;
  }

  /**
   * Abre modal de visualização de dados do ERP
   */
  abrirVisualizadorDadosERP(): void {
    this.dialog.open(ModalVisualizarDadosErpComponent, {
      width: '90vw',
      maxWidth: '1200px',
      height: '80vh',
      maxHeight: '900px',
      data: {
        unidadeExemplo: this.data.unidades[0],
        camposPersonalizados: this.data.camposPersonalizados || []
      },
      panelClass: 'modal-visualizar-dados-erp-panel'
    });
  }
}
