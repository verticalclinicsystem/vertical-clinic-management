import React, { useState, useEffect, useRef } from 'react';
import { 
  User, 
  Mail, 
  Lock, 
  Phone, 
  ArrowRight,
  ArrowLeft,
  ShieldCheck, 
  AlertCircle, 
  Clock,
  Eye,
  EyeOff,
  Calendar,
  FileText,
  FolderKanban,
  Share2
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
    if (isNaN(Number(value))) return;
    const newDigits = [...otpDigits];
    newDigits[index] = value.substring(value.length - 1);
    setOtpDigits(newDigits);

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleResetOtpChange = (index: number, value: string) => {
    if (isNaN(Number(value))) return;
    const newDigits = [...resetOtpDigits];
    newDigits[index] = value.substring(value.length - 1);
    setResetOtpDigits(newDigits);
    if (value && index < 5) {
      resetOtpRefs.current[index + 1]?.focus();
    }
  };

  // Handle Login Submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { [key: string]: string } = {};

    if (!loginIdentifier.trim()) {
      errors.identifier = 'Email or phone number is required';
    }
    if (!loginPassword) {
      errors.password = 'Password is required';
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});
    setIsLoading(true);
    setAlert(null);

    try {
      const response = await api.post('/auth/login', {
        identifier: loginIdentifier.trim(),
        password: loginPassword,
      });

      if (response.data?.success) {
        const authData = response.data.data;
        if (authData.access_token) {
          localStorage.setItem('access_token', authData.access_token);
        }
        if (authData.refresh_token) {
          localStorage.setItem('refresh_token', authData.refresh_token);
        }

        const user = authData.user || {};
        localStorage.setItem('user', JSON.stringify(user));
        if (user.role) {
          localStorage.setItem('user_role', user.role.toLowerCase());
        }
        if (user.full_name) {
          localStorage.setItem('user_name', user.full_name);
        }
        if (user.id) {
          localStorage.setItem('user_id', user.id);
        }

        // Always reset active portal tabs on fresh login to open Dashboard
        localStorage.removeItem('patient_portal_tab');
        localStorage.removeItem('doctor_portal_tab');
        localStorage.removeItem('admin_portal_tab');
        localStorage.removeItem('receptionist_portal_tab');
        localStorage.removeItem('pharmacy_portal_tab');
        localStorage.removeItem('manager_portal_tab');

        setAlert({
          type: 'success',
          message: 'Login successful! Redirecting...',
        });

        setTimeout(() => {
          if (onLoginSuccess) {
            onLoginSuccess(user);
          } else {
            window.location.reload();
          }
        }, 1000);
      } else {
        setAlert({
          type: 'error',
          message: response.data?.message || 'Login failed. Please try again.',
        });
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Invalid credentials or server error. Please try again.';
      setAlert({
        type: 'error',
        message: errorMsg,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Register Submit
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { [key: string]: string } = {};

    if (!registerName.trim()) {
      errors.fullName = 'Full Name is required';
    }
    if (!registerEmail.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(registerEmail.trim())) {
      errors.email = 'Please enter a valid email address';
    }
    if (!registerPhone.trim()) {
      errors.phone = 'Phone number is required';
    } else {
      const cleanDigits = registerPhone.replace(/\D/g, '');
      if (cleanDigits.length < 10) {
        errors.phone = 'Phone number must have at least 10 digits';
      }
    }
    if (!registerPassword) {
      errors.password = 'Password is required';
    } else if (registerPassword.length < 8) {
      errors.password = 'Password must be at least 8 characters long';
    } else if (!/[A-Z]/.test(registerPassword)) {
      errors.password = 'Password must contain at least one uppercase letter (A-Z)';
    } else if (!/[0-9]/.test(registerPassword)) {
      errors.password = 'Password must contain at least one number (0-9)';
    } else if (!/[!@#$%^&*()_+\-=\[\]{}|;':",./<>?`~\\]/.test(registerPassword)) {
      errors.password = 'Password must contain at least one special character (!@#$%^&* etc.)';
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});
    setIsLoading(true);
    setAlert(null);

    try {
      const response = await api.post('/auth/register', {
        full_name: registerName.trim(),
        email: registerEmail.trim(),
        phone: registerPhone.trim(),
        password: registerPassword,
        role: 'patient',
      });

      if (response.data?.success) {
        setOtpEmail(registerEmail.trim());
        setTimer(60);
        setCanResend(false);
        setOtpDigits(Array(6).fill(''));
        setAlert({
          type: 'success',
          message: 'Registration successful! Verification code sent to your email.',
        });
        setActiveTab('otp');
      } else {
        setAlert({
          type: 'error',
          message: response.data?.message || 'Registration failed. Please try again.',
        });
      }
    } catch (err: any) {
      const serverDetails = err.response?.data?.details;
      const fieldErrors: { [key: string]: string } = {};

      if (Array.isArray(serverDetails) && serverDetails.length > 0) {
        serverDetails.forEach((item: any) => {
          if (item.field) {
            let fieldKey = item.field;
            if (fieldKey === 'full_name') fieldKey = 'fullName';
            if (fieldKey === 'new_password') fieldKey = 'newPassword';
            fieldErrors[fieldKey] = item.message;
          }
        });
        setValidationErrors(fieldErrors);
      }

      const errorMsg = err.response?.data?.message || 'Registration failed. Please try again.';
      setAlert({
        type: 'error',
        message: errorMsg,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle OTP Submit
  const handleOtpSubmit = async (e: React.FormEvent) => {
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
        email: otpEmail,
        otp: otpCode,
      });

      if (response.data?.success) {
        setAlert({
          type: 'success',
          message: 'Email verified successfully! You can now sign in.',
        });
        setLoginIdentifier(otpEmail);
        setActiveTab('login');
      } else {
        setAlert({
          type: 'error',
          message: response.data?.message || 'Invalid verification code.',
        });
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

  // Handle Resend OTP
  const handleResendOtp = async () => {
    if (!canResend) return;
    setIsLoading(true);
    setAlert(null);

    try {
      const response = await api.post('/auth/resend-otp', { email: otpEmail });
      if (response.data?.success) {
        setTimer(60);
        setCanResend(false);
        setAlert({
          type: 'success',
          message: 'A new verification code has been sent to your email.',
        });
      }
    } catch (err: any) {
      setAlert({
        type: 'error',
        message: 'Failed to resend code. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Forgot Password API request
  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      setValidationErrors({ forgotEmail: 'Email is required' });
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
          message: 'Password reset OTP sent to your email. Please check your inbox.',
        });
        setResetOtpDigits(Array(6).fill(''));
        setActiveTab('verify-reset');
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to send reset code. Please try again.';
      setAlert({
        type: 'error',
        message: errorMsg,
      });
    } finally {
      setIsLoading(false);
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
    } else if (!/[A-Z]/.test(newPassword)) {
      setValidationErrors({ newPassword: 'Password must contain at least one uppercase letter (A-Z)' });
      return;
    } else if (!/[0-9]/.test(newPassword)) {
      setValidationErrors({ newPassword: 'Password must contain at least one number (0-9)' });
      return;
    } else if (!/[!@#$%^&*()_+\-=\[\]{}|;':",./<>?`~\\]/.test(newPassword)) {
      setValidationErrors({ newPassword: 'Password must contain at least one special character (!@#$%^&* etc.)' });
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
      const serverDetails = err.response?.data?.details;
      if (Array.isArray(serverDetails) && serverDetails.length > 0) {
        const fieldErrors: { [key: string]: string } = {};
        serverDetails.forEach((item: any) => {
          if (item.field) {
            let fieldKey = item.field;
            if (fieldKey === 'new_password') fieldKey = 'newPassword';
            fieldErrors[fieldKey] = item.message;
          }
        });
        setValidationErrors(fieldErrors);
      }

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
        <div className="auth-sidebar-overlay" />
        <div className="auth-sidebar-content">
          <div className="logo-wrapper">
            <div className="logo-box">V</div>
            <div className="logo-text">
              <h2>Vertical Clinic</h2>
              <p>CLINIC MANAGEMENT SYSTEM</p>
            </div>
          </div>

          <div className="sidebar-main">
            <h1 className="sidebar-tagline">
              Smart Clinic.<br />Better Care.
            </h1>
            <p className="sidebar-description">
              Manage appointments, patients, billing, and much more — all in one place.
            </p>

            <div className="sidebar-features-row">
              <div className="feature-pill-item">
                <div className="feature-pill-icon"><Calendar size={22} /></div>
                <span>Appointment<br />Management</span>
              </div>
              <div className="feature-pill-item">
                <div className="feature-pill-icon"><FileText size={22} /></div>
                <span>Electronic<br />Prescriptions</span>
              </div>
              <div className="feature-pill-item">
                <div className="feature-pill-icon"><FolderKanban size={22} /></div>
                <span>Patient<br />Records</span>
              </div>
              <div className="feature-pill-item">
                <div className="feature-pill-icon"><Share2 size={22} /></div>
                <span>Multi-Branch<br />Support</span>
              </div>
            </div>

            <div className="sidebar-stats-card">
              <div className="stat-item">
                <span className="stat-value">3</span>
                <span className="stat-label">Active Branches</span>
              </div>
              <div className="stat-divider" />
              <div className="stat-item">
                <span className="stat-value">12</span>
                <span className="stat-label">Doctors</span>
              </div>
              <div className="stat-divider" />
              <div className="stat-item">
                <span className="stat-value">1,240+</span>
                <span className="stat-label">Patients</span>
              </div>
              <div className="stat-divider" />
              <div className="stat-item">
                <span className="stat-value">98.4%</span>
                <span className="stat-label">Satisfaction</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right Content panel ── */}
      <div className="auth-content">
        <div className="auth-card-wrapper">
          <div className="auth-card">
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
                <p>Welcome back! Please sign in to your account.</p>
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
                      placeholder="patient1_bopal@verticalclinic.com"
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
                      placeholder="••••••••••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      style={{ paddingRight: '2.75rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="password-toggle-btn"
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
                  {isLoading ? 'Signing In...' : 'Sign In'} <ArrowRight size={18} />
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
                      placeholder="name@example.com"
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
                      type="tel"
                      className={`auth-input ${validationErrors.phone ? 'border-error' : ''}`}
                      placeholder="+91 98765 43210"
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
                      placeholder="••••••••"
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      style={{ paddingRight: '2.75rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                      className="password-toggle-btn"
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
                  {isLoading ? 'Creating Account...' : 'Create Account'} <ArrowRight size={18} />
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
            <div className="otp-container">
              <div className="auth-header" style={{ textAlign: 'center' }}>
                <h1>Verify your email</h1>
                <p>We have sent a 6-digit verification code to <strong>{otpEmail}</strong></p>
              </div>

              <form onSubmit={handleOtpSubmit} style={{ width: '100%' }}>
                <div className="otp-inputs">
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => { otpRefs.current[idx] = el; }}
                      type="text"
                      maxLength={1}
                      className="otp-field"
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !digit && idx > 0) {
                          otpRefs.current[idx - 1]?.focus();
                        }
                      }}
                    />
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
                  <button type="submit" className="submit-btn" disabled={isLoading}>
                    {isLoading ? 'Verifying...' : 'Verify Email'}
                  </button>
                </div>
              </form>

              <div className="otp-timer">
                <Clock size={16} />
                {canResend ? (
                  <button onClick={handleResendOtp} className="resend-btn" disabled={isLoading}>
                    Resend Code
                  </button>
                ) : (
                  <span>Resend code in 0:{timer < 10 ? `0${timer}` : timer}</span>
                )}
              </div>

              <div className="auth-toggle-text" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem' }}>
                <span className="auth-toggle-link" onClick={() => handleTabChange('register')} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <ArrowLeft size={16} /> Back to Sign Up
                </span>
                <span style={{ color: '#cbd5e1' }}>•</span>
                <span className="auth-toggle-link" onClick={() => handleTabChange('login')}>
                  Sign In
                </span>
              </div>
            </div>
          )}

          {activeTab === 'forgot' && (
            <>
              <div className="auth-header">
                <h1>Reset your password</h1>
                <p>Enter your registered email to receive a password reset OTP.</p>
              </div>

              <form onSubmit={handleForgotSubmit} className="auth-form">
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <div className="input-wrapper">
                    <span className="input-icon"><Mail size={18} /></span>
                    <input 
                      type="email"
                      className={`auth-input ${validationErrors.forgotEmail ? 'border-error' : ''}`}
                      placeholder="name@example.com"
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
                  {isLoading ? 'Sending Code...' : 'Send Reset Code'} <ArrowRight size={18} />
                </button>
              </form>

              <div className="auth-toggle-text">
                <span className="auth-toggle-link" onClick={() => handleTabChange('login')} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <ArrowLeft size={16} /> Back to Sign In
                </span>
              </div>
            </>
          )}

          {activeTab === 'verify-reset' && (
            <div className="otp-container">
              <div className="auth-header" style={{ textAlign: 'center' }}>
                <h1>Enter Reset Code</h1>
                <p>We sent a 6-digit password reset code to <strong>{forgotEmail}</strong></p>
              </div>

              <form onSubmit={handleVerifyResetOtpSubmit} style={{ width: '100%' }}>
                <div className="otp-inputs">
                  {resetOtpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => { resetOtpRefs.current[idx] = el; }}
                      type="text"
                      maxLength={1}
                      className="otp-field"
                      value={digit}
                      onChange={(e) => handleResetOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !digit && idx > 0) {
                          resetOtpRefs.current[idx - 1]?.focus();
                        }
                      }}
                    />
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
                  <button type="submit" className="submit-btn" disabled={isLoading}>
                    {isLoading ? 'Verifying...' : 'Verify & Continue'}
                  </button>
                </div>
              </form>

              <div className="auth-toggle-text" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center' }}>
                <span className="auth-toggle-link" onClick={() => handleTabChange('forgot')} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <ArrowLeft size={16} /> Change Email / Back
                </span>
              </div>
            </div>
          )}

          {activeTab === 'reset-password' && (
            <>
              <div className="auth-header">
                <h1>Set New Password</h1>
                <p>Please enter a strong new password for your account.</p>
              </div>

              <form onSubmit={handleResetPasswordSubmit} className="auth-form">
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <div className="input-wrapper">
                    <span className="input-icon"><Lock size={18} /></span>
                    <input 
                      type={showNewPassword ? 'text' : 'password'}
                      className={`auth-input ${validationErrors.newPassword ? 'border-error' : ''}`}
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      style={{ paddingRight: '2.75rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="password-toggle-btn"
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
                  {isLoading ? 'Saving Password...' : 'Save & Sign In'} <ArrowRight size={18} />
                </button>
              </form>

              <div className="auth-toggle-text">
                <span className="auth-toggle-link" onClick={() => handleTabChange('login')} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <ArrowLeft size={16} /> Cancel & Back to Sign In
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="security-encryption-footer">
          <Lock size={14} /> Your data is secure with 256-bit encryption
        </div>
      </div>
    </div>
  );
};
