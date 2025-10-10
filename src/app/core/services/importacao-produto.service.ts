import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UnidadeDetalhadaModel } from './erp.service';

export interface ImportacaoProdutoModel {
  codigoEmpreendimento: string;
  nomeEmpreendimento: string;
  unidades: UnidadeImportacaoModel[];
}

export interface UnidadeImportacaoModel {
  codigoUnidade: string;
  descricaoUnidade: string;
  areaPrivativa?: number;
  areaTotal?: number;
  valorVenda?: number;
  status: string;
  tipoUnidade?: string;
  andar?: number;
}

export interface ImportacaoResultModel {
  success: boolean;
  message: string;
  totalUnidades: number;
  unidadesImportadas: number;
  erros: string[];
}

export interface TransformacaoERPRequest {
  codigoObra: string;
  nomeObra: string;
  unidades: UnidadeDetalhadaModel[];
}

export interface ImportacaoERPRequest {
  empresa: string;
  codigoObra: string;
  unidades: UnidadeDetalhadaModel[];
}

@Injectable({
  providedIn: 'root'
})
export class ImportacaoProdutoService {
  private apiUrl = `${environment.apiUrl}/api/importacao-produto`;

  constructor(private http: HttpClient) {}

  transformarDadosERP(request: TransformacaoERPRequest): Observable<ImportacaoProdutoModel> {
    return this.http.post<ImportacaoProdutoModel>(`${this.apiUrl}/transformar-dados-erp`, request);
  }

  importarProdutoERP(request: ImportacaoERPRequest): Observable<ImportacaoResultModel> {
    return this.http.post<ImportacaoResultModel>(`${this.apiUrl}/importar-produto-erp`, request);
  }
}