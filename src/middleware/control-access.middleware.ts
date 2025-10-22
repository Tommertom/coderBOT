import { Context, NextFunction } from 'grammy';
import { ConfigService } from '../services/config.service.js';

export class ControlAccessMiddleware {
    private static configService: ConfigService;

    static initialize(configService: ConfigService): void {
        ControlAccessMiddleware.configService = configService;
    }

    static async requireAdminAccess(ctx: Context, next: NextFunction): Promise<void> {
        if (!ctx.from) {
            await ctx.reply('❌ Unable to identify user.');
            return;
        }

        const userId = ctx.from.id;
        const adminIds = ControlAccessMiddleware.configService.getControlBotAdminIds();

        if (!adminIds.includes(userId)) {
            console.warn(`Unauthorized control bot access attempt by user ${userId}`);
            await ctx.reply(
                '❌ *Access Denied*\n\n' +
                'You are not authorized to use this control bot.\n\n' +
                `Your User ID: \`${userId}\``,
                { parse_mode: 'Markdown' }
            );
            return;
        }

        await next();
    }
}
