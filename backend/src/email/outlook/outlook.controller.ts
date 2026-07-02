import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { OutlookService } from './outlook.service';
import { SendEmailDto } from '../email.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('email/outlook')
export class OutlookController {
  constructor(private outlookService: OutlookService) {}

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
