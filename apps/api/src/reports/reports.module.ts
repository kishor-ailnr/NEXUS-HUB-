import { Module } from '@nestjs/common';
import { PdfReportService } from './pdf-report.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { IntelligenceModule } from '../intelligence/intelligence.module';

@Module({
  imports: [SupabaseModule, NotificationsModule, IntelligenceModule],
  providers: [PdfReportService],
  exports: [PdfReportService],
})
export class ReportsModule {}
