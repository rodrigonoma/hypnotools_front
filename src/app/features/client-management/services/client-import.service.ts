import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import * as XLSX from 'xlsx';
import * as Papa from 'papaparse';
import { AuthService } from '../../../core/services/auth.service';
import {
  ClientImportData,
  SheetReferences,
  ImportResult,
  ImportError,
  ColumnMapping,
  ImportProgress,
  ReferenceData
} from '../models/client-import.interface';

@Injectable({
  providedIn: 'root'
})
export class ClientImportService {
  private readonly MANAGE_CLIENTS_ENDPOINT = '/manageclients';
  private readonly FIXED_TOKEN = '%242a%2407%24rHBGlndVRbE3Oyx1hGpCve60kjAvC5iw5Dm.T8724epmzRwJvHxqO';

  public dynamicToken: string = this.FIXED_TOKEN;
  private currentEmpresa: string = '';

  private progressSubject = new BehaviorSubject<ImportProgress>({
    current: 0,
    total: 0,
    percentage: 0,
    currentOperation: ''
  });

  private clientDetailsSubject = new BehaviorSubject<any>(null);
  private importLogsSubject = new BehaviorSubject<string[]>([]);

  public progress$ = this.progressSubject.asObservable();
  public clientDetails$ = this.clientDetailsSubject.asObservable();
  public importLogs$ = this.importLogsSubject.asObservable();

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    // Escutar mudanças na empresa logada
    this.authService.empresa$.subscribe(empresa => {
      if (empresa) {
        this.currentEmpresa = empresa;
      }
    });
  }

  private logToFile(message: string): void {
    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp} - ${message}\n`;

    // Adicionar ao array de logs
    if (!(window as any).importLogs) {
      (window as any).importLogs = [];
    }
    (window as any).importLogs.push(logEntry);

    console.log(message);

    // Enviar para backend via HTTP
    this.http.post('http://localhost:3000/log', { message: logEntry }).subscribe({
      error: () => {} // Ignorar erros silenciosamente
    });
  }

  async processSpreadsheet(file: File): Promise<{ clients: any[], references: SheetReferences, skippedRows: ImportError[] }> {
    this.logToFile('=== INICIANDO PROCESSAMENTO ===');
    this.updateProgress(0, 100, 'Lendo arquivo...');

    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    let workbook: XLSX.WorkBook;

    if (isExcel) {
      const buffer = await file.arrayBuffer();
      workbook = XLSX.read(buffer, { type: 'buffer' });
    } else {
      throw new Error('Formato de arquivo não suportado. Use apenas .xlsx ou .csv');
    }

    this.updateProgress(25, 100, 'Processando dados de referência...');

    const references = this.extractReferences(workbook);

    this.updateProgress(50, 100, 'Processando dados dos clientes...');

    const { clients, skippedRows } = this.extractClients(workbook, references);

    this.logToFile(`Total de clientes processados: ${clients.length}`);
    this.logToFile(`Total de linhas ignoradas: ${skippedRows.length}`);

    this.updateProgress(100, 100, 'Processamento concluído');

    return { clients, references, skippedRows };
  }

  private extractReferences(workbook: XLSX.WorkBook): SheetReferences {
    console.log('📊 [REFS] Extraindo referências das abas...');

    const references: SheetReferences = {
      subMomento: this.extractReferenceSheet(workbook, 'SUB MOMENTO'),
      momento: this.extractReferenceSheet(workbook, 'MOMENTO'),
      motivoNaoCliente: this.extractReferenceSheet(workbook, 'MOTIVO DE NÃO CLIENTE'),
      midiasOrigem: this.extractReferenceSheet(workbook, 'MÍDIAS DE ORIGEM'),
      canalOrigem: this.extractReferenceSheet(workbook, 'CANAIS DE ORIGEM'),
      produto: this.extractReferenceSheet(workbook, 'PRODUTO'),
      usuario: this.extractReferenceSheet(workbook, 'USUARIO')
    };

    console.log('📊 [REFS] Referências extraídas:');
    console.log(`   📋 SUB MOMENTO (${references.subMomento.length} items):`, references.subMomento.slice(0, 5).map(r => `${r.id}="${r.nome}"`));
    console.log(`   📋 MOMENTO (${references.momento.length} items):`, references.momento.map(r => `${r.id}="${r.nome}"`));
    console.log(`   📋 MIDIAS DE ORIGEM (${references.midiasOrigem.length} items):`, references.midiasOrigem.slice(0, 3).map(r => `${r.id}="${r.nome}"`));
    console.log(`   📋 CANAL DE ORIGEM (${references.canalOrigem.length} items):`, references.canalOrigem.slice(0, 3).map(r => `${r.id}="${r.nome}"`));
    console.log(`   📋 PRODUTO (${references.produto.length} items):`, references.produto.slice(0, 3).map(r => `${r.id}="${r.nome}"`));
    console.log(`   📋 USUARIO (${references.usuario.length} items):`, references.usuario.slice(0, 3).map(r => `${r.id}="${r.nome}"`));

    return references;
  }

  private extractReferenceSheet(workbook: XLSX.WorkBook, sheetName: string): ReferenceData[] {
    console.log(`🔍 [REF DEBUG] Tentando extrair aba: "${sheetName}"`);

    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      console.warn(`❌ [REF DEBUG] Aba '${sheetName}' não encontrada`);
      console.log(`📋 [REF DEBUG] Abas disponíveis:`, Object.keys(workbook.Sheets));
      return [];
    }

    console.log(`✅ [REF DEBUG] Aba '${sheetName}' encontrada`);
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    console.log(`📊 [REF DEBUG] Aba '${sheetName}' - Total de linhas: ${data.length}`);

    if (data.length > 0) {
      console.log(`🔍 [REF DEBUG] Aba '${sheetName}' - Primeiras 3 linhas:`, data.slice(0, 3));
    }

    const references: ReferenceData[] = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      console.log(`🔍 [REF DEBUG] Aba '${sheetName}' - Linha ${i}:`, row, `length: ${row?.length || 0}`);

      if (row && row.length >= 2) {
        const ref = {
          id: row[0],
          nome: sheetName === 'SUB MOMENTO' ? row[2] : row[1], // SUB MOMENTO usa coluna 2, outras usam coluna 1
          valor: row[3] || row[2] || ''
        };
        if (sheetName === 'SUB MOMENTO') {
          console.log(`🎯 [SUB MOMENTO FIX] Linha ${i}: row[0]=${row[0]}, row[1]="${row[1]}", row[2]="${row[2]}" → Usando row[2] como nome`);
        }
        console.log(`✅ [REF DEBUG] Aba '${sheetName}' - Adicionando:`, ref);
        references.push(ref);
      } else {
        console.log(`⚠️ [REF DEBUG] Aba '${sheetName}' - Linha ${i} ignorada (vazia ou < 2 colunas)`);
      }
    }

    console.log(`🎯 [REF DEBUG] Aba '${sheetName}' - Final: ${references.length} referências extraídas`);
    return references;
  }

  private extractClients(workbook: XLSX.WorkBook, references: SheetReferences): { clients: any[], skippedRows: ImportError[] } {
    const clientsSheet = workbook.Sheets['CLIENTES'];
    if (!clientsSheet) {
      throw new Error('Aba CLIENTES não encontrada');
    }

    // Obter apenas o range real da planilha (sem linhas vazias do Excel)
    const range = XLSX.utils.decode_range(clientsSheet['!ref'] || 'A1');
    console.log(`📊 Range da planilha: ${range.s.r} a ${range.e.r} (${range.e.r + 1} linhas)`);

    // Limitar leitura a no máximo 100.000 linhas para evitar out of memory
    const MAX_ROWS_TO_READ = 100000;
    const actualEndRow = Math.min(range.e.r, MAX_ROWS_TO_READ);

    if (range.e.r > MAX_ROWS_TO_READ) {
      console.warn(`⚠️ Planilha tem ${range.e.r + 1} linhas. Limitando leitura a ${MAX_ROWS_TO_READ} linhas.`);
    }

    // Ajustar o range para ler apenas as linhas necessárias
    const limitedRange = `A1:${XLSX.utils.encode_col(range.e.c)}${actualEndRow + 1}`;
    console.log(`📊 Lendo range limitado: ${limitedRange}`);

    const data = XLSX.utils.sheet_to_json(clientsSheet, {
      header: 1,
      defval: '',
      raw: false,
      range: limitedRange
    }) as any[][];

    if (data.length < 2) {
      throw new Error('Planilha de clientes está vazia');
    }

    const headers = data[0] as string[];
    console.log('🔍 HEADERS DA PLANILHA (primeiras 10):', headers.slice(0, 10));
    console.log('🔍 TOTAL DE COLUNAS:', headers.length);
    console.log(`📊 Total de linhas lidas: ${data.length}`);
    const columnMapping = this.createColumnMapping(headers);
    console.log('🗺️ MAPEAMENTO DE COLUNAS:', columnMapping);
    const clients: any[] = [];
    const skippedRows: ImportError[] = [];
    let consecutiveEmptyRows = 0;
    const MAX_CONSECUTIVE_EMPTY_ROWS = 50; // Aumentar para 50 linhas vazias

    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      // Verificar se a linha está vazia
      if (!row || !row.some(cell => cell !== undefined && cell !== null && cell !== '')) {
        consecutiveEmptyRows++;

        // Se encontrar muitas linhas vazias consecutivas, parar processamento
        if (consecutiveEmptyRows >= MAX_CONSECUTIVE_EMPTY_ROWS) {
          console.log(`⚠️ Parando processamento: ${consecutiveEmptyRows} linhas vazias consecutivas encontradas na linha ${i + 1}`);
          console.log(`📊 Total de linhas vazias ignoradas: ${data.length - i}`);
          break;
        }

        continue; // Não adicionar linha vazia ao log
      }

      // Resetar contador de linhas vazias
      consecutiveEmptyRows = 0;

      if (i <= 2) { // Log first 2 rows
        console.log(`🔍 RAW ROW ${i + 1}:`, row);
        console.log(`🔍 RAW ROW ${i + 1} - Total de colunas: ${row.length}`);
        console.log(`🔍 RAW ROW ${i + 1} - Coluna 2 (nome): "${row[2]}"`);
        console.log(`🔍 RAW ROW ${i + 1} - Coluna 3 (email): "${row[3]}"`);
      }

      const result = this.mapRowToClient(row, columnMapping, references, i + 1);

      if (result.client) {
        if (i <= 2) { // Log first 2 processed clients
          console.log(`🏗️ PROCESSED CLIENT ${i}:`, result.client);
        }
        clients.push(result.client);
      } else if (result.errors && result.errors.length > 0) {
        // Agrupar todos os erros de validação em uma única entrada por linha
        const allErrors = result.errors.join('; ');
        skippedRows.push({
          row: i + 1,
          field: 'validação',
          message: allErrors
        });
        console.warn(`⚠️ Linha ${i + 1} ignorada: ${allErrors}`);
      }
    }

    console.log(`📊 RESUMO DO PROCESSAMENTO:`);
    console.log(`   ✅ Clientes válidos: ${clients.length}`);
    console.log(`   ❌ Linhas ignoradas: ${skippedRows.length}`);

    return { clients, skippedRows };
  }

  private createColumnMapping(headers: string[]): ColumnMapping {
    const mapping: ColumnMapping = {};

    const fieldMappings: { [key: string]: string[] } = {
      'id_cliente_legado': ['id_cliente_legado', 'id cliente legado', 'cliente legado'],
      'produto': ['nome do produto / empreendimento', 'produto', 'nome do produto', 'id_produto', 'id produto', 'empreendimento'],
      'usuario': ['e-mail do corretor responsavel', 'e-mail do corretor', 'email do corretor', 'corretor responsavel', 'id_usuario', 'id usuario', 'usuario'],
      'nome': ['nome do cliente obrigatorio', 'nome do cliente', 'nome completo', 'nome_completo', 'nome'],
      'email': ['e-mail do cliente obrigatorio', 'e-mail do cliente', 'email do cliente', 'email cliente', 'email', 'e-mail'],
      'ddd_residencial': ['ddd_residencial', 'ddd residencial'],
      'tel_residencial': ['tel_residencial', 'telefone residencial', 'fone residencial', 'telefone'],
      'ddd_celular': ['ddd_celular', 'ddd celular'],
      'tel_celular': ['tel_celular', 'telefone celular', 'celular'],
      'ddd_comercial': ['ddd_comercial', 'ddd comercial'],
      'tel_comercial': ['tel_comercial', 'telefone comercial', 'fone comercial'],
      'status': ['status'],
      'motivo_nao_cliente': ['motivo_nao_cliente', 'motivo nao cliente'],
      'data_cadastro': ['data_cadastro', 'data cadastro'],
      'endereco': ['endereco', 'endereço', 'logradouro'],
      'cep': ['cep', 'código postal'],
      'numero': ['numero', 'número', 'num'],
      'complemento': ['complemento endereco', 'compl endereco'],
      'cidade': ['cidade', 'municipio', 'município'],
      'UF': ['uf', 'estado', 'sigla estado'],
      'sexo': ['sexo', 'gênero', 'genero'],
      'cpf': ['cpf', 'documento'],
      'renda_mensal': ['renda_mensal', 'renda mensal', 'renda'],
      'fgts': ['valor do fgts', 'fgts', 'saldo fgts'],
      'qtd_dependentes': ['qtd_dependentes', 'dependentes', 'qtd dependentes'],
      'rg': ['rg do cliente', 'rg', 'identidade'],
      'valor_entrada': ['valor_entrada', 'valor entrada', 'entrada'],
      'email2': ['e-mail 2', 'email 2', 'segundo email'],
      'email3': ['e-mail 3', 'email 3', 'terceiro email'],
      'profissao': ['profissao', 'profissão', 'ocupacao', 'ocupação'],
      'cargo': ['cargo', 'função', 'funcao'],
      'data_nascimento': ['data_nascimento', 'data nascimento', 'nascimento', 'dt_nascimento'],
      'estado_civil': ['estado civil'],
      'bairro': ['bairro', 'distrito'],
      'descricao': ['descricao', 'descrição', 'observacoes', 'observações'],
      'bairro_comercial': ['bairro_comercial', 'bairro comercial'],
      'cep_comercial': ['cep_comercial', 'cep comercial'],
      'cidade_comercial': ['cidade_comercial', 'cidade comercial'],
      'complemento_comercial': ['complemento_comercial', 'complemento comercial'],
      'conjuge_dt_nascimento': ['conjuge_dt_nascimento', 'conjuge data nascimento', 'dt nasc conjuge'],
      'conjuge_estado_civil': ['conjuge_estado_civil', 'conjuge estado civil'],
      'canal_origem': ['canal_origem', 'canal origem', 'canal', 'id_canal_origem', 'id canal origem', 'canal de origem'],
      'midia_origem': ['midia_origem', 'midia origem', 'midia', 'id_midia', 'id midia', 'mídia', 'mídia origem'],
      'momento': ['momento', 'id_momento', 'id momento', 'momento obrigatorio'],
      'submomento': ['submomento', 'id_submomento', 'id submomento', 'sub_momento', 'sub momento (verificar aba complementar *) obrigatorio'],
      'temperatura': ['temperatura', 'id_temperatura', 'id temperatura'],
      'objetivo': ['objetivo', 'id_objetivo', 'id objetivo'],
      'conjuge_profissao': ['conjuge_profissao', 'conjuge profissao', 'profissao conjuge', 'profissão cônjuge'],
      'conjuge_renda_mensal': ['conjuge_renda_mensal', 'conjuge renda mensal', 'renda mensal conjuge'],
      'conjuge_sexo': ['conjuge_sexo', 'conjuge sexo', 'sexo conjuge'],
      'conjuge_cpf': ['conjuge_cpf', 'conjuge cpf', 'cpf conjuge'],
      'nome_conjuge': ['nome_conjuge', 'nome conjuge', 'conjuge nome', 'cônjuge nome'],
      'data_atualizacao': ['data_atualizacao', 'data atualizacao', 'data atualização'],
      'data_criacao': ['data_criacao', 'data criacao', 'data criação'],
      'renda_familiar': ['renda_familiar', 'renda familiar'],
      'logradouro_comercial': ['logradouro_comercial', 'logradouro comercial', 'endereco comercial']
    };

    headers.forEach((header, index) => {
      const normalizedHeader = this.normalizeText(header);

      // Log especial para coluna 6 (SUB MOMENTO)
      if (index === 6) {
        console.log(`🔍 [HEADER DEBUG] Coluna 6: "${header}"`);
        console.log(`🔍 [HEADER DEBUG] Normalizado: "${normalizedHeader}"`);
        console.log(`🔍 [HEADER DEBUG] Contém padrão? ${normalizedHeader.includes('sub momento (verificar aba complementar *) obrigatorio')}`);
      }

      // Verificação especial para SUB MOMENTO (deve ser checado ANTES do loop geral)
      if (normalizedHeader.includes('sub momento') && normalizedHeader.includes('verificar aba complementar')) {
        mapping[index.toString()] = 'submomento';
        console.log(`🎯 [SUB MOMENTO MAPPING] Header "${header}" (coluna ${index}) mapeado para campo "submomento"`);
        return;
      }

      // Verificações especiais para TELEFONES (ordem específica para evitar conflitos)
      if (normalizedHeader.includes('telefone celular')) {
        mapping[index.toString()] = 'tel_celular';
        console.log(`🎯 [TELEFONE MAPPING] Header "${header}" (coluna ${index}) mapeado para campo "tel_celular"`);
        return;
      }
      if (normalizedHeader.includes('telefone comercial')) {
        mapping[index.toString()] = 'tel_comercial';
        console.log(`🎯 [TELEFONE MAPPING] Header "${header}" (coluna ${index}) mapeado para campo "tel_comercial"`);
        return;
      }
      if (normalizedHeader.includes('telefone residencial')) {
        mapping[index.toString()] = 'tel_residencial';
        console.log(`🎯 [TELEFONE MAPPING] Header "${header}" (coluna ${index}) mapeado para campo "tel_residencial"`);
        return;
      }
      if (normalizedHeader === 'telefone' || normalizedHeader.trim() === 'telefone') {
        mapping[index.toString()] = 'tel_residencial';
        console.log(`🎯 [TELEFONE MAPPING] Header "${header}" (coluna ${index}) mapeado para campo "tel_residencial" (genérico)`);
        return;
      }

      for (const [field, variations] of Object.entries(fieldMappings)) {
        if (variations.some(variation => normalizedHeader.includes(this.normalizeText(variation)))) {
          mapping[index.toString()] = field;
          // Log específico para campos importantes
          if (field === 'canal_origem') {
            console.log(`🎯 [CANAL MAPPING] Header "${header}" (coluna ${index}) mapeado para campo "${field}"`);
          } else if (field === 'submomento') {
            console.log(`🎯 [SUB MOMENTO MAPPING] Header "${header}" (coluna ${index}) mapeado para campo "${field}"`);
          }
          break;
        }
      }
    });

    return mapping;
  }

  private mapRowToClient(
    row: any[],
    columnMapping: ColumnMapping,
    references: SheetReferences,
    rowNumber: number
  ): { client: ClientImportData | null, errors: string[] } {
    const client: any = {};
    const errors: string[] = [];

    try {
      Object.entries(columnMapping).forEach(([columnIndex, field]) => {
        const index = parseInt(columnIndex);
        const value = row[index];

        // Log específico para canal_origem sempre
        if (field === 'canal_origem') {
          console.log(`🔍 [CANAL DEBUG] Linha ${rowNumber}: Coluna ${columnIndex} = "${value}" (${typeof value}), isEmpty: ${!value || value === ''}`);
        }

        if (value !== undefined && value !== null && value !== '') {
          switch (field) {
            case 'canal_origem':
              console.log(`🔍 [CANAL DEBUG] Linha ${rowNumber}: Coluna ${columnIndex}, Campo: ${field}, Valor: "${value}", Tipo: ${typeof value}`);
              console.log(`🔍 [CANAL DEBUG] Linha ${rowNumber}: references.canalOrigem existe? ${!!references.canalOrigem}, length: ${references.canalOrigem?.length || 0}`);
              if (references.canalOrigem && references.canalOrigem.length > 0) {
                console.log(`🔍 [CANAL DEBUG] Linha ${rowNumber}: Primeiras 3 referencias de canal:`, references.canalOrigem.slice(0, 3));
              } else {
                console.error(`❌ [CANAL DEBUG] Linha ${rowNumber}: REFERENCES.CANALORIGEM ESTÁ VAZIO OU NULO!`);
              }
              client.id_canal_origem = this.findReferenceId(references.canalOrigem, value, 'CANAL_ORIGEM');
              console.log(`🔍 [CANAL DEBUG] Linha ${rowNumber}: Resultado ID = ${client.id_canal_origem}`);
              break;
            case 'midia_origem':
              client.id_midia = this.findReferenceId(references.midiasOrigem, value, 'MIDIA_ORIGEM');
              break;
            case 'momento':
              client.id_momento = this.findReferenceId(references.momento, value, 'MOMENTO');
              break;
            case 'submomento':
              client.id_submomento = this.findReferenceId(references.subMomento, value, 'SUBMOMENTO');
              console.log(`🎯 [SUB MOMENTO RESULT] Linha ${rowNumber}: "${value}" → ${client.id_submomento}`);
              break;
            case 'produto':
              client.id_produto = this.findReferenceId(references.produto, value, 'PRODUTO');
              console.log(`🎯 [PRODUTO RESULT] Linha ${rowNumber}: "${value}" → ${client.id_produto}`);
              break;
            case 'usuario':
              client.id_usuario = this.findReferenceId(references.usuario, value, 'USUARIO');
              console.log(`🎯 [USUARIO RESULT] Linha ${rowNumber}: "${value}" → ${client.id_usuario}`);
              break;
            case 'temperatura':
            case 'objetivo':
              const parsedValue = parseInt(value.toString());
              client[`id_${field}`] = isNaN(parsedValue) ? null : parsedValue;
              break;
            case 'renda_mensal':
            case 'fgts':
            case 'qtd_dependentes':
            case 'valor_entrada':
              client[field] = parseInt(value.toString()) || 0;
              break;
            case 'data_nascimento':
            case 'conjuge_dt_nascimento':
              client[field] = this.formatDate(value);
              break;
            default:
              client[field] = value.toString().trim();
          }
        }
      });

      // Validações obrigatórias da API manageclients
      const validationErrors = this.validateClient(client, rowNumber);
      if (validationErrors.length > 0) {
        console.error(`❌ Linha ${rowNumber}: Erros de validação:`, validationErrors);
        return { client: null, errors: validationErrors };
      }

      // Adicionar campos obrigatórios com valores padrão se não informados
      if (!client.id_cliente_legado) {
        client.id_cliente_legado = `import_${rowNumber}_${Date.now()}`;
        console.warn(`⚠️ Linha ${rowNumber}: id_cliente_legado não informado, usando: ${client.id_cliente_legado}`);
      }

      // Campo obrigatório na API
      client.excluido = '0'; // Cliente ativo por padrão

      // NENHUM FALLBACK: Campos ficam null/undefined se não forem encontrados nas referências
      console.log(`🔍 [FINAL] Cliente linha ${rowNumber} processado:`, {
        nome: client.nome,
        email: client.email,
        id_canal_origem: client.id_canal_origem,
        id_midia: client.id_midia,
        id_momento: client.id_momento,
        id_submomento: client.id_submomento,
        id_temperatura: client.id_temperatura,
        id_objetivo: client.id_objetivo,
        id_produto: client.id_produto,
        id_usuario: client.id_usuario
      });

      // Log específico do canal para debug
      console.log(`🎯 [CANAL FINAL] Linha ${rowNumber}: id_canal_origem = ${client.id_canal_origem}`);

      return { client: client as ClientImportData, errors: [] };
    } catch (error: any) {
      console.error(`Erro ao processar linha ${rowNumber}:`, error);
      return { client: null, errors: [`Erro ao processar: ${error.message || 'Erro desconhecido'}`] };
    }
  }

  private findReferenceId(references: ReferenceData[], value: string, fieldName: string = ''): number | null {
    if (!value || value.trim() === '') {
      console.log(`🔍 [JOIN] ${fieldName}: Valor vazio, retornando null`);
      return null; // Valor vazio = campo fica vazio
    }

    if (!references || references.length === 0) {
      console.warn(`⚠️ [JOIN] ${fieldName}: Referencias vazias para valor "${value}"`);
      return null;
    }

    const normalizedValue = this.normalizeText(value);
    console.log(`🔍 [JOIN] ${fieldName}: Procurando "${normalizedValue}" (original: "${value}") em ${references.length} referencias`);

    // Log de todas as referências disponíveis para debug
    console.log(`📋 [JOIN] ${fieldName}: Referencias disponíveis:`, references.map(r => `ID ${r.id}: "${r.nome}" (normalizado: "${this.normalizeText(r.nome)}")`));

    const reference = references.find(ref => {
      const refName = this.normalizeText(ref.nome);
      const match = refName === normalizedValue;
      if (match) {
        console.log(`✅ [JOIN] ${fieldName}: MATCH! "${normalizedValue}" === "${refName}"`);
      }
      return match;
    });

    if (reference) {
      console.log(`✅ [JOIN] ${fieldName}: ENCONTRADO! "${value}" → ID ${reference.id}`);
      return reference.id;
    } else {
      console.warn(`❌ [JOIN] ${fieldName}: NÃO ENCONTRADO "${value}" (normalizado: "${normalizedValue}")`);
      console.warn(`💡 [JOIN] ${fieldName}: Sugestões mais próximas:`,
        references.map(r => r.nome).filter(nome => {
          const normalizedNome = this.normalizeText(nome);
          return normalizedNome.includes(normalizedValue.substring(0, 5)) ||
                 normalizedValue.includes(normalizedNome.substring(0, 5));
        })
      );
      return null;
    }
  }

  private formatDate(value: any): string {
    if (!value) return '';

    try {
      if (typeof value === 'number') {
        const date = new Date(Math.round((value - 25569) * 86400 * 1000));
        return date.toISOString().split('T')[0];
      } else if (typeof value === 'string') {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      }
    } catch (error) {
      console.error('Erro ao formatar data:', error);
    }

    return '';
  }

  async importClients(clients: ClientImportData[], batchSize: number = 5, skippedRows: ImportError[] = []): Promise<ImportResult> {
    const totalBatches = Math.ceil(clients.length / batchSize);
    let processedCount = 0;
    let errorCount = 0;
    const errors: ImportError[] = [...skippedRows]; // Incluir erros de processamento da planilha

    this.logToFile('=== INICIANDO IMPORTAÇÃO ===');
    this.logToFile(`Total de clientes a importar: ${clients.length}`);
    this.logToFile(`Linhas ignoradas na leitura: ${skippedRows.length}`);
    this.logToFile(`Batch size: ${batchSize}`);
    this.logToFile(`Total de batches: ${totalBatches}`);

    this.updateProgress(0, clients.length, 'Iniciando importação...');

    for (let i = 0; i < totalBatches; i++) {
      const batch = clients.slice(i * batchSize, (i + 1) * batchSize);
      this.logToFile(`Processando batch ${i + 1}/${totalBatches} com ${batch.length} clientes`);
      this.updateProgress(processedCount, clients.length, `Processando lote ${i + 1} de ${totalBatches}...`);

      const batchPromises = batch.map((client, index) =>
        this.sendClientToAPI(client, i * batchSize + index + 1)
      );

      const batchResults = await Promise.allSettled(batchPromises);

      batchResults.forEach((result, index) => {
        const clientIndex = i * batchSize + index + 1;
        const clientName = batch[index].nome;

        if (result.status === 'fulfilled') {
          processedCount++;
          this.logToFile(`✅ Cliente ${clientIndex} (${clientName}) - SUCESSO`);
        } else {
          errorCount++;
          const errorMsg = result.reason?.message || 'Erro desconhecido';
          this.logToFile(`❌ Cliente ${clientIndex} (${clientName}) - FALHOU: ${errorMsg}`);
          errors.push({
            row: clientIndex,
            field: 'api',
            message: errorMsg
          });
        }
      });

      this.updateProgress(processedCount + errorCount, clients.length,
        `Processados: ${processedCount}, Erros: ${errorCount}`);

      // Delay maior entre batches para evitar sobrecarga na API
      await this.delay(1000);
    }

    this.updateProgress(clients.length, clients.length, 'Importação concluída');

    this.logToFile('=== IMPORTAÇÃO FINALIZADA ===');
    this.logToFile(`Total processados com SUCESSO: ${processedCount}`);
    this.logToFile(`Total de ERROS: ${errorCount}`);
    this.logToFile(`Total de erros no processamento: ${skippedRows.length}`);
    this.logToFile(`Total geral de erros: ${errors.length}`);

    // Salvar log em arquivo
    this.downloadLog();

    return {
      success: errors.length === 0,
      processedCount,
      errorCount: errors.length,
      errors
    };
  }

  private downloadLog(): void {
    const logs = (window as any).importLogs || [];
    if (logs.length === 0) return;

    const logContent = logs.join('');
    const blob = new Blob([logContent], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `import-log-${new Date().getTime()}.txt`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log('📄 Log salvo automaticamente nos Downloads');
  }

  setToken(token: string): void {
    this.dynamicToken = token;
  }

  getToken(): string {
    return this.dynamicToken;
  }

  getCurrentEmpresa(): string {
    return this.currentEmpresa;
  }

  private async sendClientToAPI(client: ClientImportData, rowNumber: number, retryCount: number = 0): Promise<void> {
    const MAX_RETRIES = 3;
    const params = new HttpParams()
      .set('token', this.dynamicToken)
      .set('id_cliente_legado', client.id_cliente_legado || '')
      .set('nome', client.nome)
      .set('email', client.email)
      .set('ddd_residencial', client.ddd_residencial || '')
      .set('tel_residencial', client.tel_residencial || '')
      .set('ddd_celular', client.ddd_celular || '')
      .set('tel_celular', client.tel_celular || '')
      .set('ddd_comercial', client.ddd_comercial || '')
      .set('tel_comercial', client.tel_comercial || '')
      .set('id_usuario', client.id_usuario?.toString() || '')
      .set('id_produto', client.id_produto?.toString() || '')
      .set('endereco', client.endereco || '')
      .set('cep', client.cep || '')
      .set('numero', client.numero || '')
      .set('complemento', client.complemento || '')
      .set('cidade', client.cidade || '')
      .set('UF', client.UF || '')
      .set('id_canal_origem', client.id_canal_origem?.toString() || '')
      .set('id_midia', client.id_midia?.toString() || '')
      .set('id_momento', client.id_momento?.toString() || '')
      .set('id_submomento', client.id_submomento?.toString() || '')
      .set('id_temperatura', client.id_temperatura?.toString() || '')
      .set('id_objetivo', client.id_objetivo?.toString() || '')
      .set('sexo', client.sexo || '')
      .set('cpf', client.cpf || '')
      .set('renda_mensal', client.renda_mensal?.toString() || '')
      .set('fgts', client.fgts?.toString() || '')
      .set('qtd_dependentes', client.qtd_dependentes?.toString() || '')
      .set('rg', client.rg || '')
      .set('valor_entrada', client.valor_entrada?.toString() || '')
      .set('email2', client.email2 || '')
      .set('email3', client.email3 || '')
      .set('profissao', client.profissao || '')
      .set('cargo', client.cargo || '')
      .set('data_nascimento', client.data_nascimento || '')
      .set('estado_civil', client.estado_civil || '')
      .set('bairro', client.bairro || '')
      .set('bairro_comercial', client.bairro_comercial || '')
      .set('cep_comercial', client.cep_comercial || '')
      .set('cidade_comercial', client.cidade_comercial || '')
      .set('complemento_comercial', client.complemento_comercial || '')
      .set('conjuge_dt_nascimento', client.conjuge_dt_nascimento || '')
      .set('conjuge_estado_civil', client.conjuge_estado_civil || '')
      .set('status', 'cliente')
      .set('excluido', client.excluido || '0');

    const baseUrl = this.currentEmpresa ? `${this.currentEmpresa}.hypnobox.com.br/api` : 'meuambiente.hypnobox.com.br/api';
    const url = `https://${baseUrl}${this.MANAGE_CLIENTS_ENDPOINT}`;

    // Validação prévia
    if (!this.currentEmpresa) {
      throw new Error(`Linha ${rowNumber}: Empresa não configurada`);
    }
    if (!this.dynamicToken) {
      throw new Error(`Linha ${rowNumber}: Token não configurado`);
    }

    // Log simplificado para o console apenas
    console.log(`📤 Importando Cliente ${rowNumber}: ${client.nome || 'Sem nome'}`);

    // Logs no console (mantidos para debug)
    console.log(`\n================================`);
    console.log(`📤 IMPORTANDO CLIENTE ${rowNumber}`);
    console.log(`🌐 URL: ${url}`);
    console.log(`🏢 Empresa: ${this.currentEmpresa}`);
    console.log(`🔑 Token: ${this.dynamicToken ? 'Presente' : 'Ausente'}`);
    console.log(`🌐 Base URL: ${baseUrl}`);
    console.log(`================================`);

    console.log(`📋 DADOS PESSOAIS:`);
    console.log(`   • Nome: ${client.nome || 'N/A'}`);
    console.log(`   • ID Cliente Legado: ${client.id_cliente_legado || 'N/A'}`);
    console.log(`   • Email: ${client.email || 'N/A'}`);
    console.log(`   • Email 2: ${client.email2 || 'N/A'}`);
    console.log(`   • Email 3: ${client.email3 || 'N/A'}`);
    console.log(`   • CPF: ${client.cpf || 'N/A'}`);
    console.log(`   • RG: ${client.rg || 'N/A'}`);
    console.log(`   • Data Nascimento: ${client.data_nascimento || 'N/A'}`);
    console.log(`   • Sexo: ${client.sexo || 'N/A'}`);
    console.log(`   • Estado Civil: ${client.estado_civil || 'N/A'}`);
    console.log(`   • Profissão: ${client.profissao || 'N/A'}`);
    console.log(`   • Cargo: ${client.cargo || 'N/A'}`);

    console.log(`📞 TELEFONES:`);
    console.log(`   • Celular: (${client.ddd_celular || ''}) ${client.tel_celular || 'N/A'}`);
    console.log(`   • Residencial: (${client.ddd_residencial || ''}) ${client.tel_residencial || 'N/A'}`);
    console.log(`   • Comercial: (${client.ddd_comercial || ''}) ${client.tel_comercial || 'N/A'}`);

    console.log(`🏠 ENDEREÇO RESIDENCIAL:`);
    console.log(`   • Endereço: ${client.endereco || 'N/A'}`);
    console.log(`   • Número: ${client.numero || 'N/A'}`);
    console.log(`   • Complemento: ${client.complemento || 'N/A'}`);
    console.log(`   • Bairro: ${client.bairro || 'N/A'}`);
    console.log(`   • Cidade: ${client.cidade || 'N/A'}`);
    console.log(`   • UF: ${client.UF || 'N/A'}`);
    console.log(`   • CEP: ${client.cep || 'N/A'}`);

    console.log(`🏢 ENDEREÇO COMERCIAL:`);
    console.log(`   • Bairro: ${client.bairro_comercial || 'N/A'}`);
    console.log(`   • Cidade: ${client.cidade_comercial || 'N/A'}`);
    console.log(`   • CEP: ${client.cep_comercial || 'N/A'}`);
    console.log(`   • Complemento: ${client.complemento_comercial || 'N/A'}`);

    console.log(`💰 DADOS FINANCEIROS:`);
    console.log(`   • Renda Mensal: R$ ${client.renda_mensal || 'N/A'}`);
    console.log(`   • FGTS: R$ ${client.fgts || 'N/A'}`);
    console.log(`   • Valor Entrada: R$ ${client.valor_entrada || 'N/A'}`);
    console.log(`   • Qtd Dependentes: ${client.qtd_dependentes || 'N/A'}`);

    console.log(`👫 DADOS DO CÔNJUGE:`);
    console.log(`   • Data Nascimento: ${client.conjuge_dt_nascimento || 'N/A'}`);
    console.log(`   • Estado Civil: ${client.conjuge_estado_civil || 'N/A'}`);

    console.log(`🔗 IDS DE RELACIONAMENTO:`);
    console.log(`   • ID Usuário: ${client.id_usuario || 'N/A'}`);
    console.log(`   • ID Canal Origem: ${client.id_canal_origem || 'N/A'}`);
    console.log(`   • ID Mídia: ${client.id_midia || 'N/A'}`);
    console.log(`   • ID Momento: ${client.id_momento || 'N/A'}`);
    console.log(`   • ID Submomento: ${client.id_submomento || 'N/A'}`);
    console.log(`   • ID Temperatura: ${client.id_temperatura || 'N/A'}`);
    console.log(`   • ID Objetivo: ${client.id_objetivo || 'N/A'}`);

    console.log(`🔑 TOKEN: ${this.dynamicToken ? `${this.dynamicToken.substring(0, 15)}...` : 'N/A'}`);

    console.log(`📤 OBJETO COMPLETO SENDO ENVIADO:`, client);

    console.log(`🔗 PARÂMETROS URL FINAIS:`, params.toString());
    console.log(`================================\n`);

    try {
      const response: any = await this.http.put(url, null, { params }).toPromise();
      console.log(`✅ SUCESSO HTTP linha ${rowNumber}:`, response);
      console.log(`Status da resposta linha ${rowNumber}:`, typeof response, response);

      // Verificar se a API retornou erros internos
      if (response && response.erros) {
        console.error(`⚠️ [BLOCO-RESPONSE-ERROS] API retornou erros internos linha ${rowNumber}:`, response.erros);
        console.error(`⚠️ [BLOCO-RESPONSE-ERROS] Tipo do response.erros linha ${rowNumber}:`, typeof response.erros);
        console.error(`⚠️ [BLOCO-RESPONSE-ERROS] Array.isArray(response.erros) linha ${rowNumber}:`, Array.isArray(response.erros));

        let errorMessage = '';
        if (Array.isArray(response.erros)) {
          console.log(`⚠️ [BLOCO-RESPONSE-ERROS] Processando como array linha ${rowNumber}`);
          errorMessage = response.erros.map((erro: any) => {
            if (typeof erro === 'string') {
              return erro;
            } else if (typeof erro === 'object') {
              return erro.message || erro.error || erro.description || JSON.stringify(erro);
            } else {
              return String(erro);
            }
          }).join(', ');
        } else if (typeof response.erros === 'object') {
          console.log(`⚠️ [BLOCO-RESPONSE-ERROS] Processando como objeto linha ${rowNumber}`);
          try {
            // Tentar extrair propriedades específicas do objeto de erro
            if (response.erros.message) {
              console.log(`⚠️ [BLOCO-RESPONSE-ERROS] Usando response.erros.message linha ${rowNumber}:`, response.erros.message);
              errorMessage = response.erros.message;
            } else if (response.erros.error) {
              console.log(`⚠️ [BLOCO-RESPONSE-ERROS] Usando response.erros.error linha ${rowNumber}:`, response.erros.error);
              errorMessage = response.erros.error;
            } else if (response.erros.description) {
              console.log(`⚠️ [BLOCO-RESPONSE-ERROS] Usando response.erros.description linha ${rowNumber}:`, response.erros.description);
              errorMessage = response.erros.description;
            } else {
              console.log(`⚠️ [BLOCO-RESPONSE-ERROS] Tentando JSON.stringify linha ${rowNumber}`);
              // Tentar JSON.stringify com tratamento de erro
              errorMessage = JSON.stringify(response.erros, null, 2);
              console.log(`⚠️ [BLOCO-RESPONSE-ERROS] JSON.stringify resultado linha ${rowNumber}:`, errorMessage);
            }
          } catch (jsonError) {
            console.log(`⚠️ [BLOCO-RESPONSE-ERROS] JSON.stringify falhou linha ${rowNumber}, tentando Object.keys`);
            // Se JSON.stringify falhar, extrair as propriedades manualmente
            const keys = Object.keys(response.erros);
            console.log(`⚠️ [BLOCO-RESPONSE-ERROS] Object.keys linha ${rowNumber}:`, keys);
            if (keys.length > 0) {
              errorMessage = keys.map(key => `${key}: ${response.erros[key]}`).join(', ');
              console.log(`⚠️ [BLOCO-RESPONSE-ERROS] Mensagem final das keys linha ${rowNumber}:`, errorMessage);
            } else {
              errorMessage = 'Erro na API (objeto não serializável)';
              console.log(`⚠️ [BLOCO-RESPONSE-ERROS] Usando mensagem padrão linha ${rowNumber}`);
            }
          }
        } else {
          console.log(`⚠️ [BLOCO-RESPONSE-ERROS] Convertendo para string linha ${rowNumber}`);
          errorMessage = String(response.erros);
        }

        console.error(`⚠️ [BLOCO-RESPONSE-ERROS] Mensagem final antes do throw linha ${rowNumber}:`, errorMessage);
        throw new Error(`Linha ${rowNumber}: [RESPONSE-ERROS] Erros da API: ${errorMessage}`);
      }

      // Verificar se não foi criado um ID (indicativo de falha)
      if (!response || !response.id) {
        console.error(`❌ API não retornou ID de cliente linha ${rowNumber}:`, response);
        throw new Error(`Linha ${rowNumber}: Cliente não foi criado - API retornou sucesso mas sem ID`);
      }

      // Log de sucesso confirmado
      console.log(`🎯 CLIENTE CRIADO COM SUCESSO linha ${rowNumber}: ID=${response.id}, Nome="${client.nome}"`);

    } catch (error: any) {
      console.error(`❌ ERRO linha ${rowNumber}:`, error);
      console.error(`Detalhes do erro linha ${rowNumber}:`, {
        status: error.status,
        statusText: error.statusText,
        message: error.message,
        error: error.error
      });
      console.error(`Tipo do error.error linha ${rowNumber}:`, typeof error.error);
      console.error(`Conteúdo completo do error linha ${rowNumber}:`, JSON.stringify(error, null, 2));

      let errorMessage = 'Erro na API';

      // Detectar tipos específicos de erro
      if (error.status === 0 || (error.error && error.error.isTrusted)) {
        errorMessage = 'Erro de rede/CORS';

        // Tentar novamente em caso de erro de rede (até 3 vezes)
        if (retryCount < MAX_RETRIES) {
          console.warn(`⚠️ Tentando novamente linha ${rowNumber} (tentativa ${retryCount + 1}/${MAX_RETRIES})...`);
          await this.delay(2000 * (retryCount + 1)); // Delay crescente: 2s, 4s, 6s
          return this.sendClientToAPI(client, rowNumber, retryCount + 1);
        } else {
          errorMessage = `Erro de rede/CORS após ${MAX_RETRIES} tentativas`;
        }
      } else if (error.error && typeof error.error === 'object') {
        if (error.error.message) {
          errorMessage = error.error.message;
        } else if (error.error.erros) {
          if (Array.isArray(error.error.erros)) {
            errorMessage = error.error.erros.join(', ');
          } else if (typeof error.error.erros === 'object') {
            errorMessage = JSON.stringify(error.error.erros);
          } else {
            errorMessage = String(error.error.erros);
          }
        } else {
          errorMessage = JSON.stringify(error.error);
        }
      } else if (error.message && error.message !== '[object Object]') {
        errorMessage = error.message;
      } else if (error.statusText) {
        errorMessage = `${error.status}: ${error.statusText}`;
      } else if (JSON.stringify(error) === '{"isTrusted":true}') {
        errorMessage = 'Erro de rede - Verifique a conexão com a API';
      }

      throw new Error(`Linha ${rowNumber}: [CATCH-BLOCK] ${errorMessage}`);
    }
  }

  private updateProgress(current: number, total: number, operation: string): void {
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
    this.progressSubject.next({
      current,
      total,
      percentage,
      currentOperation: operation
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private validateClient(client: any, rowNumber: number): string[] {
    const errors: string[] = [];

    // Debug: mostrar o que foi recebido para as primeiras linhas
    if (rowNumber <= 3) {
      console.log(`🔍 [VALIDAÇÃO DEBUG] Linha ${rowNumber}:`, {
        nome: client.nome,
        email: client.email,
        nome_type: typeof client.nome,
        email_type: typeof client.email,
        nome_empty: !client.nome || client.nome.trim() === '',
        email_empty: !client.email || client.email.trim() === ''
      });
    }

    // 1. Nome - obrigatório
    if (!client.nome || client.nome.trim() === '') {
      errors.push('Nome é obrigatório');
      console.log(`❌ [VALIDAÇÃO] Linha ${rowNumber}: Nome vazio ou ausente (valor: "${client.nome}")`);
    }

    // 2. Email - obrigatório e formato válido
    if (!client.email || client.email.trim() === '') {
      errors.push('Email é obrigatório');
      console.log(`❌ [VALIDAÇÃO] Linha ${rowNumber}: Email vazio ou ausente (valor: "${client.email}")`);
    } else if (!this.isValidEmail(client.email)) {
      errors.push(`Email inválido: "${client.email}"`);
      console.log(`❌ [VALIDAÇÃO] Linha ${rowNumber}: Email inválido: "${client.email}"`);
    }

    // 3. Email2 e Email3 - formato válido se informados
    if (client.email2 && !this.isValidEmail(client.email2)) {
      errors.push('Email2 inválido');
    }
    if (client.email3 && !this.isValidEmail(client.email3)) {
      errors.push('Email3 inválido');
    }

    // 4. Estado Civil - valores permitidos (normalizar automaticamente)
    if (client.estado_civil) {
      const estadoCivilNormalizado = this.normalizeEstadoCivil(client.estado_civil);
      if (!estadoCivilNormalizado) {
        errors.push(`Estado Civil inválido: "${client.estado_civil}" (deve ser: Solteiro, Casado, Divorciado ou Viúvo)`);
        console.log(`❌ [VALIDAÇÃO] Linha ${rowNumber}: Estado Civil "${client.estado_civil}" não reconhecido`);
      } else {
        client.estado_civil = estadoCivilNormalizado;
      }
    }

    // 5. Estado Civil Cônjuge - valores permitidos (normalizar automaticamente)
    if (client.conjuge_estado_civil) {
      const estadoCivilConjugeNormalizado = this.normalizeEstadoCivil(client.conjuge_estado_civil);
      if (!estadoCivilConjugeNormalizado) {
        errors.push(`Estado Civil do Cônjuge inválido: "${client.conjuge_estado_civil}" (deve ser: Solteiro, Casado, Divorciado ou Viúvo)`);
      } else {
        client.conjuge_estado_civil = estadoCivilConjugeNormalizado;
      }
    }

    // 6. CPF - formato válido se informado (aceitar com ou sem formatação)
    if (client.cpf) {
      const cpfLimpo = client.cpf.toString().replace(/\D/g, '');
      if (cpfLimpo.length !== 11) {
        errors.push(`CPF inválido: "${client.cpf}" (deve ter 11 dígitos)`);
        console.log(`❌ [VALIDAÇÃO] Linha ${rowNumber}: CPF "${client.cpf}" não tem 11 dígitos`);
      } else {
        // Normalizar CPF para o formato esperado pela API
        client.cpf = cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
      }
    }

    // 7. CPF Cônjuge - formato válido se informado (aceitar com ou sem formatação)
    if (client.conjuge_cpf) {
      const cpfConjugeLimpo = client.conjuge_cpf.toString().replace(/\D/g, '');
      if (cpfConjugeLimpo.length !== 11) {
        errors.push(`CPF do Cônjuge inválido: "${client.conjuge_cpf}" (deve ter 11 dígitos)`);
      } else {
        // Normalizar CPF do cônjuge para o formato esperado pela API
        client.conjuge_cpf = cpfConjugeLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
      }
    }

    // 8. Campos numéricos
    const numericFields = [
      'renda_mensal', 'fgts', 'qtd_dependentes', 'valor_entrada', 'conjuge_renda_mensal', 'renda_familiar',
      'valor_de_imovel', 'valor_ate_imovel', 'dormitorio_de', 'dormitorio_ate'
    ];

    numericFields.forEach(field => {
      if (client[field] !== undefined && client[field] !== null && client[field] !== '') {
        const value = parseFloat(client[field].toString());
        if (isNaN(value)) {
          errors.push(`${field} deve ser um valor numérico`);
        }
      }
    });

    // 9. Datas - formato válido se informadas
    if (client.data_nascimento && !this.isValidDate(client.data_nascimento)) {
      errors.push('Data de nascimento deve ter formato válido (YYYY-MM-DD)');
    }

    if (client.conjuge_dt_nascimento && !this.isValidDate(client.conjuge_dt_nascimento)) {
      errors.push('Data de nascimento do cônjuge deve ter formato válido (YYYY-MM-DD)');
    }

    return errors;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidCPF(cpf: string): boolean {
    const cpfRegex = /^[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}$/;
    return cpfRegex.test(cpf);
  }

  private isValidDate(date: string): boolean {
    if (!date) return true; // Campo opcional
    // Aceita formatos: YYYY-MM-DD, DD/MM/YYYY, etc.
    const parsedDate = new Date(date);
    return !isNaN(parsedDate.getTime());
  }

  private normalizeText(text: string): string {
    if (!text) return '';

    return text
      .toLowerCase()
      .trim()
      // Remover acentos
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      // Padronizar espaços
      .replace(/\s+/g, ' ')
      // Remover caracteres especiais comuns que podem causar problemas
      .replace(/[""'']/g, '"')
      .replace(/[–—]/g, '-');
  }

  private normalizeEstadoCivil(estadoCivil: string): string | null {
    if (!estadoCivil) return null;

    const normalized = estadoCivil.toString().toLowerCase().trim()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // Remover acentos

    const mapping: { [key: string]: string } = {
      'solteiro': 'Solteiro',
      'solteira': 'Solteiro',
      'casado': 'Casado',
      'casada': 'Casado',
      'divorciado': 'Divorciado',
      'divorciada': 'Divorciado',
      'viuvo': 'Viuvo',
      'viuva': 'Viuvo',
      'viúvo': 'Viuvo',
      'viúva': 'Viuvo',
      'separado': 'Divorciado',
      'separada': 'Divorciado'
    };

    return mapping[normalized] || null;
  }
}