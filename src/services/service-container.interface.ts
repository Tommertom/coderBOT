import { XtermService } from '../features/xterm/xterm.service.js';
import { XtermRendererService } from '../features/xterm/xterm-renderer.service.js';
import { CoderService } from '../features/coder/coder.service.js';

export interface ServiceContainer {
    xtermService: XtermService;
    xtermRendererService: XtermRendererService;
    coderService: CoderService;
    cleanup(): Promise<void>;
}
