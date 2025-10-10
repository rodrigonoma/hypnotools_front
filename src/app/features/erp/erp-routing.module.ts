import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ImportarProdutosComponent } from './components/importar-produtos/importar-produtos.component';

const routes: Routes = [
  {
    path: 'importar-produtos',
    component: ImportarProdutosComponent
  },
  {
    path: '',
    redirectTo: 'importar-produtos',
    pathMatch: 'full'
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ErpRoutingModule { }