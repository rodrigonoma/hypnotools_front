import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ProvedorExternoModel {
  id: number;
  nome: string;
  urlBase: string;
  usuario: string;
  senha: string;
  empresa: string;
  provedor: number;
  dataCriacao: Date;
}

export interface EmpresaAtivaModel {
  codigo_emp: number;
  desc_emp: string;
  cgc_emp: string;
  ie_emp: string;
  inscrMunic_emp: string;
  endereco_emp: string;
  fone_emp: string;
}

export interface ObraAtivaModel {
  codigoObra: string;
  empresaObra: number;
  nomeObra: string;
  statusObra: string;
  dataInicio?: Date;
  dataPrevisaoTermino?: Date;
  idProduto?: number; // ID do produto no sistema Transacional (tower products)
}

export interface CampoPersonalizadoModel {
  campo: string;
  descricao: string;
}

export interface UnidadeDetalhadaModel {
  codigoUnidade: string;
  descricaoUnidade: string;
  codigoObra: string;
  nomeObra: string;
  areaPrivativa?: number;
  areaTotal?: number;
  valorVenda?: number;
  status?: string;
  tipoUnidade?: string;
  andar?: number;
  // Campos dinâmicos personalizados
  [key: string]: any;
}

export interface AtualizarIdExternoUnidade {
  identificador_unid: string;
}

export interface AtualizarIdExternoRequest {
  idProduto: number;
  unidades: AtualizarIdExternoUnidade[];
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

@Injectable({
  providedIn: 'root'
})
export class ErpService {
  private apiUrl = `${environment.apiUrl}/api/erp`;

  constructor(private http: HttpClient) {}

  getProvedoresExternos(empresa: string, provedor?: number): Observable<ProvedorExternoModel[]> {
    let url = `${this.apiUrl}/provedores-externos/${empresa}`;
    if (provedor) {
      url += `?provedor=${provedor}`;
    }
    return this.http.get<ProvedorExternoModel[]>(url);
  }

  getEmpresasAtivas(empresa: string): Observable<EmpresaAtivaModel[]> {
    return this.http.get<EmpresaAtivaModel[]>(`${this.apiUrl}/empresas-ativas/${empresa}`);
  }

  getObrasAtivas(empresa: string): Observable<ObraAtivaModel[]> {
    return this.http.get<ObraAtivaModel[]>(`${this.apiUrl}/obter-obras-ativas/${empresa}`);
  }

  getUnidadesDetalhadas(empresa: string, codigoObra: string): Observable<UnidadeDetalhadaModel[]> {
    return this.http.get<UnidadeDetalhadaModel[]>(`${this.apiUrl}/unidades-detalhadas/${empresa}/${codigoObra}`);
  }

  getCamposPersonalizados(empresa: string, codigoObra: string): Observable<CampoPersonalizadoModel[]> {
    return this.http.get<CampoPersonalizadoModel[]>(`${this.apiUrl}/campos-personalizados/${empresa}/${codigoObra}`);
  }

  atualizarIdExterno(request: AtualizarIdExternoRequest): Observable<AtualizarIdExternoResponse> {
    const unidadeApiUrl = `${environment.apiUrl}/api/unidade`;
    return this.http.post<AtualizarIdExternoResponse>(`${unidadeApiUrl}/atualizar-id-externo`, request);
  }
}