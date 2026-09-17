import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { TripsModule } from '../trips/trips.module';
import { RailwaysModule } from '../railways/railways.module';
import { AirwaysModule } from '../airways/airways.module';
import { SeawaysModule } from '../seaways/seaways.module';

@Module({
  imports: [
    SupabaseModule,
    DashboardModule,
    TripsModule,
    RailwaysModule,
    AirwaysModule,
    SeawaysModule,
  ],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
