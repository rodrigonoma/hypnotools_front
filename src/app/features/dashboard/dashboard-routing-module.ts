import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardHome } from './pages/dashboard-home/dashboard-home';
import { ImportTestComponent } from './pages/import-test/import-test.component';

const routes: Routes = [
  {
    path: '',
    component: DashboardHome,
    title: 'Dashboard'
  },
  {
    path: 'import-clients',
    component: ImportTestComponent,
    title: 'Importar Clientes - Teste'
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class DashboardRoutingModule { }
