import React, { type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: React.ReactNode;
  error?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  icon,
  error,
  id,
  className = '',
  ...props
}) => {
  return (
    <div className="form-group">
      {label && (
        <label htmlFor={id} className="form-label">
          {label}
        </label>
      )}
      <div className="input-wrapper">
        {icon && <span className="input-icon">{icon}</span>}
        <input
          id={id}
          className={`auth-input ${error ? 'border-error' : ''} ${className}`}
          {...props}
        />
      </div>
      {error && <span className="error-text" style={{ color: 'var(--error-red)', fontSize: '0.75rem', marginTop: '0.2rem' }}>{error}</span>}
    </div>
  );
};
