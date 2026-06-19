import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Activates the passport `jwt` strategy; attaches the reviewer to the request. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
