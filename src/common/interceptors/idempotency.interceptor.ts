import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Observable, of, tap } from 'rxjs';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string> }>();
    const key = req.headers['idempotency-key'];

    if (!key) throw new BadRequestException('Idempotency-Key header is required');

    const cached = await this.redis.get(`idem:${key}`);
    if (cached) return of(JSON.parse(cached));

    return next.handle().pipe(
      tap(async (response) => {
        await this.redis.setex(`idem:${key}`, 86400, JSON.stringify(response));
      }),
    );
  }
}
