import { Bot } from "grammy";
import { XtermBot } from './features/xterm/xterm.bot.js';
import { CoderBot } from './features/coder/coder.bot.js';
import { ServiceContainerFactory } from './services/service-container.factory.js';
import { ServiceContainer } from './services/service-container.interface.js';
import { mediaWatcherService } from './features/media/media-watcher.service.js';
import { AccessControlMiddleware } from './middleware/access-control.middleware.js';
import dotenv from 'dotenv';

console.log('Starting CoderBot...')

dotenv.config();

interface BotInstance {
    bot: Bot;
    services: ServiceContainer;
    xtermBot: XtermBot;
    coderBot: CoderBot;
}

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

const botInstances: BotInstance[] = [];

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

            // Create per-bot services
            const services = ServiceContainerFactory.create(botId);

            // Pass services to bot classes
            const xtermBot = new XtermBot(
                botId,
                services.xtermService,
                services.xtermRendererService
            );
            const coderBot = new CoderBot(
                botId,
                services.xtermService,
                services.xtermRendererService,
                services.coderService
            );

            // Store bot instance with its services
            botInstances.push({
                bot,
                services,
                xtermBot,
                coderBot
            });

            // Register handlers - CoderBot first for general commands, then XtermBot for specific ones
            coderBot.registerHandlers(bot);
            xtermBot.registerHandlers(bot);

            await bot.api.setMyCommands([
                { command: 'screen', description: 'Capture and view terminal screenshot' },
                { command: 'send', description: 'Send text to terminal with Enter' },
                { command: 'help', description: 'Show complete command reference' },
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
    
    // Cleanup each bot's services independently
    await Promise.all(
        botInstances.map(async (instance) => {
            await instance.services.cleanup();
            await instance.bot.stop();
        })
    );
    
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    mediaWatcherService.cleanup();
    
    // Cleanup each bot's services independently
    await Promise.all(
        botInstances.map(async (instance) => {
            await instance.services.cleanup();
            await instance.bot.stop();
        })
    );
    
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
