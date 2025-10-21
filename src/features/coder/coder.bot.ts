import { Bot, Context, InlineKeyboard, InputFile, Keyboard } from 'grammy';
import { XtermService } from '../xterm/xterm.service.js';
import { XtermRendererService } from '../xterm/xterm-renderer.service.js';
import { CoderService } from './coder.service.js';
import { ConfigService } from '../../services/config.service.js';
import { AccessControlMiddleware } from '../../middleware/access-control.middleware.js';
import { MessageUtils } from '../../utils/message.utils.js';
import { ErrorUtils } from '../../utils/error.utils.js';
import { Messages, SuccessMessages, ErrorActions } from '../../constants/messages.js';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

export class CoderBot {
    private bot: Bot | null = null;
    private botId: string;
    private botToken: string;
    private mediaPath: string;
    private receivedPath: string;
    private xtermService: XtermService;
    private xtermRendererService: XtermRendererService;
    private coderService: CoderService;
    private configService: ConfigService;

    constructor(
        botId: string,
        botToken: string,
        xtermService: XtermService,
        xtermRendererService: XtermRendererService,
        coderService: CoderService,
        configService: ConfigService
    ) {
        this.botId = botId;
        this.botToken = botToken;
        this.xtermService = xtermService;
        this.xtermRendererService = xtermRendererService;
        this.coderService = coderService;
        this.configService = configService;
        this.mediaPath = this.coderService.getMediaPath();
        this.receivedPath = this.coderService.getReceivedPath();
        this.ensureReceivedDirectory();
    }

    private ensureReceivedDirectory(): void {
        try {
            if (!fs.existsSync(this.receivedPath)) {
                fs.mkdirSync(this.receivedPath, { recursive: true });
                console.log(`Created received directory: ${this.receivedPath}`);
            }
        } catch (error) {
            console.error('Failed to create received directory:', error);
        }
    }

    registerHandlers(bot: Bot): void {
        this.bot = bot;
        bot.command('start', AccessControlMiddleware.requireAccess, this.handleStart.bind(this));
        bot.command('help', AccessControlMiddleware.requireAccess, this.handleHelp.bind(this));
        bot.command('copilot', AccessControlMiddleware.requireAccess, this.handleCopilot.bind(this));
        bot.command('claude', AccessControlMiddleware.requireAccess, this.handleClaude.bind(this));
        bot.command('cursor', AccessControlMiddleware.requireAccess, this.handleCursor.bind(this));
        bot.command('send', AccessControlMiddleware.requireAccess, this.handleSend.bind(this));
        bot.command('close', AccessControlMiddleware.requireAccess, this.handleClose.bind(this));
        bot.command('killbot', AccessControlMiddleware.requireAccess, this.handleKillbot.bind(this));
        bot.on('callback_query:data', AccessControlMiddleware.requireAccess, this.handleCallbackQuery.bind(this));
        bot.on('message:photo', AccessControlMiddleware.requireAccess, this.handlePhoto.bind(this));
        bot.on('message:text', AccessControlMiddleware.requireAccess, this.handleTextMessage.bind(this));
    }

    private async refreshScreen(userId: string, chatId: number): Promise<void> {
        if (!this.xtermService.hasSession(userId)) {
            return;
        }

        try {
            const outputBuffer = this.xtermService.getSessionOutputBuffer(userId);
            const dimensions = this.xtermService.getSessionDimensions(userId);

            const imageBuffer = await this.xtermRendererService.renderToImage(
                outputBuffer,
                dimensions.rows,
                dimensions.cols
            );

            const keyboard = new InlineKeyboard().text('🔄 Refresh', 'refresh_screen');

            await this.bot!.api.sendPhoto(chatId, new InputFile(imageBuffer), {
                reply_markup: keyboard,
            });
        } catch (error) {
            console.error('Failed to refresh screen:', error);
        }
    }

