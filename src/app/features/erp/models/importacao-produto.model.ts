/**
 * Modelos para importação de estrutura de produtos do ERP para o TRS
 */

export interface TipologyPropertyModel {
  name: string;
  quantity: number;
}

export interface TorreModel {
  name: string;
  description?: string;
  qty_floors: number;
  qty_columns: number;
  delivery_date: string; // formato: yyyy-MM-dd
  status: string;
  ground_floor: string;
  unit_pattern: string;
  id_externo?: string;
}

export interface TipologyModel {
  name: string;
  tipology: string;
  usable_area: string;
  total_area: string;
  padrao: number;
  id_externo?: string;
  properties: TipologyPropertyModel[];
}

export interface UnidadeModel {
  id_torre: string; // índice da torre no array
  id_tipologia: string; // índice da tipologia no array
  floor: number;
  unity_number: string;
  unity_number_custom?: string;
  status: string;
  cadastrar: boolean;
  percentage_unity?: string;
  fase?: string;
  vaga?: string;
  deposito?: string;
  area_deposito?: string;
  fracao_ideal?: string;
  id_externo?: string;
  area_total?: string;
}

export interface ImportacaoProdutoRequestModel {
  IdProduto: number;
  Torres: TorreModel[];
  Tipologias: TipologyModel[];
  Unidades: UnidadeModel[];
}

/**
 * Modelo para mapeamento de campos obrigatórios
 */
export interface CampoObrigatorio {
  propriedade: string;
  mensagem: string;
  categoria: 'torre' | 'tipologia' | 'unidade' | 'propriedade';
  valorPadrao?: string;
}

/**
 * Modelo para campos disponíveis do ERP
 */
export interface CampoERP {
  campo: string;
  descricao: string;
  exemplo?: string;
}

/**
 * Modelo para mapeamento DE/PARA
 */
export interface MapeamentoCampo {
  campoObrigatorio: string;
  campoERP: string | null;
  categoria: string;
  valorManual?: string;
  usarValorPadrao?: boolean;
}

/**
 * Modelo para validação de mapeamento
 */
export interface ValidacaoMapeamento {
  valido: boolean;
  camposFaltantes: string[];
  avisos: string[];
}
