import React from 'react';
import { Search, UserPlus, Users, Eye } from 'lucide-react';

interface RecepPatientsTabProps {
  patientSearchQuery: string;
  setPatientSearchQuery: (query: string) => void;
  searchPatients: () => void;
  patients: any[];
  setShowRegisterModal: (show: boolean) => void;
  setSelectedPatientForHistory: (patient: any) => void;
  fetchPatientHistoryProfile: (id: string) => void;
  setIsEditingPatientProfile: (editing: boolean) => void;
  setShowPatientHistoryModal: (show: boolean) => void;
}

export const RecepPatientsTab: React.FC<RecepPatientsTabProps> = ({
  patientSearchQuery,
  setPatientSearchQuery,
  searchPatients,
  patients,
  setShowRegisterModal,
  setSelectedPatientForHistory,
  fetchPatientHistoryProfile,
  setIsEditingPatientProfile,
  setShowPatientHistoryModal,
}) => {
  return (
    <div className="recep-patients-view">
      <div className="recep-card">
        <div className="recep-card-header flex-column-mobile">
          <div className="recep-search-wrapper">
            <Search size={16} className="recep-search-icon" />
            <input
              type="text"
              className="recep-search-input"
              placeholder="Search patient by name, code, phone..."
              list="receptionist-patients-suggestions"
              value={patientSearchQuery}
              onChange={(e) => setPatientSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchPatients()}
            />
            <datalist id="receptionist-patients-suggestions">
              {Array.from(
                new Set((patients || []).map((pat: any) => pat.user?.full_name || pat.name))
              ).map((name: any) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <button className="search-btn-action" onClick={searchPatients}>
              Search
            </button>
          </div>

          <div className="recep-header-actions">
            <button className="recep-btn-primary" onClick={() => setShowRegisterModal(true)}>
              <UserPlus size={16} /> New Registration
            </button>
          </div>
        </div>

        {patients.length === 0 ? (
          <div className="recep-empty-state">
            <Users size={48} />
            <p>No patient records found.</p>
          </div>
        ) : (
          <div className="recep-table-container">
            <table className="recep-table">
              <thead>
                <tr>
                  <th>Patient Code</th>
                  <th>Name</th>
                  <th>Age / Gender</th>
                  <th>Phone</th>
                  <th>Insurance Details</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((p) => {
                  const age = p.date_of_birth
                    ? new Date().getFullYear() - new Date(p.date_of_birth).getFullYear()
                    : '—';
                  return (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.patient_code}</strong>
                      </td>
                      <td>{p.user?.full_name || 'N/A'}</td>
                      <td>
                        {age} Yrs / {p.gender || '—'}
                      </td>
                      <td>{p.user?.phone || '—'}</td>
                      <td>
                        {p.insurance_provider
                          ? `${p.insurance_provider} (${p.insurance_policy_no || 'No Policy'})`
                          : 'None'}
                      </td>
                      <td>
                        <span
                          className={`badge ${p.is_active ? 'badge-completed' : 'badge-cancelled'}`}
                        >
                          {p.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="recep-actions-row">
                          <button
                            className="btn-action-history"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 14px',
                              borderRadius: '6px',
                            }}
                            title="View Patient Profile & Details"
                            onClick={() => {
                              setSelectedPatientForHistory(p);
                              fetchPatientHistoryProfile(p.id);
                              setIsEditingPatientProfile(false);
                              setShowPatientHistoryModal(true);
                            }}
                          >
                            <Eye size={16} /> View Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
