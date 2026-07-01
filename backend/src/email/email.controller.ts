import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AiAssistantService } from './ai/ai-assistant.service';
import { AiComposeDto } from './email.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('email')
@UseGuards(JwtAuthGuard)
export class EmailController {
  constructor(private aiService: AiAssistantService) {}

  @Post('ai/compose')
  async aiCompose(@Body() dto: AiComposeDto) {
    return this.aiService.composeEmail(dto.prompt, dto.tone, dto.context);
  }

  @Post('ai/suggest-task')
  async suggestTask(@Body('title') title: string, @Body('type') type: string) {
    return this.aiService.suggestTaskDescription(title, type);
  }
}
