# Tabloom

Tabloom 是一个 Manifest V3 Chrome 插件，用于重命名当前标签页，并按域名自动或手工整理彩色标签组。它主要解决大量 Merlin 页面标题相同、难以快速定位的问题。

## 功能

- 在工具栏弹窗中设置或恢复当前标签标题。
- 在网页内容区右键选择“重命名当前标签页”。
- 使用 `Command+Shift+E`（macOS）或 `Ctrl+Shift+E`（Windows/Linux）快速重命名。
- 将当前窗口中的标签按域名前两段自动归并和着色，例如 `ml.bytedance.net → ml-bytedance`。
- 自动整理新打开的网页，不覆盖已有组或手工分组。
- 在标签工作台中新建自定义组，通过拖拽或“移动到”菜单调整标签。
- 在标签工作台撤销上一步分组，或恢复到 Tabloom 首次修改前的分组状态。
- 切换 Chrome 窗口、搜索标签、激活/关闭标签、折叠原生标签组。

## 安装

### 使用已构建版本

1. 打开 `chrome://extensions/`。
2. 开启右上角“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择项目中的 `.output/chrome-mv3` 目录。
5. 建议将 Tabloom 固定到 Chrome 工具栏。

### 从源码构建

建议使用 Node.js 22；当前环境的 Node.js 20.17 也已通过完整构建验证，但 npm 会提示 WXT 的官方引擎版本要求。

```bash
npm install
npm run check
```

构建产物位于 `.output/chrome-mv3`。生成可分发 zip：

```bash
npm run zip
```

## 使用

### 重命名标签

点击工具栏中的 Tabloom 图标，输入标题后保存。自定义标题以当前标签实例为单位保存，刷新页面后仍会应用；关闭标签后自动清理。

也可以在网页内容区右键，或使用默认快捷键唤起输入框。Chrome 不允许扩展向浏览器标签栏本身的右键菜单添加项目，因此右键入口位于网页内容区。

`chrome://`、Chrome Web Store、扩展页等受限页面不允许内容脚本运行，无法重命名。快捷键可在 `chrome://extensions/shortcuts` 中修改。

### 整理标签组

- 弹窗中的“按域名整理”使用域名前两段生成短组名，例如 `code.byted.org → code-byted`。
- 旧版完整域名组会在下次整理时自动合并和重命名，手工分组仍会保留。
- 自动整理开启后，新网页会进入对应域名组。
- 已有原生标签组、固定标签和手工拖拽结果不会被自动整理覆盖。
- 工作台中的自定义空组是临时拖放目标；拖入第一个标签时才创建 Chrome 原生组。
- Chrome 原生标签组不能跨窗口，工作台顶部可以切换管理窗口。
- “撤销”逐步回退本会话的分组操作；“恢复分组”回到 Tabloom 首次修改该窗口之前的状态。

## 开发

```bash
npm run dev        # 启动 WXT 开发模式
npm run typecheck  # TypeScript 严格检查
npm run lint       # ESLint
npm test           # Vitest
npm run build      # 生产构建
npm run check      # 依次执行全部检查
```

主要目录：

```text
entrypoints/       Manifest V3 后台、内容脚本、弹窗和工作台入口
src/lib/           域名、颜色、存储、运行时消息和 Chrome 标签服务
src/popup/         工具栏弹窗
src/manager/       标签工作台及组件
tests/             领域逻辑和核心交互测试
.trae/documents/   产品需求和技术架构
```

## 隐私

Tabloom 不上传 URL、标题或分组数据，不使用远程脚本。设置保存在本机，标签标题和手工分组偏好仅保留在当前浏览器会话中。
