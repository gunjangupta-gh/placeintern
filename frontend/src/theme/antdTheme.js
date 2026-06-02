import { theme } from 'antd';

const { defaultAlgorithm, darkAlgorithm } = theme;

// Primary blue from Tailwind (blue-500 for light, blue-400 for dark)
const PRIMARY_LIGHT = '#3b82f6';
const PRIMARY_DARK = '#60a5fa';

export const lightTheme = {
  token: {
    // Colors
    colorPrimary: PRIMARY_LIGHT,
    colorInfo: PRIMARY_LIGHT,
    colorSuccess: '#22c55e',
    colorWarning: '#f59e0b',
    colorError: '#ef4444',
    colorBgLayout: '#f1f5f9',
    colorBgContainer: '#ffffff',
    colorTextBase: '#0f172a',
    colorTextSecondary: '#475569',
    colorBorder: '#e2e8f0',

    // Typography - Professional compact
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: 13,
    fontSizeSM: 11,
    fontSizeLG: 15,
    fontSizeHeading1: 28,
    fontSizeHeading2: 22,
    fontSizeHeading3: 18,
    fontSizeHeading4: 15,
    fontSizeHeading5: 13,
    lineHeight: 1.5,
    fontWeightStrong: 600,

    // Compact sizing
    controlHeight: 32,
    controlHeightSM: 24,
    controlHeightLG: 36,

    // Sharp professional corners
    borderRadius: 6,
    borderRadiusLG: 8,
    borderRadiusSM: 4,
    borderRadiusXS: 2,

    // Tighter spacing
    padding: 12,
    paddingLG: 16,
    paddingXS: 6,
    paddingSM: 8,
    marginXS: 6,
    marginSM: 8,

    // Subtle shadows
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
    boxShadowSecondary: '0 2px 8px -2px rgba(0, 0, 0, 0.08)',
  },
  algorithm: defaultAlgorithm,
  components: {
    Card: {
      colorBorderSecondary: '#f1f5f9',
      paddingLG: 16,
    },
    Table: {
      headerBg: '#f8fafc',
      headerColor: '#64748b',
      cellPaddingBlock: 10,
      cellPaddingInline: 12,
      headerSplitColor: 'transparent',
    },
    Button: {
      fontWeight: 500,
      controlHeight: 32,
      paddingInline: 14,
    },
    Input: {
      controlHeight: 32,
      paddingInline: 10,
    },
    Select: {
      controlHeight: 32,
    },
    Modal: {
      paddingContentHorizontal: 16,
      paddingMD: 12,
      titleFontSize: 15,
    },
    Form: {
      itemMarginBottom: 14,
      labelFontSize: 13,
    },
    Tabs: {
      horizontalItemPadding: '10px 0',
      horizontalMargin: '0 24px 0 0',
    },
    Menu: {
      itemMarginInline: 8,
      itemPaddingInline: 12,
      itemHeight: 36,
    },
    // Micro-elements - compact professional
    Tag: {
      borderRadiusSM: 4,
      defaultBg: '#f1f5f9',
      defaultColor: '#475569',
    },
    Badge: {
      dotSize: 6,
      textFontSize: 10,
      textFontSizeSM: 10,
    },
    Avatar: {
      containerSize: 32,
      containerSizeSM: 24,
      containerSizeLG: 40,
      textFontSize: 13,
      textFontSizeSM: 11,
      textFontSizeLG: 15,
    },
    Tooltip: {
      colorBgSpotlight: '#1e293b',
      colorTextLightSolid: '#f8fafc',
      borderRadius: 6,
      controlHeight: 28,
    },
    Alert: {
      borderRadiusLG: 8,
      withDescriptionPadding: '12px 16px',
      defaultPadding: '8px 12px',
    },
    Message: {
      contentPadding: '8px 12px',
    },
    Notification: {
      width: 340,
      paddingContentHorizontal: 16,
    },
    Progress: {
      lineBorderRadius: 100,
      defaultColor: PRIMARY_LIGHT,
    },
    Breadcrumb: {
      itemColor: '#64748b',
      separatorColor: '#cbd5e1',
      fontSize: 12,
    },
    Collapse: {
      headerPadding: '10px 12px',
      contentPadding: '12px 16px',
    },
    Steps: {
      iconSize: 28,
      iconSizeSM: 20,
      dotSize: 6,
    },
    Descriptions: {
      itemPaddingBottom: 12,
      titleMarginBottom: 12,
    },
    Popover: {
      titleMinWidth: 160,
    },
    Popconfirm: {
      borderRadiusOuter: 8,
    },
    Divider: {
      colorSplit: '#e2e8f0',
    },
  },
};

// Sidebar specific colors
const SIDEBAR_BG = '#0f172a';
const SIDEBAR_ITEM_HOVER = 'rgba(255, 255, 255, 0.08)';
const SIDEBAR_ITEM_SELECTED = 'rgba(59, 130, 246, 0.15)';
const SIDEBAR_TEXT = 'rgba(255, 255, 255, 0.85)';
const SIDEBAR_TEXT_SELECTED = '#ffffff';

