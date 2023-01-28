import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class ManagerGuard implements CanActivate {
    constructor(private readonly config: ConfigService) {}

    canActivate(context: ExecutionContext): boolean {
        const req = context.switchToHttp().getRequest<Request>();
        const token = req.headers['authorization'];
        const correctToken =
            'Bearer ' + this.config.get('MANAGER_ACCESS_TOKEN');
        return token == correctToken;
    }
}
