import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';

export interface CampoERP {
  nome: string;
  valor: any;
  tipo: string;
  label?: string; // Label do campo personalizado, se existir
  categoria: 'basico' | 'personalizado' | 'sistema';
}

export interface ModalVisualizarDadosErpData {
  unidadeExemplo: any;
  camposPersonalizados: any[];
}

@Component({
  selector: 'app-modal-visualizar-dados-erp',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatFormFieldModule,
    MatInputModule,
    MatChipsModule,
    MatTooltipModule,
    MatCardModule
  ],
  templateUrl: './modal-visualizar-dados-erp.html',
  styleUrl: './modal-visualizar-dados-erp.scss'
})
export class ModalVisualizarDadosErpComponent implements OnInit {
  camposTodos: CampoERP[] = [];
  camposBasicos: CampoERP[] = [];
  camposPersonalizados: CampoERP[] = [];
  camposSistema: CampoERP[] = [];

  filtro: string = '';
  camposFiltrados: CampoERP[] = [];

  // Campos que são considerados básicos/importantes
  camposBasicosKeys = [
    'codigoUnidade', 'descricaoUnidade', 'codigoObra', 'nomeObra',
    'valorVenda', 'status', 'tipoUnidade', 'areaPrivativa', 'areaTotal',
    'andar', 'ValPreco_unid', 'Identificador_unid'
  ];

  constructor(
    public dialogRef: MatDialogRef<ModalVisualizarDadosErpComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ModalVisualizarDadosErpData
  ) {}

  ngOnInit(): void {
    this.processarCampos();
  }

  processarCampos(): void {
    const unidade = this.data.unidadeExemplo;
    if (!unidade) return;

    // Criar mapa de campos personalizados para lookup rápido
    const camposPersonalizadosMap = new Map<string, string>();
    if (this.data.camposPersonalizados) {
      console.log('Campos Personalizados recebidos:', this.data.camposPersonalizados);
      this.data.camposPersonalizados.forEach((cp: any) => {
        // API retorna 'descricao', mas também aceita 'label' por compatibilidade
        const descricao = cp.descricao || cp.label || cp.campo;
        camposPersonalizadosMap.set(cp.campo, descricao);
        console.log(`Mapeando ${cp.campo} -> ${descricao}`);
      });
    } else {
      console.warn('Nenhum campo personalizado recebido!');
    }

    // Processar todos os campos
    Object.keys(unidade).forEach(key => {
      const valor = unidade[key];

      // Pular campos vazios/null
      if (valor === null || valor === undefined || valor === '') {
        return;
      }

      // Categorizar campo primeiro
      let categoria: 'basico' | 'personalizado' | 'sistema';
      if (this.camposBasicosKeys.includes(key)) {
        categoria = 'basico';
      } else if (key.match(/^c\d+_unid$/)) {
        categoria = 'personalizado';
      } else {
        categoria = 'sistema';
      }

      const campo: CampoERP = {
        nome: key,
        valor: valor,
        tipo: typeof valor,
        label: camposPersonalizadosMap.get(key),
        categoria: categoria
      };

      // Adicionar à categoria apropriada
      if (categoria === 'basico') {
        this.camposBasicos.push(campo);
      } else if (categoria === 'personalizado') {
        this.camposPersonalizados.push(campo);
      } else {
        this.camposSistema.push(campo);
      }

      this.camposTodos.push(campo);
    });

    // Ordenar cada categoria
    this.camposBasicos.sort((a, b) => a.nome.localeCompare(b.nome));
    this.camposPersonalizados.sort((a, b) => {
      // Ordenar por número dentro de c*_unid
      const numA = parseInt(a.nome.match(/\d+/)?.[0] || '0');
      const numB = parseInt(b.nome.match(/\d+/)?.[0] || '0');
      return numA - numB;
    });
    this.camposSistema.sort((a, b) => a.nome.localeCompare(b.nome));

    this.camposFiltrados = this.camposTodos;
  }

  aplicarFiltro(): void {
    const filtroLower = this.filtro.toLowerCase();

    if (!filtroLower) {
      this.camposFiltrados = this.camposTodos;
      return;
    }

    this.camposFiltrados = this.camposTodos.filter(campo =>
      campo.nome.toLowerCase().includes(filtroLower) ||
      campo.label?.toLowerCase().includes(filtroLower) ||
      String(campo.valor).toLowerCase().includes(filtroLower)
    );
  }

  formatarValor(valor: any): string {
    if (valor === null || valor === undefined) {
      return 'null';
    }
    if (typeof valor === 'object') {
      return JSON.stringify(valor);
    }
    if (typeof valor === 'number') {
      // Formatar números grandes como moeda
      if (valor > 1000) {
        return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
    }
    return String(valor);
  }

  copiarNomeCampo(nomeCampo: string): void {
    navigator.clipboard.writeText(nomeCampo).then(() => {
      // Poderia adicionar um toast aqui
    });
  }

  getIconeCategoria(categoria: string): string {
    const icones: { [key: string]: string } = {
      'basico': 'star',
      'personalizado': 'extension',
      'sistema': 'settings'
    };
    return icones[categoria] || 'label';
  }

  getCorCategoria(categoria: string): string {
    const cores: { [key: string]: string } = {
      'basico': '#2196F3',
      'personalizado': '#4CAF50',
      'sistema': '#9E9E9E'
    };
    return cores[categoria] || '#666';
  }

  fechar(): void {
    this.dialogRef.close();
  }
}
