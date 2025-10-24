import { Bot, Context, InlineKeyboard } from 'grammy';
import type { BotCommand } from '@grammyjs/types';
import { ProcessManager, BotProcessInfo } from '../../services/process-manager.service.js';
import { ConfigManager } from '../../services/config-manager.service.js';
import { ConfigService } from '../../services/config.service.js';
import { ControlAccessMiddleware } from '../../middleware/control-access.middleware.js';
import { MessageUtils } from '../../utils/message.utils.js';

export class ControlBot {
    private bot: Bot;
    private processManager: ProcessManager;
    private configManager: ConfigManager;
    private configService: ConfigService;
    private startTime: Date;

    private static readonly MY_COMMANDS: BotCommand[] = [
        { command: 'status', description: 'Show status of all worker bots' },
        { command: 'stopall', description: 'Stop all running bots' },
        { command: 'help', description: 'Show complete command reference' },
    ];

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
        this.bot.command('stopall', requireAdmin, this.handleStopAll.bind(this));
        this.bot.command('startall', requireAdmin, this.handleStartAll.bind(this));
        this.bot.command('restartall', requireAdmin, this.handleRestartAll.bind(this));

        // Callback query handler for inline buttons
        this.bot.on('callback_query:data', requireAdmin, this.handleCallback.bind(this));