    private async handleBellNotification(userId: string, chatId: number): Promise<void> {
        if (!this.bot) {
            console.error('Bot instance not available for BEL notification');
            return;
        }

        try {
            const lastMessageId = this.xtermService.getLastScreenshotMessageId(userId);

            if (lastMessageId) {
                // Update the existing screenshot
                const outputBuffer = this.xtermService.getSessionOutputBuffer(userId);
                const dimensions = this.xtermService.getSessionDimensions(userId);

                const imageBuffer = await this.xtermRendererService.renderToImage(
                    outputBuffer,
                    dimensions.rows,
                    dimensions.cols
                );

                const keyboard = new InlineKeyboard().text('🔄 Refresh', 'refresh_screen');

                try {
                    await this.bot.api.editMessageMedia(chatId, lastMessageId, {
                        type: 'photo',
                        media: new InputFile(imageBuffer),
                    }, {
                        reply_markup: keyboard,
                    });
                } catch (error) {
                    console.error('Failed to update screenshot:', error);
                }
            }
        } catch (error) {
            console.error(`Failed to send BEL notification: ${error}`);
        }
    }

    private async handleConfirmNotification(userId: string, chatId: number, data: string): Promise<void> {
        if (!this.bot) {
            console.error('Bot instance not available for confirmation notification');
            return;
        }

        try {
            this.handleBellNotification(userId, chatId);
            const outputBuffer = this.xtermService.getSessionOutputBuffer(userId);

            // Check if the terminal output contains the confirmation trigger pattern
            const fullOutput = outputBuffer.join('');

            if (!fullOutput.includes('> 1.')) {
                // If the trigger pattern is not found, don't send notification
                return;
            }

            // Build message with generic option list
            const message = '⚠️ Confirmation Required';

            const sentMsg = await this.bot.api.sendMessage(chatId, message);

            const deleteTimeout = this.configService.getMessageDeleteTimeout();
            if (deleteTimeout > 0) {
                setTimeout(async () => {
                    try {
                        await this.bot!.api.deleteMessage(chatId, sentMsg.message_id);
                    } catch (error) {
                        console.error('Failed to delete confirmation notification message:', error);
                    }
                }, deleteTimeout);
            }
        } catch (error) {
            console.error(`Failed to send confirmation notification: ${error}`);
        }
    }

