import { useState, useEffect, useCallback, useRef } from 'react'
import { ConvertConfig, ProcessingFile, ConvertedImage } from '@/types'
import { saveConfig, loadConfig, getDefaultConfig } from '@/lib/storage'
import { createImageFile, resizeImage, canvasToWebP, calculateDensities } from '@/lib/imageUtils'
import { Analytics } from '@/lib/analytics'
import JSZip from 'jszip'

// Sub-components
import { Sidebar } from './drawable/Sidebar'
import { UploadArea } from './drawable/UploadArea'
import { FileList } from './drawable/FileList'
import { ActionBar } from './drawable/ActionBar'

export function DrawableProcessor() {
    const [files, setFiles] = useState<ProcessingFile[]>([])
    const [config, setConfig] = useState<ConvertConfig>(getDefaultConfig())
    const [isDragging, setIsDragging] = useState(false)
    const [downloadingId, setDownloadingId] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Load config from localStorage on mount
    useEffect(() => {
        const saved = loadConfig()
        if (saved) {
            setConfig(saved)
        }
    }, [])

    // Save config to localStorage when it changes
    useEffect(() => {
        saveConfig(config)
    }, [config])

    const handleFileSelect = useCallback(async (selectedFiles: FileList | null) => {
        if (!selectedFiles) return

        const fileArray = Array.from(selectedFiles).filter(
            file => file.type.startsWith('image/') &&
                (file.type.includes('png') || file.type.includes('jpeg') || file.type.includes('jpg') || file.type.includes('webp'))
        )

        try {
            const imageFiles = await Promise.all(fileArray.map(createImageFile))
            const processingFiles: ProcessingFile[] = imageFiles.map(f => ({
                ...f,
                status: 'ready' as const,
                progress: 0,
                outputName: f.name.replace(/\.[^.]+$/, '')
            }))
            setFiles(prev => [...prev, ...processingFiles])

            // Track file upload
            const totalSize = imageFiles.reduce((sum, f) => sum + f.size, 0)
            Analytics.fileUpload(imageFiles.length, totalSize)
        } catch (error) {
            console.error('Failed to process files:', error)
        }
    }, [])

    const handleDrop = useCallback((e: React.DragEvent | DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
        const dt = (e as DragEvent).dataTransfer || (e as React.DragEvent).dataTransfer
        const files = dt?.files
        if (files) {
            handleFileSelect(files)
        }
    }, [handleFileSelect])

    // Window-level drag events for fullscreen overlay
    useEffect(() => {
        let dragCounter = 0

        const handleWindowDragEnter = (e: DragEvent) => {
            e.preventDefault()
            dragCounter++
            if (e.dataTransfer?.types.includes('Files')) {
                setIsDragging(true)
            }
        }

        const handleWindowDragOver = (e: DragEvent) => {
            e.preventDefault()
        }

        const handleWindowDragLeave = (e: DragEvent) => {
            e.preventDefault()
            dragCounter--
            if (dragCounter <= 0 ||
                e.clientX <= 0 || e.clientY <= 0 ||
                e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
                dragCounter = 0
                setIsDragging(false)
            }
        }

        const handleWindowDrop = (e: DragEvent) => {
            e.preventDefault()
            dragCounter = 0
            setIsDragging(false)
            if (e.dataTransfer?.files) {
                handleFileSelect(e.dataTransfer.files)
            }
        }

        const handleDragEnd = () => {
            dragCounter = 0
            setIsDragging(false)
        }

        window.addEventListener('dragenter', handleWindowDragEnter)
        window.addEventListener('dragover', handleWindowDragOver)
        window.addEventListener('dragleave', handleWindowDragLeave)
        window.addEventListener('drop', handleWindowDrop)
        window.addEventListener('dragend', handleDragEnd)

        return () => {
            window.removeEventListener('dragenter', handleWindowDragEnter)
            window.removeEventListener('dragover', handleWindowDragOver)
            window.removeEventListener('dragleave', handleWindowDragLeave)
            window.removeEventListener('drop', handleWindowDrop)
            window.removeEventListener('dragend', handleDragEnd)
        }
    }, [handleFileSelect])

    const removeFile = useCallback((id: string) => {
        setFiles(prev => {
            const file = prev.find(f => f.id === id)
            if (file) {
                URL.revokeObjectURL(file.preview)
            }
            return prev.filter(f => f.id !== id)
        })
        Analytics.removeFile()
    }, [])

    const startEditing = useCallback((id: string) => {
        setFiles(prev => prev.map(f =>
            f.id === id ? { ...f, isEditing: true } : f
        ))
    }, [])

    const updateOutputName = useCallback((id: string, newName: string) => {
        setFiles(prev => prev.map(f =>
            f.id === id ? { ...f, outputName: newName } : f
        ))
    }, [])

    const finishEditing = useCallback((id: string) => {
        setFiles(prev => prev.map(f =>
            f.id === id ? { ...f, isEditing: false } : f
        ))
        Analytics.renameFile()
    }, [])

    const downloadFile = useCallback(async (file: ProcessingFile) => {
        setDownloadingId(file.id)
        try {
            setFiles(prev => prev.map(f =>
                f.id === file.id ? { ...f, status: 'processing' as const, progress: 0 } : f
            ))

            const densities = calculateDensities(config.inputScale)
            const allDensities = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi', 'drawable'] as const
            const convertedImages: ConvertedImage[] = []

            const img = new Image()
            img.src = file.preview

            await new Promise<void>((resolve, reject) => {
                img.onload = async () => {
                    try {
                        const selectedDensities = config.selectedDensities
                        const totalSteps = selectedDensities.length
                        let currentStep = 0

                        for (const densityName of allDensities) {
                            if (!selectedDensities.includes(densityName)) continue

                            const density = densityName === 'drawable' ? densities.mdpi : densities[densityName as keyof typeof densities]
                            const width = Math.round(file.width * density.scale)
                            const height = Math.round(file.height * density.scale)
                            const canvas = resizeImage(img, width, height)
                            const webpBlob = await canvasToWebP(canvas, config.quality, config.lossless)

                            // 1. Add normal folder
                            const normalFolder = densityName === 'drawable' ? 'drawable' : `drawable-${densityName}`
                            convertedImages.push({ density: normalFolder, blob: webpBlob })

                            // 2. Add night folder if enabled
                            if (config.nightMode) {
                                const nightFolder = densityName === 'drawable' ? 'drawable-night' : `drawable-night-${densityName}`
                                convertedImages.push({ density: nightFolder, blob: webpBlob })
                            }

                            currentStep++
                            setFiles(prev => prev.map(f =>
                                f.id === file.id ? { ...f, progress: Math.round((currentStep / totalSteps) * 100) } : f
                            ))
                        }
                        resolve()
                    } catch (error) { reject(error) }
                }
                img.onerror = () => reject(new Error('Failed to load image'))
            })

            setFiles(prev => prev.map(f =>
                f.id === file.id ? { ...f, status: 'ready' as const, progress: 100 } : f
            ))

            const zip = new JSZip()
            for (const img of convertedImages!) {
                zip.file(`${img.density}/${file.outputName}.webp`, img.blob)
            }
            const blob = await zip.generateAsync({ type: 'blob' })

            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${file.outputName}-drawable.zip`
            a.click()
            URL.revokeObjectURL(url)

            Analytics.downloadAssets(1, 'single')
        } catch (error) {
            setFiles(prev => prev.map(f =>
                f.id === file.id ? { ...f, status: 'error' as const, error: '转换失败' } : f
            ))
        } finally {
            setDownloadingId(null)
        }
    }, [config])

    const downloadAll = useCallback(async () => {
        const readyFiles = files.filter(f => f.status === 'ready')
        if (readyFiles.length === 0) return

        if (readyFiles.length === 1) {
            downloadFile(readyFiles[0])
            return
        }

        setDownloadingId('all')
        try {
            const densities = calculateDensities(config.inputScale)
            const allDensities = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi', 'drawable'] as const
            const processedFiles: { file: ProcessingFile; images: ConvertedImage[] }[] = []

            for (const file of readyFiles) {
                setFiles(prev => prev.map(f =>
                    f.id === file.id ? { ...f, status: 'processing' as const, progress: 0 } : f
                ))

                const convertedImages: ConvertedImage[] = []
                const img = new Image()
                img.src = file.preview

                await new Promise<void>((resolve, reject) => {
                    img.onload = async () => {
                        try {
                            const selectedDensities = config.selectedDensities
                            for (const densityName of allDensities) {
                                if (!selectedDensities.includes(densityName)) continue
                                const density = densityName === 'drawable' ? densities.mdpi : densities[densityName as keyof typeof densities]
                                const width = Math.round(file.width * density.scale)
                                const height = Math.round(file.height * density.scale)
                                const canvas = resizeImage(img, width, height)
                                const webpBlob = await canvasToWebP(canvas, config.quality, config.lossless)
                                // 1. Add normal folder
                                const normalFolder = densityName === 'drawable' ? 'drawable' : `drawable-${densityName}`
                                convertedImages.push({ density: normalFolder, blob: webpBlob })

                                // 2. Add night folder if enabled
                                if (config.nightMode) {
                                    const nightFolder = densityName === 'drawable' ? 'drawable-night' : `drawable-night-${densityName}`
                                    convertedImages.push({ density: nightFolder, blob: webpBlob })
                                }
                            }
                            resolve()
                        } catch (error) { reject(error) }
                    }
                    img.onerror = () => reject(new Error('Failed to load image'))
                })

                setFiles(prev => prev.map(f =>
                    f.id === file.id ? { ...f, status: 'ready' as const, progress: 100 } : f
                ))

                processedFiles.push({ file, images: convertedImages })
            }

            const masterZip = new JSZip()
            for (const { file, images } of processedFiles) {
                for (const img of images) {
                    masterZip.file(`${img.density}/${file.outputName}.webp`, img.blob)
                }
            }
            const blob = await masterZip.generateAsync({ type: 'blob' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'drawable-resources.zip'
            a.click()
            URL.revokeObjectURL(url)

            Analytics.downloadAssets(readyFiles.length, 'zip')
        } finally {
            setDownloadingId(null)
        }
    }, [files, downloadFile, config])

    const clearAll = useCallback(() => {
        files.forEach(file => URL.revokeObjectURL(file.preview))
        setFiles([])
    }, [files])

    const readyCount = files.filter(f => f.status === 'ready').length
    const processingCount = files.filter(f => f.status === 'processing').length

    return (
        <div className="flex flex-1 overflow-hidden relative">
            {/* Sidebar (Configuration) */}
            <Sidebar config={config} onChange={setConfig} />

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Upload Area */}
                <UploadArea
                    isDragging={isDragging}
                    onDrop={handleDrop as unknown as React.DragEventHandler}
                    onDragOver={(e) => e.preventDefault()}
                    onDragLeave={(e) => e.preventDefault()}
                    onClick={() => fileInputRef.current?.click()}
                    inputRef={fileInputRef}
                    onFileSelect={handleFileSelect}
                />

                {/* File List */}
                <FileList
                    files={files}
                    downloadingId={downloadingId}
                    onRemove={removeFile}
                    onStartEdit={startEditing}
                    onNameChange={updateOutputName}
                    onFinishEdit={finishEditing}
                    onDownload={downloadFile}
                />

                {/* Bottom Action Bar */}
                {files.length > 0 && (
                    <ActionBar
                        readyCount={readyCount}
                        processingCount={processingCount}
                        downloadingId={downloadingId}
                        onClearAll={clearAll}
                        onDownloadAll={downloadAll}
                    />
                )}
            </main>
        </div>
    )
}
