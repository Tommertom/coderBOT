/**
 * Configuration Service
 * 
 * Centralizes all environment variable access and provides type-safe
 * configuration management for bot instances.
 */
export class ConfigService {
    // Telegram Configuration
    private readonly telegramBotTokens: string[];
    private readonly allowedUserIds: number[];
    private readonly autoKill: boolean;

    // Xterm/PTY Configuration
    private readonly xtermMaxOutputLines: number;
    private readonly xtermSessionTimeout: number;
    private readonly xtermTerminalRows: number;
    private readonly xtermTerminalCols: number;
    private readonly xtermShellPath: string;

    // Media Configuration
    private readonly mediaTmpLocation: string;
    private readonly cleanUpMediaDir: boolean;

    // Message Configuration
    private readonly messageDeleteTimeout: number;

    // Auto-refresh Configuration
    private readonly screenRefreshInterval: number;
    private readonly screenRefreshMaxCount: number;

    // Bot Token Monitoring
    private readonly botTokenMonitorInterval: number;

    // System Environment
    private readonly homeDirectory: string;
    private readonly systemEnv: { [key: string]: string };

    constructor() {
        // Load and parse Telegram bot tokens
        this.telegramBotTokens = (process.env.TELEGRAM_BOT_TOKENS || '')
            .split(',')
            .map(token => token.trim())
            .filter(token => token.length > 0);

        // Load and parse allowed user IDs
        const allowedIds = process.env.ALLOWED_USER_IDS || '';
        this.allowedUserIds = allowedIds
            .split(',')
            .map(id => id.trim())
            .filter(id => id.length > 0)
            .map(id => parseInt(id, 10))
            .filter(id => !isNaN(id));

        // Load auto-kill setting
        const autoKillValue = process.env.AUTO_KILL?.toLowerCase();
        this.autoKill = autoKillValue === 'true' || autoKillValue === '1';

        // Load Xterm configuration
        this.xtermMaxOutputLines = parseInt(process.env.XTERM_MAX_OUTPUT_LINES || '1000', 10);
        this.xtermSessionTimeout = parseInt(process.env.XTERM_SESSION_TIMEOUT || '1800000', 10);
        this.xtermTerminalRows = parseInt(process.env.XTERM_TERMINAL_ROWS || '50', 10);
        this.xtermTerminalCols = parseInt(process.env.XTERM_TERMINAL_COLS || '100', 10);
        this.xtermShellPath = process.env.XTERM_SHELL_PATH || '/bin/bash';

        // Load media configuration
        this.mediaTmpLocation = process.env.MEDIA_TMP_LOCATION || '/tmp/coderBOT_media';
        const cleanUpValue = process.env.CLEAN_UP_MEDIADIR?.toLowerCase();
        this.cleanUpMediaDir = cleanUpValue === 'true' || cleanUpValue === '1';

        // Load message configuration
        this.messageDeleteTimeout = parseInt(process.env.MESSAGE_DELETE_TIMEOUT || '10000', 10);

        // Load auto-refresh configuration
        this.screenRefreshInterval = parseInt(process.env.SCREEN_REFRESH_INTERVAL || '5000', 10);
        this.screenRefreshMaxCount = parseInt(process.env.SCREEN_REFRESH_MAX_COUNT || '5', 10);

        // Load bot token monitoring configuration
        this.botTokenMonitorInterval = parseInt(process.env.BOT_TOKEN_MONITOR_INTERVAL || '300000', 10);

        // Load system environment
        this.homeDirectory = process.env.HOME || '/tmp';
        this.systemEnv = process.env as { [key: string]: string };
    }

    // Telegram Configuration Getters
    getTelegramBotTokens(): string[] {
        return [...this.telegramBotTokens];
    }

    getAllowedUserIds(): number[] {
        return [...this.allowedUserIds];
    }

    isAutoKillEnabled(): boolean {
        return this.autoKill;
    }

    // Xterm Configuration Getters
    getXtermMaxOutputLines(): number {
        return this.xtermMaxOutputLines;
    }

    getXtermSessionTimeout(): number {
        return this.xtermSessionTimeout;
    }

    getXtermTerminalRows(): number {
        return this.xtermTerminalRows;
    }

    getXtermTerminalCols(): number {
        return this.xtermTerminalCols;
    }

    getXtermShellPath(): string {
        return this.xtermShellPath;
    }

    // Media Configuration Getters
    getMediaTmpLocation(): string {
        return this.mediaTmpLocation;
    }

    shouldCleanUpMediaDir(): boolean {
        return this.cleanUpMediaDir;
    }

    // Message Configuration Getters
    getMessageDeleteTimeout(): number {
        return this.messageDeleteTimeout;
    }

    // Auto-refresh Configuration Getters
    getScreenRefreshInterval(): number {
        return this.screenRefreshInterval;
    }

    getScreenRefreshMaxCount(): number {
        return this.screenRefreshMaxCount;
    }

    // Bot Token Monitoring Getters
    getBotTokenMonitorInterval(): number {
        return this.botTokenMonitorInterval;
    }

    // System Environment Getters
    getHomeDirectory(): string {
        return this.homeDirectory;
    }

    getSystemEnv(): { [key: string]: string } {
        return { ...this.systemEnv };
    }

    // Validation
    validate(): void {
        if (this.telegramBotTokens.length === 0) {
            throw new Error('No bot tokens found in TELEGRAM_BOT_TOKENS environment variable');
        }

        if (this.allowedUserIds.length === 0) {
            console.warn('Warning: No allowed user IDs configured. Consider setting ALLOWED_USER_IDS.');
        }
    }

    // Debug information
    getDebugInfo(): string {
        return `ConfigService:
  - Bot Tokens: ${this.telegramBotTokens.length}
  - Allowed Users: ${this.allowedUserIds.length}
  - Auto Kill: ${this.autoKill}
  - Xterm Max Lines: ${this.xtermMaxOutputLines}
  - Xterm Session Timeout: ${this.xtermSessionTimeout}ms
  - Xterm Terminal: ${this.xtermTerminalRows}x${this.xtermTerminalCols}
  - Xterm Shell: ${this.xtermShellPath}
  - Media Location: ${this.mediaTmpLocation}
  - Clean Up Media Dir: ${this.cleanUpMediaDir}
  - Message Delete Timeout: ${this.messageDeleteTimeout}ms
  - Screen Refresh Interval: ${this.screenRefreshInterval}ms
  - Screen Refresh Max Count: ${this.screenRefreshMaxCount}
  - Bot Token Monitor Interval: ${this.botTokenMonitorInterval}ms`;
    }
}
