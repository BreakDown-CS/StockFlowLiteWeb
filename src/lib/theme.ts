import type { ThemeConfig } from 'antd';

/**
 * Single source of truth for the Ant Design theme.
 * Keep customisation light: a demo should look like Ant Design, not fight it.
 */
export const themeConfig: ThemeConfig = {
  token: {
    colorPrimary: '#1677ff',
    borderRadius: 8,
    fontSize: 14,
  },
  components: {
    Layout: {
      headerBg: '#ffffff',
      bodyBg: '#f5f6f8',
    },
  },
};
