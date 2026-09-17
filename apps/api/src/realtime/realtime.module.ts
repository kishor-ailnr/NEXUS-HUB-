import { Module, Global } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { SupabaseModule } from '../supabase/supabase.module';

@Global()
@Module({
  imports: [SupabaseModule],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
