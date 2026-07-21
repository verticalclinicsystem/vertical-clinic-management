import React, { useState, useEffect } from 'react';
import { AuthPage } from './features/auth/AuthPage';
import { PatientPortal } from './features/patient/PatientPortal';
import { AdminPortal } from './features/admin/AdminPortal';
import { DoctorPortal } from './features/doctor/DoctorPortal';
import { PharmacyPortal } from './features/pharmacy/PharmacyPortal';
import { ReceptionistPortal } from './features/receptionist/ReceptionistPortal';
import './App.css';

const App: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activePortal, setActivePortal] = useState<'admin' | 'doctor' | 'pharmacist' | 'receptionist' | 'patient' | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const token = localStorage.getItem('access_token');
    if (savedUser && token) {
      try {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);
        setActivePortal(
          parsed.role === 'admin' 
            ? 'admin' 
            : parsed.role === 'doctor' 
              ? 'doctor' 
              : parsed.role === 'pharmacist' 
                ? 'pharmacist' 
                : parsed.role === 'receptionist'
                  ? 'receptionist'
                  : 'patient'
        );
      } catch (e) {
        localStorage.clear();
      }
    }
    setCheckingAuth(false);
  }, []);

  const handleLoginSuccess = (loggedInUser: any) => {
    setUser(loggedInUser);
    setActivePortal(
      loggedInUser.role === 'admin' 
        ? 'admin' 
        : loggedInUser.role === 'doctor' 
          ? 'doctor' 
          : loggedInUser.role === 'pharmacist' 
            ? 'pharmacist' 
            : loggedInUser.role === 'receptionist'
              ? 'receptionist'
              : 'patient'
    );
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setUser(null);
    setActivePortal(null);
  };

  if (checkingAuth) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', backgroundColor: 'var(--bg-light)' }}>
        <div style={{
          border: '4px solid var(--border-color)',
          borderTop: '4px solid var(--primary-teal)',
          borderRadius: '50%',
          width: '32px',
          height: '32px',
          animation: 'spin 1s linear infinite'
        }} />
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="app-root">
      {user ? (
        activePortal === 'admin' ? (
          <AdminPortal 
            onLogout={handleLogout} 
          />
        ) : activePortal === 'doctor' ? (
          <DoctorPortal 
            onLogout={handleLogout} 
          />
        ) : activePortal === 'pharmacist' ? (
          <PharmacyPortal 
            onLogout={handleLogout} 
          />
        ) : activePortal === 'receptionist' ? (
          <ReceptionistPortal 
            onLogout={handleLogout} 
          />
        ) : (
          <PatientPortal 
            onLogout={handleLogout} 
          />
        )
      ) : (
        <AuthPage onLoginSuccess={handleLoginSuccess} />
      )}
    </div>
  );
};

export default App;
