import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { DashboardRoutingModule } from './dashboard-routing-module';
import { DashboardHome } from './pages/dashboard-home/dashboard-home';
import { ImportTestComponent } from './pages/import-test/import-test.component';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    DashboardRoutingModule,
    DashboardHome,
    ImportTestComponent
  ]
})
export class DashboardModule { }
