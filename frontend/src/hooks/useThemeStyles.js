import { theme } from 'antd';
import { useTheme } from '../contexts/ThemeContext';

export const useThemeStyles = () => {
  const { token } = theme.useToken();
  const { darkMode } = useTheme();

  const pageBackground = {
    minHeight: '100vh',
    background: darkMode ? token.colorBgLayout : token.colorBgLayout,
  };

  const subtlePattern = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    opacity: darkMode ? 0.08 : 0.04,
    backgroundImage:
      'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
    backgroundSize: '24px 24px',
    color: token.colorText,
  };

  const iconContainer = (size = 'default') => {
    const px = size === 'large' ? 64 : size === 'small' ? 36 : 44;
    return {
      width: px,
      height: px,
      borderRadius: 12,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: token.colorBgContainer,
      border: `1px solid ${token.colorBorder}`,
      color: token.colorPrimary,
    };
  };

  return {
    pageBackground,
    subtlePattern,
    iconContainer,
    titleText: { color: token.colorTextHeading },
    secondaryText: { color: token.colorTextSecondary },
    tertiaryText: { color: token.colorTextTertiary },
    cardStyle: { background: token.colorBgContainer, borderColor: token.colorBorder },
  };
};
