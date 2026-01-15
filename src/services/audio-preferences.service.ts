/**
 * Service to manage per-user audio transcription preferences
 * Allows users to choose between copy-paste mode or direct prompting mode
 */

export enum AudioTranscriptionMode {
    COPY = 'copy',      // Return transcribed text for copy-pasting (default)
    PROMPT = 'prompt'   // Directly send transcribed text as prompt to terminal
}

export class AudioPreferencesService {
    private userTranscriptionModes: Map<string, AudioTranscriptionMode> = new Map();

    /**
     * Set transcription mode for a specific user
     */
    setTranscriptionMode(userId: string, mode: AudioTranscriptionMode): void {
        this.userTranscriptionModes.set(userId, mode);
    }

    /**
     * Get transcription mode for a specific user
     * Returns COPY mode as default if user hasn't set a preference
     */
    getTranscriptionMode(userId: string): AudioTranscriptionMode {
        return this.userTranscriptionModes.get(userId) || AudioTranscriptionMode.COPY;
    }

    /**
     * Toggle transcription mode for a user
     * Returns the new mode
     */
    toggleTranscriptionMode(userId: string): AudioTranscriptionMode {
        const currentMode = this.getTranscriptionMode(userId);
        const newMode = currentMode === AudioTranscriptionMode.COPY 
            ? AudioTranscriptionMode.PROMPT 
            : AudioTranscriptionMode.COPY;
        this.setTranscriptionMode(userId, newMode);
        return newMode;
    }

    /**
     * Check if user has set a custom preference
     */
    hasCustomPreference(userId: string): boolean {
        return this.userTranscriptionModes.has(userId);
    }

    /**
     * Clear user preference (revert to default COPY mode)
     */
    clearUserPreference(userId: string): void {
        this.userTranscriptionModes.delete(userId);
    }

    /**
     * Get all users with custom preferences
     */
    getUsersWithCustomPreferences(): string[] {
        return Array.from(this.userTranscriptionModes.keys());
    }
}
