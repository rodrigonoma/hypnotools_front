export interface MapeamentoCamposConfig {
  patternExtracao: string;
  unityNumberTemplate: string;
  unityNumberCustomTemplate: string;
  floorTemplate: string;
  removerEspacos: boolean;
  removerZerosEsquerda: boolean;
}

export interface MapeamentoResultado {
  sucesso: boolean;
  numeroOriginal: string;
  unityNumber: string;
  unityNumberCustom: string;
  floor: string;
  erro?: string;
  gruposCapturados: string[];
}

export interface TesteMapeamento {
  configuracao: MapeamentoCamposConfig;
  numeroUnidadeTeste: string;
}

// Model para status de unidade do TRS
export interface StatusUnidade {
  id: number;
  nome: string;
  descricao: string;
}

// Model para mapeamento de status ERP -> TRS
export interface MapeamentoStatus {
  statusERP: string; // Nome do status no ERP
  statusTRSId: number; // ID do status no TRS
}

// Padrões pré-configurados
export const PADROES_MAPEAMENTO = [
  {
    nome: 'Quadra-Lote (ex: QD 31 LT 01)',
    config: {
      patternExtracao: 'QD\\s+(\\d+)\\s+LT\\s+(\\d+)',
      unityNumberTemplate: '{1}{2}',
      unityNumberCustomTemplate: 'QD {1} LT {2}',
      floorTemplate: '{1}',
      removerEspacos: true,
      removerZerosEsquerda: false
    }
  },
  {
    nome: 'Quadra-Lote 2 (ex: QUADRA 01 LOTE 02)',
    config: {
      patternExtracao: 'QUADRA\\s+(\\d+)\\s+LOTE\\s+(\\d+)',
      unityNumberTemplate: '{1}{2}',
      unityNumberCustomTemplate: 'QUADRA {1} LOTE {2}',
      floorTemplate: '{1}',
      removerEspacos: true,
      removerZerosEsquerda: false
    }
  },
  {
    nome: 'Apartamento Numérico (ex: 1501, 202)',
    config: {
      patternExtracao: '(\\d{2,4})',
      unityNumberTemplate: '{1}',
      unityNumberCustomTemplate: '{1}',
      floorTemplate: '{1}',
      removerEspacos: true,
      removerZerosEsquerda: false
    }
  },
  {
    nome: 'Lote Simples (ex: LOTE 001)',
    config: {
      patternExtracao: 'LOTE\\s+(\\d+)',
      unityNumberTemplate: '{1}',
      unityNumberCustomTemplate: 'LOTE {1}',
      floorTemplate: '0',
      removerEspacos: true,
      removerZerosEsquerda: true
    }
  }
];
