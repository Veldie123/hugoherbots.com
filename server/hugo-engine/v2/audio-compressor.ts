import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import ffmpegPath from 'ffmpeg-static';

const execFileAsync = promisify(execFile);

const COMPRESSION_THRESHOLD = 20 * 1024 * 1024; // 20MB — compress anything above this
const WHISPER_MAX_SIZE = 24 * 1024 * 1024; // 24MB — hard ceiling for Whisper API (actual limit 25MB)

export async function compressAudioIfNeeded(
  buffer: Buffer,
  originalName: string,
  mimetype: string
): Promise<{ buffer: Buffer; mimetype: string; originalName: string; compressed: boolean }> {
  if (buffer.length <= COMPRESSION_THRESHOLD) {
    return { buffer, mimetype, originalName, compressed: false };
  }

  const tmpDir = os.tmpdir();
  const ext = path.extname(originalName).toLowerCase() || '.m4a';
  const inputPath = path.join(tmpDir, `upload_${Date.now()}_input${ext}`);
  const outputPath = path.join(tmpDir, `upload_${Date.now()}_output.mp3`);

  try {
    await fs.promises.writeFile(inputPath, buffer);
    const result = await compressAudioFile(inputPath, outputPath, originalName, buffer.length);
    return result;
  } catch (err: any) {
    console.error('[Compressor] Compression failed:', err.message);
    throw new Error(`Audio compressie mislukt: ${err.message}`);
  } finally {
    try { await fs.promises.unlink(inputPath); } catch { /* cleanup best-effort */ }
    try { await fs.promises.unlink(outputPath); } catch { /* cleanup best-effort */ }
  }
}

export async function compressAudioFileFromPath(
  inputPath: string,
  originalName: string,
  fileSize: number
): Promise<{ buffer: Buffer; mimetype: string; originalName: string; compressed: boolean }> {
  if (fileSize <= COMPRESSION_THRESHOLD) {
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
    const result = await compressAudioFile(inputPath, outputPath, originalName, fileSize);
    return result;
  } catch (err: any) {
    console.error('[Compressor] Compression failed:', err.message);
    throw new Error(`Audio compressie mislukt: ${err.message}`);
  } finally {
    try { await fs.promises.unlink(outputPath); } catch { /* cleanup best-effort */ }
  }
}

async function compressAudioFile(
  inputPath: string,
  outputPath: string,
  originalName: string,
  fileSize: number
): Promise<{ buffer: Buffer; mimetype: string; originalName: string; compressed: boolean }> {
  const sizeMB = fileSize / (1024 * 1024);

  // Aggressive bitrates to ensure result < 24MB
  let bitrate = '64k';
  if (sizeMB < 50) bitrate = '96k';
  if (sizeMB < 30) bitrate = '128k';

  console.log(`[Compressor] Compressing ${originalName} (${sizeMB.toFixed(1)}MB) to ${bitrate} MP3...`);

  const ffmpeg = ffmpegPath || 'ffmpeg';
  await execFileAsync(ffmpeg, [
    '-i', inputPath,
    '-vn', '-ac', '1', '-ar', '22050',
    '-b:a', bitrate,
    '-y', outputPath
  ], { timeout: 300000 });

  let compressedBuffer = await fs.promises.readFile(outputPath);
  let compressedMB = compressedBuffer.length / (1024 * 1024);
  console.log(`[Compressor] First pass: ${sizeMB.toFixed(1)}MB → ${compressedMB.toFixed(1)}MB (${Math.round((1 - compressedMB / sizeMB) * 100)}% reduction)`);

  // If still too large, re-compress with minimum quality
  if (compressedBuffer.length > WHISPER_MAX_SIZE) {
    console.log(`[Compressor] Still > 24MB, re-compressing with 48k bitrate...`);
    const recompressPath = outputPath.replace('.mp3', '_v2.mp3');
    try {
      await execFileAsync(ffmpeg, [
        '-i', outputPath,
        '-vn', '-ac', '1', '-ar', '16000',
        '-b:a', '48k',
        '-y', recompressPath
      ], { timeout: 300000 });
      compressedBuffer = await fs.promises.readFile(recompressPath);
      compressedMB = compressedBuffer.length / (1024 * 1024);
      console.log(`[Compressor] Second pass: → ${compressedMB.toFixed(1)}MB`);
    } finally {
      try { await fs.promises.unlink(recompressPath); } catch { /* cleanup */ }
    }
  }

  if (compressedBuffer.length > WHISPER_MAX_SIZE) {
    throw new Error(`Bestand nog steeds te groot na compressie (${compressedMB.toFixed(1)}MB). Maximum: 24MB.`);
  }

  const newName = originalName.replace(/\.[^.]+$/, '.mp3');
  return {
    buffer: compressedBuffer,
    mimetype: 'audio/mpeg',
    originalName: newName,
    compressed: true
  };
}
