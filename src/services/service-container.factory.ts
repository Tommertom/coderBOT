import { ServiceContainer } from './service-container.interface.js';
import { XtermService } from '../features/xterm/xterm.service.js';
import { XtermRendererService } from '../features/xterm/xterm-renderer.service.js';
import { CoderService } from '../features/coder/coder.service.js';
import { ConfigService } from './config.service.js';

export class ServiceContainerFactory {
    private static globalConfig: ConfigService | null = null;

    static create(botId: string): ServiceContainer {
        // Create or reuse the global config service (shared across all bots)
        if (!ServiceContainerFactory.globalConfig) {
            ServiceContainerFactory.globalConfig = new ConfigService();
        }
        const configService = ServiceContainerFactory.globalConfig;

        const xtermService = new XtermService(configService);
        const xtermRendererService = new XtermRendererService();
        const coderService = new CoderService(configService, botId);

        return {
            configService,
            xtermService,
            xtermRendererService,
            coderService,
            async cleanup() {
                xtermService.cleanup();
                await xtermRendererService.cleanup();
            }
        };
    }

    static getGlobalConfig(): ConfigService {
        if (!ServiceContainerFactory.globalConfig) {
            ServiceContainerFactory.globalConfig = new ConfigService();
        }
        return ServiceContainerFactory.globalConfig;
    }
}
