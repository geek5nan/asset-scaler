# AssetScaler

Multi-density asset generator for Android.

🌐 **Live Demo**: [asset-scaler.pages.dev](https://asset-scaler.pages.dev)

## 使用说明

### 快速开始

1. **上传图片** - 拖拽 PNG/JPG/WebP 图片到上传区域，或点击选择文件
2. **配置参数** - 在左侧面板设置输入倍数、压缩质量和输出目录
3. **下载资源** - 点击下载按钮获取包含多密度资源的 ZIP 包

### 参数说明

#### 输入图片倍数
选择您的原始图片对应的密度：
- **1x (mdpi)** - 原始 1 倍图，将生成 mdpi 和 hdpi
- **2x (xhdpi)** - 2 倍图，将生成 mdpi、hdpi、xhdpi
- **3x (xxhdpi)** - 3 倍图（推荐），将生成 mdpi、hdpi、xhdpi、xxhdpi
- **4x (xxxhdpi)** - 4 倍高清图，将生成全部 5 种密度

#### 编码模式
- **Lossy (有损压缩)** - 文件体积更小，适合大多数场景
- **Lossless (无损压缩)** - 保留原始画质，适合需要精确还原的场景

#### 压缩质量
- Lossy 模式：10-100，建议 75-85 以平衡质量和体积
- Lossless 模式：0-100，数值越高压缩越慢但文件更小

#### 输出目录
勾选需要生成的 Android drawable 目录：
| 目录 | 密度比例 | 说明 |
|------|---------|------|
| drawable-mdpi | 1x | 中密度 (~160dpi) |
| drawable-hdpi | 1.5x | 高密度 (~240dpi) |
| drawable-xhdpi | 2x | 超高密度 (~320dpi) |
| drawable-xxhdpi | 3x | 超超高密度 (~480dpi) |
| drawable-xxxhdpi | 4x | 超超超高密度 (~640dpi) |
| drawable | 1x | 通用目录（与 mdpi 相同） |

### 使用技巧

- 🎯 **WebP 转换效果与 Android Studio 一致**，可直接用于项目开发
- 📌 **建议使用 3x 或 4x 图片** 作为输入，以获得最佳的缩放质量
- ✏️ **点击文件名旁的编辑图标** 可以修改输出文件名
- 📦 **多文件统一下载** 会将所有图片合并到同一个 ZIP 包中
- 💾 **配置自动保存** 到浏览器本地存储，下次使用无需重新设置

## Development

```bash
# Install
npm install

# Dev server
npm run dev

# Build
npm run build
```

## License

MIT
