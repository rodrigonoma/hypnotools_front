import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { environment } from '../../../../environments/environment';
import * as XLSX from 'xlsx';

export interface ClientDeletionRequest {
  clientIds: number[];
  reason: string;
  userEmail: string;
}

export interface ClientDeletionResponse {
  success: boolean;
  deletedCount: number;
  failedCount: number;
  logFileName: string;
  errors?: string[];
  details?: DeletionDetail[];
}

export interface DeletionDetail {
  clientId: number;
  clientName?: string;
  success: boolean;
  error?: string;
  affectedTables: string[];
  recordsDeleted: number;
}

export interface ValidationResult {
  validIds: number[];
  invalidIds: number[];
  clientDetails: ClientDetail[];
  totalRecordsToDelete: number;
  affectedTables: string[];
}

export interface ClientDetail {
  id: number;
  name: string;
  email: string;
  cpf?: string;
  registrationDate: Date;
}

@Injectable({
  providedIn: 'root'
})
export class ClientDeletionService {
  private apiUrl = `${environment.apiUrl}/clients`;

  // Subjects para acompanhar o progresso
  private deletionProgressSubject = new BehaviorSubject<{
    current: number;
    total: number;
    status: string;
  }>({ current: 0, total: 0, status: 'idle' });

  deletionProgress$ = this.deletionProgressSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Valida IDs de clientes antes da exclusão
   */
  validateClientIds(clientIds: number[]): Observable<ValidationResult> {
    const params = new HttpParams().set('clientIds', clientIds.join(','));

    this.updateProgress(0, clientIds.length, 'Validando IDs de clientes...');

    return this.http.get<ValidationResult>(`${this.apiUrl}/validate-for-deletion`, { params });
  }

  /**
   * Executa a exclusão em massa de clientes
   */
  deleteClients(request: ClientDeletionRequest): Observable<ClientDeletionResponse> {
    this.updateProgress(0, request.clientIds.length, 'Iniciando exclusão...');

    return this.http.delete<ClientDeletionResponse>(`${this.apiUrl}/bulk-delete`, {
      body: request
    });
  }

  /**
   * Faz upload e processa arquivo Excel com IDs de clientes
   */
  uploadExcelFile(file: File): Promise<number[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });

          // Tentar encontrar a primeira aba ou aba específica
          const firstSheetName = workbook.SheetNames[0];
          let worksheet = workbook.Sheets[firstSheetName];

          // Se existe aba "IDS" ou "CLIENTES", usar essa
          if (workbook.SheetNames.includes('IDS')) {
            worksheet = workbook.Sheets['IDS'];
          } else if (workbook.SheetNames.includes('CLIENTES')) {
            worksheet = workbook.Sheets['CLIENTES'];
          }

          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          const clientIds: number[] = [];

          // Processar dados do Excel
          for (let i = 0; i < jsonData.length; i++) {
            const row = jsonData[i] as any[];

            if (row && row.length > 0) {
              for (const cell of row) {
                if (cell && (typeof cell === 'number' || typeof cell === 'string')) {
                  const id = parseInt(cell.toString());
                  if (!isNaN(id) && id > 0) {
                    clientIds.push(id);
                  }
                }
              }
            }
          }

          // Remover duplicatas
          const uniqueIds = [...new Set(clientIds)];
          resolve(uniqueIds);

        } catch (error) {
          reject(new Error(`Erro ao processar arquivo Excel: ${error}`));
        }
      };

      reader.onerror = () => {
        reject(new Error('Erro ao ler arquivo'));
      };

      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Converte string de IDs separados por vírgula em array
   */
  parseClientIdsFromText(text: string): number[] {
    if (!text || text.trim() === '') {
      return [];
    }

    const ids: number[] = [];

    // Dividir por vírgulas, quebras de linha, espaços
    const parts = text.split(/[,\n\r\s]+/);

    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed) {
        const id = parseInt(trimmed);
        if (!isNaN(id) && id > 0) {
          ids.push(id);
        }
      }
    }

    // Remover duplicatas
    return [...new Set(ids)];
  }

  /**
   * Baixa o log de exclusão gerado
   */
  downloadDeletionLog(logFileName: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/deletion-log/${logFileName}`, {
      responseType: 'blob'
    });
  }

  /**
   * Lista logs de exclusão disponíveis
   */
  getDeletionLogs(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/deletion-logs`);
  }

  /**
   * Obtém estatísticas das tabelas que serão afetadas
   */
  getAffectedTablesStats(clientIds: number[]): Observable<{
    tableName: string;
    recordCount: number;
    description: string;
  }[]> {
    const params = new HttpParams().set('clientIds', clientIds.join(','));

    return this.http.get<{
      tableName: string;
      recordCount: number;
      description: string;
    }[]>(`${this.apiUrl}/affected-tables-stats`, { params });
  }

  /**
   * Atualiza o progresso da operação
   */
  private updateProgress(current: number, total: number, status: string) {
    this.deletionProgressSubject.next({ current, total, status });
  }

  /**
   * Reseta o progresso
   */
  resetProgress() {
    this.deletionProgressSubject.next({ current: 0, total: 0, status: 'idle' });
  }

  /**
   * Valida se o arquivo é Excel válido
   */
  validateExcelFile(file: File): boolean {
    const validTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel.sheet.macroEnabled.12'
    ];

    const validExtensions = ['.xls', '.xlsx', '.xlsm'];

    const hasValidType = validTypes.includes(file.type);
    const hasValidExtension = validExtensions.some(ext =>
      file.name.toLowerCase().endsWith(ext)
    );

    return hasValidType || hasValidExtension;
  }

  /**
   * Formata número para exibição
   */
  formatNumber(num: number): string {
    return new Intl.NumberFormat('pt-BR').format(num);
  }

  /**
   * Formata data para exibição
   */
  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }
}