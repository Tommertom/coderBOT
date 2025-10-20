import { Bot, Context, InlineKeyboard, InputFile, Keyboard } from 'grammy';
import { xtermService } from '../xterm/xterm.service.js';
import { xtermRendererService } from '../xterm/xterm-renderer.service.js';
import { coderService } from './coder.service.js';
import { AccessControlMiddleware } from '../../middleware/access-control.middleware.js';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

export class CoderBot {
    private bot: Bot | null = null;
    private botId: string;
    private mediaPath: string;
    private receivedPath: string;

    constructor(botId: string) {
        this.botId = botId;
        this.mediaPath = coderService.getMediaPath();
        this.receivedPath = coderService.getReceivedPath();
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
        bot.command('coder', AccessControlMiddleware.requireAccess, this.handleCoder.bind(this));
        bot.command('close', AccessControlMiddleware.requireAccess, this.handleClose.bind(this));
        bot.command('killbot', AccessControlMiddleware.requireAccess, this.handleKillbot.bind(this));
        bot.on('callback_query:data', AccessControlMiddleware.requireAccess, this.handleCallbackQuery.bind(this));
        bot.on('message:photo', AccessControlMiddleware.requireAccess, this.handlePhoto.bind(this));
        bot.on('message:text', AccessControlMiddleware.requireAccess, this.handleTextMessage.bind(this));
    }

