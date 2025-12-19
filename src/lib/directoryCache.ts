/**
 * Directory handle persistence using IndexedDB
 * Allows caching FileSystemDirectoryHandle to reduce repeated permission prompts
 */

const DB_NAME = 'resbeaver-db'
const DB_VERSION = 1
const STORE_NAME = 'directoryHandles'

interface StoredHandle {
    key: string
    handle: FileSystemDirectoryHandle
    name: string
    timestamp: number
}

/**
 * Open IndexedDB database
 */
function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION)

        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve(request.result)

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'key' })
            }
        }
    })
}

/**
 * Save a directory handle to IndexedDB
 */
export async function saveDirectoryHandle(
    key: string,
    handle: FileSystemDirectoryHandle
): Promise<void> {
    try {
        const db = await openDB()
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)

        const stored: StoredHandle = {
            key,
            handle,
            name: handle.name,
            timestamp: Date.now()
        }

        store.put(stored)

        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve()
            tx.onerror = () => reject(tx.error)
        })
    } catch (error) {
        console.error('Failed to save directory handle:', error)
    }
}

/**
 * Load a directory handle from IndexedDB
 * Returns null if not found or permission denied
 */
export async function loadDirectoryHandle(
    key: string
): Promise<FileSystemDirectoryHandle | null> {
    try {
        const db = await openDB()
        const tx = db.transaction(STORE_NAME, 'readonly')
        const store = tx.objectStore(STORE_NAME)

        const request = store.get(key)

        const stored = await new Promise<StoredHandle | undefined>((resolve, reject) => {
            request.onsuccess = () => resolve(request.result)
            request.onerror = () => reject(request.error)
        })

        if (!stored) {
            return null
        }

        // Verify permission is still granted
        const permission = await stored.handle.queryPermission({ mode: 'readwrite' })
        if (permission === 'granted') {
            return stored.handle
        }

        // Try to request permission again (this may show a prompt, but only once)
        const newPermission = await stored.handle.requestPermission({ mode: 'readwrite' })
        if (newPermission === 'granted') {
            return stored.handle
        }

        return null
    } catch (error) {
        console.error('Failed to load directory handle:', error)
        return null
    }
}

/**
 * Get stored handle info without requesting permission
 */
export async function getStoredHandleInfo(
    key: string
): Promise<{ name: string; timestamp: number } | null> {
    try {
        const db = await openDB()
        const tx = db.transaction(STORE_NAME, 'readonly')
        const store = tx.objectStore(STORE_NAME)

        const request = store.get(key)

        const stored = await new Promise<StoredHandle | undefined>((resolve, reject) => {
            request.onsuccess = () => resolve(request.result)
            request.onerror = () => reject(request.error)
        })

        if (!stored) {
            return null
        }

        return {
            name: stored.name,
            timestamp: stored.timestamp
        }
    } catch {
        return null
    }
}

/**
 * Clear a stored directory handle
 */
export async function clearDirectoryHandle(key: string): Promise<void> {
    try {
        const db = await openDB()
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)
        store.delete(key)
    } catch (error) {
        console.error('Failed to clear directory handle:', error)
    }
}
