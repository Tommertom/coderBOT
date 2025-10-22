import { Bot, Context } from 'grammy';
import { ProcessManager, BotProcessInfo } from '../../services/process-manager.service.js';
import { ConfigManager } from '../../services/config-manager.service.js';
import { ConfigService } from '../../services/config.service.js';
import { ControlAccessMiddleware } from '../../middleware/control-access.middleware.js';

export class ControlBot {
    private bot: Bot;
    private processManager: ProcessManager;
    private configManager: ConfigManager;
    private configService: ConfigService;
    private startTime: Date;

    constructor(
        token: string,
        processManager: ProcessManager,
        configManager: ConfigManager,
        configService: ConfigService
    ) {
        this.bot = new Bot(token);
        this.processManager = processManager;
        this.configManager = configManager;
        this.configService = configService;
        this.startTime = new Date();

        ControlAccessMiddleware.initialize(configService);
        this.registerHandlers();
    }

    private registerHandlers(): void {
        const requireAdmin = ControlAccessMiddleware.requireAdminAccess;

        // Process Management
        this.bot.command('status', requireAdmin, this.handleStatus.bind(this));
        this.bot.command('start', requireAdmin, this.handleStart.bind(this));
        this.bot.command('stop', requireAdmin, this.handleStop.bind(this));
        this.bot.command('restart', requireAdmin, this.handleRestart.bind(this));
        this.bot.command('stopall', requireAdmin, this.handleStopAll.bind(this));
        this.bot.command('startall', requireAdmin, this.handleStartAll.bind(this));
        this.bot.command('restartall', requireAdmin, this.handleRestartAll.bind(this));

        // Bot Configuration
        this.bot.command('listbots', requireAdmin, this.handleListBots.bind(this));
        this.bot.command('addbot', requireAdmin, this.handleAddBot.bind(this));
        this.bot.command('removebot', requireAdmin, this.handleRemoveBot.bind(this));
        this.bot.command('reload', requireAdmin, this.handleReload.bind(this));

        // Monitoring
        this.bot.command('logs', requireAdmin, this.handleLogs.bind(this));
        this.bot.command('health', requireAdmin, this.handleHealth.bind(this));
        this.bot.command('uptime', requireAdmin, this.handleUptime.bind(this));

        // Administrative
        this.bot.command('shutdown', requireAdmin, this.handleShutdown.bind(this));
        this.bot.command('help', requireAdmin, this.handleHelp.bind(this));
        this.bot.command('controlstart', requireAdmin, this.handleControlStart.bind(this));

        // Error handling
        this.bot.catch((err) => {
            console.error('ControlBot error:', err);
        });
    }

    async start(): Promise<void> {
        await this.bot.start();
        console.log('✅ ControlBOT is running');
    }

    async stop(): Promise<void> {
        await this.bot.stop();
        console.log('🛑 ControlBOT stopped');
    }

