# Tabloom AI 开发说明

## 项目定位

Tabloom 是 Chrome Manifest V3 扩展。运行时无后端，Chrome API 是标签和标签组状态的唯一事实来源。

## 开发约束

- 使用 React、TypeScript 和 WXT，保持 TypeScript 严格模式通过。
- 运行时代码不得依赖远程脚本、远程字体或外部服务。
- 不扩大 Manifest 权限，新增权限必须同时更新技术架构和 README。
- 自动分组只处理未分组标签，不得覆盖已有标签组、固定标签或手工覆盖标记。
- Chrome 原生组不能空创建；自定义空组必须保留为工作台临时状态，首个标签拖入时再调用 `chrome.tabs.group`。
- 自定义标题按 `tabId` 存入 `chrome.storage.session`，不得改为 URL 级持久化。
- 内容脚本只允许读取和修改 `<title>`，不得采集网页正文或表单数据。
- UI 文案和项目文档使用中文；代码标识符使用英文。

## 模块边界

- `entrypoints/background.ts`：事件监听与消息编排，不放置可独立测试的纯逻辑。
- `entrypoints/content.ts`：标题守护和页面内重命名输入。
- `src/lib/domain.ts`：URL 校验与自动分组候选计算。
- `src/lib/tab-service.ts`：Chrome 标签和标签组 API。
- `src/lib/storage.ts`：设置及会话状态。
- `src/types.ts`：跨上下文消息和领域模型。
- `src/popup/`：当前标签快速操作。
- `src/manager/`：多窗口标签工作台。

## 变更验证

每次功能修改至少运行：

```bash
npm run check
```

涉及 Manifest、内容脚本或 Chrome API 时，还需要加载 `.output/chrome-mv3` 手工验证：

1. 普通 HTTP/HTTPS 页面可以设置、刷新保持和恢复标题。
2. 页面右键菜单和快捷键可以唤起重命名。
3. `chrome://extensions/` 等受限页面显示合理错误。
4. 自动整理不会移动已有组或固定标签。
5. 工作台拖拽、下拉移动、新建组和移出分组均与 Chrome 标签栏同步。

## 提交规范

使用 Conventional Commits，格式为 `type: subject`，冒号后保留空格。

## 远端协作

- 唯一远端仓库：`git@github.com:iiiiLllllzx/Chrome-Tab-Manager.git`。
- 默认分支：`main`。
- 每次完成并验证功能更新后，需要创建提交并推送到 `origin/main`。
- 禁止使用强制推送覆盖远端历史。
