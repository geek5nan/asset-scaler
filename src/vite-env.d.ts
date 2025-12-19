/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_GA_ID?: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}

declare global {
    interface Window {
        dataLayer: unknown[]
        gtag?: (...args: unknown[]) => void
        showDirectoryPicker(options?: {
            mode?: 'read' | 'readwrite'
            startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos'
        }): Promise<FileSystemDirectoryHandle>
    }

    interface FileSystemDirectoryHandle {
        values(): AsyncIterableIterator<FileSystemHandle>
        getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>
        getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>
        queryPermission(options?: { mode?: 'read' | 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>
        requestPermission(options?: { mode?: 'read' | 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>
    }

    interface FileSystemFileHandle {
        getFile(): Promise<File>
        createWritable(): Promise<FileSystemWritableFileStream>
    }

    interface FileSystemWritableFileStream {
        write(data: string | Blob | ArrayBuffer): Promise<void>
        close(): Promise<void>
    }
}

export { }
