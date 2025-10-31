import { Bot, InputFile, InlineKeyboard } from 'grammy';
import { XtermService } from '../features/xterm/xterm.service.js';
import { XtermRendererService } from '../features/xterm/xterm-renderer.service.js';
import { ConfigService } from '../services/config.service.js';

export class ScreenRefreshUtils {
    /**
     * Create a standard inline keyboard for screen display.
     * Layout: Refresh button on top, then number buttons.
     */
    static createScreenKeyboard(): InlineKeyboard {
        return new InlineKeyboard()
            .text('🔄 Refresh', 'refresh_screen')
            .row()
            .text('1', 'num_1')
            .text('2', 'num_2')
            .text('3', 'num_3');
    }
    /**
     * Start automatic screen refreshes for a user session.
     * Refreshes the last shown screen at configured intervals for a configured number of times.
     * If already running, does not start a new parallel process.
     */
    static startAutoRefresh(
        userId: string,
        chatId: number,
        bot: Bot,
        xtermService: XtermService,
        xtermRendererService: XtermRendererService,
        configService: ConfigService
    ): void {
        const REFRESH_INTERVAL_MS = configService.getScreenRefreshInterval();
        const MAX_REFRESH_COUNT = configService.getScreenRefreshMaxCount();
        // Check if refresh is already running
        if (xtermService.getRefreshInterval(userId)) {
            return;
        }

        // Check if there's a last screenshot to refresh
        const lastMessageId = xtermService.getLastScreenshotMessageId(userId);
        if (!lastMessageId) {
            return;
        }

        // Check if session exists
        if (!xtermService.hasSession(userId)) {
            return;
        }

        let refreshCount = 0;
        let lastBufferHash: string | null = null;

        const performRefresh = async () => {
            refreshCount++;

            try {
                // Check if session still exists
                if (!xtermService.hasSession(userId)) {
                    xtermService.clearRefreshInterval(userId);
                    return;
                }

                const currentLastMessageId = xtermService.getLastScreenshotMessageId(userId);

                // If the last message ID changed, someone else triggered a new screen
                // Stop the auto-refresh as it's no longer relevant
                if (!currentLastMessageId || currentLastMessageId !== lastMessageId) {
                    xtermService.clearRefreshInterval(userId);
                    return;
                }

                // Get current buffer and create a hash to detect changes
                const outputBuffer = xtermService.getSessionOutputBuffer(userId);
                const currentBufferHash = outputBuffer.join('');

                // Skip update if buffer hasn't changed
                if (lastBufferHash !== null && currentBufferHash === lastBufferHash) {
                    // Still count this as a refresh attempt
                    if (refreshCount >= MAX_REFRESH_COUNT) {
                        xtermService.clearRefreshInterval(userId);
                    }
                    return;
                }

                // Update hash for next comparison
                lastBufferHash = currentBufferHash;

                // Render and update the screenshot
                const dimensions = xtermService.getSessionDimensions(userId);

                const imageBuffer = await xtermRendererService.renderToImage(
                    outputBuffer,
                    dimensions.rows,
                    dimensions.cols
                );

                const keyboard = ScreenRefreshUtils.createScreenKeyboard();

                await bot.api.editMessageMedia(chatId, lastMessageId, {
                    type: 'photo',
                    media: new InputFile(imageBuffer),
                }, {
                    reply_markup: keyboard,
                });

                // Update the session's buffer hash to keep it in sync
                xtermService.setLastScreenshotBufferHash(userId, currentBufferHash);

            } catch (error) {
                console.error(`Failed to auto-refresh screen for user ${userId}:`, error);
            }

            // Stop after MAX_REFRESH_COUNT refreshes
            if (refreshCount >= MAX_REFRESH_COUNT) {
                xtermService.clearRefreshInterval(userId);
            }
        };

        // Perform immediate first refresh
        performRefresh();

        // Set up interval for subsequent refreshes
        const interval = setInterval(performRefresh, REFRESH_INTERVAL_MS);

        // Store the interval in the session
        xtermService.setRefreshInterval(userId, interval);
    }

    /**
     * Stop automatic screen refreshes for a user session.
     */
    static stopAutoRefresh(userId: string, xtermService: XtermService): void {
        xtermService.clearRefreshInterval(userId);

    }
}
