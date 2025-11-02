import { Bot, Context, InlineKeyboard, InputFile, Keyboard } from 'grammy';
import { XtermService } from '../xterm/xterm.service.js';
import { XtermRendererService } from '../xterm/xterm-renderer.service.js';
import { CoderService } from './coder.service.js';
import { ConfigService } from '../../services/config.service.js';
import { RefreshStateService } from '../../services/refresh-state.service.js';
import { StartupPromptService } from '../../services/startup-prompt.service.js';
import { CustomCoderService } from '../../services/custom-coder.service.js';
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
    private refreshStateService: RefreshStateService;
    private startupPromptService: StartupPromptService;
    private customCoderService: CustomCoderService;
    private activeAssistantType: AssistantType | string | null = null;
    private confirmNotificationDebounceTimers: Map<string, NodeJS.Timeout> = new Map();
    private registeredCustomCoders: Set<string> = new Set();

    constructor(
        botId: string,
        botToken: string,
        xtermService: XtermService,
        xtermRendererService: XtermRendererService,
        coderService: CoderService,
        configService: ConfigService,
        refreshStateService: RefreshStateService
    ) {
        this.botId = botId;
        this.botToken = botToken;
        this.xtermService = xtermService;
        this.xtermRendererService = xtermRendererService;
        this.coderService = coderService;
        this.configService = configService;
        this.refreshStateService = refreshStateService;
        this.startupPromptService = new StartupPromptService();
        this.customCoderService = new CustomCoderService();
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
        bot.command('addcoder', AccessControlMiddleware.requireAccess, this.handleAddCoder.bind(this));
        bot.command('removecoder', AccessControlMiddleware.requireAccess, this.handleRemoveCoder.bind(this));
        bot.command('startup', AccessControlMiddleware.requireAccess, this.handleStartup.bind(this));
        bot.command('start', AccessControlMiddleware.requireAccess, this.handleStart.bind(this));
        bot.command('help', AccessControlMiddleware.requireAccess, this.handleHelp.bind(this));
        bot.command('esc', AccessControlMiddleware.requireAccess, this.handleEsc.bind(this));
        bot.command('close', AccessControlMiddleware.requireAccess, this.handleClose.bind(this));
        bot.command('killbot', AccessControlMiddleware.requireAccess, this.handleKillbot.bind(this));
        bot.command('urls', AccessControlMiddleware.requireAccess, this.handleUrls.bind(this));
        bot.command('projects', AccessControlMiddleware.requireAccess, this.handleProjects.bind(this));
        bot.command('macros', AccessControlMiddleware.requireAccess, this.handleMacros.bind(this));
        bot.on('callback_query:data', AccessControlMiddleware.requireAccess, this.handleCallbackQuery.bind(this));
        bot.on('message:photo', AccessControlMiddleware.requireAccess, this.handlePhoto.bind(this));
        bot.on('message:video', AccessControlMiddleware.requireAccess, this.handleVideo.bind(this));
        bot.on('message:audio', AccessControlMiddleware.requireAccess, this.handleAudio.bind(this));
        bot.on('message:voice', AccessControlMiddleware.requireAccess, this.handleVoice.bind(this));
        bot.on('message:text', AccessControlMiddleware.requireAccess, this.handleTextMessage.bind(this));
        
        // Load and register custom coders on startup
        this.loadAndRegisterAllCustomCoders();
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
                this.configService,
                this.refreshStateService
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

                await MessageUtils.scheduleMessageDeletion(ctx, sentMsg.message_id, this.configService, 0.2);
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

            // Handle project selection
            if (callbackData.startsWith('project:')) {
                const projectDir = callbackData.substring(8);
                if (projectDir === 'cancel') {
                    await this.safeAnswerCallbackQuery(ctx, '❌ Cancelled');
                    if (ctx.callbackQuery?.message) {
                        await ctx.deleteMessage();
                    }
                    return;
                }
                
                if (!this.xtermService.hasSession(userId)) {
                    await this.safeAnswerCallbackQuery(ctx, Messages.NO_ACTIVE_TERMINAL_SESSION);
                    return;
                }

                this.xtermService.writeRawToSession(userId, `cd ${projectDir}`);
                setTimeout(() => {
                    this.xtermService.writeRawToSession(userId, '\r');
                }, 100);
                await this.safeAnswerCallbackQuery(ctx, `✅ Changed to: ${path.basename(projectDir)}`);
                if (ctx.callbackQuery?.message) {
                    await ctx.deleteMessage();
                }
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

    private async handleVideo(ctx: Context): Promise<void> {
        if (!this.bot || !ctx.message?.video) {
            return;
        }

        try {
            const video = ctx.message.video;
            const file = await ctx.api.getFile(video.file_id);

            if (!file.file_path) {
                await ctx.reply('❌ Failed to get file path from Telegram.');
                return;
            }

            const fileUrl = `https://api.telegram.org/file/bot${this.botToken}/${file.file_path}`;

            const timestamp = Date.now();
            const ext = path.extname(file.file_path) || '.mp4';
            const filename = `video_${timestamp}${ext}`;
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

            await ctx.reply(`✅ Video saved:\n\`${absolutePath}\``, { parse_mode: 'Markdown' });
        } catch (error) {
            await ctx.reply(
                '❌ Failed to save video.\n\n' +
                `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    private async handleAudio(ctx: Context): Promise<void> {
        if (!this.bot || !ctx.message?.audio) {
            return;
        }

        try {
            const audio = ctx.message.audio;
            const file = await ctx.api.getFile(audio.file_id);

            if (!file.file_path) {
                await ctx.reply('❌ Failed to get file path from Telegram.');
                return;
            }

            const fileUrl = `https://api.telegram.org/file/bot${this.botToken}/${file.file_path}`;

            const timestamp = Date.now();
            const ext = path.extname(file.file_path) || '.mp3';
            const filename = `audio_${timestamp}${ext}`;
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

            await ctx.reply(`✅ Audio saved:\n\`${absolutePath}\``, { parse_mode: 'Markdown' });
        } catch (error) {
            await ctx.reply(
                '❌ Failed to save audio.\n\n' +
                `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    private async handleVoice(ctx: Context): Promise<void> {
        if (!this.bot || !ctx.message?.voice) {
            return;
        }

        try {
            const voice = ctx.message.voice;
            const file = await ctx.api.getFile(voice.file_id);

            if (!file.file_path) {
                await ctx.reply('❌ Failed to get file path from Telegram.');
                return;
            }

            const fileUrl = `https://api.telegram.org/file/bot${this.botToken}/${file.file_path}`;

            const timestamp = Date.now();
            const ext = path.extname(file.file_path) || '.ogg';
            const filename = `voice_${timestamp}${ext}`;
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

            await ctx.reply(`✅ Voice message saved:\n\`${absolutePath}\``, { parse_mode: 'Markdown' });
        } catch (error) {
            await ctx.reply(
                '❌ Failed to save voice message.\n\n' +
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

            // Replace [m0] through [m9] placeholders with configured values
            let processedText = text;
            for (let i = 0; i <= 9; i++) {
                const configValue = this.configService.getMPlaceholder(i);
                if (configValue) {
                    const placeholder = `[m${i}]`;
                    const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
                    processedText = processedText.replace(regex, configValue);
                }
            }

            // Replace /tmp/coderBOT_media/bot-2 placeholder with file content
            processedText = this.coderService.replaceMediaPlaceholder(processedText);

            this.xtermService.writeRawToSession(userId, processedText);

            await new Promise(resolve => setTimeout(resolve, 50));

            this.xtermService.writeRawToSession(userId, '\r');

            const sentMsg = await ctx.reply(`✅ Sent`);

            await MessageUtils.scheduleMessageDeletion(ctx, sentMsg.message_id, this.configService);

            // Start auto-refresh if last screen exists
            if (this.bot) {
                ScreenRefreshUtils.startAutoRefresh(
                    userId,
                    chatId,
                    this.bot,
                    this.xtermService,
                    this.xtermRendererService,
                    this.configService,
                    this.refreshStateService
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
     * Generic handler for AI assistant commands (copilot, claude, gemini, custom)
     */
    private async handleAIAssistant(
        ctx: Context,
        assistantType: AssistantType | string
    ): Promise<void> {
        const userId = ctx.from!.id.toString();
        const chatId = ctx.chat!.id;

        try {
            if (this.xtermService.hasSession(userId)) {
                const sentMsg = await ctx.reply(Messages.SESSION_ALREADY_EXISTS);
                await MessageUtils.scheduleMessageDeletion(ctx, sentMsg.message_id, this.configService);
                return;
            }

            // Send spawning message with half timeout deletion
            const spawningMsg = await ctx.reply(Messages.SPAWNING_SESSION);
            await MessageUtils.scheduleMessageDeletion(ctx, spawningMsg.message_id, this.configService, 0.5);

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

            // Update command menu to show /close instead of AI assistants
            if (this.bot) {
                await CommandMenuUtils.setSessionCommands(this.bot);
            }

            await new Promise(resolve => setTimeout(resolve, 500));

            this.xtermService.writeToSession(userId, assistantType);

            // Set the active assistant type for this session
            this.activeAssistantType = assistantType;

            await new Promise(resolve => setTimeout(resolve, 2000));

            await this.sendSessionScreenshot(ctx, userId);

            // Load and send startup prompt after 3 seconds (for ANY assistant type)
            setTimeout(async () => {
                try {
                    const startupPrompt = this.startupPromptService.loadPrompt(
                        this.botId,
                        assistantType as string
                    );
                    if (startupPrompt && startupPrompt.trim()) {
                        // Send the startup prompt to the terminal
                        this.xtermService.writeRawToSession(userId, startupPrompt);
                        await new Promise(resolve => setTimeout(resolve, 50));
                        this.xtermService.writeRawToSession(userId, '\r');
                        console.log(`Sent startup prompt to ${assistantType} for bot ${this.botId}: ${startupPrompt}`);
                        this.triggerAutoRefresh(userId, chatId);
                    }
                } catch (error) {
                    console.error(`Failed to send startup prompt for ${assistantType}:`, error);
                }
            }, 3000);
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

    /**
     * Check if command name is reserved
     */
    private isReservedCommand(name: string): boolean {
        const reserved = [
            'copilot', 'claude', 'gemini',
            'start', 'help', 'esc', 'close', 'killbot', 'urls', 'startup',
            'addcoder', 'removecoder'
        ];
        return reserved.includes(name.toLowerCase());
    }

    /**
     * Handle /addcoder command to create custom AI assistant
     */
    private async handleAddCoder(ctx: Context): Promise<void> {
        const userId = ctx.from!.id.toString();
        const message = ctx.message?.text || '';
        const args = message.replace('/addcoder', '').trim().split(/\s+/);

        // Validation
        if (args.length !== 1 || !args[0]) {
            await ctx.reply(
                '❌ Usage: `/addcoder <codername>`\n\n' +
                'Coder name must be a single lowercase word (a-z only).',
                { parse_mode: 'Markdown' }
            );
            return;
        }

        const coderName = this.customCoderService.sanitizeCoderName(args[0]);
        const validation = this.customCoderService.validateCoderName(coderName);

        if (!validation.valid) {
            await ctx.reply(`❌ ${validation.error}`);
            return;
        }

        // Check conflicts with reserved commands
        if (this.isReservedCommand(coderName)) {
            await ctx.reply(
                `❌ "${coderName}" is a reserved command. Choose a different name.`
            );
            return;
        }

        // Check if already exists
        if (this.customCoderService.hasCustomCoder(userId, coderName)) {
            await ctx.reply(
                `❌ Custom coder "/${coderName}" already exists.\n\n` +
                `Use \`/removecoder ${coderName}\` to remove it first.`,
                { parse_mode: 'Markdown' }
            );
            return;
        }

        // Save and register
        try {
            this.customCoderService.saveCustomCoder(userId, coderName, this.botId);
            this.registerCustomCoder(coderName, userId);
            await ctx.reply(
                `✅ Custom coder "/${coderName}" created successfully!\n\n` +
                `You can now use \`/${coderName}\` to start a session.`,
                { parse_mode: 'Markdown' }
            );
        } catch (error) {
            await ctx.reply(ErrorUtils.createErrorMessage('create custom coder', error));
        }
    }

    /**
     * Handle /removecoder command to remove custom AI assistant
     */
    private async handleRemoveCoder(ctx: Context): Promise<void> {
        const userId = ctx.from!.id.toString();
        const message = ctx.message?.text || '';
        const args = message.replace('/removecoder', '').trim().split(/\s+/);

        if (args.length !== 1 || !args[0]) {
            await ctx.reply('❌ Usage: `/removecoder <codername>`', { parse_mode: 'Markdown' });
            return;
        }

        // CRITICAL: Use same sanitization as addcoder
        const coderName = this.customCoderService.sanitizeCoderName(args[0]);

        if (!this.customCoderService.hasCustomCoder(userId, coderName)) {
            await ctx.reply(
                `❌ Custom coder "/${coderName}" not found.`,
                { parse_mode: 'Markdown' }
            );
            return;
        }

        try {
            const deleted = this.customCoderService.deleteCustomCoder(userId, coderName);
            if (deleted) {
                // Note: We don't unregister from bot as other users might have the same coder name
                this.registeredCustomCoders.delete(coderName);
                await ctx.reply(
                    `✅ Custom coder "/${coderName}" removed successfully.`,
                    { parse_mode: 'Markdown' }
                );
            } else {
                await ctx.reply(`❌ Failed to remove custom coder.`);
            }
        } catch (error) {
            await ctx.reply(ErrorUtils.createErrorMessage('remove custom coder', error));
        }
    }

    /**
     * Register a custom coder command dynamically
     */
    private registerCustomCoder(coderName: string, userId: string): void {
        if (!this.bot) return;

        // Avoid registering the same command multiple times
        if (this.registeredCustomCoders.has(coderName)) {
            return;
        }

        // Create a handler that works like copilot/claude/gemini
        const handler = async (ctx: Context) => {
            const currentUserId = ctx.from!.id.toString();
            
            // Update last used timestamp
            if (this.customCoderService.hasCustomCoder(currentUserId, coderName)) {
                this.customCoderService.updateLastUsed(currentUserId, coderName);
            }
            
            // Spawn terminal session
            await this.handleAIAssistant(ctx, coderName);
        };

        this.bot.command(coderName, AccessControlMiddleware.requireAccess, handler);
        this.registeredCustomCoders.add(coderName);
        console.log(`Registered custom coder command: /${coderName}`);
    }

    /**
     * Load and register all custom coders at startup
     */
    private loadAndRegisterAllCustomCoders(): void {
        try {
            const fs = require('fs');
            const path = require('path');
            const customCodersDir = path.join(process.cwd(), 'customcoders');

            if (!fs.existsSync(customCodersDir)) {
                return;
            }

            const files = fs.readdirSync(customCodersDir);
            const coderNames = new Set<string>();

            // Extract unique coder names from all files
            for (const file of files) {
                if (file.endsWith('.json') && file !== 'README.md') {
                    try {
                        const parts = file.replace('.json', '').split('-');
                        if (parts.length >= 2) {
                            // File format: userId-coderName.json
                            const coderName = parts.slice(1).join('-');
                            coderNames.add(coderName);
                        }
                    } catch (error) {
                        console.error(`Failed to parse custom coder file ${file}:`, error);
                    }
                }
            }

            // Register each unique coder name
            coderNames.forEach(coderName => {
                this.registerCustomCoder(coderName, 'system');
            });

            console.log(`Loaded ${coderNames.size} custom coder commands`);
        } catch (error) {
            console.error('Failed to load custom coders:', error);
        }
    }

    private async handleStartup(ctx: Context): Promise<void> {
        try {
            const userId = ctx.from!.id.toString();
            const message = ctx.message?.text || '';
            const prompt = message.replace('/startup', '').trim();

            // Check if session is active
            if (!this.xtermService.hasSession(userId)) {
                await ctx.reply(
                    '❌ No active session.\n\n' +
                    'Please start a coder first with /copilot, /claude, /gemini, or your custom coder.',
                    { parse_mode: 'Markdown' }
                );
                return;
            }

            // Get the active assistant type
            const assistantType = this.activeAssistantType;
            if (!assistantType) {
                await ctx.reply('❌ Unable to determine active coder type.');
                return;
            }

            // Handle delete
            if (prompt.toLowerCase() === 'delete') {
                this.startupPromptService.deletePrompt(this.botId, assistantType as string);
                await ctx.reply(
                    `✅ Startup prompt deleted for /${assistantType}`,
                    { parse_mode: 'Markdown' }
                );
                return;
            }

            // View current prompt
            if (!prompt) {
                const currentPrompt = this.startupPromptService.loadPrompt(this.botId, assistantType as string);
                if (currentPrompt) {
                    await ctx.reply(
                        `*Current startup prompt for /${assistantType}:*\n\n` +
                        `\`${currentPrompt}\`\n\n` +
                        '*To update:* `/startup <new prompt>`\n' +
                        '*To delete:* `/startup delete`',
                        { parse_mode: 'Markdown' }
                    );
                } else {
                    await ctx.reply(
                        `❌ No startup prompt configured for /${assistantType}.\n\n` +
                        '*Set one:* `/startup <prompt>`\n' +
                        '*Example:* `/startup resume`',
                        { parse_mode: 'Markdown' }
                    );
                }
                return;
            }

            // Save the prompt
            this.startupPromptService.savePrompt(this.botId, assistantType as string, prompt);
            await ctx.reply(
                `✅ Startup prompt saved for /${assistantType}\n\n` +
                `*Prompt:* \`${prompt}\`\n\n` +
                `This will be sent automatically when launching /${assistantType}`,
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
                    this.configService,
                    this.refreshStateService
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
            '/xterm - Start raw terminal (no AI)\n\n' +
            '*Custom Coders:*\n' +
            '/addcoder <name> - Create custom AI assistant (a-z only)\n' +
            '/removecoder <name> - Remove custom AI assistant\n\n' +
            '*Session Management:*\n' +
            '/startup [prompt] - Set/view auto-startup for current coder\n' +
            '/startup delete - Remove startup prompt\n' +
            '/close - Close the current terminal session\n\n' +
            '*Sending Commands to Terminal:*\n' +
            'Type any message (not starting with /) - Sent directly to terminal with Enter\n' +
            '.prompt or command - Place a dot to send / commands or literal prompts.\n' +
            '/keys <text> - Send text without Enter\n\n' +
            '*Tip:* Use \\[media\] in your text - it will be replaced with the media directory path\n\n' +
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
            '/1, /2, /3, /4, /5 - Send number keys\n\n' +
            '*Viewing Output:*\n' +
            '/screen - Capture and view terminal screenshot\n' +
            '/urls - Show all URLs found in terminal output\n' +
            '/projects - List and select project directories\n' +
            'Click 🔄 Refresh button on screenshots to update\n\n' +
            '*Media Upload & Download:*\n' +
            '• *Supported Upload Types:*\n' +
            '  - 📷 Photos (JPG, PNG, WebP, etc.)\n' +
            '  - 🎥 Videos (MP4, MOV, AVI, etc.)\n' +
            '  - 🎵 Audio files (MP3, WAV, AAC, etc.)\n' +
            '  - 🎤 Voice messages (OGG, etc.)\n' +
            '• Uploaded media is automatically saved to the received directory\n' +
            '• Files copied to \\[media\\] directory will be sent to you automatically\n' +
            '• Use \\[media\] in commands - e.g., "cp output.png \\[media\\]" to send files\n' +
            '• The bot watches this directory and sends any new files to you\n\n' +
            '*Other:*\n' +
            '/start - Show quick start guide\n' +
            '/help - Show this detailed help\n' +
            '/macros - Show configured message placeholders (m0-m9)\n' +
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

    private async handleProjects(ctx: Context): Promise<void> {
        try {
            const homeDir = this.configService.getHomeDirectory();
            
            const entries = await fs.promises.readdir(homeDir, { withFileTypes: true });
            const directories = entries
                .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
                .map(entry => path.join(homeDir, entry.name))
                .sort();

            if (directories.length === 0) {
                const sentMsg = await ctx.reply(
                    '📁 *No Projects Found*\n\n' +
                    `No directories found in ${homeDir}`,
                    { parse_mode: 'Markdown' }
                );
                await MessageUtils.scheduleMessageDeletion(ctx, sentMsg.message_id, this.configService);
                return;
            }

            const keyboard = new InlineKeyboard();
            
            directories.forEach((dir, index) => {
                const dirName = path.basename(dir);
                keyboard.text(dirName, `project:${dir}`);
                if ((index + 1) % 2 === 0) {
                    keyboard.row();
                }
            });
            
            if (directories.length % 2 !== 0) {
                keyboard.row();
            }
            
            keyboard.text('❌ Cancel', 'project:cancel');

            const sentMsg = await ctx.reply(
                `📁 *Select a Project* (${directories.length})\n\nChoose a directory to navigate to:`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                }
            );

            await MessageUtils.scheduleMessageDeletion(ctx, sentMsg.message_id, this.configService);
        } catch (error) {
            await ctx.reply(ErrorUtils.createErrorMessage(ErrorActions.SEND_TO_TERMINAL, error));
        }
    }

    private async handleMacros(ctx: Context): Promise<void> {
        try {
            let message = '⚙️ *Message Placeholders*\n\n';
            
            for (let i = 0; i <= 9; i++) {
                const value = this.configService.getMPlaceholder(i);
                const displayValue = value ? `\`${value}\`` : '_undefined_';
                message += `\`[m${i}]\` → ${displayValue}\n`;
            }

            const sentMsg = await ctx.reply(message, { parse_mode: 'Markdown' });
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
