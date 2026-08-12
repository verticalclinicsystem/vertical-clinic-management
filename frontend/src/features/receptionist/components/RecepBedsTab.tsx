import React from 'react';
import { Bed, FileText, RefreshCw, Search, Eye } from 'lucide-react';

interface RecepBedsTabProps {
  bedSubTab: 'grid' | 'history';
  setBedSubTab: React.Dispatch<React.SetStateAction<'grid' | 'history'>>;
  fetchAdmissionHistory: () => void;
  isLoadingHistory: boolean;
  fetchBedsData: () => void;
  isLoadingBeds: boolean;
  pendingAdmissionRequests: any[];
  setActiveAdmissionRequestId: (id: string | null) => void;
  setAdmitForm: (form: any) => void;
  bedsData: any[];
  setSelectedBed: (bed: any) => void;
  setIsAdmitModalOpen: (open: boolean) => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
  bedsError: string | null;
  historySearchQuery: string;
  setHistorySearchQuery: (query: string) => void;
  admissionHistory: any[];
  fetchHistoryDetails: (id: string) => void;
  handleCleanBed: (bedId: string) => void;
  setIsVitalsModalOpen: (open: boolean) => void;
  fetchClinicalRecords: (admissionId: string) => void;
  setIsMacModalOpen: (open: boolean) => void;
  setIsTransferModalOpen: (open: boolean) => void;
  setIsCheckoutModalOpen: (open: boolean) => void;
  fetchCheckoutBill: (admissionId: string) => void;
}

const formatBedNumber = (bedNum: string) => {
  if (!bedNum) return '';
  const hasAlphaPrefix = /^[a-zA-Z]/.test(bedNum);
  return hasAlphaPrefix ? bedNum : `Bed ${bedNum}`;
};

