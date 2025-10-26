import { Bot, Context, InlineKeyboard, InputFile, Keyboard } from 'grammy';
import { XtermService } from '../xterm/xterm.service.js';
import { XtermRendererService } from '../xterm/xterm-renderer.service.js';
import { CoderService } from './coder.service.js';
import { ConfigService } from '../../services/config.service.js';
import { StartupPromptService } from '../../services/startup-prompt.service.js';
import { AccessControlMiddleware } from '../../middleware/access-control.middleware.js';
import { MessageUtils } from '../../utils/message.utils.js';
import { ErrorUtils } from '../../utils/error.utils.js';
import { ScreenRefreshUtils } from '../../utils/screen-refresh.utils.js';
import { CommandMenuUtils } from '../../utils/command-menu.utils.js';
import { Messages, SuccessMessages, ErrorActions } from '../../constants/messages.js';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

export enum AssistantType {
    COPILOT = 'copilot',
    CLAUDE = 'claude',
    GEMINI = 'gemini'
}

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
    private startupPromptService: StartupPromptService;
    private activeAssistantType: AssistantType | null = null;
    private confirmNotificationDebounceTimers: Map<string, NodeJS.Timeout> = new Map();

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
        this.startupPromptService = new StartupPromptService();
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
        bot.command('copilot', AccessControlMiddleware.requireAccess, this.handleCopilot.bind(this));
        bot.command('claude', AccessControlMiddleware.requireAccess, this.handleClaude.bind(this));
        bot.command('gemini', AccessControlMiddleware.requireAccess, this.handleGemini.bind(this));
        bot.command('startup', AccessControlMiddleware.requireAccess, this.handleStartup.bind(this));
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

    /**
     * Callback for handling newly discovered URLs in terminal output
     */
    private async handleUrlDiscovered(userId: string, chatId: number, url: string): Promise<void> {
        if (!this.bot || !this.configService.isAutoNotifyUrlsEnabled()) {
            return;
        }

        try {
            // Send URL notification message
            const sentMsg = await this.bot.api.sendMessage(
                chatId,
                `\`${url}\``,
                { parse_mode: 'Markdown' }
            );

            // Schedule message deletion if timeout is configured
            const deleteTimeout = this.configService.getMessageDeleteTimeout();
            if (deleteTimeout > 0) {
                const timeout = setTimeout(async () => {
                    try {
                        await this.bot?.api.deleteMessage(chatId, sentMsg.message_id);
                        this.coderService.clearUrlNotificationTimeout(userId, sentMsg.message_id);
                    } catch (error) {
                        console.error('Failed to delete URL notification message:', error);
                    }
                }, deleteTimeout);

                this.coderService.registerUrlNotificationTimeout(userId, sentMsg.message_id, timeout);
            }
        } catch (error) {
            console.error('Failed to send URL notification:', error);
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
                // Get current buffer and check if it has changed
                const outputBuffer = this.xtermService.getSessionOutputBuffer(userId);
                const currentBufferHash = outputBuffer.join('');
                const lastBufferHash = this.xtermService.getLastScreenshotBufferHash(userId);

                // Skip update if buffer hasn't changed since last screenshot
                if (lastBufferHash !== null && lastBufferHash !== undefined && currentBufferHash === lastBufferHash) {
                    return;
                }

                // Update the existing screenshot
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

                    // Update the buffer hash after successful screenshot update
                    this.xtermService.setLastScreenshotBufferHash(userId, currentBufferHash);
                } catch (error) {
                    console.error('Failed to update screenshot:', error);
                }
            }
        } catch (error) {
            console.error(`Failed to send BEL notification: ${error}`);
        }
    }

    private async handleConfirmNotification(userId: string, chatId: number, message: string): Promise<void> {
        if (!this.bot) {
            console.error('Bot instance not available for confirmation notification');
            return;
        }

        // Implement debouncing: clear existing timer if present
        const existingTimer = this.confirmNotificationDebounceTimers.get(userId);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        // Set new timer with 5-second debounce
        const debounceTimer = setTimeout(async () => {
            try {
                // we want a beep or whatever we do when a BEL is signalled
                this.handleBellNotification(userId, chatId);
                const sentMsg = await this.bot.api.sendMessage(chatId, message);

                // And then send a message
                const ctx = {
                    api: this.bot.api,
                    chat: { id: chatId }
                } as Context;

                await MessageUtils.scheduleMessageDeletion(ctx, sentMsg.message_id, this.configService);
            } catch (error) {
                console.error(`Failed to send confirmation notification: ${error}`);
            } finally {
                // Clean up the timer from the map
                this.confirmNotificationDebounceTimers.delete(userId);
            }
        }, 5000);

        // Store the timer
        this.confirmNotificationDebounceTimers.set(userId, debounceTimer);
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

                    // Update the buffer hash after successful screenshot update
                    const currentBufferHash = outputBuffer.join('');
                    this.xtermService.setLastScreenshotBufferHash(userId, currentBufferHash);
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

        // Store the buffer hash to detect changes in future updates
        const currentBufferHash = outputBuffer.join('');
        this.xtermService.setLastScreenshotBufferHash(userId, currentBufferHash);
    }

    /**
     * Generic handler for AI assistant commands (copilot, claude, gemini)
     */
    private async handleAIAssistant(
        ctx: Context,
        assistantType: AssistantType
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
                onUrlDiscovered: this.handleUrlDiscovered.bind(this),
            });

            // Set buffer getter so CoderService can access full buffer
            this.coderService.setBufferGetter(this.xtermService.getSessionOutputBuffer.bind(this.xtermService));

            this.xtermService.createSession(
                userId,
                chatId,
                dataHandler,
                undefined, // onBufferingEndedCallback
                this.xtermService.getSessionOutputBuffer.bind(this.xtermService) // getFullBufferCallback
            );

            await new Promise(resolve => setTimeout(resolve, 500));

            this.xtermService.writeToSession(userId, assistantType);

            // Set the active assistant type for this session
            this.activeAssistantType = assistantType;

            await new Promise(resolve => setTimeout(resolve, 2000));

            await this.sendSessionScreenshot(ctx, userId);

            // Load and send startup prompt after 3 seconds (only for copilot)
            if (assistantType === AssistantType.COPILOT) {
                setTimeout(async () => {
                    try {
                        const startupPrompt = this.startupPromptService.loadPrompt(this.botId);
                        if (startupPrompt && startupPrompt.trim()) {
                            // Send the startup prompt to the terminal
                            this.xtermService.writeRawToSession(userId, startupPrompt);
                            await new Promise(resolve => setTimeout(resolve, 50));
                            this.xtermService.writeRawToSession(userId, '\r');
                            console.log(`Sent startup prompt to copilot for bot ${this.botId}: ${startupPrompt}`);
                            this.triggerAutoRefresh(userId, chatId);
                        }
                    } catch (error) {
                        console.error(`Failed to send startup prompt for bot ${this.botId}:`, error);
                    }
                }, 3000);
            }
        } catch (error) {
            await ctx.reply(ErrorUtils.createErrorMessage(ErrorActions.START_TERMINAL, error));
        }
    }

    private async handleCopilot(ctx: Context): Promise<void> {
        await this.handleAIAssistant(ctx, AssistantType.COPILOT);
    }

    private async handleClaude(ctx: Context): Promise<void> {
        await this.handleAIAssistant(ctx, AssistantType.CLAUDE);
    }

    private async handleGemini(ctx: Context): Promise<void> {
        await this.handleAIAssistant(ctx, AssistantType.GEMINI);
    }

    private async handleStartup(ctx: Context): Promise<void> {
        try {
            const message = ctx.message?.text || '';
            const prompt = message.replace('/startup', '').trim();

            if (!prompt) {
                // Show current startup prompt or help message
                const currentPrompt = this.startupPromptService.loadPrompt(this.botId);
                if (currentPrompt) {
                    await ctx.reply(
                        `*Current startup prompt for bot ${this.botId}:*\n\n\`${currentPrompt}\`\n\n` +
                        '*To update:* `/startup <your new prompt>`\n' +
                        '*To delete:* Use the delete method in the service',
                        { parse_mode: 'Markdown' }
                    );
                } else {
                    await ctx.reply(
                        '❌ No startup prompt configured.\n\n' +
                        '*Usage:* `/startup <prompt>`\n' +
                        '*Example:* `/startup ./cwd /home/user/project`\n\n' +
                        'The startup prompt will be automatically sent when launching /copilot.',
                        { parse_mode: 'Markdown' }
                    );
                }
                return;
            }

            // Save the startup prompt
            this.startupPromptService.savePrompt(this.botId, prompt);
            await ctx.reply(
                `✅ Startup prompt saved for bot ${this.botId}\n\n` +
                `*Prompt:* \`${prompt}\`\n\n` +
                'This message will be sent automatically when launching /copilot.',
                { parse_mode: 'Markdown' }
            );
        } catch (error) {
            await ctx.reply(ErrorUtils.createErrorMessage('save startup prompt', error));
        }
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
            this.coderService.clearUrlsForUser(userId);

            // Clear the active assistant type
            this.activeAssistantType = null;

            // Update command menu to show AI assistants instead of /close
            if (this.bot) {
                await CommandMenuUtils.setNoSessionCommands(this.bot);
            }

            await ctx.reply(
                '✅ *Coder Session Closed*\n\n' +
                'The coder session has been terminated.\n\n' +
                'Use /copilot, /claude, or /gemini to start a new session.',
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
            '/gemini - Start Gemini AI\n' +
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
            '/gemini - Start Gemini AI session\n' +
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

            // Get URLs from CoderService instead of XtermService
            const urls = this.coderService.getDiscoveredUrls(userId);

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
