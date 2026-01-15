import { XtermService } from '../features/xterm/xterm.service.js';
import { XtermRendererService } from '../features/xterm/xterm-renderer.service.js';
import { CoderService } from '../features/coder/coder.service.js';
import { ConfigService } from './config.service.js';
import { AirplaneStateService } from './airplane-state.service.js';
import { AudioPreferencesService } from './audio-preferences.service.js';

export interface ServiceContainer {
    configService: ConfigService;
    xtermService: XtermService;
    xtermRendererService: XtermRendererService;
    coderService: CoderService;
    airplaneStateService: AirplaneStateService;
    audioPreferencesService: AudioPreferencesService;
    cleanup(): Promise<void>;
}
