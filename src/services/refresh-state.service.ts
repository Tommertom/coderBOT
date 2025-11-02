/**
 * Service to manage per-user screen refresh state
 * Allows users to enable/disable auto-refresh without modifying .env
 */
export class RefreshStateService {
    private userRefreshStates: Map<string, boolean> = new Map();

    /**
     * Set refresh state for a specific user
     */
    setRefreshEnabled(userId: string, enabled: boolean): void {
        this.userRefreshStates.set(userId, enabled);
    }

    /**
     * Get refresh state for a specific user
     * Returns the global default if user hasn't set a preference
     */
    isRefreshEnabled(userId: string, globalDefault: boolean): boolean {
        const userPreference = this.userRefreshStates.get(userId);
        return userPreference !== undefined ? userPreference : globalDefault;
    }

    /**
     * Check if user has set a custom preference
     */
    hasCustomPreference(userId: string): boolean {
        return this.userRefreshStates.has(userId);
    }

    /**
     * Clear user preference (revert to global default)
     */
    clearUserPreference(userId: string): void {
        this.userRefreshStates.delete(userId);
    }

    /**
     * Get all users with custom preferences
     */
    getUsersWithCustomPreferences(): string[] {
        return Array.from(this.userRefreshStates.keys());
    }
}
