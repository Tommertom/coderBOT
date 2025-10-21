export interface CoderSession {
    userId: string;
    chatId: number;
    createdAt: Date;
    lastActivity: Date;
}

export interface CoderConfig {
    mediaPath: string;
    receivedPath: string;
}
