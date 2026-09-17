import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AiChatRequest, AiConfirmActionRequest, AiChatMessage } from '@nexus-ways/shared';

@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  async chat(
    @CurrentUser() user: any,
    @Body() req: AiChatRequest,
  ): Promise<AiChatMessage> {
    return this.aiService.processChat(user.orgId, req);
  }

  @Post('action/confirm')
  async confirmAction(
    @CurrentUser() user: any,
    @Body() req: AiConfirmActionRequest,
  ): Promise<{ success: boolean; message: string }> {
    return this.aiService.confirmAction(user.orgId, req);
  }
}
