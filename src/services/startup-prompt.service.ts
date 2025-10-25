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
     * Save a startup prompt for a specific bot ID
     */
    savePrompt(botId: string, message: string): void {
        try {
            const filename = `copilot-${botId}.json`;
            const filepath = path.join(this.startupDir, filename);
            
            const data = {
                botId,
                message,
                timestamp: new Date().toISOString()
            };

            fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
            console.log(`Saved startup prompt for bot ${botId}: ${filepath}`);
        } catch (error) {
            console.error(`Failed to save startup prompt for bot ${botId}:`, error);
            throw error;
        }
    }

    /**
     * Load a startup prompt for a specific bot ID
     */
    loadPrompt(botId: string): string | null {
        try {
            const filename = `copilot-${botId}.json`;
            const filepath = path.join(this.startupDir, filename);

            if (!fs.existsSync(filepath)) {
                return null;
            }

            const content = fs.readFileSync(filepath, 'utf-8');
            const data = JSON.parse(content);
            
            return data.message || null;
        } catch (error) {
            console.error(`Failed to load startup prompt for bot ${botId}:`, error);
            return null;
        }
    }

    /**
     * Check if a startup prompt exists for a specific bot ID
     */
    hasPrompt(botId: string): boolean {
        const filename = `copilot-${botId}.json`;
        const filepath = path.join(this.startupDir, filename);
        return fs.existsSync(filepath);
    }

    /**
     * Delete a startup prompt for a specific bot ID
     */
    deletePrompt(botId: string): void {
        try {
            const filename = `copilot-${botId}.json`;
            const filepath = path.join(this.startupDir, filename);

            if (fs.existsSync(filepath)) {
                fs.unlinkSync(filepath);
                console.log(`Deleted startup prompt for bot ${botId}`);
            }
        } catch (error) {
            console.error(`Failed to delete startup prompt for bot ${botId}:`, error);
        }
    }
}
