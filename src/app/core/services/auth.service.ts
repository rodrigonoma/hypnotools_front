import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface LoginRequest {
  email: string;
  senha: string;
  empresa: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  token?: string;
  usuario?: UsuarioInfo;
}

export interface UsuarioInfo {
  idUsuario: number;
  nome: string;
  email: string;
  ativo: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = `${environment.apiUrl}/api/auth`;
  private currentUserSubject = new BehaviorSubject<UsuarioInfo | null>(null);
  private tokenSubject = new BehaviorSubject<string | null>(null);
  private empresaSubject = new BehaviorSubject<string | null>(null);

  public currentUser$ = this.currentUserSubject.asObservable();
  public token$ = this.tokenSubject.asObservable();
  public empresa$ = this.empresaSubject.asObservable();

  constructor(private http: HttpClient) {
    // Recuperar dados do localStorage na inicialização
    const token = localStorage.getItem('hypnotools_token');
    const user = localStorage.getItem('hypnotools_user');
    const empresa = localStorage.getItem('hypnotools_empresa');

    if (token) {
      this.tokenSubject.next(token);
    }

    if (user) {
      this.currentUserSubject.next(JSON.parse(user));
    }

    if (empresa) {
      this.empresaSubject.next(empresa);
    }
  }

  login(loginData: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, loginData).pipe(
      map((response) => {
        if (response.success && response.token && response.usuario) {
          // Salvar dados no localStorage
          localStorage.setItem('hypnotools_token', response.token);
          localStorage.setItem('hypnotools_user', JSON.stringify(response.usuario));
          localStorage.setItem('hypnotools_empresa', loginData.empresa);

          // Atualizar subjects
          this.tokenSubject.next(response.token);
          this.currentUserSubject.next(response.usuario);
          this.empresaSubject.next(loginData.empresa);
        }
        return response;
      })
    );
  }

  logout(): void {
    // Limpar localStorage
    localStorage.removeItem('hypnotools_token');
    localStorage.removeItem('hypnotools_user');
    localStorage.removeItem('hypnotools_empresa');

    // Limpar subjects
    this.tokenSubject.next(null);
    this.currentUserSubject.next(null);
    this.empresaSubject.next(null);
  }

  validateToken(token: string): Observable<boolean> {
    return this.http.post<boolean>(`${this.apiUrl}/validate`, token);
  }

  get currentUserValue(): UsuarioInfo | null {
    return this.currentUserSubject.value;
  }

  get tokenValue(): string | null {
    return this.tokenSubject.value;
  }

  get empresaValue(): string | null {
    return this.empresaSubject.value;
  }

  get isAuthenticated(): boolean {
    return !!this.tokenValue && !!this.currentUserValue;
  }

  setEmpresa(empresa: string): void {
    localStorage.setItem('hypnotools_empresa', empresa);
    this.empresaSubject.next(empresa);
  }
}
