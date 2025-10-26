/**
 * Message constants for consistent messaging across the application
 */
export const Messages = {
    // Session-related messages
    NO_ACTIVE_SESSION: '❌ No active session.\n\nUse /start to create one.',
    SESSION_ALREADY_EXISTS: '⚠️ You already have an active terminal session.\n\n' +
        'Use /close to terminate it first, or continue using it.',

    // View/refresh hints
    VIEW_SCREEN_HINT: 'Use /screen to view the output or refresh.',

    // Session close messages
    NO_SESSION_TO_CLOSE: '⚠️ No active terminal session to close.\n\nUse /start to start one.',

    // Callback query errors
    INVALID_CALLBACK: '❌ Invalid callback',
    NO_ACTIVE_TERMINAL_SESSION: '❌ No active terminal session',

    // Status messages
    REFRESHING: '🔄 Refreshing...',
    CAPTURING_SCREEN: '📸 Capturing terminal screen...',
    SPAWNING_SESSION: '🚀 Spawning now...',
} as const;

/**
 * Success message templates
 */
export const SuccessMessages = {
    SENT: (text?: string) => text ? `✅ Sent: ${text}` : '✅ Sent',
    SENT_WITH_HINT: (text?: string) =>
        `✅ Sent${text ? `: ${text}` : ''}\n\n${Messages.VIEW_SCREEN_HINT}`,
    SENT_CONTROL_KEY: (key: string) =>
        `✅ Sent Ctrl+${key}\n\n${Messages.VIEW_SCREEN_HINT}`,
    SENT_SPECIAL_KEY: (keyName: string) =>
        `✅ Sent ${keyName}\n\n${Messages.VIEW_SCREEN_HINT}`,
} as const;

/**
 * Error action descriptions for consistent error formatting
 */
export const ErrorActions = {
    START_TERMINAL: 'start terminal session',
    SEND_TO_TERMINAL: 'send to terminal',
    CLOSE_TERMINAL: 'close terminal session',
    SEND_KEY: 'send key',
    SEND_TAB: 'send Tab',
    SEND_ENTER: 'send Enter',
    SEND_SPACE: 'send Space',
    SEND_DELETE: 'send Delete key',
    SEND_CTRL_C: 'send Ctrl+C',
    SEND_CTRL_X: 'send Ctrl+X',
    SEND_ESCAPE: 'send Escape key',
    SEND_CONTROL_CHARACTER: 'send control character',
    SEND_KEYS: 'send keys',
    CAPTURE_SCREEN: 'capture terminal screen',
    CREATE_TERMINAL: 'create terminal session',
} as const;
