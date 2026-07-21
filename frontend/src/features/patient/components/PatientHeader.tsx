import React from 'react';
import { Menu, Search, Bell, Settings } from 'lucide-react';

interface PatientHeaderProps {
  screen: string;
  patientProfile: any;
  setIsMobileSidebarOpen: (open: boolean) => void;
  setScreen: (screen: any) => void;
  getInitials: (name?: string) => string;
}

export const PatientHeader: React.FC<PatientHeaderProps> = ({
  screen,
  patientProfile,
  setIsMobileSidebarOpen,
  setScreen,
  getInitials,
}) => {
  return (
    <header className="portal-topbar">
      <button onClick={() => setIsMobileSidebarOpen(true)} className="topbar-menu-btn">
        <Menu size={20} />
      </button>
      <div className="topbar-brand-section" style={{ marginRight: 'auto' }}>
        <div className="topbar-title">
          {screen === 'book' ? 'Book an Appointment' : screen.charAt(0).toUpperCase() + screen.slice(1)}
        </div>
        <div className="topbar-subtitle">Patient Portal</div>
      </div>

      <div className="topbar-actions">
        <div className="topbar-search-wrapper">
          <Search className="topbar-search-icon" size={16} />
          <input
            type="text"
            placeholder="Search patients, appointments, invoices..."
            className="topbar-search-input"
          />
        </div>

        <button className="topbar-icon-btn">
          <Bell size={18} />
        </button>
        <button className="topbar-icon-btn" onClick={() => setScreen('preferences')}>
          <Settings size={18} />
        </button>

        {patientProfile && (
          <div className="topbar-profile">
            <div className="topbar-avatar">
              {getInitials(patientProfile.user?.full_name)}
            </div>
            <div className="topbar-user-info">
              <span className="topbar-user-name">{patientProfile.user?.full_name}</span>
              <span className="topbar-user-role">Patient</span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
