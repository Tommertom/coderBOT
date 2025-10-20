import type { IPty } from 'node-pty';

export interface PtySession {
    pty: IPty;
    output: string[];
    lastActivity: Date;
    rows: number;
    cols: number;
    chatId: number;
    onDataCallback?: (userId: string, chatId: number, data: string) => void;
    lastScreenshotMessageId?: number;
}

export interface XtermSession {
    userId: string;
    chatId: number;
    createdAt: Date;
    lastActivity: Date;
}

export interface XtermConfig {
    maxOutputLines: number;
    sessionTimeout: number;
    terminalRows: number;
    terminalCols: number;
    shellPath: string;
}

export const DEFAULT_CONFIG: XtermConfig = {
    maxOutputLines: parseInt(process.env.XTERM_MAX_OUTPUT_LINES || '1000'),
    sessionTimeout: parseInt(process.env.XTERM_SESSION_TIMEOUT || '1800000'),
    terminalRows: parseInt(process.env.XTERM_TERMINAL_ROWS || '50'),
    terminalCols: parseInt(process.env.XTERM_TERMINAL_COLS || '100'),
    shellPath: process.env.XTERM_SHELL_PATH || '/bin/bash',
};
