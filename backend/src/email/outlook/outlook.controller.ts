import { Controller, Post, Get, Delete, Body, UseGuards } from '@nestjs/common';
import { OutlookService } from './outlook.service';
import { SendEmailDto } from '../email.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('email/outlook')
@UseGuards(JwtAuthGuard)
export class OutlookController {
  constructor(private outlookService: OutlookService) {}

  @Post('connect')
  async connect(@CurrentUser() user: { sub: string }, @Body('code') code: string) {
    return this.outlookService.connect(user.sub, code);
  }

  @Post('disconnect')
  async disconnect(@CurrentUser() user: { sub: string }) {
    return this.outlookService.disconnect(user.sub);
  }

  @Get('status')
  async status(@CurrentUser() user: { sub: string }) {
    return this.outlookService.getStatus(user.sub);
  }

  @Post('send')
  async send(@CurrentUser() user: { sub: string }, @Body() dto: SendEmailDto) {
    return this.outlookService.sendEmail(dto, user.sub);
  }
}
