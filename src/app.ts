import { Bot } from "grammy";
import { XtermBot } from './features/xterm/xterm.bot.js';
import { CoderBot } from './features/coder/coder.bot.js';
import { ServiceContainerFactory } from './services/service-container.factory.js';
import { ServiceContainer } from './services/service-container.interface.js';
import { createMediaWatcherService } from './features/media/media-watcher.service.js';
import { AccessControlMiddleware } from './middleware/access-control.middleware.js';
import { ConfigService } from './services/config.service.js';
import dotenv from 'dotenv';

console.log('Starting CoderBot...')

dotenv.config();

// Initialize global config service
const globalConfig = new ConfigService();

try {
    globalConfig.validate();
    console.log('Configuration loaded successfully');
    console.log(globalConfig.getDebugInfo());
} catch (error) {
    console.error('Configuration error:', error);
    process.exit(1);
}

interface BotInstance {
    bot: Bot;
    services: ServiceContainer;
    xtermBot: XtermBot;
    coderBot: CoderBot;
}

// Get bot tokens from config
const botTokens = globalConfig.getTelegramBotTokens();

console.log(`Found ${botTokens.length} bot token(s)`);

// Create bot instances for all tokens
const bots: Bot[] = botTokens.map((token, index) => {
    console.log(`Creating bot instance ${index + 1}/${botTokens.length}`);
    return new Bot(token);
});

const botInstances: BotInstance[] = [];

// Initialize media watcher service with config
const mediaWatcherService = createMediaWatcherService(globalConfig);

async function startBot() {
    try {
        // Set config service for access control
        AccessControlMiddleware.setConfigService(globalConfig);

        // Set bot instances for access control
        AccessControlMiddleware.setBotInstances(bots);

        // Initialize media watcher with all bots
        await mediaWatcherService.initialize(bots);

        // Initialize each bot
        for (let i = 0; i < bots.length; i++) {
            const bot = bots[i];
            const token = botTokens[i];
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
                services.xtermRendererService,
                services.configService
            );
            const coderBot = new CoderBot(
                botId,
                token,
                services.xtermService,
                services.xtermRendererService,
                services.coderService,
                services.configService
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

/**
 * Graceful shutdown handler for cleanup on process termination
 */
async function gracefulShutdown(signal: string): Promise<void> {
    console.log(`Received ${signal}, shutting down gracefully...`);
    mediaWatcherService.cleanup();

    // Cleanup each bot's services independently
    await Promise.all(
        botInstances.map(async (instance) => {
            await instance.services.cleanup();
            await instance.bot.stop();
        })
    );

    process.exit(0);
}

// Handle graceful shutdown for both SIGINT and SIGTERM
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

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
