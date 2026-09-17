import { Module } from '@nestjs/common';
import { ConvoysService } from './convoys.service';
import { ConvoysController } from './convoys.controller';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [ConvoysController],
  providers: [ConvoysService],
  exports: [ConvoysService],
})
export class ConvoysModule {}
