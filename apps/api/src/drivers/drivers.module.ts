import { Module } from '@nestjs/common';
import { DriversService } from './drivers.service';
import { DriversController } from './drivers.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { IntelligenceModule } from '../intelligence/intelligence.module';

@Module({
  imports: [SupabaseModule, IntelligenceModule],
  controllers: [DriversController],
  providers: [DriversService],
  exports: [DriversService],
})
export class DriversModule {}
