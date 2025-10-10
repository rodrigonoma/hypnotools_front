import { Routes } from '@angular/router';
import { ImportClientsComponent } from './features/client-management/pages/import-clients/import-clients.component';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full'
  },
  {
    path: 'dashboard',
    loadChildren: () => import('./features/dashboard/dashboard-module').then(m => m.DashboardModule)
  },
  {
    path: 'import-clients-test',
    component: ImportClientsComponent,
    title: 'Importar Clientes - Teste'
  },
  {
    path: 'clients',
    loadChildren: () => import('./features/client-management/client-management-module').then(m => m.ClientManagementModule)
  },
  {
    path: 'tools',
    loadChildren: () => import('./features/tools/tools-module').then(m => m.ToolsModule)
  },
  {
    path: '**',
    redirectTo: '/dashboard'
  }
];