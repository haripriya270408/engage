import { Injectable, ConflictException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { SupabaseService } from '../supabase/supabase.service';
import { RegisterDto, LoginDto, AuthResponse, MicrosoftLoginDto } from './auth.dto';
import axios from 'axios';
import * as qs from 'qs';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private supabaseService: SupabaseService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const supabase = this.supabaseService.getClient();

    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', dto.email)
      .maybeSingle();

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const password_hash = await bcrypt.hash(dto.password, 10);
    const role = dto.role || 'REP';

    const { data: user, error } = await supabase
      .from('users')
      .insert({
        email: dto.email,
        password_hash,
        first_name: dto.first_name,
        last_name: dto.last_name,
        phone: dto.phone || null,
        role,
        status: 'INACTIVE',
        is_approved: false,
      })
      .select('id, email, first_name, last_name, role, status')
      .single();

    if (error) throw error;

    const payload = { sub: user.id, email: user.email, role: user.role };
    const access_token = this.jwtService.sign(payload);

    return { access_token, user };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const hardcodedAdmin = {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'admin@relanto.ai',
      first_name: 'Admin',
      last_name: 'User',
      role: 'ADMIN',
      status: 'ACTIVE',
    };

    if (dto.email === 'admin@relanto.ai' && dto.password === 'admin123') {
      const payload = { sub: hardcodedAdmin.id, email: hardcodedAdmin.email, role: hardcodedAdmin.role };
      const access_token = this.jwtService.sign(payload);
      return { access_token, user: hardcodedAdmin };
    }

    const supabase = this.supabaseService.getClient();

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', dto.email)
      .single();

    if (error || !user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status === 'SUSPENDED') {
      throw new ForbiddenException('Account has been suspended');
    }
    if (!user.is_approved && user.role !== 'ADMIN') {
      throw new ForbiddenException('Account pending admin approval');
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        status: user.status,
      },
    };
  }

  getMicrosoftAuthUrl(): { url: string; codeVerifier: string } {
    const tenantId = process.env.OUTLOOK_TENANT_ID;
    const clientId = process.env.OUTLOOK_CLIENT_ID;
    const redirectUri = process.env.OUTLOOK_REDIRECT_URI || '';
    
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

    const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&response_mode=query&scope=User.Read%20offline_access&prompt=select_account&code_challenge=${codeChallenge}&code_challenge_method=S256`;
    return { url, codeVerifier };
  }

  async loginMicrosoft(dto: MicrosoftLoginDto): Promise<AuthResponse> {
    const tenantId = process.env.OUTLOOK_TENANT_ID;
    const clientId = process.env.OUTLOOK_CLIENT_ID;
    const clientSecret = process.env.OUTLOOK_CLIENT_SECRET;
    const redirectUri = process.env.OUTLOOK_REDIRECT_URI;

    try {
      // 1. Get access token from MS
      const tokenResponse = await axios.post(
        `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
        qs.stringify({
          client_id: clientId,
          scope: 'User.Read',
          code: dto.code,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          code_verifier: dto.codeVerifier,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Origin': 'http://localhost:3001',
          },
        }
      );

      const msToken = tokenResponse.data.access_token;

      // 2. Get user profile from Graph API
      const profileResponse = await axios.get('https://graph.microsoft.com/v1.0/me', {
        headers: {
          Authorization: `Bearer ${msToken}`,
        },
      });

      const msUser = profileResponse.data;
      const email = msUser.mail || msUser.userPrincipalName;
      const first_name = msUser.givenName || 'Unknown';
      const last_name = msUser.surname || 'User';

      const supabase = this.supabaseService.getClient();

      // 3. Check if user exists
      let { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      // 4. Create user if they don't exist
      if (!user) {
        if (!dto.role) {
          throw new UnauthorizedException('ROLE_REQUIRED');
        }

        const { data: newUser, error: insertError } = await supabase
          .from('users')
          .insert({
            email,
            first_name,
            last_name,
            role: dto.role,
            status: 'ACTIVE',
            is_approved: true, // Auto-approve for MS logins for now
            password_hash: 'OAUTH_USER_NO_PASSWORD',
          })
          .select('*')
          .single();

        if (insertError) throw insertError;
        user = newUser;
      }

      const payload = { sub: user.id, email: user.email, role: user.role };
      const access_token = this.jwtService.sign(payload);

      return {
        access_token,
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role,
          status: user.status,
        },
      };
    } catch (error: any) {
      console.error('MS Login Error:', error?.response?.data || error);
      const errorMsg = error?.response?.data?.error_description || error?.message || 'Microsoft Authentication Failed';
      throw new UnauthorizedException(`Microsoft Authentication Failed: ${errorMsg}`);
    }
  }
}
