import { Controller, Get, Delete, Query, Res, UseGuards } from '@nestjs/common';
import { SalesforceService } from './salesforce.service';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('salesforce')
export class SalesforceController {
  constructor(
    private readonly salesforceService: SalesforceService,
    private readonly configService: ConfigService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('auth-url')
  getAuthUrl(@CurrentUser() user: { sub: string }) {
    const userId = user.sub;
    const url = this.salesforceService.getAuthorizationUrl(userId);
    return { url };
  }

  @UseGuards(JwtAuthGuard)
  @Get('status')
  async getStatus(@CurrentUser() user: { sub: string }) {
    const userId = user.sub;
    const status = await this.salesforceService.checkConnectionStatus(userId);
    return status;
  }

  @UseGuards(JwtAuthGuard)
  @Delete('disconnect')
  async disconnect(@CurrentUser() user: { sub: string }) {
    const userId = user.sub;
    await this.salesforceService.disconnect(userId);
    return { success: true };
  }

  // Salesforce will redirect here. It's a public endpoint so it can receive the redirect.
  // The state parameter contains the userId.
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') sfError: string,
    @Query('error_description') sfErrorDesc: string,
    @Res() res: Response,
  ) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3001';

    // Salesforce sends `error` + `error_description` when the user denies or an OAuth error occurs
    if (sfError) {
      const msg = sfErrorDesc || sfError;
      console.error(`Salesforce OAuth error from Salesforce: ${sfError} — ${sfErrorDesc}`);
      return res.redirect(`${frontendUrl}/profile?salesforce=error&message=${encodeURIComponent(msg)}`);
    }

    try {
      if (!code || !state) {
        throw new Error('OAuth flow was cancelled or returned without a valid authorization code. Please try again.');
      }

      const userId = state;
      await this.salesforceService.handleCallback(code, userId);

      return res.redirect(`${frontendUrl}/profile?salesforce=success`);
    } catch (error) {
      console.error('Salesforce OAuth Callback Error:', error);
      return res.redirect(`${frontendUrl}/profile?salesforce=error&message=${encodeURIComponent(error.message)}`);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('opportunities')
  async getOpportunities(@CurrentUser() user: { sub: string }) {
    const userId = user.sub;
    const opportunities = await this.salesforceService.getOpportunities(userId);
    return { opportunities };
  }
}
