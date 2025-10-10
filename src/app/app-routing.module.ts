import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { ImportClientsComponent } from './features/client-management/pages/import-clients/import-clients.component';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadChildren: () => import('./features/auth/auth.module').then(m => m.AuthModule)
  },
  {
    path: 'dashboard',
    loadChildren: () => import('./features/dashboard/dashboard.module').then(m => m.DashboardModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'erp',
    loadChildren: () => import('./features/erp/erp.module').then(m => m.ErpModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'import-clients-test',
    component: ImportClientsComponent,
    title: 'Importar Clientes - Teste',
    canActivate: [AuthGuard]
  },
  {
    path: 'clients',
    loadChildren: () => import('./features/client-management/client-management-module').then(m => m.ClientManagementModule),
    canActivate: [AuthGuard]
  },
  {
    path: '**',
    redirectTo: '/dashboard'
  }
];