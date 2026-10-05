import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: number;
  email: string;
  role: 'Administrateur' | 'Responsable' | 'Technicien';
  id_boutique: number | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET')
    });
  }

  // La valeur retournée est attachée à `request.user`, avec exactement la forme de
  // JwtPayload (sub = id_employe) — c'est ce type que consomment les autres modules.
  validate(payload: JwtPayload): JwtPayload {
    return payload;
  }
}
