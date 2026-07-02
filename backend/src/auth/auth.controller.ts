import { Controller, Post, Get, Body, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, MicrosoftLoginDto } from './auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('microsoft')
  @HttpCode(HttpStatus.OK)
  async loginMicrosoft(@Body() dto: MicrosoftLoginDto) {
    return this.authService.loginMicrosoft(dto);
  }

  @Get('microsoft/url')
  getMicrosoftAuthUrl() {
    return { url: this.authService.getMicrosoftAuthUrl() };
  }
}
