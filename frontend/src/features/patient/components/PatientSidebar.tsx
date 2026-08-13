import React from 'react';
import {
  Home,
  Calendar,
  CreditCard,
  UploadCloud,
  Pill,
  Activity,
  User,
  Video,
  LogOut,
  Plus,
  X
} from 'lucide-react';

interface PatientSidebarProps {
  screen: string;
  setScreen: (screen: any) => void;
  clearBookingWizardState?: () => void;
  openBookingWizard?: () => void;
  isMobileSidebarOpen: boolean;
  setIsMobileSidebarOpen: (open: boolean) => void;
  onLogout: () => void;
}

export const PatientSidebar: React.FC<PatientSidebarProps> = ({
  screen,
  setScreen,
  clearBookingWizardState,
  openBookingWizard,
  isMobileSidebarOpen,
  setIsMobileSidebarOpen,
  onLogout,
}) => {
  return (
    <>
      {isMobileSidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setIsMobileSidebarOpen(false)} />
      )}
      <aside className={`portal-sidebar ${isMobileSidebarOpen ? 'open' : ''}`}>
        <div className="portal-brand">
          <div className="portal-brand-mark">V</div>
          <div className="portal-brand-text">
            <h2>Vertical Clinic</h2>
            <p>Patient Portal</p>
          </div>
          <button onClick={() => setIsMobileSidebarOpen(false)} className="sidebar-close-btn">
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '12px' }}>
          <button
            className="portal-nav-item active"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              color: '#ffffff',
              fontWeight: 700
            }}
            onClick={() => { setScreen('dashboard'); setIsMobileSidebarOpen(false); }}
          >
            <User size={16} /> Patient Portal
          </button>
        </div>

        <nav className="portal-nav">
          <span className="sidebar-section-heading">Main</span>
          <button
            className={`portal-nav-item ${screen === 'dashboard' ? 'active' : ''}`}
            onClick={() => { setScreen('dashboard'); setIsMobileSidebarOpen(false); }}
          >
            <Home size={18} /> Dashboard
          </button>
          <button
            className={`portal-nav-item ${screen === 'book' ? 'active' : ''}`}
            onClick={() => {
              if (clearBookingWizardState) clearBookingWizardState();
              if (openBookingWizard) openBookingWizard();
              setScreen('book');
              setIsMobileSidebarOpen(false);
            }}
          >
            <Plus size={18} /> Book an Appointment
          </button>
          <button
            className={`portal-nav-item ${screen === 'appointments' ? 'active' : ''}`}
            onClick={() => { setScreen('appointments'); setIsMobileSidebarOpen(false); }}
          >
            <Calendar size={18} /> Appointments
          </button>

          <span className="sidebar-section-heading">Records</span>
          <button
            className={`portal-nav-item ${screen === 'timeline' ? 'active' : ''}`}
            onClick={() => { setScreen('timeline'); setIsMobileSidebarOpen(false); }}
          >
            <Activity size={18} /> Medical History
          </button>
          <button
            className={`portal-nav-item ${screen === 'reports' ? 'active' : ''}`}
            onClick={() => { setScreen('reports'); setIsMobileSidebarOpen(false); }}
          >
            <UploadCloud size={18} /> Medical Reports
          </button>
          <button
            className={`portal-nav-item ${screen === 'prescriptions' ? 'active' : ''}`}
            onClick={() => { setScreen('prescriptions'); setIsMobileSidebarOpen(false); }}
          >
            <Pill size={18} /> Prescriptions
          </button>
          <button
            className={`portal-nav-item ${screen === 'billing' ? 'active' : ''}`}
            onClick={() => { setScreen('billing'); setIsMobileSidebarOpen(false); }}
          >
            <CreditCard size={18} /> Billing History
          </button>

          <span className="sidebar-section-heading">Other</span>
          <button
            className={`portal-nav-item ${screen === 'teleconsultation' ? 'active' : ''}`}
            onClick={() => { setScreen('teleconsultation'); setIsMobileSidebarOpen(false); }}
          >
            <Video size={18} /> Tele Consultation
          </button>

          <button
            className={`portal-nav-item ${screen === 'profile' ? 'active' : ''}`}
            onClick={() => { setScreen('profile'); setIsMobileSidebarOpen(false); }}
          >
            <User size={18} /> Profile
          </button>
        </nav>

        <div className="portal-sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button onClick={onLogout} className="logout-btn">
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </aside>
    </>
  );
};
