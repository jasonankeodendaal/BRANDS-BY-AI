import { get, set, clear as clearDb } from 'idb-keyval';
import { Episode } from '../types';

const DB_KEY = 'podcast-episodes';

/**
 * Retrieves all stored episodes from IndexedDB.
 * @returns A promise that resolves to an array of Episode objects.
 */
export async function getEpisodes(): Promise<Episode[]> {
  const episodes = await get<Episode[]>(DB_KEY);
  return episodes || [];
}

/**
 * Overwrites the stored list of episodes with a new array.
 * @param episodes The full array of Episode objects to save.
 * @returns A promise that resolves when the operation is complete.
 */
export async function setEpisodes(episodes: Episode[]): Promise<void> {
  await set(DB_KEY, episodes);
}

/**
 * Clears all episode data from IndexedDB.
 * @returns A promise that resolves when the operation is complete.
 */
export async function clearEpisodes(): Promise<void> {
    // Note: idb-keyval's clear() clears the entire database, which is fine
    // as we are scoping this app's DB to this one store.
    // If multiple stores were used, we'd use del(DB_KEY) instead.
    await set(DB_KEY, []);
}
