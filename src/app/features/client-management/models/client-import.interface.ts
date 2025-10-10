export interface ClientImportData {
  id_cliente_legado?: string;
  nome: string;
  email: string;
  ddd_residencial?: string;
  tel_residencial?: string;
  ddd_celular?: string;
  tel_celular?: string;
  ddd_comercial?: string;
  tel_comercial?: string;
  id_usuario?: number | null;
  id_produto?: number | null;
  endereco?: string;
  cep?: string;
  numero?: string;
  complemento?: string;
  cidade?: string;
  UF?: string;
  id_canal_origem?: number | null;
  id_midia?: number | null;
  id_momento?: number | null;
  id_submomento?: number | null;
  id_temperatura?: number | null;
  id_objetivo?: number | null;
  excluido?: string;
  sexo?: string;
  cpf?: string;
  renda_mensal?: number;
  fgts?: number;
  qtd_dependentes?: number;
  rg?: string;
  valor_entrada?: number;
  email2?: string;
  email3?: string;
  profissao?: string;
  cargo?: string;
  data_nascimento?: string;
  estado_civil?: string;
  bairro?: string;
  bairro_comercial?: string;
  cep_comercial?: string;
  cidade_comercial?: string;
  complemento_comercial?: string;
  conjuge_dt_nascimento?: string;
  conjuge_estado_civil?: string;
  conjuge_profissao?: string;
  conjuge_renda_mensal?: number;
  conjuge_sexo?: string;
  conjuge_cpf?: string;
  nome_conjuge?: string;
  data_atualizacao?: string;
  data_criacao?: string;
  descricao?: string;
  renda_familiar?: number;
  logradouro_comercial?: string;
}

export interface ReferenceData {
  id: number;
  nome: string;
  valor?: string;
}

export interface SheetReferences {
  subMomento: ReferenceData[];
  momento: ReferenceData[];
  motivoNaoCliente: ReferenceData[];
  midiasOrigem: ReferenceData[];
  canalOrigem: ReferenceData[];
  produto: ReferenceData[];
  usuario: ReferenceData[];
}

export interface ImportResult {
  success: boolean;
  processedCount: number;
  errorCount: number;
  errors: ImportError[];
}

export interface ImportError {
  row: number;
  field: string;
  message: string;
}

export interface ColumnMapping {
  [key: string]: string;
}

export interface ImportProgress {
  current: number;
  total: number;
  percentage: number;
  currentOperation: string;
}