import { GoogleGenAI, createUserContent, createPartFromUri } from '@google/genai';
import dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const AUDIO_PATH = '/tmp/coderBOT_media/bot-3/received/voice_1768500469456.oga';

const mimeTypes: Record<string, string> = {
    '.ogg': 'audio/ogg',
    '.oga': 'audio/ogg',
    '.opus': 'audio/opus',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.webm': 'audio/webm',
    '.m4a': 'audio/mp4',
    '.flac': 'audio/flac'
};

async function main(): Promise<void> {
    const apiKey = process.env.TTS_API_KEY;
    if (!apiKey) {
        throw new Error('TTS_API_KEY is not configured in .env');
    }

    if (!fs.existsSync(AUDIO_PATH)) {
        throw new Error(`Audio file not found: ${AUDIO_PATH}`);
    }

    const ext = path.extname(AUDIO_PATH).toLowerCase();
    const mimeType = mimeTypes[ext] || 'audio/mpeg';

    const ai = new GoogleGenAI({ apiKey });
    const uploadedFile = await ai.files.upload({
        file: AUDIO_PATH,
        config: { mimeType }
    });

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: createUserContent([
            createPartFromUri(uploadedFile.uri, uploadedFile.mimeType),
            'Transcribe this audio file. Return only the transcribed text without any additional commentary or formatting.'
        ])
    });

    console.log(response.text || '');
}

main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
});
