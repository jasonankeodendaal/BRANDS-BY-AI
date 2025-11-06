import { ApiKey } from '../types';

const API_KEY_STORAGE_KEY = 'user-api-keys';

/**
 * Retrieves the list of API keys from localStorage.
 * @returns An array of ApiKey objects.
 */
export function getApiKeys(): ApiKey[] {
    try {
        const storedKeys = localStorage.getItem(API_KEY_STORAGE_KEY);
        if (storedKeys) {
            const parsed = JSON.parse(storedKeys);
            if (Array.isArray(parsed) && parsed.every(item => 
                typeof item === 'object' && 
                'key' in item && 
                'id' in item &&
                'name' in item &&
                'type' in item
            )) {
                return parsed;
            }
        }
    } catch (error) {
        console.error("Failed to parse API keys from localStorage:", error);
        localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
    return [];
}

/**
 * Saves a list of API keys to localStorage.
 * @param keys An array of ApiKey objects to save.
 */
export function saveApiKeys(keys: ApiKey[]): void {
    try {
        localStorage.setItem(API_KEY_STORAGE_KEY, JSON.stringify(keys));
    } catch (error) {
        console.error("Failed to save API keys to localStorage:", error);
    }
}