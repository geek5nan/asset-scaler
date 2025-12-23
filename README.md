<p align="center">
  <img src="public/logo.png" alt="ResBeaver Logo" width="200">
</p>

# ResBeaver (切图生成器)

Android 资源管理大师 - 图片多密度转换与字符串资源一键合并。

🌐 **Live Demo**: [resbeaver.pages.dev](https://resbeaver.pages.dev)
📄 **AI Context**: [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md)

---

## 🚀 核心功能

### 1. 图片资源 (Drawable Processor)
自动化 Android 图片资源适配。将一张高倍图自动转换为适配各种屏幕密度的 WebP 格式。
- **多密度生成**: 自动生成 mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi。
- **WebP 编码**: 支持有损 (Lossy) 和无损 (Lossless) 压缩。
- **智能缩放**: 采样高质量算法，确保在各倍率下清晰。
- **批量处理**: 支持一键重命名、批量下载 ZIP 包。

### 2. 字符串资源 (String Processor)
Android 多语言翻译资源的高效管理工具。解决多语言 Excel/XML 导入合并的烦恼。
- **项目扫描**: 自动识别 Android 项目中的 `res` 目录与模块。
- **语言映射**: 灵活配置源文件与目标语言目录的映射关系。
- **变更预览**: 精确到代码行的差异对比（Diff Preview）。
- **无损合并**: 自动合并新增词条，保留原有注释，支持覆盖或追加模式。
- **安全导入**: 基于浏览器原生 File System Access API，直接写入本地项目。

---

## 📖 使用指南

### 图片处理
1. **上传**: 拖拽 PNG/JPG 到区域，或点击上传。
2. **倍率**: 选择输入图的倍率（建议 3x 或 4x）。
3. **密度**: 勾选需要的密度（默认自动推荐）。
4. **下载**: 点击单个下载或统一下载 ZIP。

### 字符串合并
1. **选择项目**: 点击“选择项目”按钮，指向你的 Android 工程根目录。
2. **选择翻译源**: 点击“翻译文件夹”按钮，选择包含各语言 XML 的文件夹。
3. **编辑规则**: 点击“编辑导入规则”应用或修改文件名与 Locale 的对应关系。
4. **预览与合并**: 在左侧选择语言查看 Diff，确定无误后点击“开始导入”。

---

## 🛠️ 技术背景

- **核心架构**: React 18 + Vite + TypeScript + Tailwind CSS
- **图片处理**: WASM (@jsquash/webp) + Canvas API
- **文件操作**: Browser File System Access API (直接操作本地磁盘文件)
- **UI 组件**: Shadcn UI + Lucide Icons + Framer Motion

## 💻 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

---

## 📜 许可证

MIT
   
