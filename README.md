# 切图生成器 Web App

一个基于 React + shadcn/ui 的 Web 应用，用于将 PNG/JPG 图片批量转换为 Android 多密度 drawable 资源。

## 特性

- ✅ **首屏无滚动设计** - 所有核心功能在首屏可见
- ✅ **侧边栏配置** - 配置选项独立在侧边栏
- ✅ **弹窗组织** - 文件列表、预览、结果都用弹窗展示
- ✅ **拖拽上传** - 支持拖拽和点击上传
- ✅ **批量处理** - 一次性处理多个图片文件
- ✅ **WebP 转换** - 自动转换为 WebP 格式
- ✅ **多密度支持** - 自动生成 mdpi、hdpi、xhdpi、xxhdpi、xxxhdpi
- ✅ **ZIP 打包** - 自动打包成 ZIP 文件下载
- ✅ **本地存储** - 自动保存配置到 localStorage

## 技术栈

- **React 18** - UI 框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **Tailwind CSS** - 样式框架
- **shadcn/ui** - UI 组件库
- **Radix UI** - 无障碍组件
- **JSZip** - ZIP 打包
- **Canvas API** - 图片处理

## 安装

```bash
cd web-app
npm install
```

## 开发

```bash
npm run dev
```

访问 http://localhost:5173

## 构建

```bash
npm run build
```

构建产物在 `dist` 目录，可以直接部署到任何静态托管服务。

## 使用说明

1. **上传图片** - 拖拽或点击选择 PNG/JPG 图片
2. **配置选项** - 在左侧侧边栏设置：
   - 输入图片倍数（1x/2x/3x/4x）
   - WebP 质量（0-100）
   - 是否生成 drawable/ 目录
3. **开始转换** - 点击底部"开始转换"按钮
4. **下载结果** - 转换完成后下载 ZIP 包

## 项目结构

```
web-app/
├── src/
│   ├── components/
│   │   └── ui/          # shadcn/ui 组件
│   ├── lib/
│   │   ├── imageUtils.ts    # 图片处理工具
│   │   ├── storage.ts        # localStorage 工具
│   │   └── utils.ts          # 通用工具
│   ├── types/
│   │   └── index.ts          # TypeScript 类型定义
│   ├── App.tsx               # 主应用组件
│   ├── main.tsx              # 入口文件
│   └── index.css             # 全局样式
├── index.html
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── vite.config.ts
```

## 浏览器支持

- Chrome/Edge (推荐)
- Firefox
- Safari

需要支持 Canvas API 和 WebP 格式。

## 许可证

MIT License

