import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

const COMPRESSION_THRESHOLD = 24 * 1024 * 1024; // 24MB

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
    console.error('[Compressor] Compression failed, using original:', err.message);
    return { buffer, mimetype, originalName, compressed: false };
  } finally {
    try { await fs.promises.unlink(inputPath); } catch {}
    try { await fs.promises.unlink(outputPath); } catch {}
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
    console.error('[Compressor] Compression failed, reading original:', err.message);
    const buffer = await fs.promises.readFile(inputPath);
    return { buffer, mimetype: 'audio/mp4', originalName, compressed: false };
  } finally {
    try { await fs.promises.unlink(outputPath); } catch {}
  }
}

async function compressAudioFile(
  inputPath: string,
  outputPath: string,
  originalName: string,
  fileSize: number
): Promise<{ buffer: Buffer; mimetype: string; originalName: string; compressed: boolean }> {
  const sizeMB = fileSize / (1024 * 1024);
  let bitrate = '64k';
  if (sizeMB < 50) bitrate = '96k';
  if (sizeMB < 30) bitrate = '128k';

  console.log(`[Compressor] Compressing ${originalName} (${sizeMB.toFixed(1)}MB) to ${bitrate} MP3...`);

  await execAsync(
    `ffmpeg -i "${inputPath}" -vn -ac 1 -ar 16000 -b:a ${bitrate} -y "${outputPath}"`,
    { timeout: 300000 }
  );

  const compressedBuffer = await fs.promises.readFile(outputPath);
  const compressedMB = compressedBuffer.length / (1024 * 1024);
  console.log(`[Compressor] Done: ${sizeMB.toFixed(1)}MB → ${compressedMB.toFixed(1)}MB (${Math.round((1 - compressedMB / sizeMB) * 100)}% reduction)`);

  const newName = originalName.replace(/\.[^.]+$/, '.mp3');

  return {
    buffer: compressedBuffer,
    mimetype: 'audio/mpeg',
    originalName: newName,
    compressed: true
  };
}
