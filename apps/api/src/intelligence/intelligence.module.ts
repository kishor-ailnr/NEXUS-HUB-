import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { CarbonService } from './carbon.service';
import { TollService } from './toll.service';
import { DriverScoringService } from './driver-scoring.service';
import { EtaService } from './eta.service';

@Module({
  imports: [SupabaseModule],
  providers: [CarbonService, TollService, DriverScoringService, EtaService],
  exports: [CarbonService, TollService, DriverScoringService, EtaService],
})
export class IntelligenceModule {}
