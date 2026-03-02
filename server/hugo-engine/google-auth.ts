/**
 * Google Drive authentication via Service Account.
 * Replaces Replit Connectors OAuth — works anywhere (local, Cloud Run, etc.)
 *
 * Uses GOOGLE_CLOUD_SECRET env var (JSON service account key).
 * Caches tokens until they expire.
 */
import { google } from 'googleapis';

let cachedToken: string | null = null;
let tokenExpiry = 0;

function getServiceAccountInfo(): Record<string, any> | null {
  const secret = process.env.GOOGLE_CLOUD_SECRET;
  if (!secret) return null;

  try {
    return JSON.parse(secret);
  } catch {
    try {
      return JSON.parse(Buffer.from(secret, 'base64').toString());
    } catch {
      console.error('[GoogleAuth] GOOGLE_CLOUD_SECRET is not valid JSON or base64');
      return null;
    }
  }
}

export async function getGoogleDriveAccessToken(): Promise<string> {
  // Return cached token if still valid (with 60s margin)
  if (cachedToken && Date.now() < tokenExpiry - 60_000) {
    return cachedToken;
  }

  const keyData = getServiceAccountInfo();
  if (!keyData) {
    throw new Error('GOOGLE_CLOUD_SECRET niet ingesteld — kan niet authenticeren met Google Drive');
  }

  const auth = new google.auth.GoogleAuth({
    credentials: keyData,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();

  if (!tokenResponse.token) {
    throw new Error('Kon geen Google Drive access token verkrijgen via service account');
  }

  cachedToken = tokenResponse.token;
  // Tokens are valid for 1 hour; cache for 55 minutes
  tokenExpiry = Date.now() + 55 * 60_000;

  console.log(`[GoogleAuth] Token verkregen voor ${keyData.client_email}`);
  return cachedToken;
}

// CommonJS-compatible export for use in .js files via dynamic import
module.exports = { getGoogleDriveAccessToken };
