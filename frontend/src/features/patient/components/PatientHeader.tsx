import React, { useState, useRef, useEffect } from 'react';
import { Menu, Bell, Settings, User, LogOut } from 'lucide-react';

interface PatientHeaderProps {
  screen: string;
  patientProfile: any;
  setIsMobileSidebarOpen: (open: boolean) => void;
  setScreen: (screen: any) => void;
  getInitials: (name?: string) => string;
  notifications: any[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClearAll?: () => void;
  onLogout: () => void;
}

export const PatientHeader: React.FC<PatientHeaderProps> = ({
  screen,
  patientProfile,
  setIsMobileSidebarOpen,
  setScreen,
  getInitials,
  notifications = [],
  onMarkRead,
  onMarkAllRead,
  onClearAll,
  onLogout,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const formatRelativeTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return 'Yesterday';
      return date.toLocaleDateString();
    } catch {
      return '';
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

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
        <div className="notifications-wrapper" ref={dropdownRef}>
          <button className="topbar-icon-btn" onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="notification-badge">{unreadCount}</span>
            )}
          </button>

          {isDropdownOpen && (
            <div className="notifications-dropdown">
              <div className="notifications-header">
                <h4>Notifications</h4>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {unreadCount > 0 && (
                    <button className="notifications-clear-btn" onClick={() => { onMarkAllRead(); }}>
                      Mark all read
                    </button>
                  )}
                  {notifications.length > 0 && onClearAll && (
                    <button className="notifications-clear-btn" style={{ color: '#d9534f' }} onClick={() => { onClearAll(); setIsDropdownOpen(false); }}>
                      Clear all
                    </button>
                  )}
                </div>
              </div>
              <div className="notifications-list">
                {notifications.length === 0 ? (
                  <div className="notifications-empty">No notifications yet.</div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`notification-item ${!n.is_read ? 'unread' : ''}`}
                      onClick={() => {
                        if (!n.is_read) {
                          onMarkRead(n.id);
                        }
                      }}
                    >
                      <div className="notification-item-title">
                        <span>{n.title}</span>
                        {!n.is_read && <span className="notification-unread-dot" />}
                      </div>
                      <div className="notification-item-msg">{n.message}</div>
                      <div className="notification-item-time">{formatRelativeTime(n.created_at)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {patientProfile && (
          <div className="profile-dropdown-wrapper" ref={profileDropdownRef}>
            <div 
              className="topbar-profile" 
              onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
              style={{ cursor: 'pointer' }}
            >
              <div className="topbar-avatar">
                {getInitials(patientProfile.user?.full_name)}
              </div>
              <div className="topbar-user-info">
                <span className="topbar-user-name">{patientProfile.user?.full_name}</span>
                <span className="topbar-user-role">Patient</span>
              </div>
            </div>

            {isProfileDropdownOpen && (
              <div className="profile-dropdown-menu">
                <button onClick={() => { setScreen('profile'); setIsProfileDropdownOpen(false); }}>
                  <User size={14} style={{ color: 'var(--primary-teal, #0c6e8c)' }} /> View Profile
                </button>
                <button onClick={() => { setScreen('preferences'); setIsProfileDropdownOpen(false); }}>
                  <Settings size={14} style={{ color: 'var(--primary-teal, #0c6e8c)' }} /> Settings
                </button>
                <div className="profile-dropdown-divider"></div>
                <button className="logout-item" onClick={() => { onLogout(); setIsProfileDropdownOpen(false); }}>
                  <LogOut size={14} style={{ color: '#dc2626' }} /> Sign Out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
