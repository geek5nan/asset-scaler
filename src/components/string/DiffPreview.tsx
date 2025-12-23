import { useRef, useEffect, forwardRef, useState } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MergePreviewDetail, XmlDiffLine } from '@/types'

interface DiffPreviewProps {
    preview: MergePreviewDetail | null
    projectRootName: string | null
    resPath: string | null
    activeLineIndex?: number | null
    onNavigatePrev?: () => void
    onNavigateNext?: () => void
    hasPrev?: boolean
    hasNext?: boolean
}

// Syntax highlight XML content
function highlightXml(content: string, baseColor: string): React.ReactNode {
    // Match XML string elements: <string name="key">value</string>
    const stringMatch = content.match(/^(\s*)(<string\s+)(name=")([^"]+)(")(>)(.*)(<\/string>)(.*)$/)

    if (stringMatch) {
        const [, indent, openTag, nameAttr, keyValue, closeQuote, gt, textContent, closeTag, trailing] = stringMatch
        return (
            <>
                <span>{indent}</span>
                <span className="text-cyan-600">{openTag}</span>
                <span className="text-purple-600">{nameAttr}</span>
                <span className="text-amber-600">{keyValue}</span>
                <span className="text-purple-600">{closeQuote}</span>
                <span className="text-cyan-600">{gt}</span>
                <span className={baseColor}>{textContent}</span>
                <span className="text-cyan-600">{closeTag}</span>
                <span className="text-slate-400">{trailing}</span>
            </>
        )
    }

    // Match XML comments: <!-- ... -->
    const commentMatch = content.match(/^(\s*)(<!--.*)$/)
    if (commentMatch) {
        return <span className="text-slate-400 italic">{content}</span>
    }

    // Match other XML tags: <resources>, </resources>, <?xml ...?>
    const tagMatch = content.match(/^(\s*)(<\/?[a-zA-Z][^>]*>?)(.*)$/)
    if (tagMatch) {
        const [, indent, tag, rest] = tagMatch
        return (
            <>
                <span>{indent}</span>
                <span className="text-cyan-600">{tag}</span>
                <span className={baseColor}>{rest}</span>
            </>
        )
    }

    // Plain text
    return <span className={baseColor}>{content}</span>
}

export function DiffPreview({
    preview,
    projectRootName,
    resPath,
    activeLineIndex,
    onNavigatePrev,
    onNavigateNext,
    hasPrev = false,
    hasNext = false
}: DiffPreviewProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const lineRefs = useRef<(HTMLDivElement | null)[]>([])
    const [showFullPath, setShowFullPath] = useState(false)

    // Calculate basic data early so it's available to effects
    const diffLines = preview?.diffLines || []
    const hasChanges = (preview?.addCount || 0) > 0 || (preview?.overwriteCount || 0) > 0

    // Scroll to active line or first change
    useEffect(() => {
        if (!preview) return

        const targetIndex = activeLineIndex !== null && activeLineIndex !== undefined
            ? activeLineIndex
            : diffLines.findIndex(line => line.type === 'add' || line.type === 'update-old' || line.type === 'update-new')

        if (targetIndex >= 0 && lineRefs.current[targetIndex] && containerRef.current) {
            const container = containerRef.current
            const target = lineRefs.current[targetIndex]

            const lineHeight = 28
            const contextLines = 5
            const targetScroll = Math.max(0, target!.offsetTop - (lineHeight * contextLines))

            container.scrollTop = targetScroll
        }
    }, [preview, activeLineIndex, diffLines])

    if (!preview) {
        return (
            <div className="flex-1 flex items-center justify-center text-muted-foreground bg-slate-50 rounded-lg border border-dashed">
                <p className="text-sm">选择左侧语言查看导入预览</p>
            </div>
        )
    }

    if (diffLines.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center text-muted-foreground bg-slate-50 rounded-lg border border-dashed">
                <p className="text-sm">无内容</p>
            </div>
        )
    }

    const fullPath = `${projectRootName || 'root'}${resPath ? '/' + resPath : ''}/${preview.folderName}/strings.xml`
    const shortPath = `${preview.folderName}/strings.xml`

    return (
        <div className="flex-1 overflow-hidden flex flex-col bg-white rounded-lg border">
            {/* Header */}
            {/* Header */}
            <div className="px-4 py-2 border-b bg-slate-50 flex items-center h-10 gap-3">
                <span className="text-sm font-medium flex-shrink-0">导入预览</span>
                <span className="text-xs text-muted-foreground flex-shrink-0">|</span>

                <div className="flex-1 min-w-0 flex items-center">
                    <div className="relative group/path truncate">
                        <span
                            className="text-sm font-mono text-slate-600 hover:text-primary cursor-pointer transition-colors bg-slate-100/50 px-2 py-0.5 rounded border border-transparent hover:border-slate-200 truncate block max-w-full"
                            onClick={() => setShowFullPath(!showFullPath)}
                            title={showFullPath ? "点击切换短路径" : "点击切换全路径"}
                        >
                            {showFullPath ? fullPath : shortPath}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        disabled={!hasPrev}
                        onClick={onNavigatePrev}
                        title="上一个变更"
                    >
                        <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        disabled={!hasNext}
                        onClick={onNavigateNext}
                        title="下一个变更"
                    >
                        <ChevronDown className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Diff Content */}
            <div ref={containerRef} className="flex-1 overflow-y-auto font-mono text-xs">
                {!hasChanges && (
                    <div className="px-4 py-2 bg-blue-50 text-blue-700 text-xs border-b font-sans">
                        此语言无变更，以下是目标文件现有内容
                    </div>
                )}
                {(() => {
                    let oldLine = 0
                    let newLine = 0

                    return diffLines.map((line, idx) => {
                        let oldLineNum: number | string | undefined
                        let newLineNum: number | string | undefined

                        if (line.type === 'unchanged') {
                            // Both columns get incremented
                            oldLine++
                            newLine++
                            oldLineNum = oldLine
                            newLineNum = newLine
                        } else if (line.type === 'update-old') {
                            // Only old column
                            oldLine++
                            oldLineNum = oldLine
                            newLineNum = undefined
                        } else if (line.type === 'update-new') {
                            // Only new column
                            newLine++
                            oldLineNum = undefined
                            newLineNum = newLine
                        } else if (line.type === 'add') {
                            // Only new column
                            newLine++
                            oldLineNum = undefined
                            newLineNum = newLine
                        }

                        return (
                            <DiffLine
                                key={`${line.type}-${idx}`}
                                line={line}
                                oldLineNum={oldLineNum}
                                newLineNum={newLineNum}
                                ref={el => lineRefs.current[idx] = el}
                                isActive={idx === activeLineIndex}
                            />
                        )
                    })
                })()}
            </div>
        </div>
    )
}

