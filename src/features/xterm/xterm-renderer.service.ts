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

        try {
            this.browser = await puppeteer.launch({
                headless: true,
                executablePath: '/usr/bin/chromium-browser',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                ],
            });

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

            await this.page.setContent(htmlContent);
            await this.page.waitForFunction(() => typeof (window as any).Terminal !== 'undefined');

            this.isInitialized = true;
        } catch (error) {
            this.isInitialized = false;
            throw new Error(`Failed to initialize renderer: ${error}`);
        }
    }

    async renderToImage(output: string[], rows: number, cols: number): Promise<Buffer> {
        if (!this.isInitialized || !this.page) {
            await this.initialize();
        }

        if (!this.page) {
            throw new Error('Page not initialized');
        }

        try {
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
            throw new Error(`Failed to render terminal: ${error}`);
        }
    }

    async cleanup(): Promise<void> {
        if (this.page) {
            try {
                await this.page.close();
            } catch (error) {
                console.error('Error closing page:', error);
            }
            this.page = null;
        }

        if (this.browser) {
            try {
                await this.browser.close();
            } catch (error) {
                console.error('Error closing browser:', error);
            }
            this.browser = null;
        }

        this.isInitialized = false;
    }
}
