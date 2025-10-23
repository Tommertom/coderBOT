import { fork, ChildProcess } from 'child_process';
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

interface BotWorker {
    process: ChildProcess;
    botIndex: string;
    token: string;
    ready: boolean;
}

const botWorkers: BotWorker[] = [];
let monitorInterval: NodeJS.Timeout | null = null;

// Get bot tokens from config
let currentBotTokens = globalConfig.getTelegramBotTokens();

console.log(`[Parent] Found ${currentBotTokens.length} bot token(s)`);

/**
 * Spawn a bot worker process
 */
function spawnBotWorker(token: string, index: number): BotWorker {
    const botIndex = index.toString();
    const workerPath = path.join(__dirname, 'bot-worker.js');

    console.log(`[Parent] Spawning bot worker ${botIndex}...`);

    const childProcess = fork(workerPath, [], {
        env: {
            ...process.env,
            BOT_TOKEN: token,
            BOT_INDEX: botIndex,
        },
        stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
    });

    const worker: BotWorker = {
        process: childProcess,
        botIndex,
        token,
        ready: false,
    };

    // Handle messages from child
    childProcess.on('message', (message: any) => {
        if (message.type === 'READY') {
            worker.ready = true;
            console.log(`[Parent] Bot worker ${botIndex} is ready`);
        }
    });

    // Handle child exit
    childProcess.on('exit', (code, signal) => {
        console.log(`[Parent] Bot worker ${botIndex} exited with code ${code}, signal ${signal}`);

        // Auto-restart on unexpected exit (not during shutdown)
        if (!shuttingDown && code !== 0) {
            console.log(`[Parent] Restarting bot worker ${botIndex} in 5 seconds...`);
            setTimeout(() => {
                const newWorker = spawnBotWorker(token, index);
                const workerIndex = botWorkers.findIndex(w => w.botIndex === botIndex);
                if (workerIndex !== -1) {
                    botWorkers[workerIndex] = newWorker;
                }
            }, 5000);
        }
    });

    // Handle child errors
    childProcess.on('error', (error) => {
        console.error(`[Parent] Bot worker ${botIndex} error:`, error);
    });

    return worker;
}

/**
 * Start all bot workers
 */
async function startBotWorkers() {
    try {
        // Spawn a worker for each bot token
        for (let i = 0; i < currentBotTokens.length; i++) {
            const worker = spawnBotWorker(currentBotTokens[i], i);
            botWorkers.push(worker);

            // Add small delay between spawns to avoid overwhelming the system
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log(`[Parent] ✅ All ${botWorkers.length} bot worker(s) spawned`);
    } catch (error) {
        console.error('[Parent] Failed to start bot workers:', error);
        process.exit(1);
    }
}

/**
 * Check for changes in bot tokens and update workers accordingly
 */
async function checkBotTokenChanges(): Promise<void> {
    try {
        console.log('[Parent] Checking for bot token changes...');

        // Reload environment variables
        dotenv.config();

        // Create new config to get updated tokens
        const newConfig = new ConfigService();
        const newBotTokens = newConfig.getTelegramBotTokens();

        // Find tokens that were removed
        const removedTokens = currentBotTokens.filter(token => !newBotTokens.includes(token));

        // Find tokens that were added
        const addedTokens = newBotTokens.filter(token => !currentBotTokens.includes(token));

        if (removedTokens.length === 0 && addedTokens.length === 0) {
            console.log('[Parent] No bot token changes detected');
            return;
        }

        console.log(`[Parent] Token changes detected: ${addedTokens.length} added, ${removedTokens.length} removed`);

        // Kill workers for removed tokens
        for (const removedToken of removedTokens) {
            const workerIndex = botWorkers.findIndex(w => w.token === removedToken);
            if (workerIndex !== -1) {
                const worker = botWorkers[workerIndex];
                console.log(`[Parent] Killing bot worker ${worker.botIndex} (token removed)`);
                worker.process.kill('SIGTERM');
                botWorkers.splice(workerIndex, 1);
            }
        }

        // Spawn workers for added tokens
        for (const addedToken of addedTokens) {
            // Check if this token is already running (shouldn't happen but safety check)
            if (botWorkers.some(w => w.token === addedToken)) {
                console.log(`[Parent] Token already has a running worker, skipping`);
                continue;
            }

            // Find next available index
            const nextIndex = botWorkers.length;
            console.log(`[Parent] Spawning new bot worker for added token (index ${nextIndex})`);
            const worker = spawnBotWorker(addedToken, nextIndex);
            botWorkers.push(worker);

            // Add small delay between spawns
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Update current tokens
        currentBotTokens = newBotTokens;

        console.log(`[Parent] ✅ Bot workers updated: ${botWorkers.length} total worker(s)`);
    } catch (error) {
        console.error('[Parent] Error checking bot token changes:', error);
    }
}

/**
 * Start monitoring for bot token changes
 */
function startBotTokenMonitoring(): void {
    const monitorIntervalMs = globalConfig.getBotTokenMonitorInterval();

    if (monitorIntervalMs <= 0) {
        console.log('[Parent] Bot token monitoring is disabled');
        return;
    }

    console.log(`[Parent] Starting bot token monitoring (interval: ${monitorIntervalMs}ms)`);

    monitorInterval = setInterval(() => {
        checkBotTokenChanges();
    }, monitorIntervalMs);
}

/**
 * Stop monitoring for bot token changes
 */
function stopBotTokenMonitoring(): void {
    if (monitorInterval) {
        clearInterval(monitorInterval);
        monitorInterval = null;
        console.log('[Parent] Bot token monitoring stopped');
    }
}

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

    // Stop monitoring
    stopBotTokenMonitoring();

    // Stop all worker bots via ProcessManager
    console.log('[Parent] Stopping all worker bots...');
    await processManager.stopAllBots();

    // Also stop old workers if any
    const shutdownPromises = botWorkers.map((worker) => {
        return new Promise<void>((resolve) => {
            if (worker.process.killed) {
                resolve();
                return;
            }

            console.log(`[Parent] Sending shutdown signal to bot worker ${worker.botIndex}`);

            const timeout = setTimeout(() => {
                console.log(`[Parent] Force killing bot worker ${worker.botIndex}`);
                worker.process.kill('SIGKILL');
                resolve();
            }, 10000);

            worker.process.once('exit', () => {
                clearTimeout(timeout);
                resolve();
            });

            worker.process.kill('SIGTERM');
        });
    });

    await Promise.all(shutdownPromises);
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

// Start all bot workers using ProcessManager only (not the old botWorkers system)
startBotWorkersWithProcessManager().then(async () => {
    console.log(`[Parent] ✅ CoderBot parent process ready`);

    // Initialize Control Bot
    await initializeControlBot();

    // Start monitoring for token changes (currently monitors .env file)
    // Note: ProcessManager handles bot lifecycle, not the old botWorkers system
    // startBotTokenMonitoring();
}).catch(console.error);
