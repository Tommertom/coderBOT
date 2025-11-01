# Media Upload Handlers

## Overview

The CoderBOT now supports uploading multiple types of media files directly through Telegram. When you send media files to the bot, they are automatically downloaded and saved to the `received/` directory for use in your projects.

## Supported Media Types

### 📷 Photos
- **Handler:** `handlePhoto()`
- **File naming:** `photo_<timestamp>.<ext>`
- **Default extension:** `.jpg`
- **Supported formats:** `.jpg`, `.jpeg`, `.png`, `.bmp`
- **Example:** Send a photo → saved as `photo_1730437096803.jpg`

### 🎥 Videos
- **Handler:** `handleVideo()`
- **File naming:** `video_<timestamp>.<ext>`
- **Default extension:** `.mp4`
- **Supported formats:** `.mp4`, `.avi`, `.mov`, `.mkv`, `.webm`, `.flv`
- **Example:** Send a video → saved as `video_1730437096803.mp4`

### 🎵 Audio Files
- **Handler:** `handleAudio()`
- **File naming:** `audio_<timestamp>.<ext>`
- **Default extension:** `.mp3`
- **Supported formats:** `.mp3`, `.m4a`, `.flac`, `.aac`
- **Example:** Send an audio file → saved as `audio_1730437096803.mp3`

### 🎤 Voice Messages
- **Handler:** `handleVoice()`
- **File naming:** `voice_<timestamp>.<ext>`
- **Default extension:** `.ogg`
- **Supported formats:** `.ogg`, `.oga`, `.opus`, `.wav`
- **Example:** Record a voice message → saved as `voice_1730437096803.ogg`

## How It Works

### 1. Upload Process
1. Send any supported media file to the bot via Telegram
2. Bot detects the media type automatically
3. File is downloaded from Telegram servers
4. File is saved to the `received/` directory with a timestamp
5. Bot confirms with success message showing the file path

### 2. File Storage
All uploaded files are stored in:
```
<bot-media-directory>/<bot-id>/received/
```

Default location: `./media/<bot-id>/received/`

### 3. Success Confirmation
After successful upload, you'll receive a message like:
```
✅ Video saved:
`/home/user/coderBOT/media/bot1/received/video_1730437096803.mp4`
```

### 4. Error Handling
If an upload fails, you'll see:
```
❌ Failed to save video.

Error: <error message>
```

## Usage Examples

### Example 1: Upload and Process a Video
1. Send a video file to the bot
2. Bot saves it as `video_1730437096803.mp4`
3. Use it in your terminal:
   ```bash
   ffmpeg -i [media]/received/video_1730437096803.mp4 output.gif
   ```

### Example 2: Analyze an Audio File
1. Send an audio file to the bot
2. Bot saves it as `audio_1730437096803.mp3`
3. Process it:
   ```bash
   ffprobe [media]/received/audio_1730437096803.mp3
   ```

### Example 3: Convert Voice Message
1. Record and send a voice message
2. Bot saves it as `voice_1730437096803.ogg`
3. Convert it:
   ```bash
   ffmpeg -i [media]/received/voice_1730437096803.ogg output.mp3
   ```

## Implementation Details

### Handler Pattern
All media handlers follow the same secure pattern:

```typescript
private async handleVideo(ctx: Context): Promise<void> {
    // 1. Validate context
    if (!this.bot || !ctx.message?.video) return;

    // 2. Get file metadata from Telegram
    const video = ctx.message.video;
    const file = await ctx.api.getFile(video.file_id);

    // 3. Download file securely via HTTPS
    const fileUrl = `https://api.telegram.org/file/bot${this.botToken}/${file.file_path}`;
    
    // 4. Save with timestamped filename
    const filename = `video_${timestamp}${ext}`;
    const absolutePath = path.join(this.receivedPath, filename);

    // 5. Stream to disk
    await downloadAndSave(fileUrl, absolutePath);

    // 6. Confirm success
    await ctx.reply(`✅ Video saved:\n\`${absolutePath}\``);
}
```

### Security Features
- ✅ **Access Control:** All handlers require authentication
- ✅ **Path Validation:** Files only saved to designated directory
- ✅ **Error Handling:** Partial downloads are cleaned up
- ✅ **HTTPS Only:** All downloads use secure connections
- ✅ **Unique Names:** Timestamps prevent file conflicts

### File Naming Convention
```
<type>_<timestamp>.<extension>

Examples:
- photo_1730437096803.jpg
- video_1730437096803.mp4
- audio_1730437096803.mp3
- voice_1730437096803.ogg
```

Timestamp is milliseconds since epoch, ensuring uniqueness.

## Limitations

### Telegram File Size Limits
- **Photos:** Max 10 MB
- **Videos:** Max 50 MB via bot API
- **Audio:** Max 50 MB
- **Voice:** Max 20 MB
- **Documents:** Max 50 MB

For larger files, consider using external file sharing services.

### Supported in Telegram Only
These handlers only work when interacting through Telegram. Other interfaces (if any) may need separate implementations.

## Troubleshooting

### Upload Failed
**Issue:** `❌ Failed to save video`

**Possible causes:**
1. Network connection issues
2. Insufficient disk space
3. Permission problems on `received/` directory
4. File too large for Telegram limits

**Solutions:**
- Check network connectivity
- Verify disk space with `df -h`
- Check directory permissions: `ls -la <media-path>/received/`
- Reduce file size or compress before uploading

### File Not Appearing
**Issue:** Upload succeeds but file not found

**Possible causes:**
1. Wrong directory being checked
2. File moved by another process
3. Bot using different media path

**Solutions:**
- Check the exact path in success message
- Verify bot configuration: `[media]` placeholder expands correctly
- List files: `ls -la [media]/received/`

## Related Features

### Outgoing Media (Bot → User)
Files placed in the `sent/` directory are automatically sent to users:
```bash
cp output.png [media]/
# Bot watches [media]/ and sends output.png to you
```

### Media Placeholder
Use `[media]` in terminal commands as shorthand:
```bash
# Instead of typing full path:
ffmpeg -i /long/path/to/media/received/video.mp4 out.mp4

# Use placeholder:
ffmpeg -i [media]/received/video.mp4 out.mp4
```

## API Reference

### Event Handlers Registered
```typescript
bot.on('message:photo', AccessControlMiddleware.requireAccess, this.handlePhoto.bind(this));
bot.on('message:video', AccessControlMiddleware.requireAccess, this.handleVideo.bind(this));
bot.on('message:audio', AccessControlMiddleware.requireAccess, this.handleAudio.bind(this));
bot.on('message:voice', AccessControlMiddleware.requireAccess, this.handleVoice.bind(this));
```

### Handler Signatures
```typescript
private async handlePhoto(ctx: Context): Promise<void>
private async handleVideo(ctx: Context): Promise<void>
private async handleAudio(ctx: Context): Promise<void>
private async handleVoice(ctx: Context): Promise<void>
```

## Future Enhancements

Planned improvements:
- [ ] Document file handler (PDFs, text files, etc.)
- [ ] Support for file captions and metadata
- [ ] File size validation before download
- [ ] MIME type validation
- [ ] Progress indicators for large files
- [ ] Batch upload support
- [ ] Automatic transcoding options
- [ ] Cloud storage integration

## See Also

- [Media Watcher Service](../src/features/media/media-watcher.service.ts) - Outgoing media handler
- [Bot Configuration](./configuration.md) - Media path configuration
- [Terminal Integration](./terminal-integration.md) - Using uploaded files in terminal
