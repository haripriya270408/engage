import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class AiAssistantService {
  private openai: OpenAI;

  constructor(private configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  async composeEmail(prompt: string, tone?: string, context?: string) {
    const systemPrompt = `You are a professional sales email assistant. Compose clear, effective emails.
${tone ? `Use a ${tone} tone.` : 'Use a professional tone.'}
${context ? `Context: ${context}` : ''}
Format the email with subject line (prefixed with "Subject:") and body.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content || '';
      const subjectMatch = content.match(/Subject:\s*(.+)/i);
      const subject = subjectMatch ? subjectMatch[1].trim() : 'No subject';
      const body = content.replace(/Subject:\s*.+/i, '').trim();

      return { subject, body };
    } catch (error: any) {
      throw new BadRequestException(`OpenAI Error: ${error.message}`);
    }
  }

  async replyToEmail(originalEmail: string, prompt: string, tone?: string) {
    const systemPrompt = `You are a professional sales email assistant. Compose a reply to the email below.
${tone ? `Use a ${tone} tone.` : 'Use a professional tone.'}
Original email:
${originalEmail}

Format the reply with "Subject:" line and body.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content || '';
    const subjectMatch = content.match(/Subject:\s*(.+)/i);
    const subject = subjectMatch ? subjectMatch[1].trim() : 'Re: No subject';
    const body = content.replace(/Subject:\s*.+/i, '').trim();

    return { subject, body };
  }

  async suggestTaskDescription(taskTitle: string, taskType: string) {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a sales operations assistant. Generate a helpful task description and suggested next steps.',
        },
        {
          role: 'user',
          content: `Generate a brief description and action steps for a ${taskType} task titled: "${taskTitle}"`,
        },
      ],
      max_tokens: 300,
    });

    return response.choices[0]?.message?.content || '';
  }
}
