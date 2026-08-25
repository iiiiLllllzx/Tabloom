import { defineConfig } from 'wxt'

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Tabloom',
    short_name: 'Tabloom',
    description: '任务窗口切换器，支持标签页自定义标题和手工域名分组。',
    version: '1.5.0',
    minimum_chrome_version: '114',
    permissions: ['tabs', 'tabGroups', 'storage', 'contextMenus', 'sidePanel'],
    host_permissions: ['<all_urls>'],
    icons: {
      16: 'icon-16.png',
      32: 'icon-32.png',
      48: 'icon-48.png',
      128: 'icon-128.png',
    },
    action: {
      default_title: 'Tabloom 标签管理',
      default_icon: {
        16: 'icon-16.png',
        32: 'icon-32.png',
      },
    },
    side_panel: {
      default_path: 'sidepanel.html',
    },
    commands: {
      'rename-current-tab': {
        suggested_key: {
          default: 'Ctrl+Shift+E',
          mac: 'Command+Shift+E',
        },
        description: '重命名当前标签页',
      },
      'toggle-side-panel': {
        suggested_key: {
          default: 'Ctrl+Shift+S',
          mac: 'Command+Shift+S',
        },
        description: '打开任务窗口切换器',
      },
    },
  },
})
