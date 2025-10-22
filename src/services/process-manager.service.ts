import { ChildProcess, fork } from 'child_process';
import * as path from 'path';
import { IPCMessage, IPCMessageType, HealthCheckResponse } from '../types/ipc.types.js';

export interface BotProcessInfo {
    botId: string;
    token: string;
    pid: number | null;
    status: 'running' | 'stopped' | 'starting' | 'stopping' | 'error';
    startTime: Date | null;
    uptime: number;
    lastError: string | null;
    logs: string[];
}

export class ProcessManager {
    private processes: Map<string, ChildProcess> = new Map();
    private processInfo: Map<string, BotProcessInfo> = new Map();
    private readonly MAX_LOG_LINES = 100;

    async startBot(botId: string, token: string): Promise<void> {
        if (this.processes.has(botId)) {
            throw new Error(`Bot ${botId} is already running`);
        }

        const info: BotProcessInfo = {
            botId,
            token: this.maskToken(token),
            pid: null,
            status: 'starting',
            startTime: null,
            uptime: 0,
            lastError: null,
            logs: [],
        };

        this.processInfo.set(botId, info);

        try {
            const workerPath = path.join(process.cwd(), 'dist', 'bot-worker.js');
            
            const childProcess = fork(workerPath, [], {
                env: {
                    ...process.env,
                    BOT_ID: botId,
                    TELEGRAM_BOT_TOKENS: token,
                },
                stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
            });

            info.pid = childProcess.pid || null;
            info.startTime = new Date();
            info.status = 'running';

            this.processes.set(botId, childProcess);

            childProcess.on('message', (message: IPCMessage) => {
                this.handleIPCMessage(botId, message);
            });

            childProcess.stdout?.on('data', (data: Buffer) => {
                const logLine = data.toString().trim();
                this.addLog(botId, `[STDOUT] ${logLine}`);
            });

            childProcess.stderr?.on('data', (data: Buffer) => {
                const logLine = data.toString().trim();
                this.addLog(botId, `[STDERR] ${logLine}`);
            });

            childProcess.on('exit', (code, signal) => {
                this.handleProcessExit(botId, code, signal);
            });

            childProcess.on('error', (error) => {
                this.handleProcessError(botId, error);
            });

            console.log(`✅ Bot ${botId} started with PID ${info.pid}`);
        } catch (error) {
            info.status = 'error';
            info.lastError = error instanceof Error ? error.message : 'Unknown error';
            throw error;
        }
    }

