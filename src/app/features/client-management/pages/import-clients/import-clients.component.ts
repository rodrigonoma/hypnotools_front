import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { ClientImportService } from '../../services/client-import.service';
import {
  ClientImportData,
  SheetReferences,
  ImportResult,
  ImportProgress,
  ImportError
} from '../../models/client-import.interface';

@Component({
  selector: 'app-import-clients',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatTableModule,
    MatExpansionModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule
  ],
  templateUrl: './import-clients.component.html',
  styleUrls: ['./import-clients.component.scss']
})
export class ImportClientsComponent implements OnDestroy {
  selectedFile: File | null = null;
  isProcessing = false;
  showPreview = false;
  clients: ClientImportData[] = [];
  references: SheetReferences | null = null;
  importResult: ImportResult | null = null;
  skippedRows: ImportError[] = []; // Erros de processamento da planilha
  apiToken: string = '';
  batchSize: number = 1; // Processar 1 por vez para evitar erro de CORS/rate limit
  progress: ImportProgress = {
    current: 0,
    total: 0,
    percentage: 0,
    currentOperation: ''
  };

  selectedClientForPreview: ClientImportData | null = null;
  selectedClientIndex: number = -1;

  private progressSubscription: Subscription | null = null;

  displayedColumns = ['nome', 'email', 'telefone', 'cidade', 'canal_origem', 'actions'];
  errorColumns = ['row', 'field', 'message'];

  constructor(
    private clientImportService: ClientImportService,
    private snackBar: MatSnackBar
  ) {
    this.progressSubscription = this.clientImportService.progress$.subscribe(
      progress => this.progress = progress
    );
    this.apiToken = this.clientImportService.getToken();
  }

  ngOnDestroy(): void {
    if (this.progressSubscription) {
      this.progressSubscription.unsubscribe();
    }
  }

  triggerFileInput(): void {
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  }

  onFileSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      const file = target.files[0];

