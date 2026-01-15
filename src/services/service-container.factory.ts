import { ServiceContainer } from './service-container.interface.js';
import { XtermService } from '../features/xterm/xterm.service.js';
import { XtermRendererService } from '../features/xterm/xterm-renderer.service.js';
import { CoderService } from '../features/coder/coder.service.js';
import { ConfigService } from './config.service.js';
import { AirplaneStateService } from './airplane-state.service.js';
import { AudioPreferencesService } from './audio-preferences.service.js';

export class ServiceContainerFactory {
    private static globalConfig: ConfigService | null = null;
    private static globalAirplaneState: AirplaneStateService | null = null;
    private static globalAudioPreferences: AudioPreferencesService | null = null;

    static create(botId: string): ServiceContainer {
        // Create or reuse the global config service (shared across all bots)
        if (!ServiceContainerFactory.globalConfig) {
            ServiceContainerFactory.globalConfig = new ConfigService();
        }
        const configService = ServiceContainerFactory.globalConfig;

        // Create or reuse the global airplane state service (shared across all bots)
        if (!ServiceContainerFactory.globalAirplaneState) {
            ServiceContainerFactory.globalAirplaneState = new AirplaneStateService();
        }
        const airplaneStateService = ServiceContainerFactory.globalAirplaneState;

        // Create or reuse the global audio preferences service (shared across all bots)
        if (!ServiceContainerFactory.globalAudioPreferences) {
            ServiceContainerFactory.globalAudioPreferences = new AudioPreferencesService();
        }
        const audioPreferencesService = ServiceContainerFactory.globalAudioPreferences;

        const xtermService = new XtermService(configService);
        const xtermRendererService = new XtermRendererService(configService);
        const coderService = new CoderService(configService, botId);

        return {
            configService,
            xtermService,
            xtermRendererService,
            coderService,
            airplaneStateService,
            audioPreferencesService,
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

    static getGlobalAirplaneState(): AirplaneStateService {
        if (!ServiceContainerFactory.globalAirplaneState) {
            ServiceContainerFactory.globalAirplaneState = new AirplaneStateService();
        }
        return ServiceContainerFactory.globalAirplaneState;
    }

    static getGlobalAudioPreferences(): AudioPreferencesService {
        if (!ServiceContainerFactory.globalAudioPreferences) {
            ServiceContainerFactory.globalAudioPreferences = new AudioPreferencesService();
        }
        return ServiceContainerFactory.globalAudioPreferences;
    }
}
