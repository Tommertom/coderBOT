import { Bot } from 'grammy';
import type { BotCommand } from '@grammyjs/types';

/**
 * Utility for managing dynamic bot command menus
 */
export class CommandMenuUtils {
    private static readonly COMMANDS_NO_SESSION: BotCommand[] = [
        { command: 'copilot', description: 'Start a new terminal session with Copilot' },
        { command: 'opencode', description: 'Start a new terminal session with OpenCode' },
        { command: 'gemini', description: 'Start a new terminal session with Gemini' },
        { command: 'xterm', description: 'Start a raw terminal session (no AI)' },
        { command: 'screen', description: 'Capture and view terminal screenshot' },
        { command: 'projects', description: 'List and select project directories' },
        { command: 'macros', description: 'Show configured message placeholders (m0-m9)' },
        { command: 'help', description: 'Show complete command reference' },
        { command: 'close', description: 'Close the current terminal session' },
        { command: 'start', description: 'Show welcome and quick start guide' },
    ];

    private static readonly COMMANDS_WITH_SESSION: BotCommand[] = [
        { command: 'screen', description: 'Capture and view terminal screenshot' },
        { command: 'esc', description: 'Send Escape key' },
        { command: 'close', description: 'Close the current terminal session' },
        { command: 'projects', description: 'List and select project directories' },
        { command: 'macros', description: 'Show configured message placeholders (m0-m9)' },
        { command: 'tab', description: 'Send Tab character' },
        { command: 'enter', description: 'Send Enter key' },
        { command: 'ctrlc', description: 'Send Ctrl+C (interrupt)' },
        { command: 'help', description: 'Show complete command reference' },
        { command: 'start', description: 'Show welcome and quick start guide' },
    ];

    /**
     * Update command menu to show session commands (with /close, without AI assistants)
     */
    static async setSessionCommands(bot: Bot): Promise<void> {
        try {
            await bot.api.setMyCommands(CommandMenuUtils.COMMANDS_WITH_SESSION);
        } catch (error) {
            console.error('Failed to update command menu to session mode:', error);
        }
    }

    /**
     * Update command menu to show no-session commands (with AI assistants, without /close)
     */
    static async setNoSessionCommands(bot: Bot): Promise<void> {
        try {
            await bot.api.setMyCommands(CommandMenuUtils.COMMANDS_NO_SESSION);
        } catch (error) {
            console.error('Failed to update command menu to no-session mode:', error);
        }
    }
}
