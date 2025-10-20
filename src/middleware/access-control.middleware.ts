import { Context, NextFunction, Bot } from 'grammy';

export class AccessControlMiddleware {
    private static allowedUserIds: Set<number> | null = null;
    private static adminUserId: number | null = null;
    private static bots: Bot[] = [];
    private static notifiedUsers: Set<number> = new Set();

    static setBotInstances(bots: Bot[]): void {
        AccessControlMiddleware.bots = bots;
    }

    private static initializeAllowedUsers(): Set<number> {
        if (AccessControlMiddleware.allowedUserIds === null) {
            const allowedIds = process.env.ALLOWED_USER_IDS || '';
            AccessControlMiddleware.allowedUserIds = new Set(
                allowedIds
                    .split(',')
                    .map(id => id.trim())
                    .filter(id => id.length > 0)
                    .map(id => parseInt(id, 10))
                    .filter(id => !isNaN(id))
            );

            // Set the first user as admin
            const firstUser = Array.from(AccessControlMiddleware.allowedUserIds)[0];
            if (firstUser) {
                AccessControlMiddleware.adminUserId = firstUser;
            }

            console.log(`Access Control: ${AccessControlMiddleware.allowedUserIds.size} user(s) allowed`);
        }
        return AccessControlMiddleware.allowedUserIds;
    }

    private static async notifyAdmin(userId: number, username: string | undefined, firstName: string | undefined, lastName: string | undefined): Promise<void> {
        if (AccessControlMiddleware.bots.length === 0 || !AccessControlMiddleware.adminUserId) {
            return;
        }

        // Only notify once per user
        if (AccessControlMiddleware.notifiedUsers.has(userId)) {
            return;
        }

        try {
            const userInfo = username ? `@${username}` : `${firstName || ''} ${lastName || ''}`.trim();
            const message = `🚨 *Unauthorized Access Attempt*\n\n` +
                `User: ${userInfo}\n` +
                `User ID: \`${userId}\`\n\n` +
                `This user tried to access the bot but was denied.\n\n` +
                `Use /killbot to shutdown the bot if needed.`;

            // Try to send via all bots (one will succeed if admin has access to it)
            const sendPromises = AccessControlMiddleware.bots.map(async (bot) => {
                try {
                    await bot.api.sendMessage(
                        AccessControlMiddleware.adminUserId!,
                        message,
                        { parse_mode: 'Markdown' }
                    );
                } catch (error) {
                    // Silently fail - this bot instance might not have access to the admin
                }
            });

            await Promise.allSettled(sendPromises);
            AccessControlMiddleware.notifiedUsers.add(userId);
        } catch (error) {
            console.error('Failed to notify admin:', error);
        }
    }

    static async requireAccess(ctx: Context, next: NextFunction): Promise<void> {
        if (!ctx.from) {
            await ctx.reply("Unable to identify user. Please try again.");
            return;
        }

        const userId = ctx.from.id;
        const allowedUsers = AccessControlMiddleware.initializeAllowedUsers();

        if (!allowedUsers.has(userId)) {
            // Check if auto-kill is enabled
            if (AccessControlMiddleware.isAutoKillEnabled()) {
                // Send immediate response to unauthorized user
                await ctx.reply(
                    "🚫 Unauthorized access detected.\n\n" +
                    `The Telegram User ID is: ${userId}\n\n` +
                    "The bot is now shutting down for security reasons."
                );

                // Notify all allowed users and kill the bot
                await AccessControlMiddleware.notifyAllUsersAndKill(
                    userId,
                    ctx.from.username,
                    ctx.from.first_name,
                    ctx.from.last_name
                );
                return;
            }

            // Notify admin (original behavior when auto-kill is disabled)
            await AccessControlMiddleware.notifyAdmin(
                userId,
                ctx.from.username,
                ctx.from.first_name,
                ctx.from.last_name
            );

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

    private static async notifyAllUsersAndKill(unauthorizedUserId: number, username: string | undefined, firstName: string | undefined, lastName: string | undefined): Promise<void> {
        if (AccessControlMiddleware.bots.length === 0) {
            return;
        }

        const allowedUsers = AccessControlMiddleware.getAllowedUserIds();
        const userInfo = username ? `@${username}` : `${firstName || ''} ${lastName || ''}`.trim();

        const killMessage =
            `🛑 *AUTO-KILL TRIGGERED*\n\n` +
            `The bot is shutting down due to an unauthorized access attempt.\n\n` +
            `Unauthorized User: ${userInfo}\n` +
            `User ID: \`${unauthorizedUserId}\`\n\n` +
            `The bot will now terminate.`;

        // Notify all allowed users via all bot instances
        const notificationPromises = allowedUsers.flatMap((userId) =>
            AccessControlMiddleware.bots.map(async (bot) => {
                try {
                    await bot.api.sendMessage(
                        userId,
                        killMessage,
                        { parse_mode: 'Markdown' }
                    );
                } catch (error) {
                    // Silently fail - user might not have access to this bot instance
                }
            })
        );

        // Wait for all notifications to be sent
        await Promise.allSettled(notificationPromises);

        console.log('AUTO_KILL: All users notified. Shutting down bot...');

        // Give a brief moment for messages to be sent, then kill the process
        setTimeout(() => {
            process.exit(1);
        }, 1000);
    }

    private static isAutoKillEnabled(): boolean {
        const autoKill = process.env.AUTO_KILL?.toLowerCase();
        return autoKill === 'true' || autoKill === '1';
    }
}
