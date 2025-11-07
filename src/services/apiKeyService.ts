import { get, set } from 'idb-keyval';
import { ApiKey } from '../types';

const DB_KEY = 'user-api-keys';

const canUseDB = !!window.indexedDB;

/**
 * Retrieves all stored API keys from IndexedDB.
 * @returns A promise that resolves to an array of ApiKey objects.
 */
export async function getKeys(): Promise<ApiKey[]> {
  if (!canUseDB) {
    console.warn("IndexedDB not available. Skipping getKeys.");
    return [];
  }
  try {
    const keys = await get<ApiKey[]>(DB_KEY);
    return keys || [];
  } catch (error) {
    console.warn("Could not access IndexedDB for API keys. This is expected in some secure environments. Falling back to an empty array.", error);
    return [];
  }
}

/**
 * Adds a new API key to the stored list.
 * @param newKey The ApiKey object to add.
 * @returns A promise that resolves when the operation is complete.
 */
export async function addKey(newKey: ApiKey): Promise<void> {
  if (!canUseDB) {
    console.warn("IndexedDB not available. Skipping addKey.");
    return;
  }
  try {
    const keys = await getKeys();
    // Prevent adding duplicate keys
    if (!keys.some(k => k.key === newKey.key && k.provider === newKey.provider)) {
      const updatedKeys = [...keys, newKey];
      await set(DB_KEY, updatedKeys);
    }
  } catch (error) {
    console.warn("Could not access IndexedDB to add API key.", error);
  }
}

/**
 * Deletes an API key from the stored list by its ID.
 * @param keyId The unique ID of the key to delete.
 * @returns A promise that resolves when the operation is complete.
 */
export async function deleteKey(keyId: string): Promise<void> {
  if (!canUseDB) {
    console.warn("IndexedDB not available. Skipping deleteKey.");
    return;
  }
  try {
    const keys = await getKeys();
    const updatedKeys = keys.filter(k => k.id !== keyId);
    await set(DB_KEY, updatedKeys);
  } catch (error) {
    console.warn("Could not access IndexedDB to delete API key.", error);
  }
}