export interface CustomCoder {
    userId: string;
    coderName: string;
    createdAt: string;
    lastUsed: string;
    metadata: {
        botId: string;
        version: string;
    };
}

export interface ValidationResult {
    valid: boolean;
    error?: string;
}

export interface StartupPromptConfig {
    botId: string;
    assistantType: string;
    message: string;
    timestamp: string;
}
