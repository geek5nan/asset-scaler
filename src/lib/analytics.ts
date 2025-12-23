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

    /** User toggled night mode for drawable folders */
    toggleNightMode: (enabled: boolean) =>
        trackEvent('toggle_night_mode', {
            enabled,
        }),

    /** User renamed a file */
    renameFile: () => trackEvent('rename_file'),

    /** User removed a file */
    removeFile: () => trackEvent('remove_file'),

    /** User opened help dialog */
    openHelp: () => trackEvent('open_help'),

    // String module events

    /** User selected Android project directory */
    stringSelectProject: (resDirCount: number) =>
        trackEvent('string_select_project', { res_dir_count: resDirCount }),

    /** User selected translation source directory */
    stringSelectSource: (fileCount: number, entryCount: number) =>
        trackEvent('string_select_source', { file_count: fileCount, entry_count: entryCount }),

    /** User refreshed files */
    stringRefresh: () => trackEvent('string_refresh'),

    /** User toggled mapping enabled status */
    stringToggleMapping: (enabled: boolean) =>
        trackEvent('string_toggle_mapping', { enabled }),

    /** User saved mapping settings */
    stringSaveMappings: (mappingCount: number) =>
        trackEvent('string_save_mappings', { mapping_count: mappingCount }),

    /** User reset mapping(s) */
    stringResetMapping: (resetType: 'single' | 'all') =>
        trackEvent('string_reset_mapping', { reset_type: resetType }),

    /** User toggled replace existing option */
    stringToggleReplaceExisting: (enabled: boolean) =>
        trackEvent('string_toggle_replace_existing', { enabled }),

    /** User executed string import */
    stringImport: (localeCount: number, addCount: number, updateCount: number) =>
        trackEvent('string_import', { locale_count: localeCount, add_count: addCount, update_count: updateCount }),

    /** User imported mapping config file */
    stringImportMappings: (mappingCount: number) =>
        trackEvent('string_import_mappings', { mapping_count: mappingCount }),

    /** User navigated diff changes */
    stringNavigateDiff: (direction: 'prev' | 'next') =>
        trackEvent('string_navigate_diff', { direction }),

    /** Track page view */
    pageView: (path: string) => {
        const GA_ID = import.meta.env.VITE_GA_ID
        // Debug log with masked ID for verification
        const maskedId = GA_ID ? `${GA_ID.slice(0, 4)}***` : 'undefined'
        console.log(`[Analytics] pageView triggered for: ${path}. GA_ID: ${maskedId}`)

        if (typeof window !== 'undefined' && window.gtag && GA_ID) {
            // Use explicit 'page_view' event for clearer tracking in SPAs
            window.gtag('event', 'page_view', {
                page_path: path,
                page_location: window.location.href, // Also send full URL
                send_to: GA_ID
            })
            console.log('[Analytics] sent page_view event')
        } else {
            console.warn('[Analytics] Tracking failed: GA_ID or gtag is missing. Are you running locally without .env?')
        }
    },
}
