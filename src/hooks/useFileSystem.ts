import { useState, useEffect, useCallback } from 'react';
import { get, set, del } from 'idb-keyval';
import { Episode } from '../types';

const DIRECTORY_HANDLE_KEY = 'directory-handle';

function isFileSystemDirectoryHandle(handle: any): boolean {
    return handle && handle.kind === 'directory';
}

export function useFileSystem() {
    const [directoryHandle, setDirectoryHandle] = useState<any | null>(null);
    const isSupported = 'showDirectoryPicker' in window;

    const verifyPermission = useCallback(async (handle: any, readWrite: boolean = false): Promise<boolean> => {
        const options = { mode: readWrite ? 'readwrite' : 'read' as 'read' | 'readwrite' };
        if ((await handle.queryPermission(options)) === 'granted') {
            return true;
        }
        if ((await handle.requestPermission(options)) === 'granted') {
            return true;
        }
        return false;
    }, []);

    useEffect(() => {
        if (!isSupported) return;
        get(DIRECTORY_HANDLE_KEY).then(async (handle) => {
            if (handle && isFileSystemDirectoryHandle(handle)) {
                if (await verifyPermission(handle)) {
                    setDirectoryHandle(handle);
                } else {
                    console.warn("Permission for saved directory handle was not granted.");
                    await del(DIRECTORY_HANDLE_KEY);
                }
            }
        });
    }, [isSupported, verifyPermission]);

    const connectFolder = useCallback(async () => {
        if (!isSupported) return;
        try {
            const handle = await (window as any).showDirectoryPicker();
            if (await verifyPermission(handle, true)) {
                await set(DIRECTORY_HANDLE_KEY, handle);
                setDirectoryHandle(handle);
            }
        } catch (error) {
            if ((error as DOMException).name !== 'AbortError') {
                console.error('Error connecting to folder:', error);
            }
        }
    }, [isSupported, verifyPermission]);

    const disconnectFolder = useCallback(async () => {
        await del(DIRECTORY_HANDLE_KEY);
        setDirectoryHandle(null);
    }, []);

    const writeFile = useCallback(async (fileName: string, content: object) => {
        if (!directoryHandle || !(await verifyPermission(directoryHandle, true))) {
             throw new Error("No directory connected or permission denied.");
        }
        try {
            const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(JSON.stringify(content, null, 2));
            await writable.close();
        } catch (error) {
            console.error('Error writing file:', error);
            throw error;
        }
    }, [directoryHandle, verifyPermission]);

    const listFiles = useCallback(async (): Promise<Episode[]> => {
        if (!directoryHandle || !(await verifyPermission(directoryHandle))) return [];
        try {
            const episodes: Episode[] = [];
            for await (const entry of directoryHandle.values()) {
                if (entry.kind === 'file' && entry.name.endsWith('.json')) {
                    try {
                        const file = await (entry as any).getFile();
                        const content = await file.text();
                        const episodeData = JSON.parse(content);
                        // The file name itself is the ID
                        episodes.push({ ...episodeData, id: entry.name.replace('.json', '') });
                    } catch (e) {
                        console.error(`Could not read or parse file ${entry.name}`, e);
                    }
                }
            }
            return episodes.sort((a,b) => a.episodeNumber - b.episodeNumber);
        } catch (error) {
            console.error('Error listing files:', error);
            return [];
        }
    }, [directoryHandle, verifyPermission]);

    const deleteFile = useCallback(async (fileName: string) => {
        if (!directoryHandle || !(await verifyPermission(directoryHandle, true))) {
            throw new Error("No directory connected or permission denied.");
        }
        try {
            await directoryHandle.removeEntry(fileName);
        } catch (error) {
            console.error('Error deleting file:', error);
        }
    }, [directoryHandle, verifyPermission]);


    return {
        connectFolder,
        disconnectFolder,
        directoryHandle,
        writeFile,
        listFiles,
        deleteFile,
        isSupported
    };
}