    private async handleCallbackQuery(ctx: Context): Promise<void> {
        const callbackData = ctx.callbackQuery?.data;

        if (!callbackData) {
            await this.safeAnswerCallbackQuery(ctx, Messages.INVALID_CALLBACK);
            return;
        }

        const userId = ctx.from!.id.toString();

        const chatId = ctx.chat!.id;

        try {
            if (callbackData === 'refresh_screen') {
                if (!this.xtermService.hasSession(userId)) {
                    await this.safeAnswerCallbackQuery(ctx, Messages.NO_ACTIVE_TERMINAL_SESSION);
                    return;
                }

                await this.safeAnswerCallbackQuery(ctx, Messages.REFRESHING);

                const outputBuffer = this.xtermService.getSessionOutputBuffer(userId);
                const dimensions = this.xtermService.getSessionDimensions(userId);

                const imageBuffer = await this.xtermRendererService.renderToImage(
                    outputBuffer,
                    dimensions.rows,
                    dimensions.cols
                );

                const keyboard = new InlineKeyboard().text('🔄 Refresh', 'refresh_screen');

                if (ctx.callbackQuery?.message) {
                    await ctx.editMessageMedia({
                        type: 'photo',
                        media: new InputFile(imageBuffer),
                    }, {
                        reply_markup: keyboard,
                    });
                }
                return;
            }

            if (!this.xtermService.hasSession(userId)) {
                await this.safeAnswerCallbackQuery(ctx, Messages.NO_ACTIVE_TERMINAL_SESSION);
                return;
            }

            if (callbackData.match(/^\/[1-5]$/)) {
                const number = callbackData.substring(1);
                this.xtermService.writeRawToSession(userId, number);
                await this.safeAnswerCallbackQuery(ctx, SuccessMessages.SENT(number));
            } else if (callbackData.startsWith('/')) {
                const command = callbackData.substring(1);
                this.xtermService.writeToSession(userId, command);
                await this.safeAnswerCallbackQuery(ctx, `✅ Executed: /${command}`);
            } else {
                try {
                    await ctx.answerCallbackQuery({ text: '❌ Unknown option' });
                } catch (e) {
                    console.error('Failed to answer callback query:', e);
                }
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            // Telegram callback query text limit is 200 chars, leave room for "❌ Failed: "
            const maxLength = 185;
            const truncatedMsg = errorMsg.length > maxLength ? errorMsg.substring(0, maxLength) + '...' : errorMsg;
            try {
                await ctx.answerCallbackQuery({
                    text: `❌ ${truncatedMsg}`
                });
            } catch (answerError) {
                // If still fails, try with minimal message
                try {
                    await ctx.answerCallbackQuery({ text: '❌ Operation failed' });
                } catch (finalError) {
                    console.error('Failed to answer callback query even with minimal message:', finalError);
                }
            }
        }
    }

    private async handlePhoto(ctx: Context): Promise<void> {
        if (!this.bot || !ctx.message?.photo) {
            return;
        }

        try {
            const photo = ctx.message.photo[ctx.message.photo.length - 1];
            const file = await ctx.api.getFile(photo.file_id);

            if (!file.file_path) {
                await ctx.reply('❌ Failed to get file path from Telegram.');
                return;
            }

            const fileUrl = `https://api.telegram.org/file/bot${this.botToken}/${file.file_path}`;

            const timestamp = Date.now();
            const ext = path.extname(file.file_path) || '.jpg';
            const filename = `photo_${timestamp}${ext}`;
            const absolutePath = path.join(this.receivedPath, filename);

            const fileStream = fs.createWriteStream(absolutePath);

            await new Promise<void>((resolve, reject) => {
                https.get(fileUrl, (response) => {
                    response.pipe(fileStream);
                    fileStream.on('finish', () => {
                        fileStream.close();
                        resolve();
                    });
                }).on('error', (err) => {
                    fs.unlink(absolutePath, () => { });
                    reject(err);
                });
            });

            await ctx.reply(`✅ Image saved:\n\`${absolutePath}\``, { parse_mode: 'Markdown' });
        } catch (error) {
            await ctx.reply(
                '❌ Failed to save image.\n\n' +
                `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    private async handleTextMessage(ctx: Context, next: () => Promise<void>): Promise<void> {
        const text = ctx.message?.text || '';

        if (text.startsWith('/')) {
            return next();
        }

        const userId = ctx.from!.id.toString();
        const chatId = ctx.chat!.id;

        try {
            if (!this.xtermService.hasSession(userId)) {
                await ctx.reply(Messages.NO_ACTIVE_SESSION);
                return;
            }

            const processedText = this.coderService.replaceMediaPlaceholder(text);

            this.xtermService.writeRawToSession(userId, processedText);

            await new Promise(resolve => setTimeout(resolve, 50));

            this.xtermService.writeRawToSession(userId, '\r');

            const sentMsg = await ctx.reply(`✅ Sent - ${Messages.VIEW_SCREEN_HINT}`);

            await MessageUtils.scheduleMessageDeletion(ctx, sentMsg.message_id, this.configService);
        } catch (error) {
            await ctx.reply(ErrorUtils.createErrorMessage(ErrorActions.SEND_TO_TERMINAL, error));
        }
    }

    /**
     * Helper method to safely answer callback queries with error handling
     */
    private async safeAnswerCallbackQuery(ctx: Context, text: string): Promise<void> {
        try {
            await ctx.answerCallbackQuery({ text });
        } catch (error) {
            console.error('Failed to answer callback query:', error);
        }
    }

    /**
     * Helper method to send terminal screenshot with inline keyboard
     */
    private async sendSessionScreenshot(ctx: Context, userId: string): Promise<void> {
        const outputBuffer = this.xtermService.getSessionOutputBuffer(userId);
        const dimensions = this.xtermService.getSessionDimensions(userId);

        const imageBuffer = await this.xtermRendererService.renderToImage(
            outputBuffer,
            dimensions.rows,
            dimensions.cols
        );

        const inlineKeyboard = new InlineKeyboard().text('🔄 Refresh', 'refresh_screen');

        const sentMessage = await ctx.replyWithPhoto(new InputFile(imageBuffer), {
            reply_markup: inlineKeyboard,
        });

        this.xtermService.setLastScreenshotMessageId(userId, sentMessage.message_id);
    }

    /**
     * Generic handler for AI assistant commands (copilot, claude, cursor)
     */
    private async handleAIAssistant(
        ctx: Context,
        assistantType: 'copilot' | 'claude' | 'cursor'
    ): Promise<void> {
        const userId = ctx.from!.id.toString();
        const chatId = ctx.chat!.id;

        try {
            if (this.xtermService.hasSession(userId)) {
                const sentMsg = await ctx.reply(Messages.SESSION_ALREADY_EXISTS);
                await MessageUtils.scheduleMessageDeletion(ctx, sentMsg.message_id, this.configService);
                return;
            }

            const dataHandler = this.coderService.createTerminalDataHandler({
                onBell: this.handleBellNotification.bind(this),
                onConfirmationPrompt: this.handleConfirmNotification.bind(this),
            });

            this.xtermService.createSession(userId, chatId, dataHandler);

            await new Promise(resolve => setTimeout(resolve, 500));

            this.xtermService.writeToSession(userId, assistantType);

            await new Promise(resolve => setTimeout(resolve, 2000));

            await this.sendSessionScreenshot(ctx, userId);
        } catch (error) {
            await ctx.reply(ErrorUtils.createErrorMessage(ErrorActions.START_TERMINAL, error));
        }
    }

    private async handleCopilot(ctx: Context): Promise<void> {
        await this.handleAIAssistant(ctx, 'copilot');
    }

    private async handleClaude(ctx: Context): Promise<void> {
        await this.handleAIAssistant(ctx, 'claude');
    }

    private async handleCursor(ctx: Context): Promise<void> {
        await this.handleAIAssistant(ctx, 'cursor');
    }

    private async handleSend(ctx: Context): Promise<void> {
        const userId = ctx.from!.id.toString();
        const chatId = ctx.chat!.id;

        try {
            if (!this.xtermService.hasSession(userId)) {
                await ctx.reply(Messages.NO_ACTIVE_SESSION);
                return;
            }

            const message = ctx.message?.text || '';
            const text = message.replace('/send', '').trim();

            if (!text) {
                await ctx.reply(
                    '⚠️ Please provide text to send.\n\n' +
                    '*Usage:* `/send <text>`\n' +
                    '*Example:* `/send ls -la`',
                    { parse_mode: 'Markdown' }
                );
                return;
            }

            const processedText = this.coderService.replaceMediaPlaceholder(text);

            this.xtermService.writeRawToSession(userId, processedText);

            await new Promise(resolve => setTimeout(resolve, 50));

            this.xtermService.writeRawToSession(userId, '\r');

            const sentMsg = await ctx.reply(`✅ Sent - ${Messages.VIEW_SCREEN_HINT}`);

            await MessageUtils.scheduleMessageDeletion(ctx, sentMsg.message_id, this.configService);
        } catch (error) {
            await ctx.reply(ErrorUtils.createErrorMessage(ErrorActions.SEND_TO_TERMINAL, error));
        }
    }

    private async handleClose(ctx: Context): Promise<void> {
        const userId = ctx.from!.id.toString();
        const chatId = ctx.chat!.id;

        try {
            if (!this.xtermService.hasSession(userId)) {
                await ctx.reply(Messages.NO_SESSION_TO_CLOSE);
                return;
            }

            this.xtermService.closeSession(userId);
            this.coderService.clearBuffer(userId, chatId);

            await ctx.reply(
                '✅ *Coder Session Closed*\n\n' +
                'The coder session has been terminated.\n\n' +
                'Use /start to start a new session.',
                { parse_mode: 'Markdown' }
            );
        } catch (error) {
            await ctx.reply(ErrorUtils.createErrorMessage(ErrorActions.CLOSE_TERMINAL, error));
        }
    }

    private async handleStart(ctx: Context): Promise<void> {
        const sentMsg = await ctx.reply(
            '🤖 *Welcome to coderBOT!*\n\n' +
            'Your AI-powered terminal assistant is ready to help.\n\n' +
            '*Quick Start:*\n' +
            '/copilot - Start a session with GitHub Copilot\n' +
            '/claude - Start a session with Claude AI\n' +
            '/cursor - Start a session with Cursor AI\n\n' +
            '*Other Commands:*\n' +
            '/screen - View terminal output\n' +
            '/close - Close your session\n' +
            '/help - Show many more commands\n\n' +
            'Happy coding! 🚀',
            { parse_mode: 'Markdown' }
        );

        await MessageUtils.scheduleMessageDeletion(ctx, sentMsg.message_id, this.configService, 2);
    }

    private async handleHelp(ctx: Context): Promise<void> {
        const sentMsg = await ctx.reply(
            '🤖 *Coder Bot - Complete Command Reference*\n\n' +
            '*Session Management:*\n' +
            '/copilot - Start a new session with GitHub Copilot\n' +
            '/claude - Start a new session with Claude AI\n' +
            '/cursor - Start a new session with Cursor AI\n' +
            '/close - Close the current terminal session\n\n' +
            '/xterm - Start a raw bash terminal session\n' +
            '*Sending Text to Terminal:*\n' +
            'Type any message (not starting with /) - Sent directly to terminal with Enter\n' +
            '/send <text> - Send text to terminal with Enter\n' +
            '/keys <text> - Send text without pressing Enter\n' +
            '*Tip:* Use \\[media\\] in your text - it will be replaced with the media directory path\n\n' +
            '*Special Keys:*\n' +
            '/tab - Send Tab character\n' +
            '/enter - Send Enter key\n' +
            '/space - Send Space character\n' +
            '/ctrl <char> - Send Ctrl+character (e.g., /ctrl c for Ctrl+C)\n' +
            '/ctrlc - Send Ctrl+C (interrupt)\n' +
            '/ctrlx - Send Ctrl+X\n' +
            '/esc - Send Escape key\n' +
            '/1 /2 /3 /4 /5 - Send number keys (for menu selections)\n\n' +
            '*Viewing Output:*\n' +
            '/screen - Capture and view terminal screenshot\n' +
            'Click 🔄 Refresh button on screenshots to update\n\n' +
            '*Media:*\n' +
            '• Upload photos or files - Automatically saved to received directory and available to the coder agent\n' +
            '• Files copied to \\[media\] directory will be sent to you automatically\n' +
            '• Use \\[media\] in commands - e.g., "cp output.png \\[media\\]" to send files\n' +
            '• The bot watches this directory and sends any new files to you\n\n' +
            '*Other:*\n' +
            '/start - Show quick start guide\n' +
            '/help - Show this detailed help\n' +
            '/killbot - Shutdown the bot\n\n' +
            '💡 *Pro Tip:* Most commands work only when you have an active session. Start one with /copilot or /claude!',
            { parse_mode: 'Markdown' }
        );

        await MessageUtils.scheduleMessageDeletion(ctx, sentMsg.message_id, this.configService, 2);
    }

    private async handleKillbot(ctx: Context): Promise<void> {
        try {
            await ctx.reply('🛑 Shutting down bot...\n\nGoodbye!');

            console.log('Killbot command received, shutting down...');

            setTimeout(() => {
                process.exit(0);
            }, 1000);
        } catch (error) {
            console.error('Error during killbot:', error);
            process.exit(1);
        }
    }
}
