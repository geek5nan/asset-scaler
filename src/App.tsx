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

const PAGE_TITLES: Record<string, string> = {
  '/drawable': '图片资源',
  '/string': '字符串资源',
}

function PageTracker() {
  const location = useLocation()

  useEffect(() => {
    // Get title based on current path, default to 'ResBeaver'
    const pageTitle = PAGE_TITLES[location.pathname]
      ? `ResBeaver - ${PAGE_TITLES[location.pathname]}`
      : 'ResBeaver'

    // Update document title
    document.title = pageTitle

    // Send page view with title
    Analytics.pageView(location.pathname + location.search, pageTitle)
  }, [location])

  return null
}

function App() {
  // Show help on first visit
  const [showHelp, setShowHelp] = useState(() => {
    const hasSeenHelp = localStorage.getItem('resbeaver-seen-help')
    return !hasSeenHelp
  })
  const [helpTab, setHelpTab] = useState<'drawable' | 'string'>('drawable')

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
      <PageTracker />
      <div className="h-screen flex flex-col overflow-hidden bg-slate-50 relative">
        {/* Help Modal */}
        {showHelp && (
          <div
            className="absolute inset-0 z-[100] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm"
            onClick={() => setShowHelp(false)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[85vh] overflow-hidden border border-slate-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="px-8 pt-6 pb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">使用说明</h2>
                  <p className="text-sm text-slate-500 mt-0.5">了解如何高效使用 ResBeaver</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowHelp(false)}
                  className="rounded-full hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Tabs */}
              <div className="px-8 flex gap-6 border-b border-slate-100">
                <button
                  onClick={() => setHelpTab('drawable')}
                  className={`pb-3 text-sm font-semibold transition-all border-b-2 ${helpTab === 'drawable'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                >
                  图片资源
                </button>
                <button
                  onClick={() => setHelpTab('string')}
                  className={`pb-3 text-sm font-semibold transition-all border-b-2 ${helpTab === 'string'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                >
                  字符串资源
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar">
                {helpTab === 'drawable' ? (
                  <>
                    <section>
                      <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs">1</span>
                        快速开始
                      </h3>
                      <ol className="space-y-3 text-slate-600 leading-relaxed font-medium">
                        <li className="flex gap-3">
                          <span className="text-primary">•</span>
                          <span><strong>上传图片</strong>: 拖拽 PNG/JPG/WebP 图片到上传区域，或点击选择文件。支持批量上传。</span>
                        </li>
                        <li className="flex gap-3">
                          <span className="text-primary">•</span>
                          <span><strong>配置参数</strong>: 在左侧面板设置输入倍数（建议 3x/4x）、压缩质量。</span>
                        </li>
                        <li className="flex gap-3">
                          <span className="text-primary">•</span>
                          <span><strong>获取资源</strong>: 点击单个“下载”或底部“统一下载”获取多密度资源 ZIP 包。</span>
                        </li>
                      </ol>
                    </section>

                    <section className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                      <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2 text-sm italic">
                        💡 使用技巧
                      </h3>
                      <ul className="space-y-2.5 text-xs text-slate-600">
                        <li className="flex items-start gap-2">
                          <span className="text-amber-500 font-bold">🎯</span>
                          <span><strong>WebP 转换效果与 Android Studio 一致</strong>，可直接用于生产项目。</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-blue-500 font-bold">✏️</span>
                          <span><strong>重命名</strong>: 点击文件名旁的编辑图标可快速修改输出文件名。</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-green-500 font-bold">💾</span>
                          <span><strong>自动保存</strong>: 您的配置会自动保存，下次打开页面即刻沿用。</span>
                        </li>
                      </ul>
                    </section>
                  </>
                ) : (
                  <>
                    <section>
                      <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs">1</span>
                        操作流程
                      </h3>
                      <ol className="space-y-3 text-slate-600 leading-relaxed font-medium">
                        <li className="flex gap-3">
                          <span className="text-primary">•</span>
                          <span><strong>选择项目</strong>: 指向 Android 工程根目录（自动识别模块）。</span>
                        </li>
                        <li className="flex gap-3">
                          <span className="text-primary">•</span>
                          <span><strong>选择翻译</strong>: 选择包含翻译资源的文件夹（支持识别文件名中的 Locale）。</span>
                        </li>
                        <li className="flex gap-3">
                          <span className="text-primary">•</span>
                          <span><strong>差异预览</strong>: 在预览列表切换，右侧实时查看 Diff。</span>
                        </li>
                        <li className="flex gap-3">
                          <span className="text-primary">•</span>
                          <span><strong>安全导入</strong>: 点击“开始导入”，ResBeaver 将智能合并词条并直接写入磁盘。</span>
                        </li>
                      </ol>
                    </section>

                    <section className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                      <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2 text-sm italic">
                        🛠️ 进阶功能
                      </h3>
                      <ul className="space-y-2.5 text-xs text-slate-600">
                        <li className="flex items-start gap-2">
                          <span className="text-amber-500 font-bold">🔗</span>
                          <span><strong>映射规则</strong>: 支持导出/导入 JSON 规则配置，方便在团队间同步 Locale 映射。</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-purple-500 font-bold">💬</span>
                          <span><strong>注释保留</strong>: 智能识别 XML 注释，合并时自动保留原始文档结构。</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary font-bold">📦</span>
                          <span><strong>模块支持</strong>: 自动检测多 Module 项目，支持在不同模块间自由切换。</span>
                        </li>
                      </ul>
                    </section>
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                <Button size="sm" onClick={() => setShowHelp(false)}>
                  我已了解
                </Button>
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
