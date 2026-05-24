import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { AuthGuard } from "@nestjs/passport";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { SKIP_API_KEY } from "../decorators/skip-api-key.decorator";
import { ALLOW_ONBOARDING_KEY } from "../decorators/allow-onboarding.decorator";
import { SESSION_EXPIRED } from "../lib/enums/lib.enum.messages";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(
    private reflector: Reflector,
    private config: ConfigService,
  ) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      const skipApiKey = this.reflector.getAllAndOverride<boolean>(
        SKIP_API_KEY,
        [context.getHandler(), context.getClass()],
      );

      if (!skipApiKey) {
        const request = context.switchToHttp().getRequest();
        const apiKey = request.headers["x-api-key"];
        if (!apiKey || apiKey !== this.config.get<string>("X_API_KEY")) {
          throw new UnauthorizedException("Invalid or missing API key");
        }
      }

      return true;
    }

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (info?.name === "TokenExpiredError") {
      throw new UnauthorizedException(SESSION_EXPIRED);
    }
    if (err || !user) {
      throw err || new UnauthorizedException();
    }

    if (user.tokenType === "onboarding") {
      const allowOnboarding = this.reflector.getAllAndOverride<boolean>(
        ALLOW_ONBOARDING_KEY,
        [context.getHandler(), context.getClass()],
      );
      if (!allowOnboarding) {
        throw new UnauthorizedException("Onboarding token is not valid for this endpoint");
      }
    }

    return user;
  }
}
