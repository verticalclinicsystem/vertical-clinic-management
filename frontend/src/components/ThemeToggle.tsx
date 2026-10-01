import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import './ThemeToggle.css';

interface ThemeToggleProps {
  variant?: 'icon' | 'pill';
  className?: string;
  style?: React.CSSProperties;
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  variant = 'icon',
  className = '',
  style,
  showLabel = false,
}) => {
  const { isDark, toggleTheme } = useTheme();

  const titleText = isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';

  if (variant === 'pill') {
    return (
      <button
        type="button"
        className={`theme-toggle-pill ${isDark ? 'is-dark' : 'is-light'} ${className}`}
        onClick={toggleTheme}
        title={titleText}
        aria-label={titleText}
        style={style}
      >
        <span className="theme-toggle-indicator">
          {isDark ? (
            <Sun size={14} className="theme-toggle-icon" />
          ) : (
            <Moon size={14} className="theme-toggle-icon" />
          )}
        </span>
        <span>{isDark ? 'Dark Mode' : 'Light Mode'}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`theme-toggle-btn ${isDark ? 'is-dark' : 'is-light'} ${className}`}
      onClick={toggleTheme}
      title={titleText}
      aria-label={titleText}
      style={style}
    >
      {isDark ? (
        <Sun size={18} className="theme-toggle-icon" />
      ) : (
        <Moon size={18} className="theme-toggle-icon" />
      )}
      {showLabel && (
        <span style={{ marginLeft: '6px', fontSize: '0.8rem', fontWeight: 600 }}>
          {isDark ? 'Light' : 'Dark'}
        </span>
      )}
    </button>
  );
};
