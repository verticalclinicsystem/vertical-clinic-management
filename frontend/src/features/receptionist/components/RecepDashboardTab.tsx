import React from 'react';
import { Calendar, Clock, User, Stethoscope, Plus } from 'lucide-react';

interface RecepDashboardTabProps {
  appointments: any[];
  waitingToday: any[];
  doctors: any[];
  billingRevenueToday: number;
  invoices: any[];
  today: string;
  getLocalApptDate: (dateStr: string) => string;
  getLocalApptTime: (dateStr: string) => string;
  formatDocName: (name: string) => string;
  setShowBookModal: (show: boolean) => void;
  handleCheckIn: (apptId: string) => void;
}

export const RecepDashboardTab: React.FC<RecepDashboardTabProps> = ({
  appointments,
  waitingToday,
  doctors,
  billingRevenueToday,
  invoices,
  today,
  getLocalApptDate,
  getLocalApptTime,
  formatDocName,
  setShowBookModal,
  handleCheckIn,
}) => {
  const formatTimeToAMPM = (timeStr: string) => {
    if (!timeStr) return '';
    try {
      const timePart = timeStr.includes('T') ? getLocalApptTime(timeStr) : timeStr.slice(0, 5);
      const [hours, minutes] = timePart.split(':').map(Number);
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const formattedHours = hours % 12 || 12;
      return `${formattedHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    } catch (e) {
      return timeStr;
    }
  };

  const dbTodayAppointments = appointments.filter((a) => {
    const datePart = getLocalApptDate(a.appointment_datetime);
    return datePart === today;
  });

  const displayAppointments = [...dbTodayAppointments].sort((a, b) =>
    a.appointment_datetime.localeCompare(b.appointment_datetime)
  );

  const displayApptsCount = dbTodayAppointments.length;
  const displayWaitingCount = waitingToday.length;

  const walkInsTodayCount = appointments.filter((appt) => {
    const datePart = getLocalApptDate(appt.appointment_datetime);
    return (
      datePart === today &&
      (appt.consultation_type === 'walk_in' ||
        appt.notes?.toLowerCase().includes('walk-in'))
    );
  }).length;
  const displayWalkInsCount = walkInsTodayCount;

  const availableDocs = doctors.filter((d) => d.is_available).length;
  const totalDocs = doctors.length;
  const displayDocsRatio = totalDocs > 0 ? `${availableDocs}/${totalDocs}` : '0/0';

  const displayedRevenue = billingRevenueToday;

  const getHourGroupRevenue = (startHour: number, endHour: number): number => {
    return invoices
      .filter((inv) => {
        if (inv.status !== 'paid') return false;
        const datePart = getLocalApptDate(inv.created_at);
        if (datePart !== today) return false;
        const d = new Date(inv.created_at);
        const h = d.getHours();
        return h >= startHour && h < endHour;
      })
      .reduce((sum, inv) => sum + inv.grand_total, 0);
  };

  const rev9AM = getHourGroupRevenue(8, 10);
  const rev11AM = getHourGroupRevenue(10, 12);
  const rev1PM = getHourGroupRevenue(12, 14);
  const rev3PM = getHourGroupRevenue(14, 16);
  const rev5PM = getHourGroupRevenue(16, 24);

  const maxRev = Math.max(rev9AM, rev11AM, rev1PM, rev3PM, rev5PM, 1);

  return (
    <div className="recep-dashboard-view">
      {/* Stats Grid */}
      <div className="recep-stats-grid">
        <div className="recep-stat-card border-indigo">
          <div className="recep-stat-top">
            <span className="recep-stat-icon-wrapper bg-light-purple">
              <Calendar size={20} />
            </span>
            <span className="recep-stat-trend bg-light-green">+12%</span>
          </div>
          <span className="recep-stat-val">{displayApptsCount}</span>
          <span className="recep-stat-label">Today's Appointments</span>
        </div>

        <div className="recep-stat-card border-orange">
          <div className="recep-stat-top">
            <span className="recep-stat-icon-wrapper bg-light-orange">
              <Clock size={20} />
            </span>
          </div>
          <span className="recep-stat-val">{displayWaitingCount}</span>
          <span className="recep-stat-label">Waiting Patients</span>
        </div>

        <div className="recep-stat-card border-teal">
          <div className="recep-stat-top">
            <span className="recep-stat-icon-wrapper bg-light-teal">
              <User size={20} />
            </span>
          </div>
          <span className="recep-stat-val">{displayWalkInsCount}</span>
          <span className="recep-stat-label">Walk-Ins Today</span>
        </div>

        <div className="recep-stat-card border-green">
          <div className="recep-stat-top">
            <span className="recep-stat-icon-wrapper bg-light-green">
              <Stethoscope size={20} />
            </span>
          </div>
          <span className="recep-stat-val">{displayDocsRatio}</span>
          <span className="recep-stat-label">Doctors Available</span>
        </div>
      </div>

      {/* Dashboard Row */}
      <div className="recep-dashboard-row">
        {/* Left Pane: Today's Appointments List */}
        <div className="recep-card flex-2">
          <div className="recep-card-header">
            <h3 className="recep-card-title">Today's Appointments</h3>
            <button className="recep-btn-primary" onClick={() => setShowBookModal(true)}>
              <Plus size={16} /> Walk-In
            </button>
          </div>

          <div className="recep-table-container">
            <table className="recep-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Patient</th>
                  <th>Doctor</th>
                  <th>Time</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {displayAppointments.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                      No appointments scheduled for today.
                    </td>
                  </tr>
                ) : (
                  displayAppointments.map((appt) => {
                    const timeStr = formatTimeToAMPM(appt.appointment_datetime);
                    const apptId =
                      appt.appointment_number ||
                      appt.patient?.patient_code ||
                      `APT-${appt.id.toString().slice(-5).toUpperCase()}`;

                    const isCheckedIn = appt.status === 'checked_in' || appt.status === 'Waiting';

                    let displayStatus = appt.status;
                    if (displayStatus === 'pending') {
                      displayStatus = 'Waiting';
                    } else if (displayStatus === 'confirmed') {
                      displayStatus = 'Confirmed';
                    } else if (displayStatus === 'completed') {
                      displayStatus = 'Completed';
                    } else if (displayStatus === 'cancelled') {
                      displayStatus = 'Cancelled';
                    }

                    if (isCheckedIn) {
                      displayStatus = 'Checked In';
                    }

                    let badgeClass = 'badge-pending';
                    if (displayStatus === 'Waiting') badgeClass = 'badge-waiting';
                    else if (displayStatus === 'Confirmed') badgeClass = 'badge-confirmed';
                    else if (displayStatus === 'Completed') badgeClass = 'badge-completed';
                    else if (displayStatus === 'Cancelled') badgeClass = 'badge-cancelled';
                    else if (displayStatus === 'Checked In') badgeClass = 'badge-completed';

                    const showCheckInBtn = displayStatus === 'Waiting' && !isCheckedIn;

                    return (
                      <tr key={appt.id}>
                        <td>
                          <strong className="recep-appt-id">{apptId}</strong>
                        </td>
                        <td>
                          <strong>{appt.patient?.user?.full_name || 'Walk-in'}</strong>
                        </td>
                        <td>{formatDocName(appt.doctor?.user?.full_name || 'Staff Doctor')}</td>
                        <td>{timeStr}</td>
                        <td>
                          <span className={`badge ${badgeClass}`}>{displayStatus}</span>
                        </td>
                        <td>
                          {showCheckInBtn && (
                            <button
                              className="recep-checkin-btn-action btn-sm"
                              onClick={() => handleCheckIn(appt.id)}
                            >
                              Check-In
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Pane: Revenue Today */}
        <div className="recep-card flex-1">
          <div className="recep-card-header">
            <h3 className="recep-card-title">Revenue Today</h3>
          </div>
          <div className="recep-revenue-chart-card">
            <div className="recep-revenue-header">
              <span className="recep-revenue-title">₹{displayedRevenue.toLocaleString('en-IN')}</span>
              <span className="recep-revenue-subtitle">Across Satellite branch</span>
            </div>

            <div className="recep-bar-chart">
              <div className="recep-chart-bar-container">
                <span className="recep-chart-bar-val">₹{rev9AM.toLocaleString('en-IN')}</span>
                <div className="recep-chart-bar-fill" style={{ height: `${(rev9AM / maxRev) * 100}%` }}></div>
                <span className="recep-chart-bar-label">9AM</span>
              </div>
              <div className="recep-chart-bar-container">
                <span className="recep-chart-bar-val">₹{rev11AM.toLocaleString('en-IN')}</span>
                <div className="recep-chart-bar-fill" style={{ height: `${(rev11AM / maxRev) * 100}%` }}></div>
                <span className="recep-chart-bar-label">11AM</span>
              </div>
              <div className="recep-chart-bar-container">
                <span className="recep-chart-bar-val">₹{rev1PM.toLocaleString('en-IN')}</span>
                <div className="recep-chart-bar-fill" style={{ height: `${(rev1PM / maxRev) * 100}%` }}></div>
                <span className="recep-chart-bar-label">1PM</span>
              </div>
              <div className="recep-chart-bar-container">
                <span className="recep-chart-bar-val">₹{rev3PM.toLocaleString('en-IN')}</span>
                <div className="recep-chart-bar-fill" style={{ height: `${(rev3PM / maxRev) * 100}%` }}></div>
                <span className="recep-chart-bar-label">3PM</span>
              </div>
              <div className="recep-chart-bar-container">
                <span className="recep-chart-bar-val">₹{rev5PM.toLocaleString('en-IN')}</span>
                <div className="recep-chart-bar-fill" style={{ height: `${(rev5PM / maxRev) * 100}%` }}></div>
                <span className="recep-chart-bar-label">5PM</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
