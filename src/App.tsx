import { useState, useEffect } from 'react'
import { HashRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom'
import { Sparkles, HelpCircle, X, Image as ImageIcon, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Analytics } from '@/lib/analytics'
import { StringResourceProcessor } from '@/components/StringResourceProcessor'
import { DrawableProcessor } from '@/components/DrawableProcessor'

function Navigation() {
  const location = useLocation()

  return (
    <nav className="flex gap-1 h-full">
      <Link
        to="/drawable"
        className={`flex items-center gap-2 px-4 text-sm font-semibold border-b-2 transition-all ${location.pathname === '/drawable'
          ? 'border-primary text-primary bg-primary/[0.03]'
          : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-slate-50'
          }`}
      >
        <ImageIcon className="h-4 w-4" />
        图片资源
      </Link>
      <Link
        to="/string"
        className={`flex items-center gap-2 px-4 text-sm font-semibold border-b-2 transition-all ${location.pathname === '/string'
          ? 'border-primary text-primary bg-primary/[0.03]'
          : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-slate-50'
          }`}
      >
        <FileText className="h-4 w-4" />
        字符串资源
      </Link>
    </nav>
  )
}

function App() {
  // Show help on first visit
  const [showHelp, setShowHelp] = useState(() => {
    const hasSeenHelp = localStorage.getItem('resbeaver-seen-help')
    return !hasSeenHelp
  })

  // Mark help as seen when closed
  useEffect(() => {
    if (!showHelp) {
      localStorage.setItem('resbeaver-seen-help', 'true')
    }
  }, [showHelp])

  // ESC key to close help modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showHelp) {
        setShowHelp(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showHelp])

  return (
    <Router>
      <div className="h-screen flex flex-col overflow-hidden bg-slate-50 relative">
        {/* Help Modal */}
        {showHelp && (
          <div
            className="absolute inset-0 z-[100] bg-black/50 flex items-center justify-center p-4"
            onClick={() => setShowHelp(false)}
          >
            <div
              className="bg-white rounded-xl shadow-2xl max-w-xl w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
                <h2 className="text-lg font-bold">使用说明</h2>
                <Button variant="ghost" size="sm" onClick={() => setShowHelp(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="p-6 space-y-6 text-sm">
                <section>
                  <h3 className="font-semibold text-base mb-3">快速开始</h3>
                  <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                    <li><strong>上传图片</strong> - 拖拽 PNG/JPG/WebP 图片到上传区域，或点击选择文件</li>
                    <li><strong>配置参数</strong> - 在左侧面板设置输入倍数、压缩质量和输出目录</li>
                    <li><strong>下载资源</strong> - 点击下载按钮获取包含多密度资源的 ZIP 包</li>
                  </ol>
                </section>

                <section>
                  <h3 className="font-semibold text-base mb-3">输入图片倍数</h3>
                  <p className="text-muted-foreground mb-2">选择您的原始图片对应的密度：</p>
                  <ul className="space-y-1.5 text-muted-foreground">
                    <li><strong>1x (mdpi)</strong> - 原始 1 倍图，将生成 mdpi</li>
                    <li><strong>2x (xhdpi)</strong> - 2 倍图，将生成 mdpi、hdpi、xhdpi</li>
                    <li><strong>3x (xxhdpi)</strong> - 3 倍图（推荐），将生成 mdpi、hdpi、xhdpi、xxhdpi</li>
                    <li><strong>4x (xxxhdpi)</strong> - 4 倍高清图，将生成全部 5 种密度</li>
                  </ul>
                </section>

                <section>
                  <h3 className="font-semibold text-base mb-3">编码模式</h3>
                  <ul className="space-y-1.5 text-muted-foreground">
                    <li><strong>Lossy (有损压缩)</strong> - 文件体积更小，适合大多数场景</li>
                    <li><strong>Lossless (无损压缩)</strong> - 保留原始画画质，适合需要精确还原的场景</li>
                  </ul>
                </section>

                <section>
                  <h3 className="font-semibold text-base mb-3">使用技巧</h3>
                  <ul className="space-y-1.5 text-muted-foreground">
                    <li>🎯 <strong>WebP 转换效果与 Android Studio 一致</strong>，可直接用于项目开发</li>
                    <li>📌 <strong>建议使用 3x 或 4x 图片</strong> 作为输入，以获得最佳的缩放质量</li>
                    <li>✏️ <strong>点击文件名旁的编辑图标</strong> 可以修改输出文件名</li>
                    <li>📦 <strong>多文件统一下载</strong> 会将所有图片合并到同一个 ZIP 包中</li>
                    <li>💾 <strong>配置自动保存</strong> 到浏览器本地存储，下次使用无需重新设置</li>
                  </ul>
                </section>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <header className="border-b bg-white flex-shrink-0 z-10 shadow-sm">
          <div className="max-w-[1600px] mx-auto px-6">
            <div className="h-14 flex items-center justify-between gap-8">
              <div className="flex items-center gap-10 h-full">
                <div className="flex items-center gap-2.5 mr-2">
                  <div className="bg-primary/10 p-1.5 rounded-lg">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <h1 className="text-lg font-bold tracking-tight bg-gradient-to-br from-slate-900 to-slate-600 bg-clip-text text-transparent">
                    ResBeaver
                  </h1>
                </div>
                <Navigation />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setShowHelp(true)
                  Analytics.openHelp()
                }}
                className="h-9 w-9 rounded-full bg-slate-100/50 hover:bg-slate-100"
              >
                <HelpCircle className="h-5 w-5 text-slate-600" />
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Routes>
            <Route path="/drawable" element={<DrawableProcessor />} />
            <Route path="/string" element={<StringResourceProcessor />} />
            <Route path="/" element={<Navigate to="/drawable" replace />} />
          </Routes>
        </div>
      </div>
    </Router>
  )
}

export default App
