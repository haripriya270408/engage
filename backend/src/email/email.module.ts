import { Module } from '@nestjs/common';
import { TemplatesService } from './email-templates/templates.service';
import { TemplatesController } from './email-templates/templates.controller';
import { OutlookService } from './outlook/outlook.service';
import { OutlookController } from './outlook/outlook.controller';
import { AiAssistantService } from './ai/ai-assistant.service';
import { EmailController } from './email.controller';

@Module({
  controllers: [TemplatesController, OutlookController, EmailController],
  providers: [TemplatesService, OutlookService, AiAssistantService],
  exports: [TemplatesService, OutlookService, AiAssistantService],
})
export class EmailModule {}
