import React, { useState, useEffect } from 'react';
import { AuthPage } from './features/auth/AuthPage';
import { PatientPortal } from './features/patient/PatientPortal';
import { AdminPortal } from './features/admin/AdminPortal';
import { DoctorPortal } from './features/doctor/DoctorPortal';
import { PharmacyPortal } from './features/pharmacy/PharmacyPortal';
import { ReceptionistPortal } from './features/receptionist/ReceptionistPortal';
import { ClinicManagerPortal } from './features/manager/ClinicManagerPortal';
import './App.css';

const App: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activePortal, setActivePortal] = useState<'admin' | 'clinic_manager' | 'doctor' | 'pharmacist' | 'receptionist' | 'patient' | null>(null);

  const getPortalForRole = (role: string) => {
    switch (role) {
      case 'admin': return 'admin';
      case 'clinic_manager': return 'clinic_manager';
      case 'doctor': return 'doctor';
      case 'pharmacist': return 'pharmacist';
      case 'receptionist': return 'receptionist';
      default: return 'patient';
    }
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const token = localStorage.getItem('access_token');
    if (savedUser && token) {
      try {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);
        setActivePortal(getPortalForRole(parsed.role));
      } catch (e) {
        console.error("Error parsing user from localStorage:", e);
        localStorage.removeItem('user');
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      }
    }
    setCheckingAuth(false);
  }, []);

  const handleLoginSuccess = (loggedInUser: any) => {
    localStorage.setItem('user', JSON.stringify(loggedInUser));
    setUser(loggedInUser);
    setActivePortal(getPortalForRole(loggedInUser.role));
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('patient_portal_tab');
    localStorage.removeItem('doctor_portal_tab');
    localStorage.removeItem('admin_portal_tab');
    localStorage.removeItem('receptionist_portal_tab');
    localStorage.removeItem('pharmacy_portal_tab');
    localStorage.removeItem('manager_portal_tab');
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
        ) : activePortal === 'clinic_manager' ? (
          <ClinicManagerPortal
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