export const darkTheme = {
  token: {
    // Colors
    colorPrimary: PRIMARY_DARK,
    colorInfo: PRIMARY_DARK,
    colorSuccess: '#4ade80',
    colorWarning: '#fbbf24',
    colorError: '#f87171',
    colorBgLayout: '#020617',
    colorBgContainer: '#0f172a',
    colorBgElevated: '#1e293b',
    colorBorder: '#1e293b',
    colorBorderSecondary: '#334155',
    colorTextBase: '#f8fafc',
    colorTextSecondary: '#94a3b8',

    // Typography - Professional compact
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: 13,
    fontSizeSM: 11,
    fontSizeLG: 15,
    fontSizeHeading1: 28,
    fontSizeHeading2: 22,
    fontSizeHeading3: 18,
    fontSizeHeading4: 15,
    fontSizeHeading5: 13,
    lineHeight: 1.5,
    fontWeightStrong: 600,

    // Compact sizing
    controlHeight: 32,
    controlHeightSM: 24,
    controlHeightLG: 36,

    // Sharp professional corners
    borderRadius: 6,
    borderRadiusLG: 8,
    borderRadiusSM: 4,
    borderRadiusXS: 2,

    // Tighter spacing
    padding: 12,
    paddingLG: 16,
    paddingXS: 6,
    paddingSM: 8,
    marginXS: 6,
    marginSM: 8,

    // Subtle shadows for dark mode
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.2)',
    boxShadowSecondary: '0 2px 8px -2px rgba(0, 0, 0, 0.4)',
  },
  algorithm: darkAlgorithm,
  components: {
    Card: {
      colorBgContainer: '#0f172a',
      paddingLG: 16,
    },
    Table: {
      colorBgContainer: '#0f172a',
      headerBg: '#1e293b',
      cellPaddingBlock: 10,
      cellPaddingInline: 12,
      headerSplitColor: 'transparent',
    },
    Button: {
      fontWeight: 500,
      controlHeight: 32,
      paddingInline: 14,
    },
    Input: {
      controlHeight: 32,
      paddingInline: 10,
    },
    Select: {
      controlHeight: 32,
    },
    Modal: {
      contentBg: '#0f172a',
      headerBg: '#0f172a',
      paddingContentHorizontal: 16,
      paddingMD: 12,
      titleFontSize: 15,
    },
    Drawer: {
      colorBgElevated: '#0f172a',
    },
    Form: {
      itemMarginBottom: 14,
      labelFontSize: 13,
    },
    Tabs: {
      horizontalItemPadding: '10px 0',
      horizontalMargin: '0 24px 0 0',
    },
    Menu: {
      // Dark sidebar menu styling
      darkItemBg: 'transparent',
      darkSubMenuItemBg: 'transparent',
      darkItemColor: SIDEBAR_TEXT,
      darkItemHoverColor: SIDEBAR_TEXT_SELECTED,
      darkItemHoverBg: SIDEBAR_ITEM_HOVER,
      darkItemSelectedBg: SIDEBAR_ITEM_SELECTED,
      darkItemSelectedColor: SIDEBAR_TEXT_SELECTED,
      darkPopupBg: SIDEBAR_BG,
      itemBg: 'transparent',
      subMenuItemBg: 'transparent',
      itemMarginInline: 8,
      itemPaddingInline: 12,
      iconMarginInlineEnd: 10,
      collapsedIconSize: 18,
      collapsedWidth: 72,
      itemHeight: 36,
    },
    // Micro-elements - compact professional (dark)
    Tag: {
      borderRadiusSM: 4,
      defaultBg: '#334155',
      defaultColor: '#e2e8f0',
    },
    Badge: {
      dotSize: 6,
      textFontSize: 10,
      textFontSizeSM: 10,
    },
    Avatar: {
      containerSize: 32,
      containerSizeSM: 24,
      containerSizeLG: 40,
      textFontSize: 13,
      textFontSizeSM: 11,
      textFontSizeLG: 15,
    },
    Tooltip: {
      colorBgSpotlight: '#f8fafc',
      colorTextLightSolid: '#0f172a',
      borderRadius: 6,
      controlHeight: 28,
    },
    Alert: {
      borderRadiusLG: 8,
      withDescriptionPadding: '12px 16px',
      defaultPadding: '8px 12px',
    },
    Message: {
      contentPadding: '8px 12px',
    },
    Notification: {
      width: 340,
      paddingContentHorizontal: 16,
    },
    Progress: {
      lineBorderRadius: 100,
      defaultColor: PRIMARY_DARK,
    },
    Breadcrumb: {
      itemColor: '#94a3b8',
      separatorColor: '#475569',
      fontSize: 12,
    },
    Collapse: {
      headerPadding: '10px 12px',
      contentPadding: '12px 16px',
    },
    Steps: {
      iconSize: 28,
      iconSizeSM: 20,
      dotSize: 6,
    },
    Descriptions: {
      itemPaddingBottom: 12,
      titleMarginBottom: 12,
    },
    Popover: {
      titleMinWidth: 160,
    },
    Popconfirm: {
      borderRadiusOuter: 8,
    },
    Divider: {
      colorSplit: '#334155',
    },
  },
};
