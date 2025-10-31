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
  idProduto: number;
  codigoObra: string;
  unidades: AtualizarIdExternoUnidadeModel[];
}

@Injectable({
  providedIn: 'root'
})
export class AtualizarIdExternoService {
  private apiUrl = `${environment.apiUrl}/api/unidade`;

  constructor(private http: HttpClient) {}

  /**
   * Atualiza o id_externo das unidades na tabela tower_units e das torres na tabela towers
   * @param idProduto ID do produto no Transacional-Proposta
   * @param codigoObra Código da obra do ERP (será usado para atualizar id_externo da torre)
   * @param unidades Lista de unidades com Identificador_unid
   * @returns Observable com o resultado da operação
   */
  atualizarIdExterno(
    idProduto: number,
    codigoObra: string,
    unidades: AtualizarIdExternoUnidadeModel[]
  ): Observable<AtualizarIdExternoResponse> {
    const request: AtualizarIdExternoRequest = {
      idProduto: idProduto,
      codigoObra: codigoObra,
      unidades: unidades
    };

    return this.http.post<AtualizarIdExternoResponse>(
      `${this.apiUrl}/atualizar-id-externo`,
      request
    );
  }
}
