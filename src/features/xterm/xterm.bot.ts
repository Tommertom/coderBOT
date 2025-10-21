import { Bot, Context, InputFile, InlineKeyboard } from 'grammy';
import { XtermService } from './xterm.service.js';
import { XtermRendererService } from './xterm-renderer.service.js';
import { AccessControlMiddleware } from '../../middleware/access-control.middleware.js';

export class XtermBot {
    private bot: Bot | null = null;
    private botId: string;
    private xtermService: XtermService;
    private xtermRendererService: XtermRendererService;

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
        xtermRendererService: XtermRendererService
    ) {
        this.botId = botId;
        this.xtermService = xtermService;
        this.xtermRendererService = xtermRendererService;
    }

    registerHandlers(bot: Bot): void {
        this.bot = bot;
        bot.command('xterm', AccessControlMiddleware.requireAccess, this.handleXterm.bind(this));
        bot.command('keys', AccessControlMiddleware.requireAccess, this.handleKeys.bind(this));
        bot.command('tab', AccessControlMiddleware.requireAccess, this.handleTab.bind(this));
        bot.command('enter', AccessControlMiddleware.requireAccess, this.handleEnter.bind(this));
        bot.command('space', AccessControlMiddleware.requireAccess, this.handleSpace.bind(this));
        bot.command('delete', AccessControlMiddleware.requireAccess, this.handleDelete.bind(this));
        bot.command('ctrl', AccessControlMiddleware.requireAccess, this.handleCtrl.bind(this));
        bot.command('ctrlc', AccessControlMiddleware.requireAccess, this.handleCtrlC.bind(this));
        bot.command('ctrlx', AccessControlMiddleware.requireAccess, this.handleCtrlX.bind(this));
        bot.command('esc', AccessControlMiddleware.requireAccess, this.handleEsc.bind(this));
        bot.command('screen', AccessControlMiddleware.requireAccess, this.handleScreen.bind(this));
        bot.command('1', AccessControlMiddleware.requireAccess, this.handleNumberKey.bind(this, '1'));
        bot.command('2', AccessControlMiddleware.requireAccess, this.handleNumberKey.bind(this, '2'));
        bot.command('3', AccessControlMiddleware.requireAccess, this.handleNumberKey.bind(this, '3'));
        bot.command('4', AccessControlMiddleware.requireAccess, this.handleNumberKey.bind(this, '4'));
        bot.command('5', AccessControlMiddleware.requireAccess, this.handleNumberKey.bind(this, '5'));
    }

    private async handleNumberKey(number: string, ctx: Context): Promise<void> {
        const userId = ctx.from!.id.toString();
        const chatId = ctx.chat!.id;

        try {
            if (!this.xtermService.hasSession(userId)) {
                await ctx.reply('❌ No active session.\n\nUse /start to create one.');
                return;
            }

            this.xtermService.writeRawToSession(userId, number);

            const sentMsg = await ctx.reply(`✅ Sent: ${number}`);

            const deleteTimeout = parseInt(process.env.MESSAGE_DELETE_TIMEOUT || '10000', 10);
            if (deleteTimeout > 0) {
                setTimeout(async () => {
                    try {
                        await ctx.api.deleteMessage(ctx.chat!.id, sentMsg.message_id);
                    } catch (error) {
                        console.error('Failed to delete message:', error);
                    }
                }, deleteTimeout);
            }
        } catch (error) {
            await ctx.reply(
                '❌ Failed to send key.\n\n' +
                `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    private async handleCtrl(ctx: Context): Promise<void> {
        const userId = ctx.from!.id.toString();
        const chatId = ctx.chat!.id;

        try {
            if (!this.xtermService.hasSession(userId)) {
                await ctx.reply('❌ No active session.\n\nUse /start to create one.');
                return;
            }

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
            const sentMsg = await ctx.reply(
                `✅ Sent Ctrl+${charDisplay.toUpperCase()}\n\nUse /screen to view the output or refresh any existing screen.`
            );

            const deleteTimeout = parseInt(process.env.MESSAGE_DELETE_TIMEOUT || '10000', 10);
            if (deleteTimeout > 0) {
                setTimeout(async () => {
                    try {
                        await ctx.api.deleteMessage(ctx.chat!.id, sentMsg.message_id);
                    } catch (error) {
                        console.error('Failed to delete message:', error);
                    }
                }, deleteTimeout);
            }
        } catch (error) {
            await ctx.reply(
                '❌ Failed to send control character.\n\n' +
                `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    private async handleXterm(ctx: Context): Promise<void> {
        const userId = ctx.from!.id.toString();
        const chatId = ctx.chat!.id;

        try {
            if (this.xtermService.hasSession(userId)) {
                await ctx.reply(
                    '⚠️ You already have an active terminal session.\n\n' +
                    'Use /close to terminate it first, or continue using it.'
                );
                return;
            }

            this.xtermService.createSession(userId, chatId);

            await ctx.reply(
                '🖥️ *Terminal Session Started*\n\n' +
                '✅ Bash session is now active.\n\n' +
                '*Available Commands:*\n' +
                '/send <text> - Send text to terminal with Enter\n' +
                'Send any message - Sent directly to terminal with Enter\n' +
                '/keys <text> - Send text without Enter\n' +
                '/tab - Send Tab character\n' +
                '/enter - Send Enter key\n' +
                '/space - Send Space character\n' +
                '/delete - Send Delete key\n' +
                '/ctrl <char> - Send Ctrl+character (e.g., /ctrl c for Ctrl+C)\n' +
                '/ctrlc - Send Ctrl+C (shortcut)\n' +
                '/ctrlx - Send Ctrl+X (shortcut)\n' +
                '/esc - Send Escape key\n' +
                '/screen - Capture terminal screenshot\n' +
                '/close - Close the terminal session\n\n' +
                '🔔 *Notifications:* You will receive automatic notifications when the terminal sends a BEL signal.\n\n' +
                '⚠️ *Security Note:* This terminal has access to the bot\'s environment. ' +
                'Be cautious with commands and avoid exposing sensitive data.',
                { parse_mode: 'Markdown' }
            );
        } catch (error) {
            await ctx.reply(
                '❌ Failed to create terminal session.\n\n' +
                `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    private async handleKeys(ctx: Context): Promise<void> {
        const userId = ctx.from!.id.toString();
        const chatId = ctx.chat!.id;

        try {
            if (!this.xtermService.hasSession(userId)) {
                await ctx.reply('❌ No active session.\n\nUse /start to create one.');
                return;
            }

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

            await ctx.reply(`✅ Sent keys: \`${keys}\`\n\nUse /screen to view the output or refresh any existing screen.`, { parse_mode: 'Markdown' });
        } catch (error) {
            await ctx.reply(
                '❌ Failed to send keys.\n\n' +
                `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    private async handleTab(ctx: Context): Promise<void> {
        const userId = ctx.from!.id.toString();
        const chatId = ctx.chat!.id;

        try {
            if (!this.xtermService.hasSession(userId)) {
                await ctx.reply('❌ No active session.\n\nUse /start to create one. Or type /help for assistance.');
                return;
            }

            this.xtermService.writeRawToSession(userId, '\t');

            const sentMsg = await ctx.reply('✅ Sent Tab character\n\nUse /screen to view the output or refresh any existing screen.');

            const deleteTimeout = parseInt(process.env.MESSAGE_DELETE_TIMEOUT || '10000', 10);
            if (deleteTimeout > 0) {
                setTimeout(async () => {
                    try {
                        await ctx.api.deleteMessage(ctx.chat!.id, sentMsg.message_id);
                    } catch (error) {
                        console.error('Failed to delete message:', error);
                    }
                }, deleteTimeout);
            }
        } catch (error) {
            await ctx.reply(
                '❌ Failed to send Tab.\n\n' +
                `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    private async handleEnter(ctx: Context): Promise<void> {
        const userId = ctx.from!.id.toString();
        const chatId = ctx.chat!.id;

        try {
            if (!this.xtermService.hasSession(userId)) {
                await ctx.reply('❌ No active session.\n\nUse /start to create one.');
                return;
            }

            this.xtermService.writeRawToSession(userId, '\r');

            const sentMsg = await ctx.reply('✅ Sent Enter key\n\nUse /screen to view the output or refresh any existing screen.');

            const deleteTimeout = parseInt(process.env.MESSAGE_DELETE_TIMEOUT || '10000', 10);
            if (deleteTimeout > 0) {
                setTimeout(async () => {
                    try {
                        await ctx.api.deleteMessage(ctx.chat!.id, sentMsg.message_id);
                    } catch (error) {
                        console.error('Failed to delete message:', error);
                    }
                }, deleteTimeout);
            }
        } catch (error) {
            await ctx.reply(
                '❌ Failed to send Enter.\n\n' +
                `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    private async handleSpace(ctx: Context): Promise<void> {
        const userId = ctx.from!.id.toString();
        const chatId = ctx.chat!.id;

        try {
            if (!this.xtermService.hasSession(userId)) {
                await ctx.reply('❌ No active session.\n\nUse /start to create one.');
                return;
            }

            this.xtermService.writeRawToSession(userId, ' ');

            const sentMsg = await ctx.reply('✅ Sent Space character\n\nUse /screen to view the output or refresh any existing screen.');

            const deleteTimeout = parseInt(process.env.MESSAGE_DELETE_TIMEOUT || '10000', 10);
            if (deleteTimeout > 0) {
                setTimeout(async () => {
                    try {
                        await ctx.api.deleteMessage(ctx.chat!.id, sentMsg.message_id);
                    } catch (error) {
                        console.error('Failed to delete message:', error);
                    }
                }, deleteTimeout);
            }
        } catch (error) {
            await ctx.reply(
                '❌ Failed to send Space.\n\n' +
                `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    private async handleDelete(ctx: Context): Promise<void> {
        const userId = ctx.from!.id.toString();
        const chatId = ctx.chat!.id;

        try {
            if (!this.xtermService.hasSession(userId)) {
                await ctx.reply('❌ No active session.\n\nUse /start to create one.');
                return;
            }

            this.xtermService.writeRawToSession(userId, '\x7f');

            const sentMsg = await ctx.reply('✅ Sent Delete key\n\nUse /screen to view the output or refresh any existing screen.');

            const deleteTimeout = parseInt(process.env.MESSAGE_DELETE_TIMEOUT || '10000', 10);
            if (deleteTimeout > 0) {
                setTimeout(async () => {
                    try {
                        await ctx.api.deleteMessage(ctx.chat!.id, sentMsg.message_id);
                    } catch (error) {
                        console.error('Failed to delete message:', error);
                    }
                }, deleteTimeout);
            }
        } catch (error) {
            await ctx.reply(
                '❌ Failed to send Delete key.\n\n' +
                `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    private async handleCtrlC(ctx: Context): Promise<void> {
        const userId = ctx.from!.id.toString();
        const chatId = ctx.chat!.id;

        try {
            if (!this.xtermService.hasSession(userId)) {
                await ctx.reply('❌ No active session.\n\nUse /start to create one.');
                return;
            }

            this.xtermService.writeRawToSession(userId, '\x03');

            const sentMsg = await ctx.reply('✅ Sent Ctrl+C - Use /screen to view the output or refresh any existing screen.');

            const deleteTimeout = parseInt(process.env.MESSAGE_DELETE_TIMEOUT || '10000', 10);
            if (deleteTimeout > 0) {
                setTimeout(async () => {
                    try {
                        await ctx.api.deleteMessage(ctx.chat!.id, sentMsg.message_id);
                    } catch (error) {
                        console.error('Failed to delete message:', error);
                    }
                }, deleteTimeout);
            }
        } catch (error) {
            await ctx.reply(
                '❌ Failed to send Ctrl+C.\n\n' +
                `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    private async handleCtrlX(ctx: Context): Promise<void> {
        const userId = ctx.from!.id.toString();
        const chatId = ctx.chat!.id;

        try {
            if (!this.xtermService.hasSession(userId)) {
                await ctx.reply('❌ No active session.\n\nUse /start to create one.');
                return;
            }

            this.xtermService.writeRawToSession(userId, '\x18');

            const sentMsg = await ctx.reply('✅ Sent Ctrl+X - Use /screen to view the output or refresh any existing screen.');

            const deleteTimeout = parseInt(process.env.MESSAGE_DELETE_TIMEOUT || '10000', 10);
            if (deleteTimeout > 0) {
                setTimeout(async () => {
                    try {
                        await ctx.api.deleteMessage(ctx.chat!.id, sentMsg.message_id);
                    } catch (error) {
                        console.error('Failed to delete message:', error);
                    }
                }, deleteTimeout);
            }
        } catch (error) {
            await ctx.reply(
                '❌ Failed to send Ctrl+X.\n\n' +
                `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    private async handleEsc(ctx: Context): Promise<void> {
        const userId = ctx.from!.id.toString();
        const chatId = ctx.chat!.id;

        try {
            if (!this.xtermService.hasSession(userId)) {
                await ctx.reply('❌ No active session.\n\nUse /start to create one.');
                return;
            }

            this.xtermService.writeRawToSession(userId, '\x1b');

            const sentMsg = await ctx.reply('✅ Sent Escape key - Use /screen to view the output or refresh any existing screen.');

            const deleteTimeout = parseInt(process.env.MESSAGE_DELETE_TIMEOUT || '10000', 10);
            if (deleteTimeout > 0) {
                setTimeout(async () => {
                    try {
                        await ctx.api.deleteMessage(ctx.chat!.id, sentMsg.message_id);
                    } catch (error) {
                        console.error('Failed to delete message:', error);
                    }
                }, deleteTimeout);
            }
        } catch (error) {
            await ctx.reply(
                '❌ Failed to send Escape key.\n\n' +
                `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    private async handleScreen(ctx: Context): Promise<void> {
        const userId = ctx.from!.id.toString();
        const chatId = ctx.chat!.id;

        try {
            if (!this.xtermService.hasSession(userId)) {
                await ctx.reply('❌ No active session.\n\nUse /start to create one.');
                return;
            }

            const statusMsg = await ctx.reply('📸 Capturing terminal screen...');

            const outputBuffer = this.xtermService.getSessionOutputBuffer(userId);
            const dimensions = this.xtermService.getSessionDimensions(userId);

            const imageBuffer = await this.xtermRendererService.renderToImage(
                outputBuffer,
                dimensions.rows,
                dimensions.cols
            );

            await ctx.api.deleteMessage(ctx.chat!.id, statusMsg.message_id);

            const keyboard = new InlineKeyboard().text('🔄 Refresh', 'refresh_screen');

            const sentMessage = await ctx.replyWithPhoto(new InputFile(imageBuffer), {
                reply_markup: keyboard,
            });

            // Store the message ID for future updates
            this.xtermService.setLastScreenshotMessageId(userId, sentMessage.message_id);
        } catch (error) {
            await ctx.reply(
                '❌ Failed to capture terminal screen.\n\n' +
                `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }
}
