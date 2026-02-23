import Mux from '@mux/mux-node';

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID || '',
  tokenSecret: process.env.MUX_TOKEN_SECRET || '',
});

export interface MuxUploadResult {
  uploadUrl: string;
  uploadId: string;
}

export interface MuxAssetInfo {
  assetId: string;
  playbackId: string;
  duration: number;
  status: string;
}

export const muxService = {
  async createUpload(): Promise<MuxUploadResult> {
    const upload = await mux.video.uploads.create({
      cors_origin: '*',
      new_asset_settings: {
        playback_policy: ['public'],
        video_quality: 'plus',
      },
    });

    return {
      uploadUrl: upload.url,
      uploadId: upload.id,
    };
  },

  async getAsset(assetId: string): Promise<MuxAssetInfo | null> {
    try {
      const asset = await mux.video.assets.retrieve(assetId);
      return {
        assetId: asset.id,
        playbackId: asset.playback_ids?.[0]?.id || '',
        duration: asset.duration || 0,
        status: asset.status || 'unknown',
      };
    } catch (error) {
      console.error('Error getting Mux asset:', error);
      return null;
    }
  },

  async getUpload(uploadId: string) {
    try {
      return await mux.video.uploads.retrieve(uploadId);
    } catch (error) {
      console.error('Error getting Mux upload:', error);
      return null;
    }
  },

  async deleteAsset(assetId: string): Promise<boolean> {
    try {
      await mux.video.assets.delete(assetId);
      return true;
    } catch (error) {
      console.error('Error deleting Mux asset:', error);
      return false;
    }
  },

  getThumbnailUrl(playbackId: string, time: number = 5): string {
    return `https://image.mux.com/${playbackId}/thumbnail.jpg?time=${time}`;
  },

  getAnimatedThumbnailUrl(playbackId: string): string {
    return `https://image.mux.com/${playbackId}/animated.gif`;
  },

  getStreamUrl(playbackId: string): string {
    return `https://stream.mux.com/${playbackId}.m3u8`;
  },

  verifyWebhookSignature(body: string, headers: Record<string, string>): any {
    const webhookSecret = process.env.MUX_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.warn('MUX_WEBHOOK_SECRET not configured, skipping signature verification');
      return JSON.parse(body);
    }
    try {
      return mux.webhooks.unwrap(body, headers, webhookSecret);
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      return null;
    }
  },
};
