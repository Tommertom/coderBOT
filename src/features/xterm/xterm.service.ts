import * as pty from 'node-pty';
import { PtySession, XtermConfig } from './xterm.types.js';
import { ConfigService } from '../../services/config.service.js';
import { UrlExtractionUtils } from '../../utils/url-extraction.utils.js';

export class XtermService {
    private sessions: Map<string, PtySession> = new Map();
    private config: XtermConfig;
    private configService: ConfigService;
    private timeoutCheckerInterval: NodeJS.Timeout | null = null;

    constructor(configService: ConfigService) {
        this.configService = configService;
        this.config = {
            maxOutputLines: configService.getXtermMaxOutputLines(),
            sessionTimeout: configService.getXtermSessionTimeout(),
            terminalRows: configService.getXtermTerminalRows(),
            terminalCols: configService.getXtermTerminalCols(),
            shellPath: configService.getXtermShellPath(),
        };
        this.startTimeoutChecker();
    }

    private getSessionKey(userId: string): string {
        return userId;
    }

    createSession(
        userId: string,
        chatId: number,
        onDataCallback?: (userId: string, chatId: number, data: string) => void,
        onUrlDiscoveredCallback?: (userId: string, chatId: number, url: string) => void,
        onBufferingEndedCallback?: (userId: string, chatId: number) => void
    ): void {
        const sessionKey = this.getSessionKey(userId);
        if (this.sessions.has(sessionKey)) {
            throw new Error('Session already exists for this user with this bot');
        }

        try {
            const ptyProcess = pty.spawn(this.config.shellPath, [], {
                name: 'xterm-color',
                cols: this.config.terminalCols,
                rows: this.config.terminalRows,
                cwd: this.configService.getHomeDirectory(),
                env: this.configService.getSystemEnv(),
            });

            const session: PtySession = {
                pty: ptyProcess,
                output: [],
                lastActivity: new Date(),
                rows: this.config.terminalRows,
                cols: this.config.terminalCols,
                chatId,
                onDataCallback,
                discoveredUrls: new Set<string>(),
                notifiedUrls: new Set<string>(),
                urlNotificationTimeouts: new Map<number, NodeJS.Timeout>(),
                lastBufferSnapshot: '',
                lastBufferChangeTime: new Date(),
                onBufferingEndedCallback,
            };

            ptyProcess.onData((data) => {
                session.output.push(data);
                if (session.output.length > this.config.maxOutputLines) {
                    session.output.shift();
                }
                session.lastActivity = new Date();
                session.lastBufferChangeTime = new Date();

                // Extract and store URLs from terminal output
                const urls = UrlExtractionUtils.extractUrlsFromTerminalOutput(data);
                urls.forEach(url => {
                    session.discoveredUrls?.add(url);

                    // Notify about new URLs if callback is provided and URL hasn't been notified yet
                    if (onUrlDiscoveredCallback && !session.notifiedUrls?.has(url)) {
                        session.notifiedUrls?.add(url);
                        onUrlDiscoveredCallback(userId, chatId, url);
                    }
                });

                // Pass all data to the callback if provided
                if (session.onDataCallback) {
                    session.onDataCallback(userId, chatId, data);
                }
            });

            ptyProcess.onExit(() => {
                this.sessions.delete(sessionKey);
            });

            this.sessions.set(sessionKey, session);
            this.startBufferMonitoring(userId);
        } catch (error) {
            throw new Error(`Failed to spawn PTY: ${error}`);
        }
    }

    hasSession(userId: string): boolean {
        return this.sessions.has(this.getSessionKey(userId));
    }

    writeToSession(userId: string, data: string): void {
        const session = this.sessions.get(this.getSessionKey(userId));
        if (!session) {
            throw new Error('No active session found');
        }

        try {
            session.pty.write(data + '\r');
            session.lastActivity = new Date();
        } catch (error) {
            throw new Error(`Failed to write to PTY: ${error}`);
        }
    }

    writeRawToSession(userId: string, data: string): void {
        const session = this.sessions.get(this.getSessionKey(userId));
        if (!session) {
            throw new Error('No active session found');
        }

        try {
            session.pty.write(data);
            session.lastActivity = new Date();
        } catch (error) {
            throw new Error(`Failed to write to PTY: ${error}`);
        }
    }

    async getSessionOutput(userId: string, waitMs: number = 500): Promise<string> {
        const session = this.sessions.get(this.getSessionKey(userId));
        if (!session) {
            throw new Error('No active session found');
        }

        await new Promise(resolve => setTimeout(resolve, waitMs));

        return session.output.join('');
    }

    getSessionOutputBuffer(userId: string): string[] {
        const session = this.sessions.get(this.getSessionKey(userId));
        if (!session) {
            throw new Error('No active session found');
        }

        return [...session.output];
    }

    getSessionDimensions(userId: string): { rows: number; cols: number } {
        const session = this.sessions.get(this.getSessionKey(userId));
        if (!session) {
            throw new Error('No active session found');
        }

        return {
            rows: session.rows,
            cols: session.cols,
        };
    }

