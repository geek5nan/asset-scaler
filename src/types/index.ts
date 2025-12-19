export interface ImageFile {
  id: string
  file: File
  name: string
  width: number
  height: number
  size: number
  preview: string
}

export interface ConvertConfig {
  inputScale: number
  quality: number
  lossless: boolean
  selectedDensities: string[]
}

export interface XmlFile {
  id: string
  file: File
  name: string
  status: 'pending' | 'processing' | 'success' | 'error'
  entries?: string[]
  error?: string
}

// Locale-specific string resources
export interface LocaleResources {
  locale: string              // 'default' | 'zh' | 'ja' | 'ko' | ...
  folderName: string          // 'values' | 'values-zh' | 'values-rCN' | ...
  entries: Map<string, string> // name -> value
  rawContent?: string         // original file content
}

// Merge operation result
export interface MergeResult {
  locale: string
  added: number
  overwritten: number
  isNewFile: boolean
}

// Merge preview for UI display
export interface MergePreview {
  locale: string
  folderName: string
  sourceCount: number
  targetCount: number
  addCount: number
  overwriteCount: number
  isNewFile: boolean
}
// Discovered Android resource directory info
export interface AndroidResourceDir {
  name: string                 // e.g., 'app' or 'lib'
  path: string                 // e.g., 'app/src/main/res'
  handle: FileSystemDirectoryHandle
}

// Single file to locale mapping rule
export interface LocaleMapping {
  sourceFileName: string    // 'ar_strings.xml'
  targetFolder: string      // 'values-ar'
  locale: string            // 'ar'
  enabled: boolean          // whether to include in merge
  entryCount?: number       // number of string entries
}

// Mapping configuration collection
export interface LocaleMappingConfig {
  mappings: LocaleMapping[]
  lastModified: string
}

// Source file info from scanning
export interface SourceXmlFile {
  fileName: string
  file: File
  entries: Map<string, string>
  suggestedLocale: string
  suggestedFolder: string
}
