import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatChipsModule } from '@angular/material/chips';
import { Subscription } from 'rxjs';

import {
  ClientDeletionService,
  ClientDeletionRequest,
  ValidationResult,
  DeletionDetail
} from '../../services/client-deletion.service';

interface TableStats {
  tableName: string;
  recordCount: number;
  description: string;
}

@Component({
  selector: 'app-delete-clients',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatExpansionModule,
    MatTableModule,
    MatCheckboxModule,
    MatSnackBarModule,
    MatDialogModule,
    MatChipsModule
  ],
  templateUrl: './delete-clients.component.html',
  styleUrls: ['./delete-clients.component.scss']
})
export class DeleteClientsComponent implements OnInit, OnDestroy {
  deletionForm: FormGroup;

  // Estados da aplicação
  currentStep = 1;
  isLoading = false;
  isValidating = false;
  isDeleting = false;

  // Dados
  clientIds: number[] = [];
  validationResult: ValidationResult | null = null;
  affectedTablesStats: TableStats[] = [];
  deletionResult: any = null;

  // Upload de arquivo
  selectedFile: File | null = null;

  // Progresso
  progressSubscription: Subscription | null = null;
  deletionProgress = { current: 0, total: 0, status: 'idle' };

  // Colunas das tabelas
  clientColumns = ['select', 'id', 'name', 'email', 'registrationDate'];
  tableStatsColumns = ['tableName', 'recordCount', 'description'];

