import puppeteer, { Browser, Page } from 'puppeteer';
import { ConfigService } from '../../services/config.service.js';

export class XtermRendererService {
    private browser: Browser | null = null;
    private page: Page | null = null;
    private isInitialized: boolean = false;
    private configService: ConfigService;

    constructor(configService: ConfigService) {
        this.configService = configService;
    }

    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        const maxRetries = 3;
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`[XtermRenderer] Initializing browser (attempt ${attempt}/${maxRetries})...`);

                this.browser = await puppeteer.launch({
                    headless: true,
                    executablePath: '/usr/bin/chromium-browser',
                    timeout: 60000,
                    protocolTimeout: 180000,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-gpu',
                        '--no-zygote',
                        '--single-process',
                        '--disable-web-security',
                        '--disable-features=IsolateOrigins,site-per-process',
                        '--disable-background-networking',
                        '--disable-default-apps',
                        '--disable-extensions',
                        '--disable-sync',
                        '--no-first-run',
                        '--disable-translate',
                    ],
                });

                console.log('[XtermRenderer] Browser launched, creating new page...');
                this.page = await this.browser.newPage();
                await this.page.setViewport({ width: 1200, height: 800 });

                const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css" />
    <script src="https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.js"></script>
    <style>
        body {
            margin: 0;
            padding: 20px;
            background: #000;
            display: flex;
            justify-content: center;
            align-items: flex-start;
        }
        #terminal {
            display: inline-block;
        }
    </style>
</head>
<body>
    <div id="terminal"></div>
</body>
</html>
            `;

                await this.page.setContent(htmlContent, { waitUntil: 'networkidle0', timeout: 30000 });
                await this.page.waitForFunction(() => typeof (window as any).Terminal !== 'undefined', { timeout: 30000 });

                this.isInitialized = true;
                console.log('[XtermRenderer] Browser initialized successfully');
                return;
            } catch (error) {
                lastError = error as Error;
                console.error(`[XtermRenderer] Initialization attempt ${attempt} failed:`, error);

                await this.cleanup();

                if (attempt < maxRetries) {
                    const waitTime = attempt * 2000;
                    console.log(`[XtermRenderer] Retrying in ${waitTime}ms...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
            }
        }

        this.isInitialized = false;
        throw new Error(`Failed to initialize renderer after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
    }

    async renderToImage(output: string[], rows: number, cols: number): Promise<Buffer> {
        const maxRetries = 2;
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                if (!this.isInitialized || !this.page) {
                    console.log('[XtermRenderer] Page not initialized, initializing...');
                    await this.initialize();
                }

                if (!this.page) {
                    throw new Error('Page not initialized after initialization attempt');
                }

                const terminalContent = output.join('');
                const fontSize = this.configService.getXtermFontSize();

                await this.page.evaluate((content: string, r: number, c: number, fontSize: number) => {
                    const terminalDiv = document.getElementById('terminal');
                    if (terminalDiv) {
                        terminalDiv.innerHTML = '';
                    }

                    const term = new (window as any).Terminal({
                        rows: r,
                        cols: c,
                        cursorBlink: false,
                        fontFamily: 'Courier New, monospace',
                        fontSize: fontSize,
                        theme: {
                            background: '#000000',
                            foreground: '#ffffff',
                            cursor: '#ffffff',
                        },
                    });

                    term.open(document.getElementById('terminal'));
                    term.write(content);

                    (window as any).currentTerminal = term;
                }, terminalContent, rows, cols, fontSize);

                await new Promise(resolve => setTimeout(resolve, 500));

                const element = await this.page.$('#terminal');
                if (!element) {
                    throw new Error('Terminal element not found');
                }

                const screenshot = await element.screenshot({
                    type: 'png',
                });

                return screenshot as Buffer;
            } catch (error) {
                lastError = error as Error;
                console.error(`[XtermRenderer] Render attempt ${attempt} failed:`, error);

                if (attempt < maxRetries) {
                    console.log('[XtermRenderer] Cleaning up and retrying...');
                    await this.cleanup();
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } else {
                    throw new Error(`Failed to render terminal after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
                }
            }
        }

        throw new Error(`Failed to render terminal: ${lastError?.message || 'Unknown error'}`);
    }

    async cleanup(): Promise<void> {
        console.log('[XtermRenderer] Cleaning up browser resources...');

        if (this.page) {
            try {
                if (!this.page.isClosed()) {
                    await this.page.close();
                }
            } catch (error) {
                console.error('[XtermRenderer] Error closing page:', error);
            }
            this.page = null;
        }

        if (this.browser) {
            try {
                if (this.browser.connected) {
                    await this.browser.close();
                }
            } catch (error) {
                console.error('[XtermRenderer] Error closing browser:', error);
            }
            this.browser = null;
        }

        this.isInitialized = false;
        console.log('[XtermRenderer] Cleanup complete');
    }
}