export const RecepBedsTab: React.FC<RecepBedsTabProps> = ({
  bedSubTab,
  setBedSubTab,
  fetchAdmissionHistory,
  isLoadingHistory,
  fetchBedsData,
  isLoadingBeds,
  pendingAdmissionRequests,
  setActiveAdmissionRequestId,
  setAdmitForm,
  bedsData,
  setSelectedBed,
  setIsAdmitModalOpen,
  showToast,
  bedsError,
  historySearchQuery,
  setHistorySearchQuery,
  admissionHistory,
  fetchHistoryDetails,
  handleCleanBed,
  setIsVitalsModalOpen,
  fetchClinicalRecords,
  setIsMacModalOpen,
  setIsTransferModalOpen,
  setIsCheckoutModalOpen,
  fetchCheckoutBill,
}) => {
  return (
    <div className="tab-fade-in beds-workspace" style={{ width: '100%' }}>
      <div
        className="beds-workspace-header"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}
      >
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a' }}>
            <Bed size={22} style={{ color: '#0d9488' }} /> Clinic Bed Occupancy Grid
          </h2>
          <p style={{ margin: 0, fontSize: '0.86rem', color: '#64748b' }}>
            Real-time monitoring of in-patient admissions, proration billing, vitals logs, and checkout history.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {bedSubTab === 'history' && (
            <button
              type="button"
              className="recep-btn-secondary"
              onClick={fetchAdmissionHistory}
              disabled={isLoadingHistory}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={14} className={isLoadingHistory ? 'spin-animation' : ''} /> Refresh History
            </button>
          )}
          {bedSubTab === 'grid' && (
            <button
              type="button"
              className="recep-btn-secondary"
              onClick={fetchBedsData}
              disabled={isLoadingBeds}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={14} className={isLoadingBeds ? 'spin-animation' : ''} /> Refresh Grid
            </button>
          )}
        </div>
      </div>

      {/* Sub-Tab Navigation Switcher */}
      <div style={{ display: 'flex', gap: '12px', borderBottom: '2px solid #e2e8f0', marginBottom: '24px', paddingBottom: '2px' }}>
        <button
          type="button"
          onClick={() => setBedSubTab('grid')}
          style={{
            padding: '10px 20px',
            fontWeight: 700,
            fontSize: '0.92rem',
            border: 'none',
            borderBottom: bedSubTab === 'grid' ? '3px solid #0d9488' : '3px solid transparent',
            background: 'none',
            color: bedSubTab === 'grid' ? '#0d9488' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease',
          }}
        >
          <Bed size={18} /> Live Occupancy Grid
        </button>
        <button
          type="button"
          onClick={() => {
            setBedSubTab('history');
            fetchAdmissionHistory();
          }}
          style={{
            padding: '10px 20px',
            fontWeight: 700,
            fontSize: '0.92rem',
            border: 'none',
            borderBottom: bedSubTab === 'history' ? '3px solid #0d9488' : '3px solid transparent',
            background: 'none',
            color: bedSubTab === 'history' ? '#0d9488' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease',
          }}
        >
          <FileText size={18} /> Bed Booking History Logs
        </button>
      </div>

      {/* SUB-TAB 1: LIVE OCCUPANCY GRID */}
      {bedSubTab === 'grid' && (
        <>
          {/* 🏥 DOCTOR ADMISSION REQUESTS QUEUE */}
          {pendingAdmissionRequests.length > 0 && (
            <div
              style={{
                background: 'linear-gradient(135deg, #E8F7FA 0%, #EAF6FA 100%)',
                borderRadius: '12px',
                border: '1.5px solid #D6E7ED',
                padding: '16px 20px',
                marginBottom: '20px',
                boxShadow: '0 4px 12px rgba(11, 142, 171, 0.08)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0B7894', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🏥 Doctor Recommended Admissions Queue ({pendingAdmissionRequests.length})
                </h3>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ffffff', background: '#0B8EAB', padding: '3px 10px', borderRadius: '12px' }}>
                  Action Needed
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
                {pendingAdmissionRequests.map((req: any) => (
                  <div
                    key={req.id}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #D6E7ED',
                      borderRadius: '10px',
                      padding: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '10px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <strong style={{ fontSize: '0.95rem', color: '#102A43' }}>{req.patient_name}</strong>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '10px',
                            background:
                              req.urgency === 'emergency' ? '#FEE2E2' : req.urgency === 'urgent' ? '#FEF3C7' : '#EAF6FA',
                            color:
                              req.urgency === 'emergency' ? '#EF4444' : req.urgency === 'urgent' ? '#F59E0B' : '#58758A',
                          }}
                        >
                          {req.urgency ? req.urgency.toUpperCase() : 'ROUTINE'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#58758A', marginTop: '2px' }}>
                        Code: <strong>{req.patient_code}</strong> | Dr. {req.doctor_name}
                      </div>
                      {req.category_name && (
                        <div style={{ fontSize: '0.78rem', color: '#0B7894', fontWeight: 600, marginTop: '4px' }}>
                          Advised Ward: <strong>{req.category_name}</strong>
                        </div>
                      )}
                      <div
                        style={{
                          fontSize: '0.78rem',
                          color: '#102A43',
                          marginTop: '6px',
                          fontStyle: 'italic',
                          background: '#F1F8FA',
                          padding: '6px 8px',
                          borderRadius: '6px',
                        }}
                      >
                        "{req.reason}"
                      </div>
                    </div>
                    <button
                      type="button"
                      className="recep-btn-primary"
                      onClick={() => {
                        setActiveAdmissionRequestId(req.id);
                        setAdmitForm({
                          patient_id: req.patient_id,
                          admitting_doctor_id: req.doctor_id,
                          diagnosis: req.reason,
                          initial_deposit: 2000,
                        });
                        let availableBed = null;
                        if (req.category_id) {
                          availableBed = bedsData.find(
                            (b: any) => b.category?.id === req.category_id && b.status === 'available'
                          );
                        }
                        if (!availableBed) {
                          availableBed = bedsData.find((b: any) => b.status === 'available');
                        }
                        if (availableBed) {
                          setSelectedBed(availableBed);
                          setIsAdmitModalOpen(true);
                        } else {
                          showToast('No available bed found in clinic. Please clear or clean a bed first.', 'error');
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '8px',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        background: '#0B7894',
                        borderColor: '#0B7894',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Bed size={15} /> Admit & Assign Bed
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {bedsError && (
            <div
              className="profile-alert error"
              style={{
                marginBottom: '16px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                padding: '12px',
                borderRadius: '8px',
              }}
            >
              {bedsError}
            </div>
          )}

          {isLoadingBeds ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
              <RefreshCw size={32} className="spin-animation" style={{ color: '#0d9488' }} />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', marginBottom: '30px' }}>
              {(() => {
                const groupedCategories: { [key: string]: any[] } = {};
                bedsData.forEach((bed: any) => {
                  const catName = bed.category?.name || 'General Ward';
                  if (!groupedCategories[catName]) {
                    groupedCategories[catName] = [];
                  }
                  groupedCategories[catName].push(bed);
                });

                const categoryMeta: any = {
                  'General Ward': { borderLeft: '5px solid #3b82f6', bg: '#eff6ff', color: '#1d4ed8', tagBg: '#dbeafe', tagColor: '#1e40af' },
                  'ICU': { borderLeft: '5px solid #ef4444', bg: '#fef2f2', color: '#b91c1c', tagBg: '#fee2e2', tagColor: '#991b1b' },
                  'Private Deluxe': { borderLeft: '5px solid #8b5cf6', bg: '#f5f3ff', color: '#6d28d9', tagBg: '#ede9fe', tagColor: '#5b21b6' },
                };

                if (Object.keys(groupedCategories).length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No clinic beds found.</div>
                  );
                }

                return Object.entries(groupedCategories).map(([catName, bedsList]) => {
                  const meta = categoryMeta[catName] || {
                    borderLeft: '5px solid #0d9488',
                    bg: '#f0fdf4',
                    color: '#0f766e',
                    tagBg: '#ccfbf1',
                    tagColor: '#115e59',
                  };
                  const availableCount = bedsList.filter((b: any) => b.status === 'available').length;
                  const occupiedCount = bedsList.filter((b: any) => b.status === 'occupied').length;
                  const cleaningCount = bedsList.filter((b: any) => b.status === 'cleaning').length;

                  return (
                    <div
                      key={catName}
                      style={{
                        background: '#ffffff',
                        borderRadius: '14px',
                        padding: '20px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                      }}
                    >
                      {/* Category Header Banner */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '12px 18px',
                          background: meta.bg,
                          borderRadius: '10px',
                          borderLeft: meta.borderLeft,
                          marginBottom: '20px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <h3
                            style={{
                              margin: 0,
                              fontSize: '1.15rem',
                              fontWeight: 800,
                              color: meta.color,
                              letterSpacing: '0.5px',
                            }}
                          >
                            {catName.toUpperCase()}
                          </h3>
                          <span
                            style={{
                              fontSize: '0.82rem',
                              fontWeight: 700,
                              background: meta.tagBg,
                              color: meta.tagColor,
                              padding: '3px 10px',
                              borderRadius: '20px',
                            }}
                          >
                            {bedsList.length} {bedsList.length === 1 ? 'Bed' : 'Beds'} Total
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', fontSize: '0.78rem', fontWeight: 700 }}>
                          <span
                            style={{
                              background: '#f0fdf4',
                              color: '#16a34a',
                              border: '1px solid #bbf7d0',
                              padding: '4px 12px',
                              borderRadius: '20px',
                            }}
                          >
                            {availableCount} Available
                          </span>
                          <span
                            style={{
                              background: '#fef2f2',
                              color: '#dc2626',
                              border: '1px solid #fecaca',
                              padding: '4px 12px',
                              borderRadius: '20px',
                            }}
                          >
                            {occupiedCount} Occupied
                          </span>
                          {cleaningCount > 0 && (
                            <span
                              style={{
                                background: '#fffbeb',
                                color: '#b45309',
                                border: '1px solid #fef3c7',
                                padding: '4px 12px',
                                borderRadius: '20px',
                              }}
                            >
                              {cleaningCount} Cleaning
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Beds Grid for this Category */}
                      <div
                        className="beds-grid-container"
                        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}
                      >
                        {bedsList.map((bed: any) => {
                          const statusColors: any = {
                            available: { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', badge: 'Available' },
                            occupied: { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c', badge: 'Occupied' },
                            cleaning: { bg: '#fffbeb', border: '#fef3c7', text: '#b45309', badge: 'Cleaning' },
                          };
                          const color = statusColors[bed.status] || statusColors.available;

                          return (
                            <div
                              key={bed.id}
                              className="bed-card-premium"
                              style={{
                                background: '#ffffff',
                                border: `1px solid ${color.border}`,
                                borderRadius: '12px',
                                padding: '20px',
                                boxShadow:
                                  '0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
                                position: 'relative',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                minHeight: '260px',
                              }}
                            >
                              <div>
                                <div
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: '12px',
                                  }}
                                >
                                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                                    {bed.category?.name}
                                  </span>
                                  <span
                                    style={{
                                      background: color.bg,
                                      color: color.text,
                                      border: `1px solid ${color.border}`,
                                      padding: '3px 10px',
                                      borderRadius: '9999px',
                                      fontSize: '0.74rem',
                                      fontWeight: 700,
                                    }}
                                  >
                                    {color.badge}
                                  </span>
                                </div>

                                <h3 style={{ margin: '0 0 8px 0', fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>
                                  {formatBedNumber(bed.bed_number)}
                                </h3>

                                <div style={{ fontSize: '0.84rem', color: '#64748b', marginBottom: '16px' }}>
                                  <div>Rate: ₹{bed.category?.base_charge_24h}/24h</div>
                                  <div>Overtime: ₹{bed.category?.hourly_overtime_rate}/hour</div>
                                </div>

                                {bed.active_admission && (
                                  <div
                                    style={{
                                      background: '#f8fafc',
                                      border: '1px solid #e2e8f0',
                                      borderRadius: '8px',
                                      padding: '12px',
                                      fontSize: '0.8rem',
                                      marginBottom: '16px',
                                    }}
                                  >
                                    <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>
                                      {bed.active_admission.patient_name}
                                    </div>
                                    <div style={{ color: '#64748b' }}>Code: {bed.active_admission.patient_code}</div>
                                    <div style={{ color: '#64748b' }}>Doctor: {bed.active_admission.admitting_doctor}</div>
                                    <div style={{ color: '#64748b', marginTop: '4px', fontStyle: 'italic' }}>
                                      Diagnosis: {bed.active_admission.diagnosis}
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: 'auto' }}>
                                {bed.status === 'available' && (
                                  <button
                                    type="button"
                                    className="recep-btn-primary"
                                    style={{ width: '100%', padding: '8px', fontSize: '0.84rem' }}
                                    onClick={() => {
                                      setSelectedBed(bed);
                                      setIsAdmitModalOpen(true);
                                    }}
                                  >
                                    Admit Patient
                                  </button>
                                )}

                                {bed.status === 'occupied' && (
                                  <>
                                    <button
                                      type="button"
                                      className="recep-btn-secondary"
                                      style={{ flex: '1 1 45%', padding: '6px 8px', fontSize: '0.78rem', fontWeight: 700 }}
                                      onClick={() => {
                                        setSelectedBed(bed);
                                        setIsVitalsModalOpen(true);
                                        if (bed.active_admission) {
                                          fetchClinicalRecords(bed.active_admission.admission_id);
                                        }
                                      }}
                                    >
                                      Vitals
                                    </button>
                                    <button
                                      type="button"
                                      className="recep-btn-secondary"
                                      style={{ flex: '1 1 45%', padding: '6px 8px', fontSize: '0.78rem', fontWeight: 700 }}
                                      onClick={() => {
                                        setSelectedBed(bed);
                                        setIsMacModalOpen(true);
                                        if (bed.active_admission) {
                                          fetchClinicalRecords(bed.active_admission.admission_id);
                                        }
                                      }}
                                    >
                                      MAC
                                    </button>
                                    <button
                                      type="button"
                                      className="recep-btn-secondary"
                                      style={{ flex: '1 1 45%', padding: '6px 8px', fontSize: '0.78rem', fontWeight: 700 }}
                                      onClick={() => {
                                        setSelectedBed(bed);
                                        setIsTransferModalOpen(true);
                                      }}
                                    >
                                      Transfer
                                    </button>
                                    <button
                                      type="button"
                                      className="recep-btn-primary"
                                      style={{
                                        flex: '1 1 45%',
                                        padding: '6px 8px',
                                        fontSize: '0.78rem',
                                        fontWeight: 700,
                                        background: '#dc2626',
                                        borderColor: '#dc2626',
                                      }}
                                      onClick={() => {
                                        setSelectedBed(bed);
                                        setIsCheckoutModalOpen(true);
                                        if (bed.active_admission) {
                                          fetchCheckoutBill(bed.active_admission.admission_id);
                                        }
                                      }}
                                    >
                                      Checkout
                                    </button>
                                  </>
                                )}

                                {bed.status === 'cleaning' && (
                                  <button
                                    type="button"
                                    className="recep-btn-primary"
                                    style={{
                                      width: '100%',
                                      padding: '8px',
                                      fontSize: '0.84rem',
                                      background: '#d97706',
                                      borderColor: '#d97706',
                                    }}
                                    onClick={() => handleCleanBed(bed.id)}
                                  >
                                    Ready / Mark Clean
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </>
      )}

      {/* SUB-TAB 2: DEDICATED BED BOOKING HISTORY LOGS */}
      {bedSubTab === 'history' && (
        <div
          style={{
            background: '#ffffff',
            borderRadius: '14px',
            padding: '24px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
          }}
        >
          {/* Search and Summary Counters */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
            <div style={{ position: 'relative', width: '320px' }}>
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8',
                }}
              />
              <input
                type="text"
                placeholder="Search patient, bed number, or doctor..."
                value={historySearchQuery}
                onChange={(e) => setHistorySearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 36px',
                  fontSize: '0.88rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Records</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>{admissionHistory.length}</div>
              </div>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '8px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' }}>Active Stays</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#15803d' }}>
                  {admissionHistory.filter((a) => a.admission_status === 'admitted').length}
                </div>
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Discharged</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#475569' }}>
                  {admissionHistory.filter((a) => a.admission_status === 'discharged').length}
                </div>
              </div>
            </div>
          </div>

          {isLoadingHistory ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
              <RefreshCw size={32} className="spin-animation" style={{ color: '#0d9488' }} />
            </div>
          ) : (
            (() => {
              const filteredHistory = admissionHistory.filter((item: any) => {
                const q = historySearchQuery.toLowerCase();
                return (
                  (item.patient_name && item.patient_name.toLowerCase().includes(q)) ||
                  (item.patient_code && item.patient_code.toLowerCase().includes(q)) ||
                  (item.bed_number && item.bed_number.toLowerCase().includes(q)) ||
                  (item.admitting_doctor && item.admitting_doctor.toLowerCase().includes(q)) ||
                  (item.category_name && item.category_name.toLowerCase().includes(q))
                );
              });

              if (filteredHistory.length === 0) {
                return (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                    <FileText size={40} style={{ margin: '0 auto 12px', color: '#cbd5e1' }} />
                    <h4 style={{ margin: '0 0 6px', color: '#334155' }}>No Admission History Found</h4>
                    <p style={{ margin: 0, fontSize: '0.88rem' }}>No historical bed booking records match your query.</p>
                  </div>
                );
              }

              return (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                        <th style={{ padding: '12px 14px' }}>Patient Details</th>
                        <th style={{ padding: '12px 14px' }}>Ward & Bed</th>
                        <th style={{ padding: '12px 14px' }}>Admitting Doctor</th>
                        <th style={{ padding: '12px 14px' }}>Admission Datetime</th>
                        <th style={{ padding: '12px 14px' }}>Discharge Datetime</th>
                        <th style={{ padding: '12px 14px' }}>Duration</th>
                        <th style={{ padding: '12px 14px' }}>Status</th>
                        <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHistory.map((item: any, idx: number) => {
                        const isDischarged = item.admission_status === 'discharged';
                        return (
                          <tr key={item.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '12px 14px' }}>
                              <div style={{ fontWeight: 700, color: '#0f172a' }}>{item.patient_name}</div>
                              <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Code: {item.patient_code}</div>
                              {item.diagnosis && (
                                <div style={{ fontSize: '0.76rem', color: '#64748b', fontStyle: 'italic', marginTop: '2px' }}>
                                  Diag: {item.diagnosis}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <div style={{ fontWeight: 700, color: '#0f172a' }}>{formatBedNumber(item.bed_number)}</div>
                              <span
                                style={{
                                  fontSize: '0.74rem',
                                  background: '#f1f5f9',
                                  color: '#475569',
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  fontWeight: 600,
                                }}
                              >
                                {item.category_name}
                              </span>
                            </td>
                            <td style={{ padding: '12px 14px', fontWeight: 600, color: '#334155' }}>
                              Dr. {item.admitting_doctor}
                            </td>
                            <td style={{ padding: '12px 14px', color: '#475569' }}>
                              {new Date(item.admission_datetime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                            </td>
                            <td style={{ padding: '12px 14px', color: '#475569' }}>
                              {item.discharge_datetime ? (
                                new Date(item.discharge_datetime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
                              ) : (
                                <span style={{ color: '#059669', fontWeight: 700 }}>Active Stay</span>
                              )}
                            </td>
                            <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0f172a' }}>
                              {item.stay_days > 0 ? `${item.stay_days} Days (${item.stay_hours}h)` : `${item.stay_hours} Hours`}
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <span
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: '20px',
                                  fontSize: '0.76rem',
                                  fontWeight: 700,
                                  background: isDischarged ? '#f1f5f9' : '#dcfce7',
                                  color: isDischarged ? '#475569' : '#15803d',
                                  border: isDischarged ? '1px solid #cbd5e1' : '1px solid #86efac',
                                }}
                              >
                                {isDischarged ? 'Discharged' : 'Admitted'}
                              </span>
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                              <button
                                type="button"
                                className="recep-btn-secondary"
                                style={{
                                  padding: '5px 12px',
                                  fontSize: '0.78rem',
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  borderRadius: '6px',
                                }}
                                onClick={() => fetchHistoryDetails(item.id)}
                              >
                                <Eye size={13} /> View Details
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()
          )}
        </div>
      )}
    </div>
  );
};
