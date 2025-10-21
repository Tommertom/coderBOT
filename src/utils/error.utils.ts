/**
 * Utility class for error formatting and handling
 */
export class ErrorUtils {
    /**
     * Extracts a readable error message from an unknown error type
     * @param error - The error to format
     * @returns A human-readable error message string
     */
    static formatError(error: unknown): string {
        return error instanceof Error ? error.message : 'Unknown error';
    }

    /**
     * Creates a standardized error message for failed actions
     * @param action - Description of the action that failed (e.g., "send to terminal")
     * @param error - The error that occurred
     * @returns A formatted error message string
     */
    static createErrorMessage(action: string, error: unknown): string {
        return `❌ Failed to ${action}.\n\n` +
            `Error: ${ErrorUtils.formatError(error)}`;
    }
}
