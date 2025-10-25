import { ConfigService } from './services/config.service.js';
import { ProcessManager } from './services/process-manager.service.js';
import { ConfigManager } from './services/config-manager.service.js';
import { ControlBot } from './features/control/control.bot.js';
import dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('[Parent] Starting CoderBot parent process...');

dotenv.config();

// Initialize global config service
const globalConfig = new ConfigService();
const processManager = new ProcessManager(globalConfig);
const configManager = new ConfigManager('.env');
let controlBot: ControlBot | null = null;

try {
    globalConfig.validate();
    console.log('[Parent] Configuration loaded successfully');
    console.log(globalConfig.getDebugInfo());
} catch (error) {
    console.error('[Parent] Configuration error:', error);
    process.exit(1);
}


console.log(`[Parent] Found ${globalConfig.getTelegramBotTokens().length} bot token(s)`);

/**
 * Initialize and start the Control Bot if configured
 */
async function initializeControlBot(): Promise<void> {
    if (!globalConfig.hasControlBot()) {
        console.log('[Parent] Control bot not configured, skipping...');
        return;
    }

    const token = globalConfig.getControlBotToken();
    const adminIds = globalConfig.getControlBotAdminIds();

    if (!token) {
        console.log('[Parent] No control bot token found');
        return;
    }

    if (adminIds.length === 0) {
        console.warn('[Parent] Warning: Control bot token set but no admin IDs configured');
        return;
    }

    try {
        await configManager.initialize();

        controlBot = new ControlBot(
            token,
            processManager,
            configManager,
            globalConfig
        );

        await controlBot.start();
        console.log(`[Parent] ✅ ControlBOT started successfully with ${adminIds.length} admin(s)`);
    } catch (error) {
        console.error('[Parent] Failed to start ControlBOT:', error);
    }
}

/**
 * Start all bot workers using ProcessManager
 */
async function startBotWorkersWithProcessManager() {
    try {
        const tokens = globalConfig.getTelegramBotTokens();
        console.log(`[Parent] Starting ${tokens.length} bot worker(s) via ProcessManager...`);

        for (let i = 0; i < tokens.length; i++) {
            const botId = `bot-${i + 1}`;
            await processManager.startBot(botId, tokens[i]);

            // Small delay between spawns
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log(`[Parent] ✅ All ${tokens.length} bot worker(s) started`);
    } catch (error) {
        console.error('[Parent] Failed to start bot workers:', error);
        process.exit(1);
    }
}

let shuttingDown = false;

/**
 * Graceful shutdown handler for cleanup on process termination
 */
async function gracefulShutdown(signal: string): Promise<void> {
    if (shuttingDown) {
        console.log('[Parent] Shutdown already in progress...');
        return;
    }

    shuttingDown = true;
    console.log(`[Parent] Received ${signal}, shutting down gracefully...`);

    // Stop control bot
    if (controlBot) {
        console.log('[Parent] Stopping ControlBOT...');
        await controlBot.stop();
    }

    // Stop all worker bots via ProcessManager
    console.log('[Parent] Stopping all worker bots...');
    await processManager.stopAllBots();

    console.log('[Parent] ✅ All bot workers stopped');
    process.exit(0);
}

// Handle graceful shutdown for both SIGINT and SIGTERM
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('[Parent] Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('[Parent] Uncaught Exception:', error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Start all bot workers using ProcessManager
startBotWorkersWithProcessManager().then(async () => {
    console.log(`[Parent] ✅ CoderBot parent process ready`);

    // Initialize Control Bot
    await initializeControlBot();
}).catch(console.error);
