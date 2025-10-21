import { ServiceContainer } from './service-container.interface.js';
import { XtermService } from '../features/xterm/xterm.service.js';
import { XtermRendererService } from '../features/xterm/xterm-renderer.service.js';
import { CoderService } from '../features/coder/coder.service.js';

export class ServiceContainerFactory {
    static create(botId: string): ServiceContainer {
        const xtermService = new XtermService();
        const xtermRendererService = new XtermRendererService();
        const coderService = new CoderService();

        return {
            xtermService,
            xtermRendererService,
            coderService,
            async cleanup() {
                xtermService.cleanup();
                await xtermRendererService.cleanup();
            }
        };
    }
}
