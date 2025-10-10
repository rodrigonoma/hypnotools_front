import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';

import { ClientManagementRoutingModule } from './client-management-routing-module';
import { ImportClientsComponent } from './pages/import-clients/import-clients.component';
import { DeleteClientsComponent } from './pages/delete-clients/delete-clients.component';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    HttpClientModule,
    ClientManagementRoutingModule,
    ImportClientsComponent,
    DeleteClientsComponent
  ]
})
export class ClientManagementModule { }