        // Bot Configuration
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
        await this.setCommands();
        await this.bot.start();
        console.log('✅ ControlBOT is running');
    }

    private async setCommands(): Promise<void> {
        try {
            await this.bot.api.setMyCommands(ControlBot.MY_COMMANDS);
            console.log('✅ ControlBOT commands set successfully');
        } catch (error) {
            console.error('Failed to set ControlBOT commands:', error);
        }
    }

    async stop(): Promise<void> {
        await this.bot.stop();
        console.log('🛑 ControlBOT stopped');
    }

    private async handleStatus(ctx: Context): Promise<void> {
        try {
            const statuses = this.processManager.getAllBotStatuses();

            if (statuses.length === 0) {
                const msg = await ctx.reply('📊 *Bot Status*\n\nNo worker bots configured.', {
                    parse_mode: 'Markdown',
                });
                await MessageUtils.scheduleMessageDeletion(ctx, msg.message_id, this.configService, 60);
                return;
            }

            // Send summary first
            const runningCount = statuses.filter(s => s.status === 'running').length;
            const summaryMsg = await ctx.reply(
                `📊 *Worker Bot Status*\n\n*Summary:* ${runningCount}/${statuses.length} bots running`,
                { parse_mode: 'Markdown' }
            );
            await MessageUtils.scheduleMessageDeletion(ctx, summaryMsg.message_id, this.configService, 60);

            // Send individual message for each bot with action buttons
            for (const status of statuses) {
                await this.sendBotStatus(ctx, status);
            }
        } catch (error) {
            const errMsg = await ctx.reply(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            await MessageUtils.scheduleMessageDeletion(ctx, errMsg.message_id, this.configService, 60);
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
/status - Show status with action buttons
/stopall - Stop all running bots
/startall - Start all stopped bots
/restartall - Restart all bots

*Bot Configuration:*
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
\`/logs bot-1 100\`
\`/addbot 123456:ABCdef...\`

*Note:* Use the inline buttons on status messages to start/stop/restart individual bots.
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

    private async sendBotStatus(ctx: Context, status: BotProcessInfo): Promise<void> {
        const statusIcon = this.getStatusIcon(status.status);
        const uptimeStr = this.formatUptime(status.uptime);

        let message = `${statusIcon} *${status.botId}*\n`;
        if (status.fullName) {
            message += `${MessageUtils.escapeMarkdown(status.fullName)}`;
            if (status.username) {
                message += ` (@${MessageUtils.escapeMarkdown(status.username)})`;
            }
            message += `\n`;
        }
        message += `Status: \`${status.status}\`\n`;
        message += `PID: \`${status.pid || 'N/A'}\`\n`;
        message += `Uptime: \`${uptimeStr}\``;

        if (status.lastError) {
            message += `\nError: \`${MessageUtils.escapeMarkdown(status.lastError.substring(0, 100))}\``;
        }

        // Create inline keyboard based on bot status
        const keyboard = new InlineKeyboard();

        if (status.status === 'running') {
            keyboard.text('🔄 Restart', `restart:${status.botId}`);
            keyboard.text('🛑 Stop', `stop:${status.botId}`);
        } else {
            keyboard.text('▶️ Start', `start:${status.botId}`);
        }

        keyboard.text('📋 Logs', `logs:${status.botId}`);

        const msg = await ctx.reply(message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
        await MessageUtils.scheduleMessageDeletion(ctx, msg.message_id, this.configService, 60);
    }

    private async handleCallback(ctx: Context): Promise<void> {
        try {
            const data = ctx.callbackQuery?.data;
            if (!data) return;

            const [action, botId] = data.split(':');

            // Answer callback query immediately
            await ctx.answerCallbackQuery();

            switch (action) {
                case 'start':
                    await this.handleStartBot(ctx, botId);
                    break;
                case 'stop':
                    await this.handleStopBot(ctx, botId);
                    break;
                case 'restart':
                    await this.handleRestartBot(ctx, botId);
                    break;
                case 'logs':
                    await this.handleLogsForBot(ctx, botId, 50);
                    break;
            }
        } catch (error) {
            console.error('Callback error:', error);
            await ctx.answerCallbackQuery({ text: '❌ Error occurred' });
        }
    }

    private async handleStartBot(ctx: Context, botId: string): Promise<void> {
        try {
            const status = this.processManager.getBotStatus(botId);

            if (!status) {
                const msg = await ctx.reply(`❌ Bot \`${botId}\` not found.`, { parse_mode: 'Markdown' });
                await MessageUtils.scheduleMessageDeletion(ctx, msg.message_id, this.configService, 60);
                return;
            }

            if (status.status === 'running') {
                const msg = await ctx.reply(`⚠️ Bot \`${botId}\` is already running.`, { parse_mode: 'Markdown' });
                await MessageUtils.scheduleMessageDeletion(ctx, msg.message_id, this.configService, 60);
                return;
            }

            const startingMsg = await ctx.reply(`⏳ Starting bot \`${botId}\`...`, { parse_mode: 'Markdown' });
            await MessageUtils.scheduleMessageDeletion(ctx, startingMsg.message_id, this.configService, 60);

            const tokens = await this.configManager.getBotTokens();
            const botIndex = parseInt(botId.replace('bot-', ''), 10) - 1;

            if (botIndex < 0 || botIndex >= tokens.length) {
                const msg = await ctx.reply(`❌ Invalid bot index for \`${botId}\`.`, { parse_mode: 'Markdown' });
                await MessageUtils.scheduleMessageDeletion(ctx, msg.message_id, this.configService, 60);
                return;
            }

            await this.processManager.startBot(botId, tokens[botIndex]);
            const successMsg = await ctx.reply(`✅ Bot \`${botId}\` started successfully!`, { parse_mode: 'Markdown' });
            await MessageUtils.scheduleMessageDeletion(ctx, successMsg.message_id, this.configService, 60);

            // Send updated status
            setTimeout(async () => {
                const updatedStatus = this.processManager.getBotStatus(botId);
                if (updatedStatus) {
                    await this.sendBotStatus(ctx, updatedStatus);
                }
            }, 1000);
        } catch (error) {
            await ctx.reply(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async handleStopBot(ctx: Context, botId: string): Promise<void> {
        try {
            if (!this.processManager.isBotRunning(botId)) {
                const msg = await ctx.reply(`⚠️ Bot \`${botId}\` is not running.`, { parse_mode: 'Markdown' });
                await MessageUtils.scheduleMessageDeletion(ctx, msg.message_id, this.configService, 60);
                return;
            }

            const stoppingMsg = await ctx.reply(`⏳ Stopping bot \`${botId}\`...`, { parse_mode: 'Markdown' });
            await MessageUtils.scheduleMessageDeletion(ctx, stoppingMsg.message_id, this.configService, 60);
            await this.processManager.stopBot(botId);
            const successMsg = await ctx.reply(`✅ Bot \`${botId}\` stopped successfully!`, { parse_mode: 'Markdown' });
            await MessageUtils.scheduleMessageDeletion(ctx, successMsg.message_id, this.configService, 60);

            // Send updated status
            const updatedStatus = this.processManager.getBotStatus(botId);
            if (updatedStatus) {
                await this.sendBotStatus(ctx, updatedStatus);
            }
        } catch (error) {
            const errMsg = await ctx.reply(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            await MessageUtils.scheduleMessageDeletion(ctx, errMsg.message_id, this.configService, 60);
        }
    }

    private async handleRestartBot(ctx: Context, botId: string): Promise<void> {
        try {
            const restartingMsg = await ctx.reply(`⏳ Restarting bot \`${botId}\`...`, { parse_mode: 'Markdown' });
            await MessageUtils.scheduleMessageDeletion(ctx, restartingMsg.message_id, this.configService, 60);

            await this.processManager.restartBot(botId);
            const successMsg = await ctx.reply(`✅ Bot \`${botId}\` restarted successfully!`, { parse_mode: 'Markdown' });
            await MessageUtils.scheduleMessageDeletion(ctx, successMsg.message_id, this.configService, 60);

            // Send updated status
            setTimeout(async () => {
                const updatedStatus = this.processManager.getBotStatus(botId);
                if (updatedStatus) {
                    await this.sendBotStatus(ctx, updatedStatus);
                }
            }, 1000);
        } catch (error) {
            const errMsg = await ctx.reply(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            await MessageUtils.scheduleMessageDeletion(ctx, errMsg.message_id, this.configService, 60);
        }
    }

    private async handleLogsForBot(ctx: Context, botId: string, lines: number): Promise<void> {
        const logs = this.processManager.getBotLogs(botId, lines);

        if (logs.length === 0) {
            const msg = await ctx.reply(`📋 No logs available for \`${botId}\`.`, { parse_mode: 'Markdown' });
            await MessageUtils.scheduleMessageDeletion(ctx, msg.message_id, this.configService, 60);
            return;
        }

        const logsText = logs.join('\n');
        const maxLength = 4000;

        if (logsText.length > maxLength) {
            const truncated = logsText.substring(logsText.length - maxLength);
            const msg = await ctx.reply(`📋 *Logs for ${botId}* (truncated):\n\`\`\`\n${truncated}\n\`\`\``, { parse_mode: 'Markdown' });
            await MessageUtils.scheduleMessageDeletion(ctx, msg.message_id, this.configService, 60);
        } else {
            const msg = await ctx.reply(`📋 *Logs for ${botId}:*\n\`\`\`\n${logsText}\n\`\`\``, { parse_mode: 'Markdown' });
            await MessageUtils.scheduleMessageDeletion(ctx, msg.message_id, this.configService, 60);
        }
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
