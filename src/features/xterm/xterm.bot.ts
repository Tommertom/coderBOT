import { Bot, Context, InputFile, InlineKeyboard } from 'grammy';
import { XtermService } from './xterm.service.js';
import { XtermRendererService } from './xterm-renderer.service.js';
import { ConfigService } from '../../services/config.service.js';
import { StartupPromptService } from '../../services/startup-prompt.service.js';
import { AccessControlMiddleware } from '../../middleware/access-control.middleware.js';
import { MessageUtils } from '../../utils/message.utils.js';
import { ErrorUtils } from '../../utils/error.utils.js';
import { ScreenRefreshUtils } from '../../utils/screen-refresh.utils.js';
import { CommandMenuUtils } from '../../utils/command-menu.utils.js';
import { Messages, SuccessMessages, ErrorActions } from '../../constants/messages.js';

export class XtermBot {
    private bot: Bot | null = null;
    private botId: string;
    private xtermService: XtermService;
    private xtermRendererService: XtermRendererService;
    private configService: ConfigService;
    private startupPromptService: StartupPromptService;

    private readonly CTRL_MAPPINGS: Record<string, string> = {
        '@': '\x00',
        'a': '\x01',
        'b': '\x02',
        'c': '\x03',
        'd': '\x04',
        'e': '\x05',
        'f': '\x06',
        'g': '\x07',
        'h': '\x08',
        'i': '\x09',
        'j': '\x0a',
        'k': '\x0b',
        'l': '\x0c',
        'm': '\x0d',
        'n': '\x0e',
        'o': '\x0f',
        'p': '\x10',
        'q': '\x11',
        'r': '\x12',
        's': '\x13',
        't': '\x14',
        'u': '\x15',
        'v': '\x16',
        'w': '\x17',
        'x': '\x18',
        'y': '\x19',
        'z': '\x1a',
        '[': '\x1b',
        '\\': '\x1c',
        ']': '\x1d',
        '^': '\x1e',
        '_': '\x1f',
        '?': '\x7f',
    };

    constructor(
        botId: string,
        xtermService: XtermService,
        xtermRendererService: XtermRendererService,
        configService: ConfigService
    ) {
        this.botId = botId;
        this.xtermService = xtermService;
        this.xtermRendererService = xtermRendererService;
        this.configService = configService;
        this.startupPromptService = new StartupPromptService();
    }

    registerHandlers(bot: Bot): void {
        this.bot = bot;
        bot.command('xterm', AccessControlMiddleware.requireAccess, this.handleXterm.bind(this));
        bot.command('copilot', AccessControlMiddleware.requireAccess, this.handleCopilot.bind(this));
        bot.command('claude', AccessControlMiddleware.requireAccess, this.handleClaude.bind(this));
        bot.command('gemini', AccessControlMiddleware.requireAccess, this.handleGemini.bind(this));
        bot.command('startup', AccessControlMiddleware.requireAccess, this.handleStartup.bind(this));
        bot.command('keys', AccessControlMiddleware.requireAccess, this.handleKeys.bind(this));
        bot.command('tab', AccessControlMiddleware.requireAccess, this.handleTab.bind(this));
        bot.command('enter', AccessControlMiddleware.requireAccess, this.handleEnter.bind(this));
        bot.command('space', AccessControlMiddleware.requireAccess, this.handleSpace.bind(this));
        bot.command('delete', AccessControlMiddleware.requireAccess, this.handleDelete.bind(this));
        bot.command('ctrl', AccessControlMiddleware.requireAccess, this.handleCtrl.bind(this));
        bot.command('ctrlc', AccessControlMiddleware.requireAccess, this.handleCtrlC.bind(this));
        bot.command('ctrlx', AccessControlMiddleware.requireAccess, this.handleCtrlX.bind(this));
        bot.command('esc', AccessControlMiddleware.requireAccess, this.handleEsc.bind(this));
        bot.command('arrowup', AccessControlMiddleware.requireAccess, this.handleArrowUp.bind(this));
        bot.command('arrowdown', AccessControlMiddleware.requireAccess, this.handleArrowDown.bind(this));
        bot.command('screen', AccessControlMiddleware.requireAccess, this.handleScreen.bind(this));
        bot.command('urls', AccessControlMiddleware.requireAccess, this.handleUrls.bind(this));
        bot.command('1', AccessControlMiddleware.requireAccess, this.handleNumberKey.bind(this, '1'));
        bot.command('2', AccessControlMiddleware.requireAccess, this.handleNumberKey.bind(this, '2'));
        bot.command('3', AccessControlMiddleware.requireAccess, this.handleNumberKey.bind(this, '3'));
        bot.command('4', AccessControlMiddleware.requireAccess, this.handleNumberKey.bind(this, '4'));
        bot.command('5', AccessControlMiddleware.requireAccess, this.handleNumberKey.bind(this, '5'));
        bot.on('callback_query:data', AccessControlMiddleware.requireAccess, this.handleCallbackQuery.bind(this));
        bot.on('message:text', AccessControlMiddleware.requireAccess, this.handleTextMessage.bind(this));
    }