interface DiffLineProps {
    line: XmlDiffLine
    oldLineNum?: number | string
    newLineNum?: number | string
    isActive?: boolean
}

const DiffLine = forwardRef<HTMLDivElement, DiffLineProps>(({ line, oldLineNum, newLineNum, isActive }, ref) => {
    const colWidth = 'w-10'

    const activeClass = isActive ? 'ring-2 ring-primary ring-inset z-10' : ''

    if (line.type === 'add') {
        return (
            <div ref={ref} className={`flex border-b border-slate-100 relative ${activeClass}`}>
                {/* Left column (old) - empty for added lines */}
                <div className={`${colWidth} flex-shrink-0 text-right pr-2 py-1 text-slate-300 bg-green-50 border-r select-none`}>

                </div>
                {/* Right column (new) */}
                <div className={`${colWidth} flex-shrink-0 text-right pr-2 py-1 text-green-600 bg-green-50 border-r select-none`}>
                    {newLineNum}
                </div>
                <div className="flex-1 py-1 px-3 bg-green-50/50 whitespace-pre-wrap break-all">
                    {highlightXml(line.content, 'text-green-700')}
                </div>
            </div>
        )
    }

    if (line.type === 'update-old') {
        return (
            <div ref={ref} className={`flex border-b border-slate-100 relative ${activeClass}`}>
                {/* Left column (old) */}
                <div className={`${colWidth} flex-shrink-0 text-right pr-2 py-1 text-red-500 bg-red-50 border-r select-none`}>
                    {oldLineNum}
                </div>
                {/* Right column (new) - empty for deleted lines */}
                <div className={`${colWidth} flex-shrink-0 text-right pr-2 py-1 text-slate-300 bg-red-50 border-r select-none`}>

                </div>
                <div className="flex-1 py-1 px-3 bg-red-50/50 whitespace-pre-wrap break-all line-through">
                    {highlightXml(line.content, 'text-red-700')}
                </div>
            </div>
        )
    }

    if (line.type === 'update-new') {
        return (
            <div ref={ref} className={`flex border-b border-slate-100 relative ${activeClass}`}>
                {/* Left column (old) - empty */}
                <div className={`${colWidth} flex-shrink-0 text-right pr-2 py-1 text-slate-300 bg-green-50 border-r select-none`}>

                </div>
                {/* Right column (new) */}
                <div className={`${colWidth} flex-shrink-0 text-right pr-2 py-1 text-green-600 bg-green-50 border-r select-none`}>
                    {newLineNum}
                </div>
                <div className="flex-1 py-1 px-3 bg-green-50/50 whitespace-pre-wrap break-all">
                    {highlightXml(line.content, 'text-green-700')}
                </div>
            </div>
        )
    }

    // unchanged
    return (
        <div ref={ref} className={`flex border-b border-slate-100 relative ${activeClass}`}>
            {/* Left column (old) */}
            <div className={`${colWidth} flex-shrink-0 text-right pr-2 py-1 text-slate-400 bg-slate-50 border-r select-none`}>
                {oldLineNum}
            </div>
            {/* Right column (new) */}
            <div className={`${colWidth} flex-shrink-0 text-right pr-2 py-1 text-slate-400 bg-slate-50 border-r select-none`}>
                {newLineNum}
            </div>
            <div className="flex-1 py-1 px-3 whitespace-pre-wrap break-all">
                {highlightXml(line.content, 'text-slate-600')}
            </div>
        </div>
    )
})

DiffLine.displayName = 'DiffLine'
