import { storage } from './storage';

/**
 * Dev-only config seeding, for the simulator and `vite dev`.
 *
 * The Navidrome server URL and credentials are normally typed into the phone UI, which
 * is unreachable when the app is driven headlessly through the simulator's automation
 * port. This seeds them from Vite env vars instead, so a scripted run can boot straight
 * into a configured state.
 *
 * `import.meta.env.DEV` is statically false in a production build, so this whole
 * function — and the credentials — are dropped from the packaged .ehpk.
 */
export async function seedDevConfig(): Promise<void> {
  if (!import.meta.env.DEV) return;

  const url = import.meta.env.VITE_DEV_NAVIDROME_URL;
  const username = import.meta.env.VITE_DEV_NAVIDROME_USER;
  const password = import.meta.env.VITE_DEV_NAVIDROME_PASSWORD;
  if (!url || !username || !password) return;

  await storage.setItem('music_source', 'navidrome');
  await storage.setItem('navidrome_base_url', url);
  await storage.setItem('navidrome_username', username);
  await storage.setItem('navidrome_password', password);

  // Which player to follow is normally a tap in the phone UI, so pin it here too —
  // otherwise a headless run is stuck with whatever client was selected last.
  const client = import.meta.env.VITE_DEV_NAVIDROME_CLIENT;
  if (client) await storage.setItem('navidrome_selected_client', client);
  console.log('[devSeed] Navidrome config seeded from VITE_DEV_NAVIDROME_* env vars');
}
