import React, { useState, useEffect, useRef } from 'react';
import { 
  User, 
  Mail, 
  Lock, 
  Phone, 
  ChevronRight, 
  ShieldCheck, 
  AlertCircle, 
  Clock,
  ArrowLeft,
  Eye,
  EyeOff
} from 'lucide-react';
import { api } from '../../services/api';
import './auth.css';

type TabType = 'login' | 'register' | 'otp' | 'forgot' | 'verify-reset' | 'reset-password';

interface AlertState {
  type: 'success' | 'error';
  message: string;
}

interface AuthPageProps {
  onLoginSuccess?: (user: any) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onLoginSuccess }) => {
  const [activeTab, setActiveTab] = useState<TabType>('login');
  
  // Login Form
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Register Form
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  
  // OTP Form
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(6).fill(''));
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [otpEmail, setOtpEmail] = useState('');
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  
  // Global States
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});

  // Password Visibility States
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);

  // Forgot / Reset Password Form States
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetOtpDigits, setResetOtpDigits] = useState<string[]>(Array(6).fill(''));
  const resetOtpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Switch tabs
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setAlert(null);
    setValidationErrors({});
  };

  // OTP Countdown timer
  useEffect(() => {
    let interval: any;
    if ((activeTab === 'otp' || activeTab === 'verify-reset') && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else if (timer === 0) {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [activeTab, timer]);

  // Handle OTP digit changes
  const handleOtpChange = (index: number, value: string) => {
    if (isNaN(Number(value))) return; // numbers only
    
    const newDigits = [...otpDigits];
    // take only last character if multiple typed
    newDigits[index] = value.substring(value.length - 1);
    setOtpDigits(newDigits);

    // move to next input if filled
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  // Handle OTP Backspace key
  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  // Handle OTP Paste
  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').trim();
    if (pasteData.length === 6 && /^\d+$/.test(pasteData)) {
      const newDigits = pasteData.split('');
      setOtpDigits(newDigits);
      otpRefs.current[5]?.focus();
    }
  };

  // Validate form fields
  const validateForm = (): boolean => {
    const errors: { [key: string]: string } = {};
    
    if (activeTab === 'register') {
      if (!registerName.trim()) errors.fullName = 'Full name is required';
      
      if (!registerEmail.trim()) {
        errors.email = 'Email address is required';
      } else if (!/\S+@\S+\.\S+/.test(registerEmail)) {
        errors.email = 'Email address is invalid';
      }
      
      if (!registerPhone.trim()) {
        errors.phone = 'Phone number is required';
      } else {
        const cleanPhone = registerPhone.replace(/\D/g, '');
        if (cleanPhone.length < 10) {
          errors.phone = 'Phone number must be at least 10 digits';
        }
      }
      
      if (!registerPassword) {
        errors.password = 'Password is required';
      } else {
        if (registerPassword.length < 8) {
          errors.password = 'Password must be at least 8 characters';
        }
        if (!/[A-Z]/.test(registerPassword)) {
          errors.password = 'Password must contain at least one uppercase letter';
        }
        if (!/\d/.test(registerPassword)) {
          errors.password = 'Password must contain at least one digit';
        }
      }
    } else if (activeTab === 'login') {
      if (!loginIdentifier.trim()) errors.identifier = 'Email or phone number is required';
      if (!loginPassword) errors.password = 'Password is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle API Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setIsLoading(true);
    setAlert(null);
    
    try {
      const response = await api.post('/auth/login', {
        identifier: loginIdentifier.trim(),
        password: loginPassword,
      });

      if (response.data?.success) {
        const { access_token, refresh_token, user } = response.data.data;
        localStorage.setItem('access_token', access_token);
        localStorage.setItem('refresh_token', refresh_token);
        localStorage.setItem('user', JSON.stringify(user));
        
        setAlert({
          type: 'success',
          message: `Login successful! Welcome back, ${user.full_name} (${user.role}).`,
        });
        
        if (onLoginSuccess) {
          onLoginSuccess(user);
        }
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Login failed. Please check credentials.';
      setAlert({
        type: 'error',
        message: errorMsg,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle API Patient Registration
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setIsLoading(true);
    setAlert(null);
    
    try {
      const response = await api.post('/auth/register', {
        full_name: registerName.trim(),
        email: registerEmail.trim(),
        phone: registerPhone.trim(),
        password: registerPassword,
      });

      if (response.data?.success) {
        const email = response.data.data.email;
        setOtpEmail(email);
        setAlert({
          type: 'success',
          message: 'Account created successfully! We sent a 6-digit OTP to your email.',
        });
        
        // Reset OTP states and redirect to OTP screen
        setOtpDigits(Array(6).fill(''));
        setTimer(60);
        setCanResend(false);
        setActiveTab('otp');
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Registration failed. Try again.';
      setAlert({
        type: 'error',
        message: errorMsg,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle API OTP Verification
  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpCode = otpDigits.join('');
    if (otpCode.length < 6) {
      setAlert({
        type: 'error',
        message: 'Please enter all 6 digits of the verification code.',
      });
      return;
    }

    setIsLoading(true);
    setAlert(null);

    try {
      const response = await api.post('/auth/verify-otp', {
        email: otpEmail || registerEmail.trim(),
        otp: otpCode,
      });

      if (response.data?.success) {
        setAlert({
          type: 'success',
          message: 'Account activated successfully! You can now log in.',
        });
        setActiveTab('login');
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Verification failed. Please try again.';
      setAlert({
        type: 'error',
        message: errorMsg,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Resend OTP for both verification and password reset
  const handleResendOtp = async (purpose: 'verify' | 'reset' = 'verify') => {
    setIsLoading(true);
    setAlert(null);
    
    try {
      const targetEmail = purpose === 'verify' ? (otpEmail || registerEmail.trim()) : forgotEmail.trim();
      const response = await api.post('/auth/resend-otp', {
        email: targetEmail,
        purpose: purpose,
      });

      if (response.data?.success) {
        setAlert({
          type: 'success',
          message: 'A fresh OTP has been sent to your email.',
        });
        setTimer(60);
        setCanResend(false);
        if (purpose === 'verify') {
          setOtpDigits(Array(6).fill(''));
        } else {
          setResetOtpDigits(Array(6).fill(''));
        }
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to resend OTP. Try again.';
      setAlert({
        type: 'error',
        message: errorMsg,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Forgot Password API request
  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      setValidationErrors({ forgotEmail: 'Email address is required' });
      return;
    }
    
    setIsLoading(true);
    setAlert(null);
    
    try {
      const response = await api.post('/auth/forgot-password', {
        email: forgotEmail.trim(),
      });
      if (response.data?.success) {
        setAlert({
          type: 'success',
          message: 'A password reset OTP has been sent to your email.',
        });
        setTimer(60);
        setCanResend(false);
        setResetOtpDigits(Array(6).fill(''));
        setActiveTab('verify-reset');
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to send password reset code. Please try again.';
      setAlert({
        type: 'error',
        message: errorMsg,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Reset OTP digit changes
  const handleResetOtpChange = (index: number, value: string) => {
    if (isNaN(Number(value))) return;
    
    const newDigits = [...resetOtpDigits];
    newDigits[index] = value.substring(value.length - 1);
    setResetOtpDigits(newDigits);

    if (value && index < 5) {
      resetOtpRefs.current[index + 1]?.focus();
    }
  };

  // Handle Reset OTP Backspace key
  const handleResetOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !resetOtpDigits[index] && index > 0) {
      resetOtpRefs.current[index - 1]?.focus();
    }
  };

  // Handle Reset OTP Paste
  const handleResetOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').trim();
    if (pasteData.length === 6 && /^\d+$/.test(pasteData)) {
      const newDigits = pasteData.split('');
      setResetOtpDigits(newDigits);
      resetOtpRefs.current[5]?.focus();
    }
  };

  // Handle Verify Reset OTP API request
  const handleVerifyResetOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpCode = resetOtpDigits.join('');
    if (otpCode.length < 6) {
      setAlert({
        type: 'error',
        message: 'Please enter all 6 digits of the reset code.',
      });
      return;
    }

    setIsLoading(true);
    setAlert(null);

    try {
      const response = await api.post('/auth/verify-reset-otp', {
        email: forgotEmail.trim(),
        otp: otpCode,
      });
      if (response.data?.success) {
        setResetToken(response.data.data.reset_token);
        setAlert({
          type: 'success',
          message: 'OTP verified successfully. Now, set your new password.',
        });
        setActiveTab('reset-password');
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Verification failed. Please try again.';
      setAlert({
        type: 'error',
        message: errorMsg,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Set New Password API request
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) {
      setValidationErrors({ newPassword: 'Password is required' });
      return;
    }
    if (newPassword.length < 8) {
      setValidationErrors({ newPassword: 'Password must be at least 8 characters long' });
      return;
    }

    setIsLoading(true);
    setAlert(null);

    try {
      const response = await api.post('/auth/reset-password', {
        reset_token: resetToken,
        new_password: newPassword,
      });
      if (response.data?.success) {
        setAlert({
          type: 'success',
          message: 'Your password has been reset successfully! Please sign in with your new password.',
        });
        setLoginPassword('');
        setActiveTab('login');
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to reset password. Please request a new code.';
      setAlert({
        type: 'error',
        message: errorMsg,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      {/* ── Left Sidebar panel ── */}
      <div className="auth-sidebar">
        <div className="logo-wrapper">
          <div className="logo-box">V</div>
          <div className="logo-text">
            <h2>Vertical Clinic</h2>
            <p>Clinic Management System</p>
          </div>
        </div>

        <div className="sidebar-main">
          <h1 className="sidebar-tagline">
            One system for every chair, every branch, every patient.
          </h1>
          <p className="sidebar-description">
            From booking a slot to dispensing medicine — Satellite, Bopal &amp; Navrangpura run on a single, real-time dashboard.
          </p>

          <div className="sidebar-stats">
            <div className="stat-item">
              <span className="stat-value">3</span>
              <span className="stat-label">Active Branches</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">1,240+</span>
              <span className="stat-label">Patients on file</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">98.4%</span>
              <span className="stat-label">On-time check-ins</span>
            </div>
          </div>
        </div>

        <div className="sidebar-footer">
          Demo build · Static data for presentation purposes · v2.4.1
        </div>
      </div>

      {/* ── Right Content panel ── */}
      <div className="auth-content">
        <div className="auth-card" >
          {/* Notification Alert Banner */}
          {alert && (
            <div className={`auth-alert auth-alert-${alert.type}`}>
              {alert.type === 'error' ? (
                <AlertCircle size={18} className="alert-icon" />
              ) : (
                <ShieldCheck size={18} className="alert-icon" />
              )}
              <span>{alert.message}</span>
            </div>
          )}

          {activeTab === 'login' && (
            <>
              <div className="auth-header">
                <h1>Sign in to continue</h1>
                <p>Welcome back! Please enter your details to sign in.</p>
              </div>

              {/* Login Form */}
              <form onSubmit={handleLoginSubmit} className="auth-form">
                <div className="form-group">
                  <label className="form-label">Email or Phone</label>
                  <div className="input-wrapper">
                    <span className="input-icon"><Mail size={18} /></span>
                    <input 
                      type="text"
                      className={`auth-input ${validationErrors.identifier ? 'border-error' : ''}`}
                      placeholder="Enter email or phone number"
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                    />
                  </div>
                  {validationErrors.identifier && (
                    <span style={{ color: 'var(--error-red)', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                      {validationErrors.identifier}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Password</label>
                  <div className="input-wrapper">
                    <span className="input-icon"><Lock size={18} /></span>
                    <input 
                      type={showLoginPassword ? 'text' : 'password'}
                      className={`auth-input ${validationErrors.password ? 'border-error' : ''}`}
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      style={{ paddingRight: '2.75rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="password-toggle-btn"
                      style={{
                        position: 'absolute',
                        right: '1rem',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        padding: 0
                      }}
                    >
                      {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {validationErrors.password && (
                    <span style={{ color: 'var(--error-red)', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                      {validationErrors.password}
                    </span>
                  )}
                </div>

                <div className="form-row">
                  <label className="remember-me">
                    <input type="checkbox" defaultChecked />
                    <span>Remember me</span>
                  </label>
                  <a 
                    href="#forgot" 
                    onClick={(e) => { e.preventDefault(); handleTabChange('forgot'); }} 
                    className="forgot-password"
                  >
                    Forgot password?
                  </a>
                </div>

                <button type="submit" className="submit-btn" disabled={isLoading}>
                  {isLoading ? 'Signing In...' : 'Sign In'} <ChevronRight size={18} />
                </button>
              </form>

              <div className="auth-toggle-text">
                Don't have an account? 
                <span className="auth-toggle-link" onClick={() => handleTabChange('register')}>
                  Sign Up
                </span>
              </div>

            </>
          )}

          {activeTab === 'register' && (
            <>
              <div className="auth-header">
                <h1>Create an account</h1>
                <p>Register as a patient to book and manage visits.</p>
              </div>

              {/* Registration Form */}
              <form onSubmit={handleRegisterSubmit} className="auth-form">
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <div className="input-wrapper">
                    <span className="input-icon"><User size={18} /></span>
                    <input 
                      type="text"
                      className={`auth-input ${validationErrors.fullName ? 'border-error' : ''}`}
                      placeholder="John Doe"
                      value={registerName}
                      onChange={(e) => setRegisterName(e.target.value)}
                    />
                  </div>
                  {validationErrors.fullName && (
                    <span style={{ color: 'var(--error-red)', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                      {validationErrors.fullName}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <div className="input-wrapper">
                    <span className="input-icon"><Mail size={18} /></span>
                    <input 
                      type="email"
                      className={`auth-input ${validationErrors.email ? 'border-error' : ''}`}
                      placeholder="john@example.com"
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                    />
                  </div>
                  {validationErrors.email && (
                    <span style={{ color: 'var(--error-red)', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                      {validationErrors.email}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <div className="input-wrapper">
                    <span className="input-icon"><Phone size={18} /></span>
                    <input 
                      type="text"
                      className={`auth-input ${validationErrors.phone ? 'border-error' : ''}`}
                      placeholder="+919876543210"
                      value={registerPhone}
                      onChange={(e) => setRegisterPhone(e.target.value)}
                    />
                  </div>
                  {validationErrors.phone && (
                    <span style={{ color: 'var(--error-red)', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                      {validationErrors.phone}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Password</label>
                  <div className="input-wrapper">
                    <span className="input-icon"><Lock size={18} /></span>
                    <input 
                      type={showRegisterPassword ? 'text' : 'password'}
                      className={`auth-input ${validationErrors.password ? 'border-error' : ''}`}
                      placeholder="At least 8 characters (A-Z, 0-9)"
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      style={{ paddingRight: '2.75rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                      className="password-toggle-btn"
                      style={{
                        position: 'absolute',
                        right: '1rem',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        padding: 0
                      }}
                    >
                      {showRegisterPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {validationErrors.password && (
                    <span style={{ color: 'var(--error-red)', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                      {validationErrors.password}
                    </span>
                  )}
                </div>

                <button type="submit" className="submit-btn" disabled={isLoading}>
                  {isLoading ? 'Creating Account...' : 'Sign Up'} <ChevronRight size={18} />
                </button>
              </form>

              <div className="auth-toggle-text">
                Already have an account? 
                <span className="auth-toggle-link" onClick={() => handleTabChange('login')}>
                  Sign In
                </span>
              </div>
            </>
          )}

          {activeTab === 'otp' && (
            <>
              <div className="auth-header">
                <h1>Verify your email</h1>
                <p>We've sent a 6-digit OTP code to <strong>{otpEmail || registerEmail}</strong>. Please enter it below to activate your account.</p>
              </div>

              {/* OTP Form */}
              <form onSubmit={handleOtpVerify} className="otp-container">
                <div className="otp-inputs">
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      type="text"
                      maxLength={1}
                      className="otp-field"
                      value={digit}
                      ref={(el) => { otpRefs.current[idx] = el; }}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      onPaste={idx === 0 ? handleOtpPaste : undefined}
                    />
                  ))}
                </div>

                <button type="submit" className="submit-btn" disabled={isLoading}>
                  {isLoading ? 'Verifying...' : 'Verify & Activate'} <ChevronRight size={18} />
                </button>

                <div className="otp-timer">
                  <Clock size={16} />
                  {timer > 0 ? (
                    <span>Resend OTP in {timer}s</span>
                  ) : (
                    <button 
                      type="button" 
                      onClick={() => handleResendOtp('verify')} 
                      className="resend-btn"
                      disabled={isLoading || !canResend}
                    >
                      Resend Verification Code
                    </button>
                  )}
                </div>

                <div 
                  className="auth-toggle-link" 
                  onClick={() => handleTabChange('login')}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.9rem', marginTop: '1rem' }}
                >
                  <ArrowLeft size={16} /> Back to Sign In
                </div>
              </form>
            </>
          )}

          {activeTab === 'forgot' && (
            <>
              <div className="auth-header">
                <h1>Forgot Password</h1>
                <p>Enter your registered email address and we'll send you an OTP to reset your password.</p>
              </div>

              <form onSubmit={handleForgotSubmit} className="auth-form">
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <div className="input-wrapper">
                    <span className="input-icon"><Mail size={18} /></span>
                    <input 
                      type="email"
                      className={`auth-input ${validationErrors.forgotEmail ? 'border-error' : ''}`}
                      placeholder="john@example.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                    />
                  </div>
                  {validationErrors.forgotEmail && (
                    <span style={{ color: 'var(--error-red)', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                      {validationErrors.forgotEmail}
                    </span>
                  )}
                </div>

                <button type="submit" className="submit-btn" disabled={isLoading}>
                  {isLoading ? 'Sending...' : 'Send Reset Code'} <ChevronRight size={18} />
                </button>

                <div 
                  className="auth-toggle-link" 
                  onClick={() => handleTabChange('login')}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.9rem', marginTop: '1rem', justifyContent: 'center' }}
                >
                  <ArrowLeft size={16} /> Back to Sign In
                </div>
              </form>
            </>
          )}

          {activeTab === 'verify-reset' && (
            <>
              <div className="auth-header">
                <h1>Verify Reset Code</h1>
                <p>We've sent a 6-digit password reset OTP to <strong>{forgotEmail}</strong>. Please enter it below.</p>
              </div>

              <form onSubmit={handleVerifyResetOtpSubmit} className="otp-container">
                <div className="otp-inputs">
                  {resetOtpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      type="text"
                      maxLength={1}
                      className="otp-field"
                      value={digit}
                      ref={(el) => { resetOtpRefs.current[idx] = el; }}
                      onChange={(e) => handleResetOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleResetOtpKeyDown(idx, e)}
                      onPaste={idx === 0 ? handleResetOtpPaste : undefined}
                    />
                  ))}
                </div>

                <button type="submit" className="submit-btn" disabled={isLoading}>
                  {isLoading ? 'Verifying...' : 'Verify OTP'} <ChevronRight size={18} />
                </button>

                <div className="otp-timer">
                  <Clock size={16} />
                  {timer > 0 ? (
                    <span>Resend OTP in {timer}s</span>
                  ) : (
                    <button 
                      type="button" 
                      onClick={() => handleResendOtp('reset')} 
                      className="resend-btn"
                      disabled={isLoading || !canResend}
                    >
                      Resend Reset Code
                    </button>
                  )}
                </div>

                <div 
                  className="auth-toggle-link" 
                  onClick={() => handleTabChange('forgot')}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.9rem', marginTop: '1rem' }}
                >
                  <ArrowLeft size={16} /> Back to Forgot Password
                </div>
              </form>
            </>
          )}

          {activeTab === 'reset-password' && (
            <>
              <div className="auth-header">
                <h1>Reset Password</h1>
                <p>Set a secure new password for your account.</p>
              </div>

              <form onSubmit={handleResetPasswordSubmit} className="auth-form">
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <div className="input-wrapper">
                    <span className="input-icon"><Lock size={18} /></span>
                    <input 
                      type={showNewPassword ? 'text' : 'password'}
                      className={`auth-input ${validationErrors.newPassword ? 'border-error' : ''}`}
                      placeholder="At least 8 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      style={{ paddingRight: '2.75rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="password-toggle-btn"
                      style={{
                        position: 'absolute',
                        right: '1rem',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        padding: 0
                      }}
                    >
                      {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {validationErrors.newPassword && (
                    <span style={{ color: 'var(--error-red)', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                      {validationErrors.newPassword}
                    </span>
                  )}
                </div>

                <button type="submit" className="submit-btn" disabled={isLoading}>
                  {isLoading ? 'Resetting...' : 'Save New Password'} <ChevronRight size={18} />
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
export default AuthPage;
