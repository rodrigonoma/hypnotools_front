import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ImportClientsComponent } from './pages/import-clients/import-clients.component';
import { DeleteClientsComponent } from './pages/delete-clients/delete-clients.component';

const routes: Routes = [
  {
    path: 'import',
    component: ImportClientsComponent,
    title: 'Importar Clientes'
  },
  {
    path: 'delete',
    component: DeleteClientsComponent,
    title: 'Excluir Clientes'
  },
  {
    path: '',
    redirectTo: 'import',
    pathMatch: 'full'
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ClientManagementRoutingModule { }
