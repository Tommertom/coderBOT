/**
 * Utility functions for extracting URLs from terminal output
 */

const URL_REGEX = /https?:\/\/(?:(?:[a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+(?:\.[a-zA-Z]{2,})?|localhost|(?:\d{1,3}\.){3}\d{1,3})(?::\d{1,5})?(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)/gi;

export class UrlExtractionUtils {
    /**
     * Extract all URLs from text using a comprehensive regex pattern
     */
    static extractUrls(text: string): string[] {
        const matches = text.match(URL_REGEX);
        return matches ? [...new Set(matches)] : [];
    }

    /**
     * Remove ANSI escape codes from text before URL extraction
     */
    static stripAnsiCodes(text: string): string {
        // eslint-disable-next-line no-control-regex
        return text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
    }

    /**
     * Extract URLs from text with ANSI codes stripped
     */
    static extractUrlsFromTerminalOutput(text: string): string[] {
        const cleanText = this.stripAnsiCodes(text);
        return this.extractUrls(cleanText);
    }
}
