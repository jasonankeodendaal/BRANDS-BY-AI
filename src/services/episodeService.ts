import { get, set } from 'idb-keyval';
import { Episode } from '../types';

const DB_KEY = 'podcast-episodes';

const canUseDB = !!window.indexedDB;

/**
 * Retrieves all stored episodes from IndexedDB.
 * @returns A promise that resolves to an array of Episode objects.
 */
export async function getEpisodes(): Promise<Episode[]> {
  if (!canUseDB) {
    console.warn("IndexedDB not available. Skipping getEpisodes.");
    return [];
  }
  try {
    const episodes = await get<Episode[]>(DB_KEY);
    return episodes || [];
  } catch (error) {
    console.warn("Could not access IndexedDB for episodes. This is expected in some secure environments. Falling back to an empty array.", error);
    return [];
  }
}

/**
 * Overwrites the stored list of episodes with a new array.
 * @param episodes The full array of Episode objects to save.
 * @returns A promise that resolves when the operation is complete.
 */
export async function setEpisodes(episodes: Episode[]): Promise<void> {
  if (!canUseDB) {
    console.warn("IndexedDB not available. Skipping setEpisodes.");
    return;
  }
  try {
    await set(DB_KEY, episodes);
  } catch (error) {
    console.warn("Could not access IndexedDB to set episodes.", error);
  }
}

/**
 * Clears all episode data from IndexedDB.
 * @returns A promise that resolves when the operation is complete.
 */
export async function clearEpisodes(): Promise<void> {
    if (!canUseDB) {
      console.warn("IndexedDB not available. Skipping clearEpisodes.");
      return;
    }
    try {
        await set(DB_KEY, []);
    } catch (error) {
        console.warn("Could not access IndexedDB to clear episodes.", error);
    }
}