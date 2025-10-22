import { Context, NextFunction, Bot } from 'grammy';
import { ConfigService } from '../services/config.service.js';

export class AccessControlMiddleware {
    private static allowedUserIds: Set<number> | null = null;
    private static adminUserId: number | null = null;
    private static notifiedUsers: Set<number> = new Set();
    private static configService: ConfigService | null = null;

    static setConfigService(config: ConfigService): void {
        AccessControlMiddleware.configService = config;
    }

    private static initializeAllowedUsers(): Set<number> {
        if (AccessControlMiddleware.allowedUserIds === null) {
            if (!AccessControlMiddleware.configService) {
                throw new Error('ConfigService not set in AccessControlMiddleware');
            }

            const allowedIds = AccessControlMiddleware.configService.getAllowedUserIds();
            AccessControlMiddleware.allowedUserIds = new Set(allowedIds);

            // Set the first user as admin
            const firstUser = Array.from(AccessControlMiddleware.allowedUserIds)[0];
            if (firstUser) {
                AccessControlMiddleware.adminUserId = firstUser;
            }

            console.log(`Access Control: ${AccessControlMiddleware.allowedUserIds.size} user(s) allowed`);
        }
        return AccessControlMiddleware.allowedUserIds;
    }

    static async requireAccess(ctx: Context, next: NextFunction): Promise<void> {
        if (!ctx.from) {
            await ctx.reply("Unable to identify user. Please try again.");
            return;
        }

        const userId = ctx.from.id;
        const allowedUsers = AccessControlMiddleware.initializeAllowedUsers();

        if (!allowedUsers.has(userId)) {
            console.log(`Unauthorized access attempt from user ${userId}`);

            // Check if auto-kill is enabled
            if (AccessControlMiddleware.isAutoKillEnabled()) {
                // Send immediate response to unauthorized user
                await ctx.reply(
                    "🚫 Unauthorized access detected.\n\n" +
                    `The Telegram User ID is: ${userId}\n\n` +
                    "The bot worker is now shutting down for security reasons."
                );

                console.log(`AUTO_KILL: Unauthorized access from ${userId}. Shutting down worker...`);

                // Kill this worker process
                setTimeout(() => {
                    process.exit(1);
                }, 1000);
                return;
            }

            // Standard denial (no auto-kill)
            await ctx.reply(
                "🚫 You don't have access to this bot.\n\n" +
                `Your Telegram User ID is: ${userId}\n\n` +
                "Please contact the bot administrator to get access."
            );
            return;
        }

        await next();
    }

    static isAllowed(userId: number): boolean {
        const allowedUsers = AccessControlMiddleware.initializeAllowedUsers();
        return allowedUsers.has(userId);
    }

    static getAllowedUserIds(): number[] {
        const allowedUsers = this.initializeAllowedUsers();
        return Array.from(allowedUsers);
    }

    private static isAutoKillEnabled(): boolean {
        if (!AccessControlMiddleware.configService) {
            return false;
        }
        return AccessControlMiddleware.configService.isAutoKillEnabled();
    }
}
