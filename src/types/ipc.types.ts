/**
 * IPC Communication Types for Parent-Child Process Communication
 */

export enum IPCMessageType {
    HEALTH_CHECK = 'health_check',
    HEALTH_RESPONSE = 'health_response',
    SHUTDOWN = 'shutdown',
    LOG_MESSAGE = 'log_message',
    ERROR = 'error',
    STATUS_UPDATE = 'status_update',
}

export interface IPCMessage {
    type: IPCMessageType;
    botId: string;
    data?: any;
    timestamp: Date;
}

export interface HealthCheckResponse {
    healthy: boolean;
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
}
