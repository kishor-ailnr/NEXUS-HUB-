import { Module } from '@nestjs/common';
import { TripsService } from './trips.service';
import { TripsController } from './trips.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { GeocodingModule } from '../geocoding/geocoding.module';
import { RoutingModule } from '../routing/routing.module';
import { TrackingModule } from '../tracking/tracking.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { IntelligenceModule } from '../intelligence/intelligence.module';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [
    SupabaseModule,
    GeocodingModule,
    RoutingModule,
    TrackingModule,
    RealtimeModule,
    IntelligenceModule,
    ReportsModule,
  ],
  controllers: [TripsController],
  providers: [TripsService],
  exports: [TripsService],
})
export class TripsModule {}
