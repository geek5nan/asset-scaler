# ResBeaver Project Context for AI

## Project Overview
**ResBeaver** is a web-based productivity tool designed for Android developers to manage resource migration and processing. It currently consists of two primary modules:
1.  **Drawable Processor**: Handles image scaling, conversion (to WebP/PNG), and automatic distribution into Android `drawable-*` density folders. Supports **Dark Mode Directory** generation (dual export of standard and `drawable-night-*` folders).
2.  **String Resource Processor**: Handles XML string resource merging, translation import, and multi-locale management with a focus on preserving file structure and comments.

## Tech Stack
- **Framework**: React 18 + TypeScript + Vite.
- **UI Components**: Tailwind CSS + Shadcn UI + Lucide Icons.
- **Core APIs**: 
    - [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API) (`window.showDirectoryPicker`) for direct local directory management.
    - WebAssembly for client-side image encoding/decoding (WebP, etc.).

---

## Technical Implementation: String Module

The String module is the most complex part of the codebase. Below are its critical technical details.

### 1. Core Logic Path
- **Scanning**: `scanAllXmlFiles` reads source `.xml` files. `findAndroidResourceDirectories` detects Android `res` folders.
- **Mapping**: `LocaleMapping` defines how a source XML (`ar_strings.xml`) maps to a target folder (`values-ar`).
- **Merging**: `executeMerge` is the entry point. It uses `mergeIntoExistingXml` to update files or `generateStringsXmlContent` for new ones.
- **Preview**: `generateMergePreviewWithDetails` creates a Git-style diff using line-by-line comparison.

### 2. Comment Preservation
To avoid losing developer comments during XML merging, the system does **not** use a standard XML parser for writing. Instead:
- It uses a custom line-scanning regex/logic in `parseStringsXml` to capture `rawLines` (full lines including comments).
- During merging, it reconstructs the XML by matching keys and re-inserting these `rawLines`.

### 3. State Management & Persistence
- **Rules Persistence**: Mapping rules are saved to `localStorage`. When the user switches rotation/translation folders, the system matches new files to old rules using `sourceFileName` to ensure user customizations (like disabled status or custom target folders) are never lost.
- **Draft Mechanism**: The Mapping Editor uses `tempMappings` for a "Draft" mode. Changes only apply to the main state when "Save" is clicked. ESC or closing the dialog discards changes.

### 4. UI/UX Patterns
- **Main-Detail View**: A side-by-side layout with the Mapping List on the left and a detailed Diff Preview on the right.
- **Interactive Editor**: The mapping dialog features auto-focus, scroll-to-index, and background-sync highlighting to help developers quickly modify large sets of localized files.
- **Keyboard Optimization**: Supports `Enter` to save and `ESC` to cancel in dialogs.

---

## Key Files
- `src/components/StringResourceProcessor.tsx`: Main orchestrator for the String module.
- `src/lib/xmlUtils.ts`: Low-level XML parsing, merging, and diffing logic.
- `src/components/MappingList.tsx`: Specialized UI for managing locale mappings.
- `src/lib/localeMapping.ts`: Handles persistence and config export/import.

## Context for New Sessions
When starting a new session, verify the current `SourceXmlFile` and `LocaleMapping` types in `src/types/index.ts`. All file operations are performed via `FileSystemHandle`s, so no backend is involved.
