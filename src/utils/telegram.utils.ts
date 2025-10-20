/**
 * Telegram message utilities
 * Handles message splitting and formatting for Telegram's API limitations
 */

// Telegram's maximum message length
const TELEGRAM_MAX_MESSAGE_LENGTH = 4096;

/**
 * Escape special characters for MarkdownV2 parse mode.
 * According to Telegram API, these characters must be escaped: _ * [ ] ( ) ~ ` > # + - = | { } . !
 * 
 * @param text - Text to escape
 * @returns Escaped text safe for MarkdownV2
 */
function escapeMarkdownV2(text: string): string {
    return text.replace(/([_*\[\]()~`>#+=|{}.!-])/g, '\\$1');
}

/**
 * Escape special characters for HTML parse mode.
 * According to Telegram API, these characters must be escaped: < > &
 * 
 * @param text - Text to escape
 * @returns Escaped text safe for HTML
 */
function escapeHTML(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Escape special characters for Markdown parse mode (legacy).
 * According to Telegram API, these characters must be escaped: _ * [ ] ( ) `
 * 
 * @param text - Text to escape
 * @returns Escaped text safe for Markdown
 */
function escapeMarkdown(text: string): string {
    return text.replace(/([_*\[\]()` ])/g, '\\$1');
}

/**
 * Escape special characters in message text based on parse mode.
 * 
 * @param text - Text to escape
 * @param parseMode - Parse mode: 'HTML', 'Markdown', 'MarkdownV2', or undefined for plain text
 * @returns Escaped text safe for the specified parse mode
 */
export function escapeMessage(text: string, parseMode?: string): string {
    if (!parseMode || parseMode.toLowerCase() === 'none') {
        // Plain text - no escaping needed for Telegram API,
        // but remove any control characters that might cause issues
        return text.replace(/[\x00-\x1F\x7F]/g, '');
    }

    const mode = parseMode.toLowerCase();

    switch (mode) {
        case 'html':
            return escapeHTML(text);
        case 'markdown':
            return escapeMarkdown(text);
        case 'markdownv2':
            return escapeMarkdownV2(text);
        default:
            console.warn(`Unknown parse mode: ${parseMode}, treating as plain text`);
            return text.replace(/[\x00-\x1F\x7F]/g, '');
    }
}

/**
 * Split a long message into chunks that fit within Telegram's message length limit.
 * Attempts to split at natural boundaries (newlines, sentences, words) to maintain readability.
 * 
 * @param message - The message to split
 * @param maxLength - Maximum length per chunk (default: 4096 for Telegram)
 * @returns Array of message chunks
 */
export function splitLongMessage(message: string, maxLength: number = TELEGRAM_MAX_MESSAGE_LENGTH): string[] {
    // If message fits within limit, return as-is
    if (message.length <= maxLength) {
        return [message];
    }

    const chunks: string[] = [];
    let remainingText = message;

    while (remainingText.length > 0) {
        // If remaining text fits in one chunk, add it and we're done
        if (remainingText.length <= maxLength) {
            chunks.push(remainingText);
            break;
        }

        // Find the best split point within maxLength
        let splitPoint = maxLength;
        const chunk = remainingText.substring(0, maxLength);

        // Try to split at a paragraph break (double newline)
        const paragraphBreak = chunk.lastIndexOf('\n\n');
        if (paragraphBreak > maxLength * 0.5) {
            splitPoint = paragraphBreak + 2; // Include the newlines
        }
        // Try to split at a single newline
        else {
            const newlineBreak = chunk.lastIndexOf('\n');
            if (newlineBreak > maxLength * 0.5) {
                splitPoint = newlineBreak + 1; // Include the newline
            }
            // Try to split at a sentence boundary
            else {
                const sentenceBreak = Math.max(
                    chunk.lastIndexOf('. '),
                    chunk.lastIndexOf('! '),
                    chunk.lastIndexOf('? ')
                );
                if (sentenceBreak > maxLength * 0.5) {
                    splitPoint = sentenceBreak + 2; // Include the punctuation and space
                }
                // Try to split at a word boundary
                else {
                    const wordBreak = chunk.lastIndexOf(' ');
                    if (wordBreak > maxLength * 0.5) {
                        splitPoint = wordBreak + 1; // Include the space
                    }
                    // Last resort: split at maxLength (might break words)
                    else {
                        splitPoint = maxLength;
                    }
                }
            }
        }

        // Add the chunk and continue with remaining text
        // Trim whitespace only if we split at a natural boundary
        const currentChunk = remainingText.substring(0, splitPoint);
        const nextStart = splitPoint;

        chunks.push(currentChunk.trimEnd());
        remainingText = remainingText.substring(nextStart);

        // Only trim start of next chunk if previous split was at a space/newline boundary
        if (remainingText.length > 0 && /^\s/.test(remainingText)) {
            remainingText = remainingText.trimStart();
        }
    }

    return chunks;
}

/**
 * Send a message that might be too long by splitting it into multiple messages.
 * Uses the Telegram context's reply method to send each chunk.
 * Optionally escapes special characters based on parse mode.
 * 
 * @param ctx - Telegram context with reply method
 * @param message - The message to send
 * @param options - Optional Telegram message options (applied to all chunks)
 * @param escapeText - If true, automatically escape special characters based on parse_mode in options
 * @returns Promise that resolves when all chunks are sent
 */
export async function sendLongMessage(
    ctx: { reply: (text: string, options?: any) => Promise<any> },
    message: string,
    options?: any,
    escapeText: boolean = false
): Promise<void> {
    // Escape message if requested and parse_mode is specified
    let processedMessage = message;
    if (escapeText && options?.parse_mode) {
        processedMessage = escapeMessage(message, options.parse_mode);
        console.log(`🔒 Escaped message for ${options.parse_mode} mode`);
    }

    const chunks = splitLongMessage(processedMessage);

    // If message was split, add continuation indicators
    if (chunks.length > 1) {
        console.log(`📝 Message split into ${chunks.length} parts due to length (${processedMessage.length} chars)`);
    }

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        // Add part indicator for multi-part messages
        const partIndicator = chunks.length > 1 ? `\n\n[Part ${i + 1}/${chunks.length}]` : '';
        const messageToSend = i === chunks.length - 1 ? chunk : chunk + partIndicator;

        try {
            await ctx.reply(messageToSend, options);

            // Add a small delay between messages to avoid rate limiting
            if (i < chunks.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        } catch (error) {
            console.error(`❌ Error sending message part ${i + 1}/${chunks.length}:`, error);
            throw error;
        }
    }
}
