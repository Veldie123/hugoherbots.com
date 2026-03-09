/**
 * Generate a valid Supabase JWT for scenario tests.
 *
 * Usage:
 *   npx tsx scripts/generate-test-token.ts
 *   SCENARIO_AUTH_TOKEN=$(npx tsx scripts/generate-test-token.ts) npm run test:scenarios
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const EMAIL = process.env.ADMIN_EMAIL || "stephane@hugoherbots.com";
const PASSWORD = process.env.ADMIN_PASSWORD;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment");
  process.exit(1);
}

if (!PASSWORD) {
  console.error("Missing ADMIN_PASSWORD in environment");
  process.exit(1);
}

async function main() {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);

  const { data, error } = await supabase.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD!,
  });

  if (error || !data.session) {
    console.error("Login failed:", error?.message || "No session returned");
    process.exit(1);
  }

  // Output only the token — so it can be captured with $()
  console.log(data.session.access_token);
}

main();
