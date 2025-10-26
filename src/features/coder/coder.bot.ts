import { Bot, Context, InlineKeyboard, InputFile, Keyboard } from 'grammy';
import { XtermService } from '../xterm/xterm.service.js';
import { XtermRendererService } from '../xterm/xterm-renderer.service.js';
import { CoderService } from './coder.service.js';
import { ConfigService } from '../../services/config.service.js';
import { AccessControlMiddleware } from '../../middleware/access-control.middleware.js';
import { MessageUtils } from '../../utils/message.utils.js';
import { ErrorUtils } from '../../utils/error.utils.js';
import { ScreenRefreshUtils } from '../../utils/screen-refresh.utils.js';
import { CommandMenuUtils } from '../../utils/command-menu.utils.js';
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
        bot.command('esc', AccessControlMiddleware.requireAccess, this.handleEsc.bind(this));
        bot.command('close', AccessControlMiddleware.requireAccess, this.handleClose.bind(this));
        bot.command('killbot', AccessControlMiddleware.requireAccess, this.handleKillbot.bind(this));
        bot.command('urls', AccessControlMiddleware.requireAccess, this.handleUrls.bind(this));
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

            const keyboard = ScreenRefreshUtils.createScreenKeyboard();

            await this.bot!.api.sendPhoto(chatId, new InputFile(imageBuffer), {
                reply_markup: keyboard,
            });
        } catch (error) {
            console.error('Failed to refresh screen:', error);
        }
    }

    /**
     * Helper method to trigger auto-refresh after sending input to terminal
     */
    private triggerAutoRefresh(userId: string, chatId: number): void {
        if (this.bot) {
            ScreenRefreshUtils.startAutoRefresh(
                userId,
                chatId,
                this.bot,
                this.xtermService,
                this.xtermRendererService,
                this.configService
            );
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

                const keyboard = ScreenRefreshUtils.createScreenKeyboard();

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

                const keyboard = ScreenRefreshUtils.createScreenKeyboard();

                if (ctx.callbackQuery?.message) {
                    await ctx.editMessageMedia({
                        type: 'photo',
                        media: new InputFile(imageBuffer),
                    }, {
                        reply_markup: keyboard,
                    });
                }
                
                // Trigger auto-refresh interval
                this.triggerAutoRefresh(userId, chatId);
                return;
            }

            // Handle number key buttons (1, 2 and 3)
            if (callbackData === 'num_1' || callbackData === 'num_2' || callbackData === 'num_3') {
                if (!this.xtermService.hasSession(userId)) {
                    await this.safeAnswerCallbackQuery(ctx, Messages.NO_ACTIVE_TERMINAL_SESSION);
                    return;
                }

                const number = callbackData === 'num_1' ? '1' : callbackData === 'num_2' ? '2' : '3';
                this.xtermService.writeRawToSession(userId, number);
                await this.safeAnswerCallbackQuery(ctx, SuccessMessages.SENT(number));
                this.triggerAutoRefresh(userId, chatId);
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
        let text = ctx.message?.text || '';

        if (text.startsWith('/')) {
            return next();
        }

        if (text.startsWith('.')) {
            text = text.substring(1);
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

            // Start auto-refresh if last screen exists
            if (this.bot) {
                ScreenRefreshUtils.startAutoRefresh(
                    userId,
                    chatId,
                    this.bot,
                    this.xtermService,
                    this.xtermRendererService,
                    this.configService
                );
            }
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

        const inlineKeyboard = ScreenRefreshUtils.createScreenKeyboard();

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



    private async handleEsc(ctx: Context): Promise<void> {
        const userId = ctx.from!.id.toString();
        const chatId = ctx.chat!.id;

        try {
            if (!this.xtermService.hasSession(userId)) {
                await ctx.reply(Messages.NO_ACTIVE_SESSION);
                return;
            }

            this.xtermService.writeRawToSession(userId, '\x1b');
            const sentMsg = await ctx.reply(SuccessMessages.SENT_SPECIAL_KEY('Escape key'));
            await MessageUtils.scheduleMessageDeletion(ctx, sentMsg.message_id, this.configService);

            if (this.bot) {
                ScreenRefreshUtils.startAutoRefresh(
                    userId,
                    chatId,
                    this.bot,
                    this.xtermService,
                    this.xtermRendererService,
                    this.configService
                );
            }
        } catch (error) {
            await ctx.reply(ErrorUtils.createErrorMessage(ErrorActions.SEND_ESCAPE, error));
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

            // Update command menu to show AI assistants instead of /close
            if (this.bot) {
                await CommandMenuUtils.setNoSessionCommands(this.bot);
            }

            await ctx.reply(
                '✅ *Coder Session Closed*\n\n' +
                'The coder session has been terminated.\n\n' +
                'Use /copilot, /claude, or /cursor to start a new session.',
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
            '/copilot - Start GitHub Copilot CLI\n' +
            '/claude - Start Claude AI\n' +
            '/cursor - Start Cursor AI\n' +
            '/xterm - Start raw terminal\n' +
            '/help - Show all available commands\n\n' +
            'Send any message to interact with the terminal.\n\n' +
            'Happy coding! 🚀',
            { parse_mode: 'Markdown' }
        );

        await MessageUtils.scheduleMessageDeletion(ctx, sentMsg.message_id, this.configService, 2);
    }

    private async handleHelp(ctx: Context): Promise<void> {
        const sentMsg = await ctx.reply(
            '🤖 *CoderBOT - Complete Command Reference*\n\n' +
            '*Starting Sessions:*\n' +
            '/copilot - Start GitHub Copilot CLI session\n' +
            '/claude - Start Claude AI session\n' +
            '/cursor - Start Cursor AI session\n' +
            '/xterm - Start raw terminal (no AI)\n' +
            '/startup <prompt> - Set/view auto-startup prompt for /copilot\n' +
            '/close - Close the current terminal session\n\n' +
            '*Sending Text to Terminal:*\n' +
            'Type any message (not starting with /) - Sent directly to terminal with Enter\n' +
            '.command - Send command (dot prefix removed, Enter added automatically)\n' +
            '*Tip:* Use \\[media\\] in your text - it will be replaced with the media directory path\n\n' +
            '*Special Keys:*\n' +
            '/tab - Send Tab character\n' +
            '/enter - Send Enter key\n' +
            '/space - Send Space character\n' +
            '/esc - Send Escape key\n' +
            '/delete - Send Delete/Backspace key\n' +
            '/ctrlc - Send Ctrl+C (interrupt)\n' +
            '/ctrlx - Send Ctrl+X\n' +
            '/ctrl <char> - Send any Ctrl+ combination (a-z, @, \\[, \\\\, \\], ^, \\_, ?)\n' +
            '/arrowup - Send Arrow Up key\n' +
            '/arrowdown - Send Arrow Down key\n' +
            '/keys <text> - Send text without Enter\n' +
            '/1, /2, /3, /4, /5 - Send number keys\n\n' +
            '*Viewing Output:*\n' +
            '/screen - Capture and view terminal screenshot\n' +
            '/urls - Show all URLs found in terminal output\n' +
            'Click 🔄 Refresh button on screenshots to update\n\n' +
            '*Media:*\n' +
            '• Upload photos or files - Automatically saved to received directory\n' +
            '• Files copied to \\[media\] directory will be sent to you automatically\n' +
            '• Use \\[media\] in commands - e.g., "cp output.png \\[media\\]" to send files\n' +
            '• The bot watches this directory and sends any new files to you\n\n' +
            '*Other:*\n' +
            '/start - Show quick start guide\n' +
            '/help - Show this detailed help\n' +
            '/killbot - Shutdown the bot\n\n' +
            '💡 *Pro Tip:* Send messages directly to interact with the terminal!',
            { parse_mode: 'Markdown' }
        );

        await MessageUtils.scheduleMessageDeletion(ctx, sentMsg.message_id, this.configService, 2);
    }

    private async handleUrls(ctx: Context): Promise<void> {
        const userId = ctx.from!.id.toString();

        try {
            if (!this.xtermService.hasSession(userId)) {
                await ctx.reply(Messages.NO_ACTIVE_SESSION);
                return;
            }

            const urls = this.xtermService.getDiscoveredUrls(userId);

            if (urls.length === 0) {
                await ctx.reply(
                    '🔗 *No URLs Found*\n\n' +
                    'No URLs have been detected in the terminal output yet.',
                    { parse_mode: 'Markdown' }
                );
                return;
            }

            const urlList = urls.map(url => `\`${url}\``).join('\n');
            const sentMsg = await ctx.reply(
                `🔗 *Discovered URLs* (${urls.length})\n\n${urlList}`,
                { parse_mode: 'Markdown' }
            );

            await MessageUtils.scheduleMessageDeletion(ctx, sentMsg.message_id, this.configService);
        } catch (error) {
            await ctx.reply(ErrorUtils.createErrorMessage(ErrorActions.SEND_TO_TERMINAL, error));
        }
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
