import { ArgumentsHost, BadRequestException, CanActivate, Catch, ExceptionFilter, ExecutionContext, HttpException, Injectable, OnModuleDestroy, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { timingSafeEqual } from 'node:crypto';
import { z, ZodTypeAny } from 'zod';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); }
}

export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.output<S> {
  const r = schema.safeParse(data);
  if (!r.success) throw new BadRequestException({ code: 'VALIDATION_ERROR', issues: r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
  return r.data;
}

/** Uniform error body: { error: { code, message, details? } } */
@Catch()
export class ErrorFilter implements ExceptionFilter {
  catch(e: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    if (e instanceof HttpException) {
      const body = e.getResponse() as any;
      return res.status(e.getStatus()).json({ error: { code: body?.code ?? e.name, message: typeof body === 'string' ? body : body?.message ?? e.message, details: body?.issues } });
    }
    console.error('unhandled', e instanceof Error ? e.message : e);
    return res.status(500).json({ error: { code: 'INTERNAL', message: 'خطای داخلی سرور' } });
  }
}

/**
 * TEMPORARY admin auth: static bearer token from ADMIN_API_TOKEN (fails closed if unset).
 * Must be replaced by the Identity module (users, roles, sessions) before any public deployment.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    const expected = process.env.ADMIN_API_TOKEN;
    const header: string = ctx.switchToHttp().getRequest().headers['authorization'] ?? '';
    const given = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!expected || expected.length < 24) throw new UnauthorizedException({ code: 'ADMIN_DISABLED', message: 'ADMIN_API_TOKEN تنظیم نشده یا کوتاه است' });
    const a = Buffer.from(given), b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'دسترسی غیرمجاز' });
    return true;
  }
}
