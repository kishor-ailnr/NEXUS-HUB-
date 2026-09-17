import { Module } from '@nestjs/common';
import { SimulationService } from './simulation.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { HosModule } from '../hos/hos.module';
import { IntelligenceModule } from '../intelligence/intelligence.module';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [
    SupabaseModule,
    RealtimeModule,
    NotificationsModule,
    HosModule,
    IntelligenceModule,
    ReportsModule,
  ],
  providers: [SimulationService],
  exports: [SimulationService],
})
export class TrackingModule {}
