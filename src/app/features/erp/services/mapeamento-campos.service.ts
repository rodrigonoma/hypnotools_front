import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { TesteMapeamento, MapeamentoResultado, StatusUnidade } from '../models/mapeamento-campos.model';

@Injectable({
  providedIn: 'root'
})
export class MapeamentoCamposService {
  private apiUrl = `${environment.apiUrl}/api/MapeamentoCampos`;
  private apiUrlImportacao = `${environment.apiUrl}/api/ImportacaoProduto`;

  constructor(private http: HttpClient) {}

  async testarMapeamento(teste: TesteMapeamento): Promise<MapeamentoResultado> {
    return firstValueFrom(
      this.http.post<MapeamentoResultado>(`${this.apiUrl}/testar`, teste)
    );
  }

  /**
   * Busca lista de status de unidades disponíveis no TRS
   */
  async obterStatusUnidades(): Promise<StatusUnidade[]> {
    return firstValueFrom(
      this.http.get<StatusUnidade[]>(`${this.apiUrlImportacao}/ObterStatusUnidades`)
    );
  }
}
