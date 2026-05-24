import "server-only";

import { createClient } from "@supabase/supabase-js";

import {
  getSupabaseAnonKey,
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
} from "@/lib/env";
import type { Database } from "@/types/supabase";

let adminClient: ReturnType<typeof createClient<Database>> | null = null;

export const getSupabaseAdminClient = () => {
  if (!adminClient) {
    adminClient = createClient<Database>(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return adminClient;
};

export const createPasswordVerificationClient = () => {
  return createClient<Database>(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};