    async stopBot(botId: string): Promise<void> {
        const process = this.processes.get(botId);
        const info = this.processInfo.get(botId);

        if (!process || !info) {
            throw new Error(`Bot ${botId} is not running`);
        }

        info.status = 'stopping';

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                process.kill('SIGKILL');
                reject(new Error(`Bot ${botId} did not stop gracefully, killed`));
            }, 10000);

            process.once('exit', () => {
                clearTimeout(timeout);
                resolve();
            });

            const shutdownMessage: IPCMessage = {
                type: IPCMessageType.SHUTDOWN,
                botId,
                timestamp: new Date(),
            };

            process.send(shutdownMessage, (error) => {
                if (error) {
                    clearTimeout(timeout);
                    process.kill('SIGTERM');
                }
            });
        });
    }

    async restartBot(botId: string): Promise<void> {
        const info = this.processInfo.get(botId);
        if (!info) {
            throw new Error(`Bot ${botId} not found`);
        }

        const token = info.token;
        
        if (this.processes.has(botId)) {
            await this.stopBot(botId);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        await this.startBot(botId, token);
    }

    async stopAllBots(): Promise<void> {
        const stopPromises = Array.from(this.processes.keys()).map(botId =>
            this.stopBot(botId).catch(err => 
                console.error(`Failed to stop ${botId}:`, err)
            )
        );

        await Promise.all(stopPromises);
    }

    async startAllBots(): Promise<void> {
        const startPromises = Array.from(this.processInfo.entries())
            .filter(([botId]) => !this.processes.has(botId))
            .map(([botId, info]) =>
                this.startBot(botId, info.token).catch(err =>
                    console.error(`Failed to start ${botId}:`, err)
                )
            );

        await Promise.all(startPromises);
    }

    async restartAllBots(): Promise<void> {
        await this.stopAllBots();
        await new Promise(resolve => setTimeout(resolve, 2000));
        await this.startAllBots();
    }

    getBotStatus(botId: string): BotProcessInfo | undefined {
        const info = this.processInfo.get(botId);
        if (!info) return undefined;

        if (info.startTime && info.status === 'running') {
            info.uptime = Date.now() - info.startTime.getTime();
        }

        return { ...info };
    }

    getAllBotStatuses(): BotProcessInfo[] {
        return Array.from(this.processInfo.values()).map(info => {
            if (info.startTime && info.status === 'running') {
                info.uptime = Date.now() - info.startTime.getTime();
            }
            return { ...info };
        });
    }

    isBotRunning(botId: string): boolean {
        const info = this.processInfo.get(botId);
        return info?.status === 'running' && this.processes.has(botId);
    }

    getBotLogs(botId: string, lines: number = 50): string[] {
        const info = this.processInfo.get(botId);
        if (!info) return [];

        return info.logs.slice(-lines);
    }

    async performHealthCheck(botId: string): Promise<boolean> {
        const process = this.processes.get(botId);
        if (!process) return false;

        return new Promise((resolve) => {
            const timeout = setTimeout(() => resolve(false), 5000);

            const healthCheckMessage: IPCMessage = {
                type: IPCMessageType.HEALTH_CHECK,
                botId,
                timestamp: new Date(),
            };

            const messageHandler = (message: IPCMessage) => {
                if (message.type === IPCMessageType.HEALTH_RESPONSE && message.botId === botId) {
                    clearTimeout(timeout);
                    process.off('message', messageHandler);
                    resolve(true);
                }
            };

            process.on('message', messageHandler);
            process.send(healthCheckMessage);
        });
    }

    private handleIPCMessage(botId: string, message: IPCMessage): void {
        const info = this.processInfo.get(botId);
        if (!info) return;

        switch (message.type) {
            case IPCMessageType.LOG_MESSAGE:
                this.addLog(botId, `[IPC] ${message.data}`);
                break;
            case IPCMessageType.ERROR:
                info.lastError = message.data;
                this.addLog(botId, `[ERROR] ${message.data}`);
                break;
            case IPCMessageType.STATUS_UPDATE:
                this.addLog(botId, `[STATUS] ${JSON.stringify(message.data)}`);
                break;
        }
    }

    private handleProcessExit(botId: string, code: number | null, signal: string | null): void {
        const info = this.processInfo.get(botId);
        if (!info) return;

        this.processes.delete(botId);
        info.status = 'stopped';
        info.pid = null;

        const exitMsg = signal 
            ? `Bot ${botId} exited with signal ${signal}`
            : `Bot ${botId} exited with code ${code}`;
        
        console.log(exitMsg);
        this.addLog(botId, exitMsg);

        if (code !== 0 && code !== null) {
            info.status = 'error';
            info.lastError = `Exited with code ${code}`;
        }
    }

    private handleProcessError(botId: string, error: Error): void {
        const info = this.processInfo.get(botId);
        if (!info) return;

        info.status = 'error';
        info.lastError = error.message;
        this.addLog(botId, `[ERROR] ${error.message}`);
        console.error(`Bot ${botId} error:`, error);
    }

    private addLog(botId: string, message: string): void {
        const info = this.processInfo.get(botId);
        if (!info) return;

        const timestamp = new Date().toISOString();
        info.logs.push(`[${timestamp}] ${message}`);

        if (info.logs.length > this.MAX_LOG_LINES) {
            info.logs.shift();
        }
    }

    private maskToken(token: string): string {
        if (token.length <= 8) return '***';
        return token.substring(0, 4) + '...' + token.substring(token.length - 4);
    }

    cleanup(): void {
        this.stopAllBots().catch(console.error);
    }
}
