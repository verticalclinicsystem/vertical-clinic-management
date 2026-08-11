import React from 'react';
import { ArrowRight } from 'lucide-react';

interface RecepQueueTabProps {
  scheduledToday: any[];
  waitingToday: any[];
  activeConsultation: any[];
  completedToday: any[];
  getLocalApptTime: (dateStr: string) => string;
  formatDocName: (name: string) => string;
  setSelectedApptDetails: (appt: any) => void;
  handleCheckIn: (apptId: string) => void;
  setBillingForm: (form: any) => void;
  setActiveTab: (tab: string) => void;
}

export const RecepQueueTab: React.FC<RecepQueueTabProps> = ({
  scheduledToday,
  waitingToday,
  activeConsultation,
  completedToday,
  getLocalApptTime,
  formatDocName,
  setSelectedApptDetails,
  handleCheckIn,
  setBillingForm,
  setActiveTab,
}) => {
  return (
    <div className="recep-kanban-view">
      <div className="recep-kanban-board">
        {/* Scheduled Lane */}
        <div className="recep-kanban-column">
          <div className="recep-kanban-col-header bg-gray">
            <span>Scheduled Today</span>
            <span className="col-count">{scheduledToday.length}</span>
          </div>
          <div className="recep-kanban-col-content">
            {scheduledToday.length === 0 ? (
              <div className="kanban-empty">No scheduled slots</div>
            ) : (
              scheduledToday.map((appt) => (
                <div
                  className="recep-kanban-card"
                  key={appt.id}
                  onClick={() => setSelectedApptDetails(appt)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="card-top">
                    <span className="card-time">{getLocalApptTime(appt.appointment_datetime)}</span>
                    <span className={`badge-consultation ${appt.consultation_type}`}>
                      {appt.consultation_type === 'teleconsultation' ? 'Tele' : 'In-Clinic'}
                    </span>
                  </div>
                  <h4 className="card-patient-name">{appt.patient?.user?.full_name || 'Walk-in'}</h4>
                  <span className="card-code">{appt.patient?.patient_code}</span>
                  <div className="card-meta">
                    <span>{formatDocName(appt.doctor?.user?.full_name || 'Staff')}</span>
                    <span>{appt.treatment_type}</span>
                  </div>
                  <div className="card-actions">
                    <button
                      className="btn-checkin"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCheckIn(appt.id);
                      }}
                    >
                      Check In <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Checked In / Waiting Lane */}
        <div className="recep-kanban-column">
          <div className="recep-kanban-col-header bg-orange">
            <span>Checked In / Waiting</span>
            <span className="col-count">{waitingToday.length}</span>
          </div>
          <div className="recep-kanban-col-content">
            {waitingToday.length === 0 ? (
              <div className="kanban-empty">No patients waiting</div>
            ) : (
              waitingToday.map((appt) => (
                <div
                  className="recep-kanban-card border-orange"
                  key={appt.id}
                  onClick={() => setSelectedApptDetails(appt)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="card-top">
                    <span className="card-time">{getLocalApptTime(appt.appointment_datetime)}</span>
                    <span className="badge badge-waiting">Waiting</span>
                  </div>
                  <h4 className="card-patient-name">{appt.patient?.user?.full_name || 'Walk-in'}</h4>
                  <span className="card-code">{appt.patient?.patient_code}</span>
                  <div className="card-meta">
                    <span>{formatDocName(appt.doctor?.user?.full_name || 'Staff')}</span>
                    <span>{appt.treatment_type}</span>
                  </div>
                  <p className="card-notes">
                    <em>Wait queue...</em>
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* In Consultation Lane */}
        <div className="recep-kanban-column">
          <div className="recep-kanban-col-header bg-blue">
            <span>In Consultation</span>
            <span className="col-count">{activeConsultation.length}</span>
          </div>
          <div className="recep-kanban-col-content">
            {activeConsultation.length === 0 ? (
              <div className="kanban-empty">No active cabinets</div>
            ) : (
              activeConsultation.map((appt) => (
                <div
                  className="recep-kanban-card border-blue"
                  key={appt.id}
                  onClick={() => setSelectedApptDetails(appt)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="card-top">
                    <span className="card-time">{getLocalApptTime(appt.appointment_datetime)}</span>
                    <span className="badge badge-consultation-active">In Progress</span>
                  </div>
                  <h4 className="card-patient-name">{appt.patient?.user?.full_name || 'Walk-in'}</h4>
                  <span className="card-code">{appt.patient?.patient_code}</span>
                  <div className="card-meta">
                    <span>{formatDocName(appt.doctor?.user?.full_name || 'Staff')}</span>
                    <span>{appt.treatment_type}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Completed Lane */}
        <div className="recep-kanban-column">
          <div className="recep-kanban-col-header bg-green">
            <span>Completed</span>
            <span className="col-count">{completedToday.length}</span>
          </div>
          <div className="recep-kanban-col-content">
            {completedToday.length === 0 ? (
              <div className="kanban-empty">No completed cases</div>
            ) : (
              completedToday.map((appt) => (
                <div
                  className="recep-kanban-card border-green"
                  key={appt.id}
                  onClick={() => setSelectedApptDetails(appt)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="card-top">
                    <span className="card-time">{getLocalApptTime(appt.appointment_datetime)}</span>
                    <span className="badge badge-completed">Done</span>
                  </div>
                  <h4 className="card-patient-name">{appt.patient?.user?.full_name || 'Walk-in'}</h4>
                  <span className="card-code">{appt.patient?.patient_code}</span>
                  <div className="card-meta">
                    <span>{formatDocName(appt.doctor?.user?.full_name || 'Staff')}</span>
                    <span>{appt.treatment_type}</span>
                  </div>
                  <div className="card-actions mt-1">
                    <button
                      className="btn-bill"
                      onClick={(e) => {
                        e.stopPropagation();
                        setBillingForm({
                          patient_id: appt.patient_id,
                          total_amount: appt.doctor?.consultation_fee || 500,
                          discount_amount: 0,
                          tax_amount: 0,
                        });
                        setActiveTab('billing');
                      }}
                    >
                      Create Invoice
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
