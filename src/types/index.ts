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

export interface ConvertedImage {
  density: string
  blob: Blob
}

export interface ProcessingFile extends ImageFile {
  status: 'ready' | 'processing' | 'error'
  progress: number
  convertedImages?: ConvertedImage[]
  error?: string
  outputName: string
  isEditing?: boolean
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
  rawContent?: string         // original file content (for target files)
  rawLines?: Map<string, string> // key -> full line content (for source files, with comments)
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

// Diff item for detailed preview
export interface DiffItem {
  key: string
  type: 'add' | 'update' | 'unchanged'
  newValue: string
  oldValue?: string  // only for update
}

// Line-based diff for preview (preserves original file structure)
export interface XmlDiffLine {
  lineNumber: number          // line number in target file (0 for new lines)
  content: string             // the line content
  type: 'unchanged' | 'update-old' | 'update-new' | 'add'
  stringKey?: string          // if this line is a <string> element, the key
}

// Enhanced MergePreview with diff details
export interface MergePreviewDetail extends MergePreview {
  addedItems: DiffItem[]
  updatedItems: DiffItem[]
  unchangedItems: DiffItem[]  // existing items that won't change
  diffLines: XmlDiffLine[]    // line-by-line diff for display
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
  entries: Map<string, string>  // key -> value (text content only)
  rawLines: Map<string, string> // key -> full line content (with comments)
  suggestedLocale: string
  suggestedFolder: string
}

export type OperationStatus = 'idle' | 'scanning' | 'ready' | 'merging' | 'success' | 'error'
