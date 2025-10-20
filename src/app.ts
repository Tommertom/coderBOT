import { Bot } from "grammy";
import { XtermBot } from './features/xterm/xterm.bot.js';
import { CoderBot } from './features/coder/coder.bot.js';
import { xtermService } from './features/xterm/xterm.service.js';
import { xtermRendererService } from './features/xterm/xterm-renderer.service.js';
import { mediaWatcherService } from './features/media/media-watcher.service.js';
import { AccessControlMiddleware } from './middleware/access-control.middleware.js';
import dotenv from 'dotenv';

console.log('Starting CoderBot...')

dotenv.config();

// Parse comma-separated bot tokens
const botTokens = (process.env.TELEGRAM_BOT_TOKENS || '')
    .split(',')
    .map(token => token.trim())
    .filter(token => token.length > 0);

if (botTokens.length === 0) {
    console.error('Error: No bot tokens found in TELEGRAM_BOT_TOKENS environment variable');
    console.error('Please set TELEGRAM_BOT_TOKENS with one or more comma-separated tokens');
    process.exit(1);
}

console.log(`Found ${botTokens.length} bot token(s)`);

// Create bot instances for all tokens
const bots: Bot[] = botTokens.map((token, index) => {
    console.log(`Creating bot instance ${index + 1}/${botTokens.length}`);
    return new Bot(token);
});

async function startBot() {
    try {
        // Set bot instances for access control
        AccessControlMiddleware.setBotInstances(bots);

        // Initialize media watcher with all bots
        await mediaWatcherService.initialize(bots);

        // Initialize each bot
        for (let i = 0; i < bots.length; i++) {
            const bot = bots[i];
            console.log(`Initializing bot ${i + 1}/${bots.length}...`);

            // Set global error handler to prevent crashes
            bot.catch((err) => {
                const ctx = err.ctx;
                console.error(`[Bot ${i + 1}] Error while handling update ${ctx.update.update_id}:`, err.error);
            });

            // Get bot info to use as identifier
            const botInfo = await bot.api.getMe();
            const botId = botInfo.id.toString();

            const xtermBot = new XtermBot(botId);
            const coderBot = new CoderBot(botId);

            // Register handlers - CoderBot first for general commands, then XtermBot for specific ones
            coderBot.registerHandlers(bot);
            xtermBot.registerHandlers(bot);

            await bot.api.setMyCommands([
                { command: 'screen', description: 'Capture and view terminal screenshot' },
                { command: 'coder', description: 'Send text to terminal with Enter' },
                { command: 'tab', description: 'Send Tab character' },
                { command: 'copilot', description: 'Start a new terminal session with Copilot' },
                { command: 'claude', description: 'Start a new terminal session with Claude' },
                { command: 'cursor', description: 'Start a new terminal session with Cursor' },
                { command: 'enter', description: 'Send Enter key' },
                { command: 'start', description: 'Show help message with all commands' },
                { command: 'close', description: 'Close the current terminal session' },
            ]);

            bot.start();
            console.log(`✅ Bot ${i + 1} started successfully`);
        }
    } catch (error) {
        console.error('Failed to start bot:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down gracefully...');
    mediaWatcherService.cleanup();
    xtermService.cleanup();
    await xtermRendererService.cleanup();
    // Stop all bot instances
    await Promise.all(bots.map(bot => bot.stop()));
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    mediaWatcherService.cleanup();
    xtermService.cleanup();
    await xtermRendererService.cleanup();
    // Stop all bot instances
    await Promise.all(bots.map(bot => bot.stop()));
    process.exit(0);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

startBot().then(() => {
    console.log(`✅ All ${bots.length} bot(s) started successfully`);
}).catch(console.error);
