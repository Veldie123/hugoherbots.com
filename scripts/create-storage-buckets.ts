/**
 * One-time setup: create Supabase storage buckets needed by the platform.
 * Run: npx tsx --env-file=.env scripts/create-storage-buckets.ts
 */
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ""
);

const BUCKETS = [
  {
    name: "ui-feedback-screenshots",
    options: {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    },
  },
];

async function main() {
  const { data: existing } = await supabase.storage.listBuckets();
  const existingNames = new Set((existing || []).map((b: any) => b.name));

  for (const bucket of BUCKETS) {
    if (existingNames.has(bucket.name)) {
      console.log(`[storage] Bucket "${bucket.name}" already exists — skipping`);
      continue;
    }
    const { error } = await supabase.storage.createBucket(bucket.name, bucket.options);
    if (error) {
      console.error(`[storage] Failed to create "${bucket.name}":`, error.message);
    } else {
      console.log(`[storage] Created bucket "${bucket.name}" (public: ${bucket.options.public})`);
    }
  }
}

main().catch((err) => {
  console.error("[storage] Fatal:", err.message);
  process.exit(1);
});
