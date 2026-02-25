import { seedSupabaseIfNeeded } from '@/utils/supabaseDb';

/** Initializes app: seeds Supabase with default users, services, plans if empty. */
export async function initializeDatabase(): Promise<void> {
  try {
    await seedSupabaseIfNeeded();
  } catch {
    // Allow app to continue even if Supabase seeding fails (e.g. offline)
  }
}
