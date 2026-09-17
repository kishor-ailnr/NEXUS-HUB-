import { Module } from '@nestjs/common';
import { RoutingService } from './routing.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  providers: [RoutingService],
  exports: [RoutingService],
})
export class RoutingModule {}
