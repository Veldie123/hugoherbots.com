const DAILY_API_BASE = "https://api.daily.co/v1";

function getApiKey(): string {
  const key = process.env.DAILY_API_KEY;
  if (!key) {
    throw new Error("DAILY_API_KEY not configured");
  }
  return key;
}

async function dailyFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const apiKey = getApiKey();
  const url = `${DAILY_API_BASE}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  return response;
}

interface CreateRoomOptions {
  name: string;
  privacy?: string;
  enableChat?: boolean;
  enableScreenshare?: boolean;
  maxParticipants?: number;
  expiresAt?: number;
}

interface DailyRoom {
  id: string;
  name: string;
  url: string;
  privacy: string;
  created_at: string;
}

interface DailyRecording {
  id: string;
  room_name: string;
  start_ts: number;
  status: string;
  duration?: number;
  download_link?: string | null;
}

export const dailyService = {
  createRoom: async (opts: CreateRoomOptions): Promise<DailyRoom> => {
    console.log(`[Daily] Creating room: ${opts.name}`);

    const response = await dailyFetch("/rooms", {
      method: "POST",
      body: JSON.stringify({
        name: opts.name,
        privacy: opts.privacy || "public",
        properties: {
          enable_chat: opts.enableChat !== false,
          enable_screenshare: opts.enableScreenshare !== false,
          enable_recording: "cloud",
          enable_knocking: true,
          max_participants: opts.maxParticipants || 200,
          exp: opts.expiresAt || Math.floor(Date.now() / 1000) + 24 * 60 * 60,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(
        `Failed to create Daily room: ${(err as any).error || response.status}`
      );
    }

    const room = (await response.json()) as DailyRoom;
    console.log(`[Daily] Room created: ${room.url}`);
    return room;
  },

  createParticipantToken: async (
    roomName: string,
    userName: string,
    userId?: string
  ): Promise<string> => {
    console.log(
      `[Daily] Creating participant token for room: ${roomName}, user: ${userName}`
    );

    const response = await dailyFetch("/meeting-tokens", {
      method: "POST",
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          user_name: userName,
          user_id: userId || undefined,
          is_owner: false,
          enable_screenshare: false,
          exp: Math.floor(Date.now() / 1000) + 4 * 60 * 60,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(
        `Failed to generate participant token: ${(err as any).error || response.status}`
      );
    }

    const data = (await response.json()) as { token: string };
    console.log(`[Daily] Participant token generated for: ${userName}`);
    return data.token;
  },

  createHostToken: async (
    roomName: string,
    userName: string
  ): Promise<string> => {
    console.log(
      `[Daily] Creating host token for room: ${roomName}, user: ${userName}`
    );

    const response = await dailyFetch("/meeting-tokens", {
      method: "POST",
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          user_name: userName,
          is_owner: true,
          enable_screenshare: true,
          enable_recording: "cloud",
          exp: Math.floor(Date.now() / 1000) + 4 * 60 * 60,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(
        `Failed to generate host token: ${(err as any).error || response.status}`
      );
    }

    const data = (await response.json()) as { token: string };
    console.log(`[Daily] Host token generated for: ${userName}`);
    return data.token;
  },

  startRecording: async (roomName: string): Promise<{ id: string }> => {
    console.log(`[Daily] Starting cloud recording for room: ${roomName}`);

    const response = await dailyFetch(`/rooms/${roomName}/recordings`, {
      method: "POST",
      body: JSON.stringify({ type: "cloud" }),
    });

    const result = (await response.json()) as any;

    if (!response.ok) {
      console.error("[Daily] Recording start failed:", result);
      throw new Error(result.error || "Failed to start recording");
    }

    console.log(`[Daily] Recording started: ${result.id}`);
    return { id: result.id };
  },

  stopRecording: async (roomName: string): Promise<void> => {
    console.log(`[Daily] Stopping cloud recording for room: ${roomName}`);

    const response = await dailyFetch(`/rooms/${roomName}/recordings/stop`, {
      method: "POST",
    });

    if (!response.ok && response.status !== 404) {
      const result = await response.json().catch(() => ({}));
      console.error("[Daily] Recording stop failed:", result);
      throw new Error((result as any).error || "Failed to stop recording");
    }

    console.log("[Daily] Recording stopped");
  },

  getMostRecentRecording: async (
    roomName: string
  ): Promise<DailyRecording | null> => {
    console.log(`[Daily] Fetching recordings for room: ${roomName}`);

    const response = await dailyFetch(
      `/recordings?room_name=${encodeURIComponent(roomName)}`
    );

    if (!response.ok) {
      console.error("[Daily] Failed to fetch recordings:", response.status);
      return null;
    }

    const data = (await response.json()) as { data: DailyRecording[] };
    const recordings = data.data || [];

    if (recordings.length === 0) {
      console.log("[Daily] No recordings found for room:", roomName);
      return null;
    }

    const latest = recordings.sort(
      (a, b) =>
        new Date(b.start_ts).getTime() - new Date(a.start_ts).getTime()
    )[0];

    console.log(
      `[Daily] Found recording: ${latest.id}, status: ${latest.status}`
    );

    if (latest.status === "finished" || latest.status === "saved") {
      const accessResponse = await dailyFetch(
        `/recordings/${latest.id}/access-link`
      );

      if (accessResponse.ok) {
        const accessData = (await accessResponse.json()) as {
          download_link: string;
        };
        latest.download_link = accessData.download_link;
        console.log("[Daily] Got recording download link");
      }
    } else {
      console.log(
        `[Daily] Recording not yet finished, status: ${latest.status}`
      );
    }

    return latest;
  },

  deleteRoom: async (roomName: string): Promise<void> => {
    console.log(`[Daily] Deleting room: ${roomName}`);

    const response = await dailyFetch(`/rooms/${roomName}`, {
      method: "DELETE",
    });

    if (!response.ok && response.status !== 404) {
      const err = await response.json().catch(() => ({}));
      throw new Error(
        `Failed to delete Daily room: ${(err as any).error || response.status}`
      );
    }

    console.log(`[Daily] Room deleted: ${roomName}`);
  },
};