    closeSession(userId: string): void {
        const session = this.sessions.get(this.getSessionKey(userId));
        if (!session) {
            throw new Error('No active session found');
        }

        if (session.refreshInterval) {
            clearInterval(session.refreshInterval);
        }

        if (session.bufferMonitorInterval) {
            clearInterval(session.bufferMonitorInterval);
        }

        // Clear all URL notification timeouts
        if (session.urlNotificationTimeouts) {
            session.urlNotificationTimeouts.forEach(timeout => clearTimeout(timeout));
            session.urlNotificationTimeouts.clear();
        }

        try {
            session.pty.kill();
        } catch (error) {
            console.error('Error killing PTY process:', error);
        }

        this.sessions.delete(this.getSessionKey(userId));
    }

    getActiveSessions(): number {
        return this.sessions.size;
    }

    setLastScreenshotMessageId(userId: string, messageId: number): void {
        const session = this.sessions.get(this.getSessionKey(userId));
        if (session) {
            session.lastScreenshotMessageId = messageId;
        }
    }

    getLastScreenshotMessageId(userId: string): number | undefined {
        const session = this.sessions.get(this.getSessionKey(userId));
        return session?.lastScreenshotMessageId;
    }

    setRefreshInterval(userId: string, interval: NodeJS.Timeout): void {
        const session = this.sessions.get(this.getSessionKey(userId));
        if (session) {
            session.refreshInterval = interval;
        }
    }

    getRefreshInterval(userId: string): NodeJS.Timeout | undefined {
        const session = this.sessions.get(this.getSessionKey(userId));
        return session?.refreshInterval;
    }

    clearRefreshInterval(userId: string): void {
        const session = this.sessions.get(this.getSessionKey(userId));
        if (session?.refreshInterval) {
            clearInterval(session.refreshInterval);
            session.refreshInterval = undefined;
        }
    }

    getDiscoveredUrls(userId: string): string[] {
        const session = this.sessions.get(this.getSessionKey(userId));
        if (!session?.discoveredUrls) {
            return [];
        }
        return Array.from(session.discoveredUrls);
    }

    setUrlNotificationTimeout(userId: string, messageId: number, timeout: NodeJS.Timeout): void {
        const session = this.sessions.get(this.getSessionKey(userId));
        if (session) {
            if (!session.urlNotificationTimeouts) {
                session.urlNotificationTimeouts = new Map<number, NodeJS.Timeout>();
            }
            session.urlNotificationTimeouts.set(messageId, timeout);
        }
    }

    clearUrlNotificationTimeout(userId: string, messageId: number): void {
        const session = this.sessions.get(this.getSessionKey(userId));
        if (session?.urlNotificationTimeouts) {
            const timeout = session.urlNotificationTimeouts.get(messageId);
            if (timeout) {
                clearTimeout(timeout);
                session.urlNotificationTimeouts.delete(messageId);
            }
        }
    }

    private startBufferMonitoring(userId: string): void {
        const session = this.sessions.get(this.getSessionKey(userId));
        if (!session) {
            return;
        }

        // Check buffer every second
        session.bufferMonitorInterval = setInterval(() => {
            const currentBuffer = session.output.join('');
            const now = new Date();

            // Check if buffer has changed since last check
            if (currentBuffer !== session.lastBufferSnapshot) {
                session.lastBufferSnapshot = currentBuffer;
                session.lastBufferChangeTime = now;
            } else {
                // Buffer hasn't changed - check if 5 seconds have passed
                const timeSinceLastChange = now.getTime() - (session.lastBufferChangeTime?.getTime() || 0);

                if (timeSinceLastChange >= 5000) {
                    // Buffer hasn't changed for 5 seconds
                    if (session.onBufferingEndedCallback) {
                        session.onBufferingEndedCallback(userId, session.chatId);
                    }

                    // Clear the interval to prevent repeated notifications
                    if (session.bufferMonitorInterval) {
                        clearInterval(session.bufferMonitorInterval);
                        session.bufferMonitorInterval = undefined;
                    }
                }
            }
        }, 1000);
    }

    private startTimeoutChecker(): void {
        this.timeoutCheckerInterval = setInterval(() => {
            const now = new Date();
            const sessionsToRemove: string[] = [];

            this.sessions.forEach((session, sessionKey) => {
                const idleTime = now.getTime() - session.lastActivity.getTime();
                if (idleTime > this.config.sessionTimeout) {
                    sessionsToRemove.push(sessionKey);
                }
            });

            sessionsToRemove.forEach((sessionKey) => {
                console.log(`Session timeout for ${sessionKey}`);
                try {
                    this.closeSession(sessionKey);
                } catch (error) {
                    console.error(`Error closing timed out session for ${sessionKey}:`, error);
                }
            });
        }, 60000);
    }

    cleanup(): void {
        if (this.timeoutCheckerInterval) {
            clearInterval(this.timeoutCheckerInterval);
        }

        this.sessions.forEach((session, sessionKey) => {
            try {
                session.pty.kill();
            } catch (error) {
                console.error(`Error killing PTY for session ${sessionKey}:`, error);
            }
        });

        this.sessions.clear();
    }
}
