/**
 * Analytics utility for tracking user events via Google Analytics 4
 */

// Extend window type for gtag
declare global {
    interface Window {
        gtag?: (...args: unknown[]) => void
    }
}

/**
 * Track a custom event to Google Analytics
 * @param eventName - Name of the event (e.g., 'file_upload', 'download_zip')
 * @param params - Optional event parameters
 */
export function trackEvent(
    eventName: string,
    params?: Record<string, string | number | boolean>
): void {
    if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', eventName, params)
    }
}

// Pre-defined events for this app
export const Analytics = {
    /** User uploaded image(s) */
    fileUpload: (count: number, totalSize: number) =>
        trackEvent('file_upload', {
            file_count: count,
            total_size_kb: Math.round(totalSize / 1024),
        }),

    /** User downloaded converted assets */
    downloadAssets: (fileCount: number, format: 'zip' | 'single') =>
        trackEvent('download_assets', {
            file_count: fileCount,
            format,
        }),

    /** User changed input scale setting */
    changeInputScale: (scale: number) =>
        trackEvent('change_setting', {
            setting_name: 'input_scale',
            value: `${scale}x`,
        }),

    /** User changed encoding mode */
    changeEncodingMode: (mode: 'lossy' | 'lossless') =>
        trackEvent('change_setting', {
            setting_name: 'encoding_mode',
            value: mode,
        }),

    /** User changed quality setting */
    changeQuality: (quality: number) =>
        trackEvent('change_setting', {
            setting_name: 'quality',
            value: quality,
        }),

    /** User toggled output density */
    toggleDensity: (density: string, enabled: boolean) =>
        trackEvent('toggle_density', {
            density,
            enabled,
        }),

    /** User renamed a file */
    renameFile: () => trackEvent('rename_file'),

    /** User removed a file */
    removeFile: () => trackEvent('remove_file'),

    /** User opened help dialog */
    openHelp: () => trackEvent('open_help'),
}
