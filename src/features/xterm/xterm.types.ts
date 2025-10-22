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
    refreshInterval?: NodeJS.Timeout;
    discoveredUrls?: Set<string>;
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
