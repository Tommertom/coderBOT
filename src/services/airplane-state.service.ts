/**
 * Service to manage per-user airplane mode state
 * Allows users to enable/disable airplane mode without modifying .env
 */
export class AirplaneStateService {
    private userAirplaneStates: Map<string, boolean> = new Map();

    /**
     * Set airplane mode state for a specific user
     */
    setAirplaneEnabled(userId: string, enabled: boolean): void {
        this.userAirplaneStates.set(userId, enabled);
    }

    /**
     * Get airplane mode state for a specific user
     * Returns the global default if user hasn't set a preference
     */
    isAirplaneEnabled(userId: string, globalDefault: boolean): boolean {
        const userPreference = this.userAirplaneStates.get(userId);
        return userPreference !== undefined ? userPreference : globalDefault;
    }

    /**
     * Check if user has set a custom preference
     */
    hasCustomPreference(userId: string): boolean {
        return this.userAirplaneStates.has(userId);
    }

    /**
     * Clear user preference (revert to global default)
     */
    clearUserPreference(userId: string): void {
        this.userAirplaneStates.delete(userId);
    }

    /**
     * Get all users with custom preferences
     */
    getUsersWithCustomPreferences(): string[] {
        return Array.from(this.userAirplaneStates.keys());
    }
}
