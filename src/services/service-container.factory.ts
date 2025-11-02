import { ServiceContainer } from './service-container.interface.js';
import { XtermService } from '../features/xterm/xterm.service.js';
import { XtermRendererService } from '../features/xterm/xterm-renderer.service.js';
import { CoderService } from '../features/coder/coder.service.js';
import { ConfigService } from './config.service.js';
import { RefreshStateService } from './refresh-state.service.js';

export class ServiceContainerFactory {
    private static globalConfig: ConfigService | null = null;
    private static globalRefreshState: RefreshStateService | null = null;

    static create(botId: string): ServiceContainer {
        // Create or reuse the global config service (shared across all bots)
        if (!ServiceContainerFactory.globalConfig) {
            ServiceContainerFactory.globalConfig = new ConfigService();
        }
        const configService = ServiceContainerFactory.globalConfig;

        // Create or reuse the global refresh state service (shared across all bots)
        if (!ServiceContainerFactory.globalRefreshState) {
            ServiceContainerFactory.globalRefreshState = new RefreshStateService();
        }
        const refreshStateService = ServiceContainerFactory.globalRefreshState;

        const xtermService = new XtermService(configService);
        const xtermRendererService = new XtermRendererService(configService);
        const coderService = new CoderService(configService, botId);

        return {
            configService,
            xtermService,
            xtermRendererService,
            coderService,
            refreshStateService,
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

    static getGlobalRefreshState(): RefreshStateService {
        if (!ServiceContainerFactory.globalRefreshState) {
            ServiceContainerFactory.globalRefreshState = new RefreshStateService();
        }
        return ServiceContainerFactory.globalRefreshState;
    }
}
