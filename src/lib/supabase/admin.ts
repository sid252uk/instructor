import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requireEnv, supabaseUrl } from "@/lib/env";

// Service-role client that bypasses row level security. Only use it on the
// server, after checking who the user is and what they are allowed to do.
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY ?? requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
