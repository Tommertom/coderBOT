import { DEFAULT_CODER_CONFIG, type CoderConfig } from './coder.types.js';

export interface TerminalDataHandlers {
    onBell?: (userId: string, chatId: number) => void;
    onConfirmationPrompt?: (userId: string, chatId: number, data: string) => void;
    onPromptDetected?: (userId: string, chatId: number, data: string) => void;
}

export class CoderService {
    private config: CoderConfig;

    constructor() {
        this.config = DEFAULT_CODER_CONFIG;
    }

    getMediaPath(): string {
        return this.config.mediaPath;
    }

    getReceivedPath(): string {
        return this.config.receivedPath;
    }

    replaceMediaPlaceholder(text: string): string {
        return text.replace(/\[media\]/gi, this.config.mediaPath);
    }

    /**
     * Creates a terminal data handler that detects specific patterns in terminal output
     * and triggers appropriate callbacks
     */
    createTerminalDataHandler(handlers: TerminalDataHandlers): (userId: string, chatId: number, data: string) => void {
        return (userId: string, chatId: number, data: string) => {
            // Check for BEL character (ASCII 0x07)
            if (data.includes('\x07') && handlers.onBell) {
                handlers.onBell(userId, chatId);
            } // "│ ❯ 1."

            // Check for Copilot confirmation prompts
            if (data.includes(' ❯ 1.') && handlers.onConfirmationPrompt) {
                handlers.onConfirmationPrompt(userId, chatId, data);
                console.log('Detected Copilot confirmation prompt');
            }

            // Check for prompt with > character
            if (data.includes('>') && handlers.onPromptDetected) {
                handlers.onPromptDetected(userId, chatId, data);
            }
        };
    }
}