    private async handleStatus(ctx: Context): Promise<void> {
        try {
            const statuses = this.processManager.getAllBotStatuses();

            if (statuses.length === 0) {
                await ctx.reply('📊 *Bot Status*\n\nNo worker bots configured.', {
                    parse_mode: 'Markdown',
                });
                return;
            }

            let message = '📊 *Worker Bot Status*\n\n';

            for (const status of statuses) {
                const statusIcon = this.getStatusIcon(status.status);
                const uptimeStr = this.formatUptime(status.uptime);

                message += `${statusIcon} *${status.botId}*\n`;
                message += `   Status: \`${status.status}\`\n`;
                message += `   PID: \`${status.pid || 'N/A'}\`\n`;
                message += `   Uptime: \`${uptimeStr}\`\n`;
                
                if (status.lastError) {
                    message += `   Error: \`${status.lastError.substring(0, 100)}\`\n`;
                }
                
                message += '\n';
            }

            const runningCount = statuses.filter(s => s.status === 'running').length;
            message += `\n*Summary:* ${runningCount}/${statuses.length} bots running`;

            await ctx.reply(message, { parse_mode: 'Markdown' });
        } catch (error) {
            await ctx.reply(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async handleStart(ctx: Context): Promise<void> {
        try {
            const args = ctx.message?.text?.split(' ').slice(1) || [];
            if (args.length === 0) {
                await ctx.reply(
                    '⚠️ Please specify a bot ID.\n\n' +
                    '*Usage:* `/start <bot-id>`\n' +
                    '*Example:* `/start bot-1`',
                    { parse_mode: 'Markdown' }
                );
                return;
            }

            const botId = args[0];
            const status = this.processManager.getBotStatus(botId);

            if (!status) {
                await ctx.reply(`❌ Bot \`${botId}\` not found.`, { parse_mode: 'Markdown' });
                return;
            }

            if (status.status === 'running') {
                await ctx.reply(`⚠️ Bot \`${botId}\` is already running.`, { parse_mode: 'Markdown' });
                return;
            }

            await ctx.reply(`⏳ Starting bot \`${botId}\`...`, { parse_mode: 'Markdown' });

            const tokens = await this.configManager.getBotTokens();
            const botIndex = parseInt(botId.replace('bot-', ''), 10) - 1;
            
            if (botIndex < 0 || botIndex >= tokens.length) {
                await ctx.reply(`❌ Invalid bot index for \`${botId}\`.`, { parse_mode: 'Markdown' });
                return;
            }

            await this.processManager.startBot(botId, tokens[botIndex]);
            await ctx.reply(`✅ Bot \`${botId}\` started successfully!`, { parse_mode: 'Markdown' });
        } catch (error) {
            await ctx.reply(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async handleStop(ctx: Context): Promise<void> {
        try {
            const args = ctx.message?.text?.split(' ').slice(1) || [];
            if (args.length === 0) {
                await ctx.reply(
                    '⚠️ Please specify a bot ID.\n\n' +
                    '*Usage:* `/stop <bot-id>`\n' +
                    '*Example:* `/stop bot-1`',
                    { parse_mode: 'Markdown' }
                );
                return;
            }

            const botId = args[0];
            
            if (!this.processManager.isBotRunning(botId)) {
                await ctx.reply(`⚠️ Bot \`${botId}\` is not running.`, { parse_mode: 'Markdown' });
                return;
            }

            await ctx.reply(`⏳ Stopping bot \`${botId}\`...`, { parse_mode: 'Markdown' });
            await this.processManager.stopBot(botId);
            await ctx.reply(`✅ Bot \`${botId}\` stopped successfully!`, { parse_mode: 'Markdown' });
        } catch (error) {
            await ctx.reply(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async handleRestart(ctx: Context): Promise<void> {
        try {
            const args = ctx.message?.text?.split(' ').slice(1) || [];
            if (args.length === 0) {
                await ctx.reply(
                    '⚠️ Please specify a bot ID.\n\n' +
                    '*Usage:* `/restart <bot-id>`\n' +
                    '*Example:* `/restart bot-1`',
                    { parse_mode: 'Markdown' }
                );
                return;
            }

            const botId = args[0];
            await ctx.reply(`⏳ Restarting bot \`${botId}\`...`, { parse_mode: 'Markdown' });
            
            await this.processManager.restartBot(botId);
            await ctx.reply(`✅ Bot \`${botId}\` restarted successfully!`, { parse_mode: 'Markdown' });
        } catch (error) {
            await ctx.reply(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async handleStopAll(ctx: Context): Promise<void> {
        try {
            const statuses = this.processManager.getAllBotStatuses();
            const runningBots = statuses.filter(s => s.status === 'running');

            if (runningBots.length === 0) {
                await ctx.reply('⚠️ No bots are currently running.');
                return;
            }

            await ctx.reply(`⏳ Stopping all ${runningBots.length} running bots...`);
            await this.processManager.stopAllBots();
            await ctx.reply('✅ All bots stopped successfully!');
        } catch (error) {
            await ctx.reply(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async handleStartAll(ctx: Context): Promise<void> {
        try {
            const statuses = this.processManager.getAllBotStatuses();
            const stoppedBots = statuses.filter(s => s.status !== 'running');

            if (stoppedBots.length === 0) {
                await ctx.reply('⚠️ All bots are already running.');
                return;
            }

            await ctx.reply(`⏳ Starting ${stoppedBots.length} stopped bots...`);
            await this.processManager.startAllBots();
            await ctx.reply('✅ All bots started successfully!');
        } catch (error) {
            await ctx.reply(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async handleRestartAll(ctx: Context): Promise<void> {
        try {
            const statuses = this.processManager.getAllBotStatuses();
            await ctx.reply(`⏳ Restarting all ${statuses.length} bots...`);
            
            await this.processManager.restartAllBots();
            await ctx.reply('✅ All bots restarted successfully!');
        } catch (error) {
            await ctx.reply(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async handleListBots(ctx: Context): Promise<void> {
        try {
            const tokens = await this.configManager.getBotTokens();
            
            if (tokens.length === 0) {
                await ctx.reply('📋 *Bot List*\n\nNo bots configured.', { parse_mode: 'Markdown' });
                return;
            }

            let message = '📋 *Configured Bots*\n\n';
            
            for (let i = 0; i < tokens.length; i++) {
                const botId = `bot-${i + 1}`;
                const maskedToken = this.maskToken(tokens[i]);
                const status = this.processManager.getBotStatus(botId);
                const statusIcon = status ? this.getStatusIcon(status.status) : '⚪';
                
                message += `${statusIcon} *${botId}*\n`;
                message += `   Token: \`${maskedToken}\`\n`;
                message += `   Status: \`${status?.status || 'not started'}\`\n\n`;
            }

            await ctx.reply(message, { parse_mode: 'Markdown' });
        } catch (error) {
            await ctx.reply(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async handleAddBot(ctx: Context): Promise<void> {
        try {
            const args = ctx.message?.text?.split(' ').slice(1) || [];
            if (args.length === 0) {
                await ctx.reply(
                    '⚠️ Please provide a bot token.\n\n' +
                    '*Usage:* `/addbot <token>`\n' +
                    '*Example:* `/addbot 1234567890:ABCdefGHIjklMNO...`',
                    { parse_mode: 'Markdown' }
                );
                return;
            }

            const token = args[0];
            await ctx.reply('⏳ Validating bot token...');

            const isValid = await this.configManager.validateBotToken(token);
            if (!isValid) {
                await ctx.reply('❌ Invalid bot token. Please check and try again.');
                return;
            }

            await ctx.reply('⏳ Adding bot to configuration...');
            await this.configManager.addBotToken(token);

            const tokens = await this.configManager.getBotTokens();
            const newBotId = `bot-${tokens.length}`;

            await ctx.reply('⏳ Starting new bot...');
            await this.processManager.startBot(newBotId, token);

            await ctx.reply(`✅ Bot \`${newBotId}\` added and started successfully!`, {
                parse_mode: 'Markdown',
            });
        } catch (error) {
            await ctx.reply(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async handleRemoveBot(ctx: Context): Promise<void> {
        try {
            const args = ctx.message?.text?.split(' ').slice(1) || [];
            if (args.length === 0) {
                await ctx.reply(
                    '⚠️ Please specify a bot ID.\n\n' +
                    '*Usage:* `/removebot <bot-id>`\n' +
                    '*Example:* `/removebot bot-1`',
                    { parse_mode: 'Markdown' }
                );
                return;
            }

            const botId = args[0];
            const botIndex = parseInt(botId.replace('bot-', ''), 10) - 1;

            if (botIndex < 0 || isNaN(botIndex)) {
                await ctx.reply(`❌ Invalid bot ID: \`${botId}\``, { parse_mode: 'Markdown' });
                return;
            }

            // Stop bot if running
            if (this.processManager.isBotRunning(botId)) {
                await ctx.reply(`⏳ Stopping bot \`${botId}\`...`, { parse_mode: 'Markdown' });
                await this.processManager.stopBot(botId);
            }

            await ctx.reply('⏳ Removing bot from configuration...');
            await this.configManager.removeBotToken(botIndex);

            await ctx.reply(`✅ Bot \`${botId}\` removed successfully!`, { parse_mode: 'Markdown' });
        } catch (error) {
            await ctx.reply(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async handleReload(ctx: Context): Promise<void> {
        try {
            await ctx.reply('⏳ Reloading configuration...');
            await this.configManager.reloadEnv();
            await ctx.reply('✅ Configuration reloaded successfully!');
        } catch (error) {
            await ctx.reply(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async handleLogs(ctx: Context): Promise<void> {
        try {
            const args = ctx.message?.text?.split(' ').slice(1) || [];
            if (args.length === 0) {
                await ctx.reply(
                    '⚠️ Please specify a bot ID.\n\n' +
                    '*Usage:* `/logs <bot-id> [lines]`\n' +
                    '*Example:* `/logs bot-1 50`',
                    { parse_mode: 'Markdown' }
                );
                return;
            }

            const botId = args[0];
            const lines = args.length > 1 ? parseInt(args[1], 10) : 50;

            const logs = this.processManager.getBotLogs(botId, lines);
            
            if (logs.length === 0) {
                await ctx.reply(`📋 No logs available for \`${botId}\`.`, { parse_mode: 'Markdown' });
                return;
            }

            const logText = logs.join('\n');
            const truncated = logText.length > 4000 ? logText.substring(0, 4000) + '...' : logText;

            await ctx.reply(`📋 *Logs for ${botId}* (last ${logs.length} lines)\n\n\`\`\`\n${truncated}\n\`\`\``, {
                parse_mode: 'Markdown',
            });
        } catch (error) {
            await ctx.reply(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async handleHealth(ctx: Context): Promise<void> {
        try {
            const statuses = this.processManager.getAllBotStatuses();
            
            if (statuses.length === 0) {
                await ctx.reply('🏥 *Health Check*\n\nNo bots to check.', { parse_mode: 'Markdown' });
                return;
            }

            await ctx.reply('⏳ Performing health checks...');

            let message = '🏥 *Health Check Results*\n\n';
            
            for (const status of statuses) {
                if (status.status === 'running') {
                    const healthy = await this.processManager.performHealthCheck(status.botId);
                    const healthIcon = healthy ? '✅' : '❌';
                    message += `${healthIcon} *${status.botId}*: ${healthy ? 'Healthy' : 'Unhealthy'}\n`;
                } else {
                    message += `⚪ *${status.botId}*: Not running\n`;
                }
            }

            await ctx.reply(message, { parse_mode: 'Markdown' });
        } catch (error) {
            await ctx.reply(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async handleUptime(ctx: Context): Promise<void> {
        try {
            const controlUptime = Date.now() - this.startTime.getTime();
            const statuses = this.processManager.getAllBotStatuses();

            let message = '⏱️ *System Uptime*\n\n';
            message += `🎮 *ControlBOT*: \`${this.formatUptime(controlUptime)}\`\n\n`;
            message += '*Worker Bots:*\n';

            for (const status of statuses) {
                if (status.status === 'running') {
                    message += `🤖 *${status.botId}*: \`${this.formatUptime(status.uptime)}\`\n`;
                } else {
                    message += `⚪ *${status.botId}*: Not running\n`;
                }
            }

            await ctx.reply(message, { parse_mode: 'Markdown' });
        } catch (error) {
            await ctx.reply(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async handleShutdown(ctx: Context): Promise<void> {
        try {
            await ctx.reply('⚠️ *Shutdown Initiated*\n\nStopping all bots and shutting down...', {
                parse_mode: 'Markdown',
            });

            console.log('Shutdown initiated by control bot');
            
            await this.processManager.stopAllBots();
            await this.bot.stop();
            
            setTimeout(() => {
                console.log('Shutdown complete');
                process.exit(0);
            }, 2000);
        } catch (error) {
            await ctx.reply(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async handleHelp(ctx: Context): Promise<void> {
        const message = `
🎮 *ControlBOT Command Reference*

*Process Management:*
/status - Show status of all worker bots
/start <bot-id> - Start a specific bot
/stop <bot-id> - Stop a specific bot
/restart <bot-id> - Restart a specific bot
/stopall - Stop all running bots
/startall - Start all stopped bots
/restartall - Restart all bots

*Bot Configuration:*
/listbots - List all configured bots
/addbot <token> - Add and start a new bot
/removebot <bot-id> - Remove a bot
/reload - Reload .env configuration

*Monitoring:*
/logs <bot-id> [lines] - Show bot logs
/health - Health check for all bots
/uptime - Show uptime for all bots

*Administrative:*
/shutdown - Shutdown entire system
/help - Show this help message

*Examples:*
\`/start bot-1\`
\`/logs bot-2 100\`
\`/addbot 123456:ABCdef...\`
`;

        await ctx.reply(message, { parse_mode: 'Markdown' });
    }

    private async handleControlStart(ctx: Context): Promise<void> {
        await ctx.reply(
            '🎮 *ControlBOT*\n\n' +
            '✅ Control bot is running and ready.\n\n' +
            'Use /help to see available commands.',
            { parse_mode: 'Markdown' }
        );
    }

    private getStatusIcon(status: string): string {
        switch (status) {
            case 'running': return '🟢';
            case 'stopped': return '⚪';
            case 'starting': return '🟡';
            case 'stopping': return '🟠';
            case 'error': return '🔴';
            default: return '⚫';
        }
    }

    private formatUptime(ms: number): string {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }

    private maskToken(token: string): string {
        if (token.length <= 8) return '***';
        return token.substring(0, 4) + '...' + token.substring(token.length - 4);
    }
}
