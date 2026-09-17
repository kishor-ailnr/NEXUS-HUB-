import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [SupabaseModule, ReportsModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