    /**
     * Helper method to require an active session before executing handler logic
     */
    private async requireActiveSession(
        ctx: Context,
        userId: string,
        action: () => Promise<void>
    ): Promise<void> {
        if (!this.xtermService.hasSession(userId)) {
            await ctx.reply(Messages.NO_ACTIVE_SESSION);
            return;
        }
        await action();
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
                        this.xtermService.clearUrlNotificationTimeout(userId, sentMsg.message_id);
                    } catch (error) {
                        console.error('Failed to delete URL notification message:', error);
                    }
                }, deleteTimeout);

                this.xtermService.setUrlNotificationTimeout(userId, sentMsg.message_id, timeout);
            }
        } catch (error) {
            console.error('Failed to send URL notification:', error);
        }
    }

    /**
     * Callback for handling when buffer stops changing (debugging/testing)
     */
    private async handleBufferingEnded(userId: string, chatId: number): Promise<void> {
        if (!this.bot) {
            return;
        }

        try {
            const sentMsg = await this.bot.api.sendMessage(
                chatId,
                '🔄 *Buffering ended*\n\nTerminal output has not changed for 5 seconds.',
                { parse_mode: 'Markdown' }
            );

            // Schedule message deletion at half timeout (like spawning messages)
            const deleteTimeout = this.configService.getMessageDeleteTimeout();
            if (deleteTimeout > 0) {
                setTimeout(async () => {
                    try {
                        await this.bot?.api.deleteMessage(chatId, sentMsg.message_id);
                    } catch (error) {
                        console.error('Failed to delete buffering ended message:', error);
                    }
                }, deleteTimeout / 2);
            }
        } catch (error) {
            console.error('Failed to send buffering ended notification:', error);
        }
    }

    private async handleNumberKey(number: string, ctx: Context): Promise<void> {
        const userId = ctx.from!.id.toString();
        const chatId = ctx.chat!.id;

        await this.requireActiveSession(ctx, userId, async () => {
            try {
                this.xtermService.writeRawToSession(userId, number);
                const sentMsg = await ctx.reply(SuccessMessages.SENT(number));
                await MessageUtils.scheduleMessageDeletion(ctx, sentMsg.message_id, this.configService);
                this.triggerAutoRefresh(userId, chatId);
            } catch (error) {
                await ctx.reply(ErrorUtils.createErrorMessage(ErrorActions.SEND_KEY, error));
            }
        });
    }

    private async handleCtrl(ctx: Context): Promise<void> {
        const userId = ctx.from!.id.toString();
        const chatId = ctx.chat!.id;

        await this.requireActiveSession(ctx, userId, async () => {
            try {
                const message = ctx.message?.text || '';
                const char = message.replace('/ctrl', '').trim().toLowerCase();

                if (!char || char.length !== 1) {
                    const availableKeys = Object.keys(this.CTRL_MAPPINGS).sort().join(', ');
                    await ctx.reply(
                        '⚠️ Please provide exactly one character.\n\n' +
                        '*Usage:* `/ctrl <character>`\n' +
                        '*Example:* `/ctrl c` (sends Ctrl+C)\n\n' +
                        `*Available characters:*\n\`${availableKeys}\`\n\n` +
                        '*Common mappings:*\n' +
                        '• `@` - Ctrl+@ (NUL)\n' +
                        '• `a-z` - Ctrl+A through Ctrl+Z\n' +
                        '• `[` - Ctrl+[ (Escape)\n' +
                        '• `\\` - Ctrl+\\\n' +
                        '• `]` - Ctrl+]\n' +
                        '• `^` - Ctrl+^\n' +
                        '• `_` - Ctrl+_\n' +
                        '• `?` - Ctrl+? (Delete)',
                        { parse_mode: 'Markdown' }
                    );
                    return;
                }

                const controlCode = this.CTRL_MAPPINGS[char];
                if (!controlCode) {
                    const availableKeys = Object.keys(this.CTRL_MAPPINGS).sort().join(', ');
                    await ctx.reply(
                        `❌ Invalid control character: \`${char}\`\n\n` +
                        `*Available characters:* \`${availableKeys}\``,
                        { parse_mode: 'Markdown' }
                    );
                    return;
                }

                this.xtermService.writeRawToSession(userId, controlCode);

                const charDisplay = char === '\\' ? '\\\\' : char;
                const sentMsg = await ctx.reply(SuccessMessages.SENT_CONTROL_KEY(charDisplay.toUpperCase()));

                await MessageUtils.scheduleMessageDeletion(ctx, sentMsg.message_id, this.configService);
                this.triggerAutoRefresh(userId, chatId);
            } catch (error) {
                await ctx.reply(ErrorUtils.createErrorMessage(ErrorActions.SEND_CONTROL_CHARACTER, error));
            }
        });
    }

    private async handleXterm(ctx: Context): Promise<void> {
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
            const deleteTimeout = this.configService.getMessageDeleteTimeout();
            if (deleteTimeout > 0) {
                setTimeout(async () => {
                    try {
                        await ctx.api.deleteMessage(chatId, spawningMsg.message_id);
                    } catch (error) {
                        console.error('Failed to delete spawning message:', error);
                    }
                }, deleteTimeout / 2);
            }

            // Create session with URL notification callback if enabled
            this.xtermService.createSession(
                userId,
                chatId,
                undefined,
                this.handleUrlDiscovered.bind(this),
                this.handleBufferingEnded.bind(this)
            );

            // Update command menu to show /close instead of AI assistants
            if (this.bot) {
                await CommandMenuUtils.setSessionCommands(this.bot);
            }

            await new Promise(resolve => setTimeout(resolve, 500));

            // Send initial screenshot showing the bash prompt
            await this.sendSessionScreenshot(ctx, userId);
        } catch (error) {
            await ctx.reply(ErrorUtils.createErrorMessage(ErrorActions.START_TERMINAL, error));
        }
    }

    private async handleKeys(ctx: Context): Promise<void> {
        const userId = ctx.from!.id.toString();
        const chatId = ctx.chat!.id;

        await this.requireActiveSession(ctx, userId, async () => {
            try {
                const message = ctx.message?.text || '';
                const keys = message.replace('/keys', '').trim();

                if (!keys) {
                    await ctx.reply(
                        '⚠️ Please provide keys to send.\n\n' +
                        '*Usage:* `/keys <text>`\n' +
                        '*Example:* `/keys hello`\n\n' +
                        'Sends keys without pressing Enter.',
                        { parse_mode: 'Markdown' }
                    );
                    return;
                }

                this.xtermService.writeRawToSession(userId, keys);

                const sentMsg = await ctx.reply(`✅ Sent keys: \`${keys}\`\n\n${Messages.VIEW_SCREEN_HINT}`, { parse_mode: 'Markdown' });
                await MessageUtils.scheduleMessageDeletion(ctx, sentMsg.message_id, this.configService);
                this.triggerAutoRefresh(userId, chatId);
            } catch (error) {
                await ctx.reply(ErrorUtils.createErrorMessage(ErrorActions.SEND_KEYS, error));
            }
        });
    }

    private async handleTab(ctx: Context): Promise<void> {
        const userId = ctx.from!.id.toString();
        const chatId = ctx.chat!.id;

        await this.requireActiveSession(ctx, userId, async () => {
            try {
                this.xtermService.writeRawToSession(userId, '\t');
                const sentMsg = await ctx.reply(SuccessMessages.SENT_SPECIAL_KEY('Tab character'));
                await MessageUtils.scheduleMessageDeletion(ctx, sentMsg.message_id, this.configService);
                this.triggerAutoRefresh(userId, chatId);
            } catch (error) {
                await ctx.reply(ErrorUtils.createErrorMessage(ErrorActions.SEND_TAB, error));
            }
        });
    }

    private async handleEnter(ctx: Context): Promise<void> {
        const userId = ctx.from!.id.toString();
        const chatId = ctx.chat!.id;

        await this.requireActiveSession(ctx, userId, async () => {
            try {
                this.xtermService.writeRawToSession(userId, '\r');
                const sentMsg = await ctx.reply(SuccessMessages.SENT_SPECIAL_KEY('Enter key'));
                await MessageUtils.scheduleMessageDeletion(ctx, sentMsg.message_id, this.configService);
                this.triggerAutoRefresh(userId, chatId);
            } catch (error) {
                await ctx.reply(ErrorUtils.createErrorMessage(ErrorActions.SEND_ENTER, error));
            }
        });
    }

    private async handleSpace(ctx: Context): Promise<void> {
        const userId = ctx.from!.id.toString();
        const chatId = ctx.chat!.id;

        await this.requireActiveSession(ctx, userId, async () => {
            try {
                this.xtermService.writeRawToSession(userId, ' ');
                const sentMsg = await ctx.reply(SuccessMessages.SENT_SPECIAL_KEY('Space character'));
                await MessageUtils.scheduleMessageDeletion(ctx, sentMsg.message_id, this.configService);
                this.triggerAutoRefresh(userId, chatId);
            } catch (error) {
                await ctx.reply(ErrorUtils.createErrorMessage(ErrorActions.SEND_SPACE, error));
            }
        });
    }

    private async handleDelete(ctx: Context): Promise<void> {
        const userId = ctx.from!.id.toString();
        const chatId = ctx.chat!.id;

        await this.requireActiveSession(ctx, userId, async () => {
            try {
                this.xtermService.writeRawToSession(userId, '\x7f');
                const sentMsg = await ctx.reply(SuccessMessages.SENT_SPECIAL_KEY('Delete key'));
                await MessageUtils.scheduleMessageDeletion(ctx, sentMsg.message_id, this.configService);
                this.triggerAutoRefresh(userId, chatId);
            } catch (error) {
                await ctx.reply(ErrorUtils.createErrorMessage(ErrorActions.SEND_DELETE, error));
            }
        });
    }

    private async handleCtrlC(ctx: Context): Promise<void> {
        const userId = ctx.from!.id.toString();
        const chatId = ctx.chat!.id;

        await this.requireActiveSession(ctx, userId, async () => {
            try {
                this.xtermService.writeRawToSession(userId, '\x03');
                const sentMsg = await ctx.reply(SuccessMessages.SENT_CONTROL_KEY('C'));
                await MessageUtils.scheduleMessageDeletion(ctx, sentMsg.message_id, this.configService);
                this.triggerAutoRefresh(userId, chatId);
            } catch (error) {
                await ctx.reply(ErrorUtils.createErrorMessage(ErrorActions.SEND_CTRL_C, error));
            }
        });
    }

    private async handleCtrlX(ctx: Context): Promise<void> {
        const userId = ctx.from!.id.toString();
        const chatId = ctx.chat!.id;

        await this.requireActiveSession(ctx, userId, async () => {
            try {
                this.xtermService.writeRawToSession(userId, '\x18');
                const sentMsg = await ctx.reply(SuccessMessages.SENT_CONTROL_KEY('X'));
                await MessageUtils.scheduleMessageDeletion(ctx, sentMsg.message_id, this.configService);
                this.triggerAutoRefresh(userId, chatId);
            } catch (error) {
                await ctx.reply(ErrorUtils.createErrorMessage(ErrorActions.SEND_CTRL_X, error));
            }
        });
    }

    private async handleEsc(ctx: Context): Promise<void> {
        const userId = ctx.from!.id.toString();
        const chatId = ctx.chat!.id;

        await this.requireActiveSession(ctx, userId, async () => {
            try {
                this.xtermService.writeRawToSession(userId, '\x1b');
                const sentMsg = await ctx.reply(SuccessMessages.SENT_SPECIAL_KEY('Escape key'));
                await MessageUtils.scheduleMessageDeletion(ctx, sentMsg.message_id, this.configService);
                this.triggerAutoRefresh(userId, chatId);
            } catch (error) {
                await ctx.reply(ErrorUtils.createErrorMessage(ErrorActions.SEND_ESCAPE, error));
            }
        });
    }

    private async handleArrowUp(ctx: Context): Promise<void> {
        const userId = ctx.from!.id.toString();
        const chatId = ctx.chat!.id;

        await this.requireActiveSession(ctx, userId, async () => {
            try {
                this.xtermService.writeRawToSession(userId, '\x1b[A');
                const sentMsg = await ctx.reply(SuccessMessages.SENT_SPECIAL_KEY('Arrow Up key'));
                await MessageUtils.scheduleMessageDeletion(ctx, sentMsg.message_id, this.configService);
                this.triggerAutoRefresh(userId, chatId);
            } catch (error) {
                await ctx.reply(ErrorUtils.createErrorMessage(ErrorActions.SEND_KEY, error));
            }
        });
    }

    private async handleArrowDown(ctx: Context): Promise<void> {
        const userId = ctx.from!.id.toString();
        const chatId = ctx.chat!.id;

        await this.requireActiveSession(ctx, userId, async () => {
            try {
                this.xtermService.writeRawToSession(userId, '\x1b[B');
                const sentMsg = await ctx.reply(SuccessMessages.SENT_SPECIAL_KEY('Arrow Down key'));
                await MessageUtils.scheduleMessageDeletion(ctx, sentMsg.message_id, this.configService);
                this.triggerAutoRefresh(userId, chatId);
            } catch (error) {
                await ctx.reply(ErrorUtils.createErrorMessage(ErrorActions.SEND_KEY, error));
            }
        });
    }

    private async handleScreen(ctx: Context): Promise<void> {
        const userId = ctx.from!.id.toString();

        await this.requireActiveSession(ctx, userId, async () => {
            try {
                const statusMsg = await ctx.reply(Messages.CAPTURING_SCREEN);

                const outputBuffer = this.xtermService.getSessionOutputBuffer(userId);
                const dimensions = this.xtermService.getSessionDimensions(userId);

                const imageBuffer = await this.xtermRendererService.renderToImage(
                    outputBuffer,
                    dimensions.rows,
                    dimensions.cols
                );

                try {
                    await ctx.api.deleteMessage(ctx.chat!.id, statusMsg.message_id);
                } catch (error) {
                    console.error('Failed to delete status message:', error);
                }

                const keyboard = ScreenRefreshUtils.createScreenKeyboard();

                const sentMessage = await ctx.replyWithPhoto(new InputFile(imageBuffer), {
                    reply_markup: keyboard,
                });

                this.xtermService.setLastScreenshotMessageId(userId, sentMessage.message_id);
            } catch (error) {
                await ctx.reply(ErrorUtils.createErrorMessage(ErrorActions.CAPTURE_SCREEN, error));
            }
        });
    }

    private async handleUrls(ctx: Context): Promise<void> {
        const userId = ctx.from!.id.toString();

        await this.requireActiveSession(ctx, userId, async () => {
            try {
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
                await ctx.reply(ErrorUtils.createErrorMessage(ErrorActions.SEND_KEY, error));
            }
        });
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

    /**
     * Generic handler for AI assistant commands (copilot, claude, gemini)
     */
    private async handleAIAssistant(
        ctx: Context,
        assistantType: 'copilot' | 'claude' | 'gemini'
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
            const deleteTimeout = this.configService.getMessageDeleteTimeout();
            if (deleteTimeout > 0) {
                setTimeout(async () => {
                    try {
                        await ctx.api.deleteMessage(chatId, spawningMsg.message_id);
                    } catch (error) {
                        console.error('Failed to delete spawning message:', error);
                    }
                }, deleteTimeout / 2);
            }

            // Create session with URL notification callback if enabled
            this.xtermService.createSession(
                userId,
                chatId,
                undefined,
                this.handleUrlDiscovered.bind(this),
                this.handleBufferingEnded.bind(this)
            );

            // Update command menu to show /close instead of AI assistants
            if (this.bot) {
                await CommandMenuUtils.setSessionCommands(this.bot);
            }

            await new Promise(resolve => setTimeout(resolve, 500));

            // Automatically run the AI assistant command
            this.xtermService.writeToSession(userId, assistantType);

            await new Promise(resolve => setTimeout(resolve, 2000));

            // Send initial screenshot
            await this.sendSessionScreenshot(ctx, userId);

            // Load and send startup prompt after 3 seconds (only for copilot)
            if (assistantType === 'copilot') {
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
        await this.handleAIAssistant(ctx, 'copilot');
    }

    private async handleClaude(ctx: Context): Promise<void> {
        await this.handleAIAssistant(ctx, 'claude');
    }

    private async handleGemini(ctx: Context): Promise<void> {
        await this.handleAIAssistant(ctx, 'gemini');
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
                await this.safeAnswerCallbackQuery(ctx, '❌ Unknown option');
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            const maxLength = 185;
            const truncatedMsg = errorMsg.length > maxLength ? errorMsg.substring(0, maxLength) + '...' : errorMsg;
            try {
                await ctx.answerCallbackQuery({ text: `❌ ${truncatedMsg}` });
            } catch (answerError) {
                try {
                    await ctx.answerCallbackQuery({ text: '❌ Operation failed' });
                } catch (finalError) {
                    console.error('Failed to answer callback query even with minimal message:', finalError);
                }
            }
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

            this.xtermService.writeRawToSession(userId, text);

            await new Promise(resolve => setTimeout(resolve, 50));

            this.xtermService.writeRawToSession(userId, '\r');

            const sentMsg = await ctx.reply(`✅ Sent - ${Messages.VIEW_SCREEN_HINT}`);

            await MessageUtils.scheduleMessageDeletion(ctx, sentMsg.message_id, this.configService);

            this.triggerAutoRefresh(userId, chatId);
        } catch (error) {
            await ctx.reply(ErrorUtils.createErrorMessage(ErrorActions.SEND_TO_TERMINAL, error));
        }
    }
}
