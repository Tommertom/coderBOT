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

export const DEFAULT_CODER_CONFIG: CoderConfig = {
    mediaPath: process.env.MEDIA_TMP_LOCATION || '/tmp/coderBOT_media',
    receivedPath: process.env.MEDIA_TMP_LOCATION
        ? `${process.env.MEDIA_TMP_LOCATION}/received`
        : '/tmp/coderBOT_media/received',
};
