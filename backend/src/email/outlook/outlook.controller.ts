import { Controller, Post, Get, Delete, Body, Query, Res, UseGuards } from '@nestjs/common';
import { OutlookService } from './outlook.service';
import { SendEmailDto } from '../email.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('email/outlook')
export class OutlookController {
  constructor(private outlookService: OutlookService) {}

  @Get('auth-url')
  @UseGuards(JwtAuthGuard)
  async getAuthUrl(@CurrentUser() user: { sub: string }) {
    const url = this.outlookService.getAuthUrl(user.sub);
    return { url };
  }

  @Post('connect')
  @UseGuards(JwtAuthGuard)
  async connect(@CurrentUser() user: { sub: string }, @Body('code') code: string) {
    return this.outlookService.connect(user.sub, code);
  }

  @Get('callback')
  async callback(@Query('code') code: string, @Query('state') state: string, @Res() res: any) {
    if (!code) {
      return res.redirect('http://localhost:3001/email?outlook=error');
    }
    try {
      await this.outlookService.connect(state, code);
      return res.redirect('http://localhost:3001/email?outlook=connected');
    } catch {
      return res.redirect('http://localhost:3001/email?outlook=error');
    }
  }

  @Post('disconnect')
  @UseGuards(JwtAuthGuard)
  async disconnect(@CurrentUser() user: { sub: string }) {
    return this.outlookService.disconnect(user.sub);
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  async status(@CurrentUser() user: { sub: string }) {
    return this.outlookService.getStatus(user.sub);
  }

  @Post('send')
  @UseGuards(JwtAuthGuard)
  async send(@CurrentUser() user: { sub: string }, @Body() dto: SendEmailDto) {
    return this.outlookService.sendEmail(dto, user.sub);
  }
}
