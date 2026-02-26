import { seedSupabaseIfNeeded } from '@/utils/supabaseDb';

/** Race a promise against a timeout. Resolves/rejects whichever finishes first. */
function withTimeout<T>(promise: Promise<T>, ms: number, label = 'Operation'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

/** Initializes app: seeds Supabase with default users, services, plans if empty.
 *  Has a 5-second timeout so a slow/offline network never blocks launch. */
export async function initializeDatabase(): Promise<void> {
  try {
    await withTimeout(seedSupabaseIfNeeded(), 5000, 'Database seed');
  } catch {
    // Allow app to continue even if Supabase seeding fails or times out
  }
}

export { withTimeout };
