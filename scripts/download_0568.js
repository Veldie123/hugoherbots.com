const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

async function getToken() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON;
  if (!keyJson) throw new Error('No service account key');
  const key = JSON.parse(keyJson);
  const auth = new google.auth.GoogleAuth({
    credentials: key,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  return await auth.getClient();
}

async function findAndDownload() {
  const authClient = await getToken();
  const drive = google.drive({ version: 'v3', auth: authClient });

  const res = await drive.files.list({
    q: "name contains 'MVI_0568'",
    fields: 'files(id,name,size,mimeType)',
    spaces: 'drive',
  });

  if (!res.data.files || res.data.files.length === 0) {
    console.log('MVI_0568 niet gevonden in Drive');
    return;
  }

  const file = res.data.files[0];
  console.log('Gevonden:', file.name, '(' + (parseInt(file.size)/(1024*1024)).toFixed(1) + ' MB)');

  const outDir = '/tmp/audio_normalization_test';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'MVI_0568_original.mp4');

  console.log('Downloading...');
  const resp = await drive.files.get(
    { fileId: file.id, alt: 'media' },
    { responseType: 'stream' }
  );

  const writer = fs.createWriteStream(outPath);
  let downloaded = 0;
  resp.data.on('data', (chunk) => { downloaded += chunk.length; });
  resp.data.pipe(writer);

  await new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });

  console.log('Downloaded:', (downloaded/(1024*1024)).toFixed(1), 'MB →', outPath);
}

findAndDownload().catch(e => console.error(e));
