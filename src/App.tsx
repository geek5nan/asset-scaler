import { useState, useEffect } from 'react'
import { HashRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom'
import { Sparkles, HelpCircle, X, Image as ImageIcon, FileText, Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Analytics } from '@/lib/analytics'
import { StringResourceProcessor } from '@/components/StringResourceProcessor'
import { DrawableProcessor } from '@/components/DrawableProcessor'

function Navigation() {
  const location = useLocation()
  const { t } = useTranslation()

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
        {t('nav.drawable')}
      </Link>
      <Link
        to="/string"
        className={`flex items-center gap-2 px-4 text-sm font-semibold border-b-2 transition-all ${location.pathname === '/string'
          ? 'border-primary text-primary bg-primary/[0.03]'
          : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-slate-50'
          }`}
      >
        <FileText className="h-4 w-4" />
        {t('nav.string')}
      </Link>
    </nav>
  )
}

function PageTracker() {
  const location = useLocation()
  const { t } = useTranslation()

  useEffect(() => {
    // Get title translation key based on current path, default to 'ResBeaver'
    const titleKey = location.pathname === '/drawable' ? 'nav.drawable' : (location.pathname === '/string' ? 'nav.string' : null)
    const pageTitle = titleKey ? `ResBeaver - ${t(titleKey)}` : 'ResBeaver'

    // Update document title
    document.title = pageTitle

    // Send page view with title
    Analytics.pageView(location.pathname + location.search, pageTitle)
  }, [location, t])

  return null
}

function App() {
  const { t, i18n } = useTranslation()
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
                  <h2 className="text-xl font-bold text-slate-900">{t('common.help')}</h2>
                  <p className="text-sm text-slate-500 mt-0.5">{t('common.helpDesc')}</p>
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
                  {t('nav.drawable')}
                </button>
                <button
                  onClick={() => setHelpTab('string')}
                  className={`pb-3 text-sm font-semibold transition-all border-b-2 ${helpTab === 'string'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                >
                  {t('nav.string')}
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar">
                {helpTab === 'drawable' ? (
                  <>
                    <section>
                      <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs">1</span>
                        {t('drawable.help.quickStart')}
                      </h3>
                      <ol className="space-y-3 text-slate-600 leading-relaxed font-medium">
                        <li className="flex gap-3">
                          <span className="text-primary">•</span>
                          <span><strong>{t('drawable.help.upload.title')}</strong>: {t('drawable.help.upload.desc')}</span>
                        </li>
                        <li className="flex gap-3">
                          <span className="text-primary">•</span>
                          <span><strong>{t('drawable.help.config.title')}</strong>: {t('drawable.help.config.desc')}</span>
                        </li>
                        <li className="flex gap-3">
                          <span className="text-primary">•</span>
                          <span><strong>{t('drawable.help.download.title')}</strong>: {t('drawable.help.download.desc')}</span>
                        </li>
                      </ol>
                    </section>

                    <section className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                      <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2 text-sm italic">
                        {t('drawable.help.tips.title')}
                      </h3>
                      <ul className="space-y-2.5 text-xs text-slate-600">
                        <li className="flex items-start gap-2">
                          <span className="text-amber-500 font-bold">🎯</span>
                          <span><strong>{t('drawable.help.tips.studio.bold')}</strong>{t('drawable.help.tips.studio.text')}</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-blue-500 font-bold">✏️</span>
                          <span><strong>{t('drawable.help.tips.rename.bold')}</strong>{t('drawable.help.tips.rename.text')}</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-green-500 font-bold">💾</span>
                          <span><strong>{t('drawable.help.tips.autoSave.bold')}</strong>{t('drawable.help.tips.autoSave.text')}</span>
                        </li>
                      </ul>
                    </section>
                  </>
                ) : (
                  <>
                    <section>
                      <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs">1</span>
                        {t('string.help.workflow.title')}
                      </h3>
                      <ol className="space-y-3 text-slate-600 leading-relaxed font-medium">
                        <li className="flex gap-3">
                          <span className="text-primary">•</span>
                          <span><strong>{t('string.help.workflow.step1.bold')}</strong>{t('string.help.workflow.step1.text')}</span>
                        </li>
                        <li className="flex gap-3">
                          <span className="text-primary">•</span>
                          <span><strong>{t('string.help.workflow.step2.bold')}</strong>{t('string.help.workflow.step2.text')}</span>
                        </li>
                        <li className="flex gap-3">
                          <span className="text-primary">•</span>
                          <span><strong>{t('string.help.workflow.step3.bold')}</strong>{t('string.help.workflow.step3.text')}</span>
                        </li>
                        <li className="flex gap-3">
                          <span className="text-primary">•</span>
                          <span><strong>{t('string.help.workflow.step4.bold')}</strong>{t('string.help.workflow.step4.text')}</span>
                        </li>
                      </ol>
                    </section>

                    <section className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                      <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2 text-sm italic">
                        {t('string.help.advanced.title')}
                      </h3>
                      <ul className="space-y-2.5 text-xs text-slate-600">
                        <li className="flex items-start gap-2">
                          <span className="text-amber-500 font-bold">🔗</span>
                          <span><strong>{t('string.help.advanced.mapping.bold')}</strong>{t('string.help.advanced.mapping.text')}</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-purple-500 font-bold">💬</span>
                          <span><strong>{t('string.help.advanced.comments.bold')}</strong>{t('string.help.advanced.comments.text')}</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary font-bold">📦</span>
                          <span><strong>{t('string.help.advanced.modules.bold')}</strong>{t('string.help.advanced.modules.text')}</span>
                        </li>
                      </ul>
                    </section>
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                <Button size="sm" onClick={() => setShowHelp(false)}>
                  {t('common.gotIt')}
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
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => i18n.changeLanguage(i18n.language === 'zh-CN' ? 'en-US' : 'zh-CN')}
                  className="h-9 px-3 rounded-full bg-slate-100/50 hover:bg-slate-100 flex items-center gap-2 text-slate-600"
                >
                  <Languages className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase">{i18n.language === 'zh-CN' ? 'English' : '中文'}</span>
                </Button>
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
