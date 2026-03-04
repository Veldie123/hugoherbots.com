// ARCHIVED: Original module moved to server/_archive/mux-service.ts
// These are stub exports to prevent import errors - functionality is archived

export const muxService = {
  getThumbnailUrl: (id: string) => { throw new Error("mux-service archived"); },
  getStreamUrl: (id: string) => { throw new Error("mux-service archived"); },
  createUpload: async (opts: any) => { throw new Error("mux-service archived"); },
  verifyWebhookSignature: (body: any, headers: any) => { throw new Error("mux-service archived"); },
  handleAssetReady: async (event: any) => { throw new Error("mux-service archived"); },
  handleUploadAssetCreated: async (event: any) => { throw new Error("mux-service archived"); },
  handleUploadError: async (event: any) => { throw new Error("mux-service archived"); },
};
