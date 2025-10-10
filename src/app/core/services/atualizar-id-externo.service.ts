import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AtualizarIdExternoUnidadeModel {
  Identificador_unid: string;
}

export interface AtualizarIdExternoResponse {
  success: boolean;
  message: string;
  totalAtualizados: number;
  totalRecebidos: number;
  processedAt: Date;
  error?: string;
  statusCode?: number;
}

export interface AtualizarIdExternoRequest {
  unidades: AtualizarIdExternoUnidadeModel[];
}

@Injectable({
  providedIn: 'root'
})
export class AtualizarIdExternoService {
  private apiUrl = `${environment.apiUrl}/api/unidade`;

  constructor(private http: HttpClient) {}

  /**
   * Atualiza o id_externo das unidades na tabela tower_units
   * @param unidades Lista de unidades com Identificador_unid
   * @returns Observable com o resultado da operação
   */
  atualizarIdExterno(unidades: AtualizarIdExternoUnidadeModel[]): Observable<AtualizarIdExternoResponse> {
    return this.http.post<AtualizarIdExternoResponse>(
      `${this.apiUrl}/atualizar-id-externo`,
      unidades
    );
  }
}
