import * as fs from 'fs';
import * as path from 'path';

export class StartupPromptService {
    private readonly startupDir: string;

    constructor() {
        this.startupDir = path.join(process.cwd(), 'startip');
        this.ensureStartupDirectory();
    }

    private ensureStartupDirectory(): void {
        try {
            if (!fs.existsSync(this.startupDir)) {
                fs.mkdirSync(this.startupDir, { recursive: true });
                console.log(`Created startup prompt directory: ${this.startupDir}`);
            }
        } catch (error) {
            console.error('Failed to create startup prompt directory:', error);
        }
    }

    /**
     * Save a startup prompt for a specific bot ID and assistant type
     */
    savePrompt(botId: string, assistantType: string, message: string): void {
        try {
            const filename = `${assistantType}-${botId}.json`;
            const filepath = path.join(this.startupDir, filename);
            
            const data = {
                botId,
                assistantType,
                message,
                timestamp: new Date().toISOString()
            };

            fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
            console.log(`Saved startup prompt for ${assistantType} (bot ${botId}): ${filepath}`);
        } catch (error) {
            console.error(`Failed to save startup prompt for ${assistantType} (bot ${botId}):`, error);
            throw error;
        }
    }

    /**
     * Load a startup prompt for a specific bot ID and assistant type
     */
    loadPrompt(botId: string, assistantType: string): string | null {
        try {
            // Try new format first
            let filename = `${assistantType}-${botId}.json`;
            let filepath = path.join(this.startupDir, filename);

            if (fs.existsSync(filepath)) {
                const content = fs.readFileSync(filepath, 'utf-8');
                const data = JSON.parse(content);
                return data.message || null;
            }

            // Fallback to old format for copilot (backward compatibility)
            if (assistantType === 'copilot') {
                filename = `copilot-${botId}.json`;
                filepath = path.join(this.startupDir, filename);
                
                if (fs.existsSync(filepath)) {
                    const content = fs.readFileSync(filepath, 'utf-8');
                    const data = JSON.parse(content);
                    return data.message || null;
                }
            }

            return null;
        } catch (error) {
            console.error(`Failed to load startup prompt for ${assistantType} (bot ${botId}):`, error);
            return null;
        }
    }

    /**
     * Check if a startup prompt exists for a specific bot ID and assistant type
     */
    hasPrompt(botId: string, assistantType: string): boolean {
        const filename = `${assistantType}-${botId}.json`;
        const filepath = path.join(this.startupDir, filename);
        
        if (fs.existsSync(filepath)) {
            return true;
        }

        // Check old format for copilot
        if (assistantType === 'copilot') {
            const oldFilename = `copilot-${botId}.json`;
            const oldFilepath = path.join(this.startupDir, oldFilename);
            return fs.existsSync(oldFilepath);
        }

        return false;
    }

    /**
     * Delete a startup prompt for a specific bot ID and assistant type
     */
    deletePrompt(botId: string, assistantType: string): void {
        try {
            const filename = `${assistantType}-${botId}.json`;
            const filepath = path.join(this.startupDir, filename);

            if (fs.existsSync(filepath)) {
                fs.unlinkSync(filepath);
                console.log(`Deleted startup prompt for ${assistantType} (bot ${botId})`);
            }
        } catch (error) {
            console.error(`Failed to delete startup prompt for ${assistantType} (bot ${botId}):`, error);
        }
    }
}
