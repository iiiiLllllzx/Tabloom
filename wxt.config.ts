import { defineConfig } from 'wxt'

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Tabloom',
    short_name: 'Tabloom',
    description: '重命名标签页，并按域名自动或手工整理 Chrome 标签组。',
    version: '1.0.0',
    minimum_chrome_version: '102',
    permissions: ['tabs', 'tabGroups', 'storage', 'contextMenus'],
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
    commands: {
      'rename-current-tab': {
        suggested_key: {
          default: 'Ctrl+Shift+E',
          mac: 'Command+Shift+E',
        },
        description: '重命名当前标签页',
      },
    },
  },
})
