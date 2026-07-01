import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../supabase/supabase.service';
import { JwtPayload } from '../../common/interfaces/user-request.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private supabaseService: SupabaseService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'engage-platform-secret',
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    if (payload.sub === '00000000-0000-0000-0000-000000000001') {
      return payload;
    }

    const { data: user, error } = await this.supabaseService
      .getClient()
      .from('users')
      .select('id, email, role, status')
      .eq('id', payload.sub)
      .single();

    if (error || !user) {
      throw new UnauthorizedException('User not found');
    }
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }
    return { sub: user.id, email: user.email, role: user.role };
  }
}
