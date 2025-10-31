import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ImportacaoProdutoRequestModel,
  TorreModel,
  TipologyModel,
  UnidadeModel,
  TipologyPropertyModel,
  MapeamentoCampo
} from '../models/importacao-produto.model';

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

@Injectable({
  providedIn: 'root'
})
export class ImportacaoProdutoService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Processa e importa a estrutura do produto completa
   */
  importarEstruturaProduto(
    idProduto: number,
    obraId: string,
    obraNome: string,
    dataEntregaObra: string | undefined,
    unidades: UnidadeDetalhadaModel[],
    mapeamentos: MapeamentoCampo[],
    mapeamentosStatus: any[] = []
  ): Observable<any> {
    const payload = this.construirPayload(idProduto, obraId, obraNome, dataEntregaObra, unidades, mapeamentos, mapeamentosStatus);

    // Configurar timeout de 10 minutos para importações grandes
    const headers = new HttpHeaders().set('timeout', `${600000}`);

    return this.http.post(
      `${this.apiUrl}/api/ImportacaoProduto/importar-estrutura`,
      payload,
      { headers }
    );
  }

  /**
   * Constrói o payload de importação a partir dos mapeamentos
   */
  private construirPayload(
    idProduto: number,
    obraId: string,
    obraNome: string,
    dataEntregaObra: string | undefined,
    unidades: UnidadeDetalhadaModel[],
    mapeamentos: MapeamentoCampo[],
    mapeamentosStatus: any[] = []
  ): ImportacaoProdutoRequestModel {
    // Extrai torres únicas
    const torres = this.extrairTorres(obraId, obraNome, dataEntregaObra, unidades, mapeamentos);

    // Extrai tipologias únicas
    const tipologias = this.extrairTipologias(unidades, mapeamentos);

    // Processa unidades
    const unidadesProcessadas = this.processarUnidades(unidades, mapeamentos, torres, tipologias, mapeamentosStatus);

    return {
      IdProduto: idProduto,
      Torres: torres,
      Tipologias: tipologias,
      Unidades: unidadesProcessadas
    };
  }

  /**
   * Extrai informações das torres
   */
  private extrairTorres(
    obraId: string,
    obraNome: string,
    dataEntregaObra: string | undefined,
    unidades: UnidadeDetalhadaModel[],
    mapeamentos: MapeamentoCampo[]
  ): TorreModel[] {
    const mapeamentoTorre = this.getMapeamentosCategoria(mapeamentos, 'torre');

    // Extrai nomes de torre únicos ou usa nome da obra
    const nomeTorre = this.getValorMapeado('nomeTorre', mapeamentoTorre, unidades[0]) || obraNome;

    // SEMPRE usa a data da obra (dtfim_obr), não o mapeamento
    const dataEntrega = dataEntregaObra;

    // Calcula quantidade de andares e colunas baseado nas unidades
    const andares = [...new Set(unidades.map(u => this.getAndar(u, mapeamentos)))];
    const qtyFloors = Math.max(...andares);

    // Calcula colunas (unidades por andar)
    const unidadesPorAndar = unidades
      .reduce((acc, u) => {
        const andar = this.getAndar(u, mapeamentos);
        acc[andar] = (acc[andar] || 0) + 1;
        return acc;
      }, {} as { [key: number]: number });

    const qtyColumns = Object.values(unidadesPorAndar).length > 0
      ? Math.max(...Object.values(unidadesPorAndar).map(v => Number(v)))
      : 1;

    // Determina padrão de numeração
    const mapeamentoUnidade = this.getMapeamentosCategoria(mapeamentos, 'unidade');
    const primeiraUnidade = this.getValorMapeado('unity_number', mapeamentoUnidade, unidades[0]) || unidades[0].codigoUnidade || '0';
    const unitPattern = primeiraUnidade.length >= 3 ? '1' : '0';

    const torre: TorreModel = {
      name: nomeTorre,
      description: `Torre importada do ERP - ${obraNome}`,
      qty_floors: qtyFloors,
      qty_columns: qtyColumns,
      delivery_date: this.formatarData(dataEntrega),
      status: '1', // Ativa
      ground_floor: qtyFloors > 0 ? '0' : '1',
      unit_pattern: unitPattern,
      id_externo: obraId
    };

    return [torre];
  }

  /**
   * Extrai tipologias únicas das unidades
   */
  private extrairTipologias(
    unidades: UnidadeDetalhadaModel[],
    mapeamentos: MapeamentoCampo[]
  ): TipologyModel[] {
    const mapeamentoTipologia = this.getMapeamentosCategoria(mapeamentos, 'tipologia');
    const mapeamentoPropriedades = this.getMapeamentosCategoria(mapeamentos, 'propriedade');

    // Agrupa unidades por tipo
    const tiposUnicos = new Map<string, UnidadeDetalhadaModel>();

    unidades.forEach(unidade => {
      const tipoUnidade = this.getValorMapeado('tipoUnidade', mapeamentoTipologia, unidade) ||
                         this.getValorMapeado('nomeTipologia', mapeamentoTipologia, unidade) ||
                         'Padrão';

      if (!tiposUnicos.has(tipoUnidade)) {
        tiposUnicos.set(tipoUnidade, unidade);
      }
    });

    // Cria tipologia para cada tipo único
    const tipologias: TipologyModel[] = [];

    tiposUnicos.forEach((unidadeRef, nomeTipo) => {
      const areaUtil = this.getValorMapeado('areaUtil', mapeamentoTipologia, unidadeRef) || '0';
      const areaTotal = this.getValorMapeado('areaTotal', mapeamentoTipologia, unidadeRef) || '0';

      // Extrai propriedades
      const properties: TipologyPropertyModel[] = [];

      // Mapeia propriedades configuradas
      const propriedadesConfig = [
        { campo: 'qtdBanheiro', nome: 'Banheiro' },
        { campo: 'qtdQuarto', nome: 'Quarto' },
        { campo: 'qtdSuite', nome: 'Suíte' },
        { campo: 'qtdComodo', nome: 'Cômodo' },
        { campo: 'qtdSacada', nome: 'Sacada' },
        { campo: 'qtdCozinha', nome: 'Cozinha' }
      ];

      propriedadesConfig.forEach(prop => {
        const valor = this.getValorMapeado(prop.campo, mapeamentoPropriedades, unidadeRef);
        const quantidade = parseInt(valor || '0', 10);

        if (quantidade > 0) {
          properties.push({
            name: prop.nome,
            quantity: quantidade
          });
        }
      });

      tipologias.push({
        name: nomeTipo,
        tipology: nomeTipo,
        usable_area: areaUtil,
        total_area: areaTotal,
        padrao: tipologias.length === 0 ? 1 : 0,
        id_externo: nomeTipo,
        properties
      });
    });

    return tipologias;
  }

  /**
   * Processa todas as unidades
   */
  private processarUnidades(
    unidades: UnidadeDetalhadaModel[],
    mapeamentos: MapeamentoCampo[],
    torres: TorreModel[],
    tipologias: TipologyModel[],
    mapeamentosStatus: any[] = []
  ): UnidadeModel[] {
    const mapeamentoTipologia = this.getMapeamentosCategoria(mapeamentos, 'tipologia');
    const mapeamentoUnidade = this.getMapeamentosCategoria(mapeamentos, 'unidade');

    return unidades.map(unidade => {
      // Identifica torre (sempre 0 pois criamos apenas uma)
      const idTorre = '0';

      // Identifica tipologia
      const tipoUnidade = this.getValorMapeado('tipoUnidade', mapeamentoTipologia, unidade) ||
                         this.getValorMapeado('nomeTipologia', mapeamentoTipologia, unidade) ||
                         'Padrão';
      const idTipologia = tipologias.findIndex(t => t.name === tipoUnidade).toString();

      // Dados da unidade
      const numeroUnidade = this.getValorMapeado('unity_number', mapeamentoUnidade, unidade) || unidade.codigoUnidade || '0';
      const numeroUnidadeCustom = this.getValorMapeado('unity_number_custom', mapeamentoUnidade, unidade) || numeroUnidade;
      const andar = this.getAndar(unidade, mapeamentos);
      const situacao = this.getValorMapeado('situacao', mapeamentoUnidade, unidade) || '1';
      const vaga = this.getValorMapeado('vaga', mapeamentoUnidade, unidade);
      const deposito = this.getValorMapeado('deposito', mapeamentoUnidade, unidade);
      const areaDeposito = this.getValorMapeado('areaDeposito', mapeamentoUnidade, unidade);
      const fracaoIdeal = this.getValorMapeado('fracaoIdeal', mapeamentoUnidade, unidade);
      const fase = this.getValorMapeado('fase', mapeamentoUnidade, unidade);

      // Buscar area_total da própria unidade (cada unidade tem sua área)
      const areaTotal = this.getValorMapeado('areaTotal', mapeamentoUnidade, unidade);

      // Aplicar mapeamento de status do ERP para o TRS
      let statusFinal = this.mapearStatus(situacao);
      if (mapeamentosStatus && mapeamentosStatus.length > 0 && unidade.status) {
        const mapeamento = mapeamentosStatus.find(m => m.statusERP === unidade.status);
        if (mapeamento) {
          statusFinal = mapeamento.statusTRSId.toString();
        }
      }

      const unidadeModel: UnidadeModel = {
        id_torre: idTorre,
        id_tipologia: idTipologia,
        floor: andar,
        unity_number: numeroUnidade,
        unity_number_custom: numeroUnidadeCustom,
        status: statusFinal,
        cadastrar: true,
        percentage_unity: '0',
        id_externo: unidade['Identificador_unid'] || unidade.codigoUnidade
      };

      // Adiciona campos opcionais se preenchidos
      if (vaga) unidadeModel.vaga = vaga;
      if (deposito) unidadeModel.deposito = deposito;
      if (areaDeposito) unidadeModel.area_deposito = areaDeposito;
      if (fracaoIdeal) unidadeModel.fracao_ideal = fracaoIdeal;
      if (fase) unidadeModel.fase = fase;
      if (areaTotal) unidadeModel.area_total = areaTotal;

      return unidadeModel;
    });
  }

  /**
   * Retorna mapeamentos de uma categoria específica
   */
  private getMapeamentosCategoria(mapeamentos: MapeamentoCampo[], categoria: string): MapeamentoCampo[] {
    return mapeamentos.filter(m => m.categoria === categoria);
  }

  /**
   * Obtém valor mapeado de um campo
   */
  private getValorMapeado(
    propriedade: string,
    mapeamentos: MapeamentoCampo[],
    unidade: any
  ): string | null {
    const mapeamento = mapeamentos.find(m => m.campoObrigatorio === propriedade);

    if (!mapeamento) {
      return null;
    }

    // Valor manual tem prioridade
    if (mapeamento.usarValorPadrao && mapeamento.valorManual) {
      // Verifica se é um template de regex
      if (mapeamento.valorManual.startsWith('TEMPLATE:')) {
        // Extrai o template e aplica ao campo original
        const templateConfig = (mapeamento as any).templateConfig;
        if (templateConfig) {
          return this.aplicarTemplateRegex(unidade, templateConfig, propriedade);
        }
      }
      return mapeamento.valorManual;
    }

    // Busca no campo do ERP
    if (mapeamento.campoERP && unidade) {
      const valor = unidade[mapeamento.campoERP];

      if (valor !== null && valor !== undefined) {
        return String(valor);
      }
    }

    return null;
  }

  /**
   * Aplica template de regex ao valor original
   */
  private aplicarTemplateRegex(
    unidade: any,
    templateConfig: any,
    propriedade: string
  ): string {
    // Busca o campo que contém o número original da unidade
    // Geralmente é codigoUnidade ou descricaoUnidade
    const campoOriginal = unidade.codigoUnidade || unidade.descricaoUnidade || '';

    try {
      const regex = new RegExp(templateConfig.patternExtracao);
      const match = regex.exec(campoOriginal);

      if (!match) {
        return '0';
      }

      // Determina qual template usar baseado na propriedade
      let template = '';
      if (propriedade === 'unity_number') {
        template = templateConfig.unityNumberTemplate;
      } else if (propriedade === 'unity_number_custom') {
        template = templateConfig.unityNumberCustomTemplate;
      } else if (propriedade === 'floor') {
        template = templateConfig.floorTemplate;
      }

      if (!template) {
        return '0';
      }

      // Substitui {1}, {2}, etc pelos grupos capturados
      let resultado = template;
      for (let i = 1; i < match.length; i++) {
        resultado = resultado.replace(`{${i}}`, match[i]);
      }

      // Aplica transformações
      if (templateConfig.removerEspacos) {
        resultado = resultado.replace(/\s/g, '');
      }

      if (templateConfig.removerZerosEsquerda) {
        resultado = resultado.replace(/^0+/, '');
        if (resultado === '') {
          resultado = '0';
        }
      }

      return resultado;
    } catch (error) {
      console.error('Erro ao aplicar template regex:', error);
      return '0';
    }
  }

  /**
   * Obtém andar da unidade
   */
  private getAndar(unidade: UnidadeDetalhadaModel, mapeamentos: MapeamentoCampo[]): number {
    const mapeamentoUnidade = this.getMapeamentosCategoria(mapeamentos, 'unidade');
    const andar = this.getValorMapeado('floor', mapeamentoUnidade, unidade);
    return parseInt(andar || '0', 10);
  }

  /**
   * Formata data para yyyy-MM-dd
   */
  private formatarData(dataStr: string | null | undefined): string {
    if (!dataStr) {
      // Data padrão: 1 ano a partir de hoje
      const hoje = new Date();
      hoje.setFullYear(hoje.getFullYear() + 1);
      return hoje.toISOString().split('T')[0];
    }

    try {
      // Tenta parsear vários formatos
      let data: Date;

      if (dataStr.includes('/')) {
        // dd/MM/yyyy
        const partes = dataStr.split('/');
        data = new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]));
      } else if (dataStr.includes('-')) {
        // yyyy-MM-dd ou outros formatos ISO
        data = new Date(dataStr);
      } else {
        data = new Date(dataStr);
      }

      return data.toISOString().split('T')[0];
    } catch {
      // Fallback: 1 ano a partir de hoje
      const hoje = new Date();
      hoje.setFullYear(hoje.getFullYear() + 1);
      return hoje.toISOString().split('T')[0];
    }
  }

  /**
   * Mapeia status do ERP para ID do status no TRS
   */
  private mapearStatus(statusERP: string): string {
    const mapeamento: { [key: string]: string } = {
      'disponivel': '1',
      'disponível': '1',
      'available': '1',
      'livre': '1',

      'vendido': '2',
      'vendida': '2',
      'sold': '2',

      'reservado': '3',
      'reservada': '3',
      'reserved': '3',

      'indisponivel': '4',
      'indisponível': '4',
      'bloqueado': '4',
      'bloqueada': '4'
    };

    const statusLower = statusERP.toLowerCase().trim();
    return mapeamento[statusLower] || '1'; // Default: disponível
  }
}
