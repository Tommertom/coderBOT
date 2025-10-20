import * as pty from 'node-pty';
import { PtySession, XtermConfig, DEFAULT_CONFIG } from './xterm.types.js';

export class XtermService {
    private sessions: Map<string, PtySession> = new Map();
    private config: XtermConfig;
    private timeoutCheckerInterval: NodeJS.Timeout | null = null;

    constructor(config: Partial<XtermConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.startTimeoutChecker();
    }

    private getSessionKey(botId: string, userId: string): string {
        return `${botId}:${userId}`;
    }

    createSession(botId: string, userId: string, chatId: number, onDataCallback?: (userId: string, chatId: number, data: string) => void): void {
        const sessionKey = this.getSessionKey(botId, userId);
        if (this.sessions.has(sessionKey)) {
            throw new Error('Session already exists for this user with this bot');
        }

        try {
            const ptyProcess = pty.spawn(this.config.shellPath, [], {
                name: 'xterm-color',
                cols: this.config.terminalCols,
                rows: this.config.terminalRows,
                cwd: process.env.HOME || '/tmp',
                env: process.env as { [key: string]: string },
            });

            const session: PtySession = {
                pty: ptyProcess,
                output: [],
                lastActivity: new Date(),
                rows: this.config.terminalRows,
                cols: this.config.terminalCols,
                chatId,
                onDataCallback,
            };

            ptyProcess.onData((data) => {
                session.output.push(data);
                if (session.output.length > this.config.maxOutputLines) {
                    session.output.shift();
                }
                session.lastActivity = new Date();

                // Pass all data to the callback if provided
                if (session.onDataCallback) {
                    session.onDataCallback(userId, chatId, data);
                }
            });

            ptyProcess.onExit(() => {
                this.sessions.delete(sessionKey);
            });

            this.sessions.set(sessionKey, session);
        } catch (error) {
            throw new Error(`Failed to spawn PTY: ${error}`);
        }
    }

    hasSession(botId: string, userId: string): boolean {
        return this.sessions.has(this.getSessionKey(botId, userId));
    }

    writeToSession(botId: string, userId: string, data: string): void {
        const session = this.sessions.get(this.getSessionKey(botId, userId));
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

    writeRawToSession(botId: string, userId: string, data: string): void {
        const session = this.sessions.get(this.getSessionKey(botId, userId));
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

    async getSessionOutput(botId: string, userId: string, waitMs: number = 500): Promise<string> {
        const session = this.sessions.get(this.getSessionKey(botId, userId));
        if (!session) {
            throw new Error('No active session found');
        }

        await new Promise(resolve => setTimeout(resolve, waitMs));

        return session.output.join('');
    }

    getSessionOutputBuffer(botId: string, userId: string): string[] {
        const session = this.sessions.get(this.getSessionKey(botId, userId));
        if (!session) {
            throw new Error('No active session found');
        }

        return [...session.output];
    }

    getSessionDimensions(botId: string, userId: string): { rows: number; cols: number } {
        const session = this.sessions.get(this.getSessionKey(botId, userId));
        if (!session) {
            throw new Error('No active session found');
        }

        return {
            rows: session.rows,
            cols: session.cols,
        };
    }

    closeSession(botId: string, userId: string): void {
        const session = this.sessions.get(this.getSessionKey(botId, userId));
        if (!session) {
            throw new Error('No active session found');
        }

        try {
            session.pty.kill();
        } catch (error) {
            console.error('Error killing PTY process:', error);
        }

        this.sessions.delete(this.getSessionKey(botId, userId));
    }

    getActiveSessions(): number {
        return this.sessions.size;
    }

    setLastScreenshotMessageId(botId: string, userId: string, messageId: number): void {
        const session = this.sessions.get(this.getSessionKey(botId, userId));
        if (session) {
            session.lastScreenshotMessageId = messageId;
        }
    }

    getLastScreenshotMessageId(botId: string, userId: string): number | undefined {
        const session = this.sessions.get(this.getSessionKey(botId, userId));
        return session?.lastScreenshotMessageId;
    }

    private startTimeoutChecker(): void {
        this.timeoutCheckerInterval = setInterval(() => {
            const now = new Date();
            const sessionsToRemove: { sessionKey: string; botId: string; userId: string }[] = [];

            this.sessions.forEach((session, sessionKey) => {
                const idleTime = now.getTime() - session.lastActivity.getTime();
                if (idleTime > this.config.sessionTimeout) {
                    // Extract botId and userId from composite key
                    const [botId, userId] = sessionKey.split(':');
                    sessionsToRemove.push({ sessionKey, botId, userId });
                }
            });

            sessionsToRemove.forEach(({ sessionKey, botId, userId }) => {
                console.log(`Session timeout for ${sessionKey}`);
                try {
                    this.closeSession(botId, userId);
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

export const xtermService = new XtermService();
