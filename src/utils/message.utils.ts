import { Context } from 'grammy';
import { ConfigService } from '../services/config.service.js';

/**
 * Utility class for message-related operations
 */
export class MessageUtils {
    /**
     * Schedules a message for automatic deletion after the configured timeout
     * @param ctx - The context object containing bot API
     * @param messageId - The ID of the message to delete
     * @param configService - The config service to get timeout settings
     * @param timeoutMultiplier - Optional multiplier for the timeout (default: 1)
     */
    static async scheduleMessageDeletion(
        ctx: Context,
        messageId: number,
        configService: ConfigService,
        timeoutMultiplier: number = 1
    ): Promise<void> {
        const deleteTimeout = configService.getMessageDeleteTimeout();

        if (deleteTimeout <= 0) {
            return;
        }

        setTimeout(async () => {
            try {
                await ctx.api.deleteMessage(ctx.chat!.id, messageId);
            } catch (error) {
                console.error('Failed to delete message:', error);
            }
        }, deleteTimeout * timeoutMultiplier);
    }
}
