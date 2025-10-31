import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CommonModule } from '@angular/common';
import { AuthService, LoginRequest } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  isLoading = false;
  hidePassword = true;

  // Lista de empresas disponíveis (pode ser expandida conforme necessário)
  empresasDisponiveis = [
    { value: 'casaeterra', name: 'Casa e Terra' },
    { value: 'bp8', name: 'BP8' },
    { value: 'cityinc', name: 'CityInc' },
    { value: 'construpar', name: 'Construpar' },
    { value: 'wvmaldi', name: 'Wvmaldi' },
    { value: 'markaprime', name: 'Markaprime' },
    { value: 'yonder', name: 'Yonder' },
    { value: 'catuai', name: 'Catuai' },
    { value: 'umavendas', name: 'Umavendas' }
  ];

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      empresa: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    // Se já estiver autenticado, redirecionar para dashboard
    if (this.authService.isAuthenticated) {
      this.router.navigate(['/dashboard']);
    }

    // Não definir empresa padrão - usuário deve escolher
  }

  onSubmit(): void {
    if (this.loginForm.valid && !this.isLoading) {
      this.isLoading = true;

      const loginData: LoginRequest = {
        email: this.loginForm.value.email,
        senha: this.loginForm.value.password,
        empresa: this.loginForm.value.empresa,
      };

      this.authService.login(loginData).subscribe({
        next: (response) => {
          this.isLoading = false;

          if (response.success) {
            this.snackBar.open('Login realizado com sucesso!', 'Fechar', {
              duration: 3000,
              panelClass: ['success-snackbar'],
            });

            // Aguardar um momento para garantir que o estado foi atualizado
            setTimeout(() => {
              this.router.navigate(['/dashboard']);
            }, 100);
          } else {
            this.snackBar.open(response.message || 'Erro no login', 'Fechar', {
              duration: 5000,
              panelClass: ['error-snackbar'],
            });
          }
        },
        error: (error) => {
          this.isLoading = false;
          console.error('Erro no login:', error);

          this.snackBar.open('Erro interno. Tente novamente.', 'Fechar', {
            duration: 5000,
            panelClass: ['error-snackbar'],
          });
        },
      });
    } else {
      // Marcar todos os campos como tocados para mostrar erros
      Object.keys(this.loginForm.controls).forEach((key) => {
        this.loginForm.get(key)?.markAsTouched();
      });
    }
  }

  getFieldErrorMessage(fieldName: string): string {
    const field = this.loginForm.get(fieldName);

    if (field?.hasError('required')) {
      return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} é obrigatório`;
    }

    if (field?.hasError('email')) {
      return 'Email inválido';
    }

    if (field?.hasError('minlength')) {
      return `${
        fieldName.charAt(0).toUpperCase() + fieldName.slice(1)
      } deve ter pelo menos 6 caracteres`;
    }

    return '';
  }
}