  constructor(
    private fb: FormBuilder,
    private clientDeletionService: ClientDeletionService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {
    this.deletionForm = this.fb.group({
      inputMethod: ['manual', Validators.required],
      clientIdsText: ['', [this.clientIdsValidator.bind(this)]],
      reason: ['', [Validators.required, Validators.minLength(10)]],
      userEmail: ['', [Validators.required, Validators.email]],
      confirmDeletion: [false, Validators.requiredTrue]
    });
  }

  ngOnInit() {
    // Monitorar progresso da exclusão
    this.progressSubscription = this.clientDeletionService.deletionProgress$.subscribe(
      progress => {
        this.deletionProgress = progress;
      }
    );
  }

  ngOnDestroy() {
    if (this.progressSubscription) {
      this.progressSubscription.unsubscribe();
    }
    this.clientDeletionService.resetProgress();
  }

  /**
   * Validador customizado para IDs de clientes
   */
  clientIdsValidator(control: any) {
    if (!control.value || control.value.trim() === '') {
      return { required: true };
    }

    const ids = this.clientDeletionService.parseClientIdsFromText(control.value);

    if (ids.length === 0) {
      return { invalidFormat: true };
    }

    if (ids.length > 1000) {
      return { tooMany: true };
    }

    return null;
  }

  /**
   * Handle file selection
   */
  onFileSelected(event: any) {
    const file = event.target.files[0];

    if (!file) {
      this.selectedFile = null;
      return;
    }

    if (!this.clientDeletionService.validateExcelFile(file)) {
      this.snackBar.open('❌ Arquivo deve ser Excel (.xls, .xlsx)', 'Fechar', { duration: 5000 });
      this.selectedFile = null;
      return;
    }

    this.selectedFile = file;
    this.deletionForm.patchValue({ inputMethod: 'excel' });

    // Processar arquivo automaticamente
    this.processExcelFile();
  }

  /**
   * Processa arquivo Excel
   */
  async processExcelFile() {
    if (!this.selectedFile) return;

    this.isLoading = true;

    try {
      const ids = await this.clientDeletionService.uploadExcelFile(this.selectedFile);

      if (ids.length === 0) {
        this.snackBar.open('❌ Nenhum ID válido encontrado no arquivo', 'Fechar', { duration: 5000 });
        return;
      }

      this.clientIds = ids;
      this.deletionForm.patchValue({
        clientIdsText: ids.join(', '),
        inputMethod: 'excel'
      });

      this.snackBar.open(`✅ ${ids.length} IDs carregados do Excel`, 'Fechar', { duration: 3000 });

    } catch (error) {
      this.snackBar.open(`❌ Erro ao processar arquivo: ${error}`, 'Fechar', { duration: 5000 });
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Atualiza IDs quando digitados manualmente
   */
  onClientIdsTextChange() {
    const text = this.deletionForm.get('clientIdsText')?.value || '';
    this.clientIds = this.clientDeletionService.parseClientIdsFromText(text);
  }

  /**
   * Avança para validação
   */
  goToValidation() {
    if (this.deletionForm.invalid) {
      this.snackBar.open('❌ Preencha todos os campos obrigatórios', 'Fechar', { duration: 3000 });
      return;
    }

    if (this.clientIds.length === 0) {
      this.snackBar.open('❌ Informe pelo menos um ID de cliente', 'Fechar', { duration: 3000 });
      return;
    }

    this.validateClients();
  }

  /**
   * Valida clientes antes da exclusão
   */
  validateClients() {
    this.isValidating = true;
    this.currentStep = 2;

    this.clientDeletionService.validateClientIds(this.clientIds).subscribe({
      next: (result) => {
        this.validationResult = result;

        if (result.invalidIds.length > 0) {
          this.snackBar.open(
            `⚠️ ${result.invalidIds.length} IDs inválidos encontrados`,
            'Fechar',
            { duration: 5000 }
          );
        }

        // Buscar estatísticas das tabelas afetadas
        if (result.validIds.length > 0) {
          this.loadAffectedTablesStats(result.validIds);
        }

        this.isValidating = false;
      },
      error: (error) => {
        console.error('Erro na validação:', error);
        this.snackBar.open('❌ Erro ao validar clientes', 'Fechar', { duration: 5000 });
        this.isValidating = false;
        this.currentStep = 1;
      }
    });
  }

  /**
   * Carrega estatísticas das tabelas afetadas
   */
  loadAffectedTablesStats(clientIds: number[]) {
    this.clientDeletionService.getAffectedTablesStats(clientIds).subscribe({
      next: (stats) => {
        this.affectedTablesStats = stats.filter(s => s.recordCount > 0);
      },
      error: (error) => {
        console.error('Erro ao carregar estatísticas:', error);
      }
    });
  }

  /**
   * Volta para o passo anterior
   */
  goBack() {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  /**
   * Avança para confirmação
   */
  goToConfirmation() {
    if (!this.validationResult || !this.validationResult.validIds.length) {
      this.snackBar.open('❌ Nenhum cliente válido para exclusão', 'Fechar', { duration: 3000 });
      return;
    }

    this.currentStep = 3;
  }

  /**
   * Executa a exclusão
   */
  executeClients() {
    if (!this.validationResult || !this.validationResult.validIds.length) {
      return;
    }

    if (!this.deletionForm.get('confirmDeletion')?.value) {
      this.snackBar.open('❌ Você deve confirmar a exclusão', 'Fechar', { duration: 3000 });
      return;
    }

    this.isDeleting = true;
    this.currentStep = 4;

    const request: ClientDeletionRequest = {
      clientIds: this.validationResult.validIds,
      reason: this.deletionForm.get('reason')?.value || '',
      userEmail: this.deletionForm.get('userEmail')?.value || ''
    };

    this.clientDeletionService.deleteClients(request).subscribe({
      next: (result) => {
        this.deletionResult = result;
        this.isDeleting = false;

        if (result.success) {
          this.snackBar.open(
            `✅ ${result.deletedCount} clientes excluídos com sucesso!`,
            'Fechar',
            { duration: 5000 }
          );
        } else {
          this.snackBar.open(
            `⚠️ Exclusão concluída com ${result.failedCount} erros`,
            'Fechar',
            { duration: 5000 }
          );
        }
      },
      error: (error) => {
        console.error('Erro na exclusão:', error);
        this.snackBar.open('❌ Erro ao excluir clientes', 'Fechar', { duration: 5000 });
        this.isDeleting = false;
      }
    });
  }

  /**
   * Baixa o log de exclusão
   */
  downloadLog() {
    if (!this.deletionResult?.logFileName) {
      return;
    }

    this.clientDeletionService.downloadDeletionLog(this.deletionResult.logFileName).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = this.deletionResult.logFileName;
        link.click();
        window.URL.revokeObjectURL(url);
      },
      error: (error) => {
        console.error('Erro ao baixar log:', error);
        this.snackBar.open('❌ Erro ao baixar log', 'Fechar', { duration: 3000 });
      }
    });
  }

  /**
   * Reinicia o processo
   */
  resetProcess() {
    this.currentStep = 1;
    this.clientIds = [];
    this.validationResult = null;
    this.affectedTablesStats = [];
    this.deletionResult = null;
    this.selectedFile = null;
    this.isLoading = false;
    this.isValidating = false;
    this.isDeleting = false;

    this.deletionForm.reset({
      inputMethod: 'manual',
      clientIdsText: '',
      reason: '',
      userEmail: '',
      confirmDeletion: false
    });

    this.clientDeletionService.resetProgress();
  }

  /**
   * Utilitários de formatação
   */
  formatNumber(num: number): string {
    return this.clientDeletionService.formatNumber(num);
  }

  formatDate(date: Date): string {
    return this.clientDeletionService.formatDate(date);
  }

  getTotalRecordsToDelete(): number {
    return this.affectedTablesStats.reduce((total, stat) => total + stat.recordCount, 0);
  }

  getProgressPercentage(): number {
    if (this.deletionProgress.total === 0) return 0;
    return (this.deletionProgress.current / this.deletionProgress.total) * 100;
  }

  hasValidClients(): boolean {
    return this.validationResult != null && this.validationResult.validIds.length > 0;
  }

  getValidClientsCount(): number {
    return this.validationResult?.validIds.length || 0;
  }
}