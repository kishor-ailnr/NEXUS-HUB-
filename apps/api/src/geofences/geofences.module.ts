import { Module } from '@nestjs/common';
import { GeofencesService } from './geofences.service';
import { GeofencesController } from './geofences.controller';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [GeofencesController],
  providers: [GeofencesService],
  exports: [GeofencesService],
})
export class GeofencesModule {}