    private async refreshScreen(userId: string, chatId: number): Promise<void> {
        if (!xtermService.hasSession(this.botId, userId)) {
            return;
        }

        try {
            const outputBuffer = xtermService.getSessionOutputBuffer(this.botId, userId);
            const dimensions = xtermService.getSessionDimensions(this.botId, userId);

            const imageBuffer = await xtermRendererService.renderToImage(
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
            const lastMessageId = xtermService.getLastScreenshotMessageId(this.botId, userId);

            if (lastMessageId) {
                // Update the existing screenshot
                const outputBuffer = xtermService.getSessionOutputBuffer(this.botId, userId);
                const dimensions = xtermService.getSessionDimensions(this.botId, userId);

                const imageBuffer = await xtermRendererService.renderToImage(
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
            const outputBuffer = xtermService.getSessionOutputBuffer(this.botId, userId);

            // Extract numbered options from the terminal output
            const fullOutput = outputBuffer.join('');
            const options: string[] = [];

            // Match patterns like "1. Text" or "2, Text" followed by the option description
            const optionRegex = /^\s*(\d+)[.,]\s+(.+?)$/gm;
            let match;

            while ((match = optionRegex.exec(fullOutput)) !== null) {
                const number = match[1];
                const description = match[2].trim();
                if (number && description) {
                    options.push(`/${number} - ${description}`);
                }
            }

            // Build message with extracted options or fallback to generic list
            let message = '⚠️ Confirmation Required\n\nPlease select an option:';
            if (options.length > 0) {
                message += '\n' + options.join('\n');
            } else {
                message += '\n/1\t\t/2\t\t/3\t\t/4\t\t/5';
            }

            await this.bot.api.sendMessage(chatId, message);
        } catch (error) {
            console.error(`Failed to send confirmation notification: ${error}`);
        }
    }

    private async handleCallbackQuery(ctx: Context): Promise<void> {
        const callbackData = ctx.callbackQuery?.data;

        if (!callbackData) {
            try {
                await ctx.answerCallbackQuery({ text: '❌ Invalid callback' });
            } catch (e) {
                console.error('Failed to answer callback query:', e);
            }
            return;
        }

        const userId = ctx.from!.id.toString();

        const chatId = ctx.chat!.id;

        try {
            if (callbackData === 'refresh_screen') {
                if (!xtermService.hasSession(this.botId, userId)) {
                    try {
                        await ctx.answerCallbackQuery({ text: '❌ No active terminal session' });
                    } catch (e) {
                        console.error('Failed to answer callback query:', e);
                    }
                    return;
                }

                try {
                    await ctx.answerCallbackQuery({ text: '🔄 Refreshing...' });
                } catch (e) {
                    console.error('Failed to answer callback query:', e);
                }

                const outputBuffer = xtermService.getSessionOutputBuffer(this.botId, userId);
                const dimensions = xtermService.getSessionDimensions(this.botId, userId);

                const imageBuffer = await xtermRendererService.renderToImage(
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

            if (!xtermService.hasSession(this.botId, userId)) {
                try {
                    await ctx.answerCallbackQuery({ text: '❌ No active terminal session' });
                } catch (e) {
                    console.error('Failed to answer callback query:', e);
                }
                return;
            }

            if (callbackData.match(/^\/[1-5]$/)) {
                const number = callbackData.substring(1);
                xtermService.writeRawToSession(this.botId, userId, number);
                try {
                    await ctx.answerCallbackQuery({ text: `✅ Sent: ${number}` });
                } catch (e) {
                    console.error('Failed to answer callback query:', e);
                }
            } else if (callbackData.startsWith('/')) {
                const command = callbackData.substring(1);
                xtermService.writeToSession(this.botId, userId, command);
                try {
                    await ctx.answerCallbackQuery({ text: `✅ Executed: /${command}` });
                } catch (e) {
                    console.error('Failed to answer callback query:', e);
                }
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

            const token = process.env.TELEGRAM_BOT_TOKEN!;
            const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

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
            if (!xtermService.hasSession(this.botId, userId)) {
                await ctx.reply('❌ No active session.\n\nUse /start to create one.');
                return;
            }

            const processedText = coderService.replaceMediaPlaceholder(text);

            xtermService.writeRawToSession(this.botId, userId, processedText);

            await new Promise(resolve => setTimeout(resolve, 50));

            xtermService.writeRawToSession(this.botId, userId, '\r');

            const sentMsg = await ctx.reply('✅ Sent - Use /screen to view the output or refresh any existing screen.');

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
                '❌ Failed to send to terminal.\n\n' +
                `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    private async handleCopilot(ctx: Context): Promise<void> {
        const userId = ctx.from!.id.toString();
        const chatId = ctx.chat!.id;

        try {
            if (xtermService.hasSession(this.botId, userId)) {
                await ctx.reply(
                    '⚠️ You already have an active terminal session.\n\n' +
                    'Use /close to terminate it first, or continue using it.'
                );
                return;
            }

            const message = ctx.message?.text || '';
            const directory = message.replace('/copilot', '').trim();

            if (directory) {
                const sanitizedDir = directory.replace(/[;&|`$()]/g, '');
                if (sanitizedDir !== directory) {
                    await ctx.reply('❌ Invalid directory path. Special characters are not allowed.');
                    return;
                }

                if (!fs.existsSync(sanitizedDir)) {
                    await ctx.reply(`❌ Directory does not exist: ${sanitizedDir}`);
                    return;
                }

                const stat = fs.statSync(sanitizedDir);
                if (!stat.isDirectory()) {
                    await ctx.reply(`❌ Path is not a directory: ${sanitizedDir}`);
                    return;
                }
            }

            const dataHandler = coderService.createTerminalDataHandler({
                onBell: this.handleBellNotification.bind(this),
                onConfirmationPrompt: this.handleConfirmNotification.bind(this),
            });

            xtermService.createSession(this.botId, userId, chatId, dataHandler);

            await new Promise(resolve => setTimeout(resolve, 500));

            if (directory) {
                xtermService.writeToSession(this.botId, userId, `cd ${directory} && copilot`);
            } else {
                xtermService.writeToSession(this.botId, userId, 'copilot');
            }

            await new Promise(resolve => setTimeout(resolve, 2000));

            const outputBuffer = xtermService.getSessionOutputBuffer(this.botId, userId);
            const dimensions = xtermService.getSessionDimensions(this.botId, userId);

            const imageBuffer = await xtermRendererService.renderToImage(
                outputBuffer,
                dimensions.rows,
                dimensions.cols
            );

            const inlineKeyboard = new InlineKeyboard().text('🔄 Refresh', 'refresh_screen');
            const replyKeyboard = new Keyboard()
                .text('/1').text('/2').text('/3')
                .resized()
                .persistent();

            const sentMessage = await ctx.replyWithPhoto(new InputFile(imageBuffer), {
                reply_markup: inlineKeyboard,
            });

            // Store the message ID for future updates
            xtermService.setLastScreenshotMessageId(this.botId, userId, sentMessage.message_id);
        } catch (error) {
            await ctx.reply(
                '❌ Failed to start terminal session.\n\n' +
                `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    private async handleClaude(ctx: Context): Promise<void> {
        const userId = ctx.from!.id.toString();
        const chatId = ctx.chat!.id;

        try {
            if (xtermService.hasSession(this.botId, userId)) {
                await ctx.reply(
                    '⚠️ You already have an active terminal session.\n\n' +
                    'Use /close to terminate it first, or continue using it.'
                );
                return;
            }

            const message = ctx.message?.text || '';
            const directory = message.replace('/claude', '').trim();

            if (directory) {
                const sanitizedDir = directory.replace(/[;&|`$()]/g, '');
                if (sanitizedDir !== directory) {
                    await ctx.reply('❌ Invalid directory path. Special characters are not allowed.');
                    return;
                }

                if (!fs.existsSync(sanitizedDir)) {
                    await ctx.reply(`❌ Directory does not exist: ${sanitizedDir}`);
                    return;
                }

                const stat = fs.statSync(sanitizedDir);
                if (!stat.isDirectory()) {
                    await ctx.reply(`❌ Path is not a directory: ${sanitizedDir}`);
                    return;
                }
            }

            const dataHandler = coderService.createTerminalDataHandler({
                onBell: this.handleBellNotification.bind(this),
                onConfirmationPrompt: this.handleConfirmNotification.bind(this),
            });

            xtermService.createSession(this.botId, userId, chatId, dataHandler);

            await new Promise(resolve => setTimeout(resolve, 500));

            if (directory) {
                xtermService.writeToSession(this.botId, userId, `cd ${directory} && claude`);
            } else {
                xtermService.writeToSession(this.botId, userId, 'claude');
            }

            await new Promise(resolve => setTimeout(resolve, 2000));

            const outputBuffer = xtermService.getSessionOutputBuffer(this.botId, userId);
            const dimensions = xtermService.getSessionDimensions(this.botId, userId);

            const imageBuffer = await xtermRendererService.renderToImage(
                outputBuffer,
                dimensions.rows,
                dimensions.cols
            );

            const inlineKeyboard = new InlineKeyboard().text('🔄 Refresh', 'refresh_screen');
            const replyKeyboard = new Keyboard()
                .text('/1').text('/2').text('/3')
                .resized()
                .persistent();

            const sentMessage = await ctx.replyWithPhoto(new InputFile(imageBuffer), {
                reply_markup: inlineKeyboard,
            });

            // Store the message ID for future updates
            xtermService.setLastScreenshotMessageId(this.botId, userId, sentMessage.message_id);
        } catch (error) {
            await ctx.reply(
                '❌ Failed to start terminal session.\n\n' +
                `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    private async handleCursor(ctx: Context): Promise<void> {
        const userId = ctx.from!.id.toString();
        const chatId = ctx.chat!.id;

        try {
            if (xtermService.hasSession(this.botId, userId)) {
                await ctx.reply(
                    '⚠️ You already have an active terminal session.\n\n' +
                    'Use /close to terminate it first, or continue using it.'
                );
                return;
            }

            const message = ctx.message?.text || '';
            const directory = message.replace('/cursor', '').trim();

            if (directory) {
                const sanitizedDir = directory.replace(/[;&|`$()]/g, '');
                if (sanitizedDir !== directory) {
                    await ctx.reply('❌ Invalid directory path. Special characters are not allowed.');
                    return;
                }

                if (!fs.existsSync(sanitizedDir)) {
                    await ctx.reply(`❌ Directory does not exist: ${sanitizedDir}`);
                    return;
                }

                const stat = fs.statSync(sanitizedDir);
                if (!stat.isDirectory()) {
                    await ctx.reply(`❌ Path is not a directory: ${sanitizedDir}`);
                    return;
                }
            }

            const dataHandler = coderService.createTerminalDataHandler({
                onBell: this.handleBellNotification.bind(this),
                onConfirmationPrompt: this.handleConfirmNotification.bind(this),
            });

            xtermService.createSession(this.botId, userId, chatId, dataHandler);

            await new Promise(resolve => setTimeout(resolve, 500));

            if (directory) {
                xtermService.writeToSession(this.botId, userId, `cd ${directory} && cursor`);
            } else {
                xtermService.writeToSession(this.botId, userId, 'cursor');
            }

            await new Promise(resolve => setTimeout(resolve, 2000));

            const outputBuffer = xtermService.getSessionOutputBuffer(this.botId, userId);
            const dimensions = xtermService.getSessionDimensions(this.botId, userId);

            const imageBuffer = await xtermRendererService.renderToImage(
                outputBuffer,
                dimensions.rows,
                dimensions.cols
            );

            const inlineKeyboard = new InlineKeyboard().text('🔄 Refresh', 'refresh_screen');
            const replyKeyboard = new Keyboard()
                .text('/1').text('/2').text('/3')
                .resized()
                .persistent();

            const sentMessage = await ctx.replyWithPhoto(new InputFile(imageBuffer), {
                reply_markup: inlineKeyboard,
            });

            // Store the message ID for future updates
            xtermService.setLastScreenshotMessageId(this.botId, userId, sentMessage.message_id);
        } catch (error) {
            await ctx.reply(
                '❌ Failed to start terminal session.\n\n' +
                `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    private async handleCoder(ctx: Context): Promise<void> {
        const userId = ctx.from!.id.toString();
        const chatId = ctx.chat!.id;

        try {
            if (!xtermService.hasSession(this.botId, userId)) {
                await ctx.reply('❌ No active session.\n\nUse /start to create one.');
                return;
            }

            const message = ctx.message?.text || '';
            const text = message.replace('/coder', '').trim();

            if (!text) {
                await ctx.reply(
                    '⚠️ Please provide text to send.\n\n' +
                    '*Usage:* `/coder <text>`\n' +
                    '*Example:* `/coder ls -la`',
                    { parse_mode: 'Markdown' }
                );
                return;
            }

            const processedText = coderService.replaceMediaPlaceholder(text);

            xtermService.writeRawToSession(this.botId, userId, processedText);

            await new Promise(resolve => setTimeout(resolve, 50));

            xtermService.writeRawToSession(this.botId, userId, '\r');

            const sentMsg = await ctx.reply('✅ Sent - Use /screen to view the output or refresh any existing screen.');

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
                '❌ Failed to send to terminal.\n\n' +
                `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    private async handleClose(ctx: Context): Promise<void> {
        const userId = ctx.from!.id.toString();
        const chatId = ctx.chat!.id;

        try {
            if (!xtermService.hasSession(this.botId, userId)) {
                await ctx.reply(
                    '⚠️ No active terminal session to close.\n\nUse /start to start one.'
                );
                return;
            }

            xtermService.closeSession(this.botId, userId);

            await ctx.reply(
                '✅ *Coder Session Closed*\n\n' +
                'The coder session has been terminated.\n\n' +
                'Use /start to start a new session.',
                { parse_mode: 'Markdown' }
            );
        } catch (error) {
            await ctx.reply(
                '❌ Failed to close terminal session.\n\n' +
                `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
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

        const deleteTimeout = parseInt(process.env.MESSAGE_DELETE_TIMEOUT || '10000', 10);
        if (deleteTimeout > 0) {
            setTimeout(async () => {
                try {
                    await ctx.api.deleteMessage(ctx.chat!.id, sentMsg.message_id);
                } catch (error) {
                    console.error('Failed to delete start message:', error);
                }
            }, deleteTimeout * 2);
        }
    }

    private async handleHelp(ctx: Context): Promise<void> {
        const sentMsg = await ctx.reply(
            '🤖 *Coder Bot - Complete Command Reference*\n\n' +
            '*Session Management:*\n' +
            '/copilot \\[directory\\] - Start a new session with GitHub Copilot\n' +
            '/claude \\[directory\\] - Start a new session with Claude AI\n' +
            '/cursor \\[directory\\] - Start a new session with Cursor AI\n' +
            '*Optional:* Provide a directory path to cd into before starting\n' +
            '/xterm - Start a raw bash terminal session\n' +
            '/close - Close the current terminal session\n\n' +
            '*Sending Text to Terminal:*\n' +
            'Type any message (not starting with /) - Sent directly to terminal with Enter\n' +
            '/coder <text> - Send text to terminal with Enter\n' +
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

        const deleteTimeout = parseInt(process.env.MESSAGE_DELETE_TIMEOUT || '10000', 10);
        if (deleteTimeout > 0) {
            setTimeout(async () => {
                try {
                    await ctx.api.deleteMessage(ctx.chat!.id, sentMsg.message_id);
                } catch (error) {
                    console.error('Failed to delete help message:', error);
                }
            }, deleteTimeout * 2);
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
