import { AiChatMessage, AiChatRequest, AiConfirmActionRequest } from '@nexus-ways/shared';
import { apiFetch } from '../lib/api';

export const aiService = {
  async chat(req: AiChatRequest): Promise<AiChatMessage> {
    return apiFetch<AiChatMessage>('/ai/chat', {
      method: 'POST',
      data: req,
    });
  },

  async confirmAction(req: AiConfirmActionRequest): Promise<{ success: boolean; message: string }> {
    return apiFetch<{ success: boolean; message: string }>('/ai/action/confirm', {
      method: 'POST',
      data: req,
    });
  },
};

export const aiApi = aiService;
