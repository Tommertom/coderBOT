/**
 * Utility class for sanitizing terminal output text
 */
export class TextSanitizationUtils {
    // Telegram message limit is 4096 characters
    private static readonly TELEGRAM_MESSAGE_LIMIT = 4096;
    
    // Reserve space for formatting (code block markers, etc.)
    private static readonly FORMATTING_RESERVE = 20;
    
    // Maximum usable characters for message content
    private static readonly MAX_MESSAGE_CONTENT = 
        TextSanitizationUtils.TELEGRAM_MESSAGE_LIMIT - TextSanitizationUtils.FORMATTING_RESERVE;

    /**
     * Remove ANSI escape codes from text
     * @param text - Text containing ANSI codes
     * @returns Clean text without ANSI codes
     */
    static removeAnsiCodes(text: string): string {
        // Remove ANSI escape sequences
        // Matches: ESC[ followed by any number of parameters and a final character
        return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
                   .replace(/\x1b\][0-9];[^\x07]*\x07/g, '') // OSC sequences
                   .replace(/\x1b[=>]/g, '') // Other ESC sequences
                   .replace(/\x1b\([0-9AB]/g, ''); // Character set selection
    }

    /**
     * Remove other control characters that shouldn't appear in messages
     * @param text - Text to clean
     * @returns Text without problematic control characters
     */
    static removeControlCharacters(text: string): string {
        // Keep common whitespace characters (space, tab, newline, carriage return)
        // Remove other control characters (0x00-0x1F except \t \n \r, and 0x7F)
        return text.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
    }

    /**
     * Sanitize terminal output for display in a Telegram message
     * @param text - Raw terminal output
     * @param maxLength - Maximum length (defaults to Telegram limit minus formatting)
     * @returns Sanitized text safe for Telegram
     */
    static sanitizeTerminalOutput(text: string, maxLength?: number): string {
        const limit = maxLength || TextSanitizationUtils.MAX_MESSAGE_CONTENT;
        
        // Remove ANSI codes
        let cleaned = TextSanitizationUtils.removeAnsiCodes(text);
        
        // Remove problematic control characters
        cleaned = TextSanitizationUtils.removeControlCharacters(cleaned);
        
        // Trim to maximum length if needed
        if (cleaned.length > limit) {
            cleaned = cleaned.substring(cleaned.length - limit);
            // Try to start from a newline if possible for cleaner output
            const firstNewline = cleaned.indexOf('\n');
            if (firstNewline > 0 && firstNewline < 100) {
                cleaned = cleaned.substring(firstNewline + 1);
            }
        }
        
        return cleaned;
    }

    /**
     * Get the last N characters from terminal output buffer, sanitized
     * @param outputBuffer - Array of output strings
     * @param charCount - Number of characters to retrieve (default: 500)
     * @returns Sanitized text from the end of the buffer
     */
    static getLastCharactersSanitized(outputBuffer: string[], charCount: number = 500): string {
        const fullOutput = outputBuffer.join('');
        const lastChars = fullOutput.slice(-charCount);
        return TextSanitizationUtils.sanitizeTerminalOutput(lastChars, charCount);
    }

    /**
     * Format sanitized text for Telegram code block
     * @param text - Sanitized text
     * @returns Text wrapped in code block
     */
    static formatAsCodeBlock(text: string): string {
        // Ensure text doesn't break code block formatting
        const safeText = text.replace(/```/g, "'''");
        return '```\n' + safeText + '\n```';
    }
}
