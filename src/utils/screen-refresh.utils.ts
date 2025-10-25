import { Bot, InputFile, InlineKeyboard } from 'grammy';
import { XtermService } from '../features/xterm/xterm.service.js';
import { XtermRendererService } from '../features/xterm/xterm-renderer.service.js';
import { ConfigService } from '../services/config.service.js';

export class ScreenRefreshUtils {
    /**
     * Create a standard inline keyboard for screen display.
     * Layout: Refresh button on top, then number buttons below.
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
            console.log(`Auto-refresh already running for user ${userId}, skipping new process`);
            return;
        }

        // Check if there's a last screenshot to refresh
        const lastMessageId = xtermService.getLastScreenshotMessageId(userId);
        if (!lastMessageId) {
            console.log(`No last screenshot found for user ${userId}, skipping auto-refresh`);
            return;
        }

        // Check if session exists
        if (!xtermService.hasSession(userId)) {
            console.log(`No active session for user ${userId}, skipping auto-refresh`);
            return;
        }

        let refreshCount = 0;

        const interval = setInterval(async () => {
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
                    console.log(`Last screenshot changed for user ${userId}, stopping auto-refresh`);
                    xtermService.clearRefreshInterval(userId);
                    return;
                }

                // Render and update the screenshot
                const outputBuffer = xtermService.getSessionOutputBuffer(userId);
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

                console.log(`Auto-refreshed screen for user ${userId} (${refreshCount}/${MAX_REFRESH_COUNT})`);
            } catch (error) {
                console.error(`Failed to auto-refresh screen for user ${userId}:`, error);
            }

            // Stop after MAX_REFRESH_COUNT refreshes
            if (refreshCount >= MAX_REFRESH_COUNT) {
                console.log(`Completed ${MAX_REFRESH_COUNT} auto-refreshes for user ${userId}`);
                xtermService.clearRefreshInterval(userId);
            }
        }, REFRESH_INTERVAL_MS);

        // Store the interval in the session
        xtermService.setRefreshInterval(userId, interval);
        console.log(`Started auto-refresh for user ${userId}`);
    }

    /**
     * Stop automatic screen refreshes for a user session.
     */
    static stopAutoRefresh(userId: string, xtermService: XtermService): void {
        xtermService.clearRefreshInterval(userId);
        console.log(`Stopped auto-refresh for user ${userId}`);
    }
}
