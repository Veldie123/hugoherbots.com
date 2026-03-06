import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import ffmpegPath from 'ffmpeg-static';

const execFileAsync = promisify(execFile);

const WHISPER_MAX_SIZE = 24 * 1024 * 1024; // 24MB hard ceiling (Whisper limit = 25MB)
const TARGET_SIZE = 20 * 1024 * 1024; // 20MB target (generous margin — MP3 encoding overshoots ~10-20%)
const MIN_BITRATE = 32000; // 32kbps floor — below this speech recognition degrades

const ffmpeg = ffmpegPath || 'ffmpeg';

async function getAudioDuration(filePath: string): Promise<number> {
  try {
    const { stderr } = await execFileAsync(ffmpeg, ['-i', filePath, '-f', 'null', '-'], { timeout: 30000 });
    // ffmpeg outputs duration in stderr
    const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/);
    if (match) {
      return parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]) + parseInt(match[4]) / 100;
    }
  } catch (err: any) {
    // ffmpeg exits with error code when using -f null, but stderr still has Duration
    const match = err.stderr?.match(/Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/);
    if (match) {
      return parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]) + parseInt(match[4]) / 100;
    }
  }
  return 0;
}

export async function compressAudioIfNeeded(
  buffer: Buffer,
  originalName: string,
  mimetype: string
): Promise<{ buffer: Buffer; mimetype: string; originalName: string; compressed: boolean }> {
  // Files already under Whisper limit → no compression needed
  if (buffer.length <= WHISPER_MAX_SIZE) {
    return { buffer, mimetype, originalName, compressed: false };
  }

  const tmpDir = os.tmpdir();
  const ext = path.extname(originalName).toLowerCase() || '.m4a';
  const inputPath = path.join(tmpDir, `upload_${Date.now()}_input${ext}`);
  const outputPath = path.join(tmpDir, `upload_${Date.now()}_output.mp3`);

  try {
    await fs.promises.writeFile(inputPath, buffer);
    const result = await compressToTarget(inputPath, outputPath, originalName, buffer.length);
    return result;
  } catch (err: any) {
    console.error('[Compressor] Compression failed:', err.message);
    // If original is already under Whisper limit, return it as-is
    if (buffer.length <= WHISPER_MAX_SIZE) {
      return { buffer, mimetype, originalName, compressed: false };
    }
    throw new Error(`Audio compressie mislukt: ${err.message}`);
  } finally {
    try { await fs.promises.unlink(inputPath); } catch { /* cleanup */ }
    try { await fs.promises.unlink(outputPath); } catch { /* cleanup */ }
  }
}

export async function compressAudioFileFromPath(
  inputPath: string,
  originalName: string,
  fileSize: number
): Promise<{ buffer: Buffer; mimetype: string; originalName: string; compressed: boolean }> {
  // Files already under Whisper limit → no compression needed
  if (fileSize <= WHISPER_MAX_SIZE) {
    const buffer = await fs.promises.readFile(inputPath);
    const ext = path.extname(originalName).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4',
      '.mp4': 'video/mp4', '.mov': 'video/quicktime',
    };
    return { buffer, mimetype: mimeMap[ext] || 'audio/mpeg', originalName, compressed: false };
  }

  const outputPath = inputPath.replace(/\.[^.]+$/, '_compressed.mp3');

  try {
    const result = await compressToTarget(inputPath, outputPath, originalName, fileSize);
    return result;
  } catch (err: any) {
    console.error('[Compressor] Compression failed:', err.message);
    throw new Error(`Audio compressie mislukt: ${err.message}`);
  } finally {
    try { await fs.promises.unlink(outputPath); } catch { /* cleanup */ }
  }
}

async function compressToTarget(
  inputPath: string,
  outputPath: string,
  originalName: string,
  fileSize: number
): Promise<{ buffer: Buffer; mimetype: string; originalName: string; compressed: boolean }> {
  const sizeMB = fileSize / (1024 * 1024);

  // Step 1: Get audio duration to calculate optimal bitrate
  const duration = await getAudioDuration(inputPath);
  if (duration <= 0) {
    throw new Error('Kan audio-duur niet bepalen');
  }

  // Step 2: Calculate bitrate to fit in TARGET_SIZE
  const targetBits = TARGET_SIZE * 8;
  let bitrate = Math.floor(targetBits / duration);
  bitrate = Math.max(bitrate, MIN_BITRATE); // floor at 32kbps

  const bitrateK = Math.round(bitrate / 1000);
  const durationMin = Math.round(duration / 60);
  console.log(`[Compressor] ${originalName}: ${sizeMB.toFixed(1)}MB, ${durationMin}min → target bitrate ${bitrateK}k`);

  // Step 3: Compress with calculated bitrate (retry with lower bitrate if still too big)
  for (let attempt = 1; attempt <= 2; attempt++) {
    const currentBitrateK = attempt === 1 ? bitrateK : Math.max(Math.floor(bitrateK * 0.7), Math.round(MIN_BITRATE / 1000));
    console.log(`[Compressor] Attempt ${attempt}: ${currentBitrateK}k bitrate`);

    await execFileAsync(ffmpeg, [
      '-i', inputPath,
      '-vn', '-ac', '1', '-ar', '22050',
      '-b:a', `${currentBitrateK}k`,
      '-y', outputPath
    ], { timeout: 300000 });

    const compressedBuffer = await fs.promises.readFile(outputPath);
    const compressedMB = compressedBuffer.length / (1024 * 1024);
    console.log(`[Compressor] Result: ${sizeMB.toFixed(1)}MB → ${compressedMB.toFixed(1)}MB (${Math.round((1 - compressedMB / sizeMB) * 100)}% reduction)`);

    if (compressedBuffer.length <= WHISPER_MAX_SIZE) {
      const newName = originalName.replace(/\.[^.]+$/, '.mp3');
      return {
        buffer: compressedBuffer,
        mimetype: 'audio/mpeg',
        originalName: newName,
        compressed: true
      };
    }

    if (attempt === 2) {
      throw new Error(`Gecomprimeerd bestand nog steeds ${compressedMB.toFixed(1)}MB (max 24MB)`);
    }
    console.log(`[Compressor] Still too large, retrying with lower bitrate...`);
  }

  // Should never reach here (loop always returns or throws)
  throw new Error('Compressie mislukt na alle pogingen');
}