      if (this.isValidFileType(file)) {
        this.selectedFile = file;
        this.resetState();
      } else {
        this.snackBar.open(
          'Formato de arquivo inválido. Use apenas .xlsx ou .csv',
          'Fechar',
          { duration: 3000 }
        );
      }
    }
  }

  private isValidFileType(file: File): boolean {
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    return validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
  }

  async processFile(): Promise<void> {
    if (!this.selectedFile) {
      this.snackBar.open('Selecione um arquivo primeiro', 'Fechar', { duration: 3000 });
      return;
    }

    this.isProcessing = true;
    this.resetState();

    try {
      const result = await this.clientImportService.processSpreadsheet(this.selectedFile);
      this.clients = result.clients;
      this.references = result.references;
      this.skippedRows = result.skippedRows;
      this.showPreview = true;

      // Debug: Log dos primeiros clientes para verificar estrutura dos telefones
      console.log('Primeiros 3 clientes processados:', this.clients.slice(0, 3));
      console.log('Todas as propriedades do primeiro cliente:', Object.keys(this.clients[0] || {}));
      console.log('Campos de telefone do primeiro cliente:', {
        ddd_celular: this.clients[0]?.ddd_celular,
        tel_celular: this.clients[0]?.tel_celular,
        ddd_comercial: this.clients[0]?.ddd_comercial,
        tel_comercial: this.clients[0]?.tel_comercial,
        ddd_residencial: this.clients[0]?.ddd_residencial,
        tel_residencial: this.clients[0]?.tel_residencial
      });

      // Verificar telefones processados
      console.log('Telefones dos primeiros 5 clientes:');
      this.clients.slice(0, 5).forEach((client, index) => {
        console.log(`Cliente ${index + 1}: ${this.getClientPhone(client)} | Válido: ${this.hasValidPhone(client)}`);
      });

      // Verificar CPFs processados
      console.log('CPFs dos primeiros 5 clientes:');
      this.clients.slice(0, 5).forEach((client, index) => {
        console.log(`Cliente ${index + 1}: ${client.cpf || 'SEM CPF'} | Válido: ${this.hasValidCpf(client)}`);
      });

      let message = `${this.clients.length} clientes carregados com sucesso!`;
      if (this.skippedRows.length > 0) {
        message += ` ${this.skippedRows.length} linha(s) ignorada(s) por problemas de validação.`;
      }

      this.snackBar.open(message, 'Fechar', { duration: 5000 });
    } catch (error: any) {
      this.snackBar.open(
        `Erro ao processar arquivo: ${error.message}`,
        'Fechar',
        { duration: 5000 }
      );
    } finally {
      this.isProcessing = false;
    }
  }

  onTokenChange(): void {
    if (this.apiToken) {
      this.clientImportService.setToken(this.apiToken);
    }
  }

  async importClients(): Promise<void> {
    if (!this.clients || this.clients.length === 0) {
      this.snackBar.open('Nenhum cliente para importar', 'Fechar', { duration: 3000 });
      return;
    }

    if (!this.apiToken.trim()) {
      this.snackBar.open('Token da API é obrigatório', 'Fechar', { duration: 3000 });
      return;
    }

    this.clientImportService.setToken(this.apiToken);
    this.isProcessing = true;

    try {
      // Enviar todos os clientes
      const clientsToImport = this.clients;
      console.log(`Enviando todos os ${clientsToImport.length} clientes para integração`);

      // Passar também os erros de processamento da planilha
      this.importResult = await this.clientImportService.importClients(clientsToImport, this.batchSize, this.skippedRows);

      if (this.importResult.success) {
        this.snackBar.open(
          `${this.importResult.processedCount} clientes importados com sucesso!`,
          'Fechar',
          { duration: 5000 }
        );
      } else {
        this.snackBar.open(
          `Importação concluída. ${this.importResult.processedCount} importados, ${this.importResult.errorCount} com erro. Baixe o relatório para detalhes.`,
          'Fechar',
          { duration: 7000 }
        );
      }
    } catch (error: any) {
      this.snackBar.open(
        `Erro durante a importação: ${error.message}`,
        'Fechar',
        { duration: 5000 }
      );
    } finally {
      this.isProcessing = false;
    }
  }

  resetAll(): void {
    this.selectedFile = null;
    this.resetState();

    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  private resetState(): void {
    this.showPreview = false;
    this.clients = [];
    this.references = null;
    this.importResult = null;
    this.skippedRows = [];
    this.selectedClientForPreview = null;
    this.selectedClientIndex = -1;
    this.progress = {
      current: 0,
      total: 0,
      percentage: 0,
      currentOperation: ''
    };
  }

  viewClientDetails(client: ClientImportData, index: number): void {
    this.selectedClientForPreview = client;
    this.selectedClientIndex = index + 1; // +1 para mostrar número da linha
  }

  closeClientDetails(): void {
    this.selectedClientForPreview = null;
    this.selectedClientIndex = -1;
  }

  getPreviewUrl(): string {
    const baseUrl = this.clientImportService.getCurrentEmpresa()
      ? `${this.clientImportService.getCurrentEmpresa()}.hypnobox.com.br/api`
      : 'meuambiente.hypnobox.com.br/api';
    return `https://${baseUrl}/manageclients`;
  }

  getPreviewParams(client: ClientImportData): string {
    const params = new URLSearchParams();
    params.set('token', this.apiToken);
    params.set('id_cliente_legado', client.id_cliente_legado || '');
    params.set('nome', client.nome);
    params.set('email', client.email);
    params.set('ddd_residencial', client.ddd_residencial || '');
    params.set('tel_residencial', client.tel_residencial || '');
    params.set('ddd_celular', client.ddd_celular || '');
    params.set('tel_celular', client.tel_celular || '');
    params.set('ddd_comercial', client.ddd_comercial || '');
    params.set('tel_comercial', client.tel_comercial || '');
    params.set('id_usuario', client.id_usuario?.toString() || '');
    params.set('endereco', client.endereco || '');
    params.set('cep', client.cep || '');
    params.set('numero', client.numero || '');
    params.set('complemento', client.complemento || '');
    params.set('cidade', client.cidade || '');
    params.set('UF', client.UF || '');
    params.set('id_canal_origem', client.id_canal_origem?.toString() || '');
    params.set('id_midia', client.id_midia?.toString() || '');
    params.set('id_momento', client.id_momento?.toString() || '');
    params.set('id_submomento', client.id_submomento?.toString() || '');
    params.set('id_temperatura', client.id_temperatura?.toString() || '');
    params.set('id_objetivo', client.id_objetivo?.toString() || '');
    params.set('sexo', client.sexo || '');
    params.set('cpf', client.cpf || '');
    params.set('renda_mensal', client.renda_mensal?.toString() || '');
    params.set('fgts', client.fgts?.toString() || '');
    params.set('qtd_dependentes', client.qtd_dependentes?.toString() || '');
    params.set('rg', client.rg || '');
    params.set('valor_entrada', client.valor_entrada?.toString() || '');
    params.set('email2', client.email2 || '');
    params.set('email3', client.email3 || '');
    params.set('profissao', client.profissao || '');
    params.set('cargo', client.cargo || '');
    params.set('data_nascimento', client.data_nascimento || '');
    params.set('estado_civil', client.estado_civil || '');
    params.set('bairro', client.bairro || '');
    params.set('bairro_comercial', client.bairro_comercial || '');
    params.set('cep_comercial', client.cep_comercial || '');
    params.set('cidade_comercial', client.cidade_comercial || '');
    params.set('complemento_comercial', client.complemento_comercial || '');
    params.set('conjuge_dt_nascimento', client.conjuge_dt_nascimento || '');
    params.set('conjuge_estado_civil', client.conjuge_estado_civil || '');

    return params.toString();
  }

  getClientPhone(client: ClientImportData): string {
    // Prioridade 1: Celular (com ou sem DDD)
    if (client.tel_celular) {
      const ddd = client.ddd_celular || '';
      return ddd ? `(${ddd}) ${client.tel_celular}` : client.tel_celular;
    }
    // Prioridade 2: Comercial (com ou sem DDD)
    if (client.tel_comercial) {
      const ddd = client.ddd_comercial || '';
      return ddd ? `(${ddd}) ${client.tel_comercial}` : client.tel_comercial;
    }
    // Prioridade 3: Residencial (com ou sem DDD)
    if (client.tel_residencial) {
      const ddd = client.ddd_residencial || '';
      return ddd ? `(${ddd}) ${client.tel_residencial}` : client.tel_residencial;
    }
    return 'SEM TELEFONE';
  }

  hasValidPhone(client: ClientImportData): boolean {
    return !!(client.tel_celular || client.tel_comercial || client.tel_residencial);
  }

  getClientsWithoutPhone(): ClientImportData[] {
    return this.clients.filter(client => !this.hasValidPhone(client));
  }

  getPhoneValidationMessage(): string {
    const clientsWithoutPhone = this.getClientsWithoutPhone();
    if (clientsWithoutPhone.length === 0) {
      return '';
    }
    return `⚠️ ${clientsWithoutPhone.length} cliente(s) encontrado(s) sem telefone válido`;
  }

  hasValidCpf(client: ClientImportData): boolean {
    return !!(client.cpf && client.cpf.trim() !== '');
  }

  getClientsWithoutCpf(): ClientImportData[] {
    return this.clients.filter(client => !this.hasValidCpf(client));
  }

  getCpfValidationMessage(): string {
    const clientsWithoutCpf = this.getClientsWithoutCpf();
    if (clientsWithoutCpf.length === 0) {
      return '';
    }
    return `⚠️ ${clientsWithoutCpf.length} cliente(s) encontrado(s) sem CPF válido`;
  }

  getCanalOrigemNome(client: ClientImportData): string {
    if (!this.references) return 'N/A';

    const canal = this.references.canalOrigem.find(c => c.id === client.id_canal_origem);
    return canal ? canal.nome : `ID: ${client.id_canal_origem}`;
  }

  downloadErrorReport(): void {
    if (!this.importResult || !this.importResult.errors.length) return;

    const csvContent = this.generateErrorReportCSV();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');

    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'relatorio_erros_importacao.csv');
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  private generateErrorReportCSV(): string {
    if (!this.importResult) return '';

    const headers = ['Linha', 'Tipo', 'Campo', 'Mensagem', 'Detalhes'];
    const rows = this.importResult.errors.map(error => {
      // Determinar o tipo de erro
      let tipo = 'Desconhecido';
      let detalhes = '';

      if (error.field === 'linha') {
        tipo = 'Linha Vazia';
        detalhes = 'Linha sem dados ou com todas as colunas vazias';
      } else if (error.field === 'validação') {
        tipo = 'Validação';
        detalhes = this.getValidationDetails(error.message);
      } else if (error.field === 'api') {
        tipo = 'Erro API';
        detalhes = 'Erro ao enviar para a API (verifique logs)';
      }

      return [
        error.row.toString(),
        tipo,
        error.field,
        error.message,
        detalhes
      ];
    });

    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field.replace(/"/g, '""')}"`).join(','))
      .join('\n');

    return '\uFEFF' + csvContent;
  }

  private getValidationDetails(message: string): string {
    if (message.includes('Email') && message.includes('obrigatório')) {
      return 'Campo de email está vazio';
    } else if (message.includes('Email') && message.includes('inválido')) {
      return 'Email não possui formato válido (falta @, domínio inválido, etc)';
    } else if (message.includes('Nome') && message.includes('obrigatório')) {
      return 'Campo de nome está vazio';
    } else if (message.includes('CPF') && message.includes('formato')) {
      return 'CPF informado não possui formato 000.000.000-00';
    } else if (message.includes('Estado Civil')) {
      return 'Estado Civil deve ser: Solteiro, Casado, Divorciado ou Viuvo';
    } else if (message.includes('numérico')) {
      return 'Campo numérico contém valor não-numérico';
    } else if (message.includes('data')) {
      return 'Data informada possui formato inválido';
    }
    return 'Verifique os dados da linha na planilha original';
  }
}