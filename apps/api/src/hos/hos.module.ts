import { Module } from '@nestjs/common';
import { HosService } from './hos.service';
import { HosController } from './hos.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [SupabaseModule, NotificationsModule],
  controllers: [HosController],
  providers: [HosService],
  exports: [HosService],
})
export class HosModule {}
