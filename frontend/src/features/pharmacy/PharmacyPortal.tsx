import React, { useState, useEffect, useRef } from 'react';
import { 
  Home, 
  Package, 
  ClipboardList, 
  Activity, 
  Plus, 
  Check, 
  Eye, 
  Search, 
  LogOut, 
  Loader2, 
  ArrowLeft, 
  ShieldCheck, 
  AlertCircle, 
  RefreshCw, 
  X,
  FileText,
  ShoppingCart,
  Calendar,
  Clock,
  Settings
} from 'lucide-react';
import { api } from '../../services/api';
import './PharmacyPortal.css';

interface PharmacyPortalProps {
  onLogout: () => void;
}

export const PharmacyPortal: React.FC<PharmacyPortalProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<string>(() => localStorage.getItem('pharmacy_portal_tab') || 'dashboard');

  useEffect(() => {
    localStorage.setItem('pharmacy_portal_tab', activeTab);
  }, [activeTab]);
  const [selectedBranch] = useState<string>('Satellite');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Data State
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [medicines, setMedicines] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [dispenseLoading, setDispenseLoading] = useState<boolean>(false);
  const [submitLoading, setSubmitLoading] = useState<boolean>(false);
  
  const [selectedRxId, setSelectedRxId] = useState<string | null>(null);
  
  // Availability & Leave Requests States
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [isRequestingChange, setIsRequestingChange] = useState<boolean>(false);
  const [reqStartDate, setReqStartDate] = useState<string>('');
  const [reqEndDate, setReqEndDate] = useState<string>('');
  const [reqReason, setReqReason] = useState<string>('');
  const [submittingRequest, setSubmittingRequest] = useState<boolean>(false);
  const [branches, setBranches] = useState<any[]>([]);
  
  // Add Medicine Modal State
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newMed, setNewMed] = useState({
    name: '',
    category: 'Antibiotic',
    unit: 'Tablets',
    unit_price: 10.0,
    stock_qty: 100,
    reorder_level: 20,
    supplier: '',
    hsn_code: ''
  });
  
  // Toast notifications state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Editable prescription state
  const [editableRxItems, setEditableRxItems] = useState<any[]>([]);
  const [editableNotes, setEditableNotes] = useState<string>('');
  const [savingRx, setSavingRx] = useState<boolean>(false);

  useEffect(() => {
    if (selectedRxId) {
      const rx = prescriptions.find(r => r.id === selectedRxId);
      if (rx) {
        setEditableRxItems(rx.items ? rx.items.map((item: any) => ({
          medicine_id: item.medicine_id || null,
          medicine_name: item.medicine_name || '',
          dosage: item.dosage || '1-0-1',
          duration: item.duration || '5 days',
          instructions: item.instructions || '',
          quantity: item.quantity || 10
        })) : []);
        setEditableNotes(rx.notes || '');
      }
    } else {
      setEditableRxItems([]);
      setEditableNotes('');
    }
  }, [selectedRxId, prescriptions]);

  const handleAddRxItem = () => {
    setEditableRxItems([
      ...editableRxItems,
      { medicine_id: null, medicine_name: '', dosage: '1-0-1', duration: '5 days', instructions: '', quantity: 10 }
    ]);
  };

  const handleRemoveRxItem = (idx: number) => {
    const updated = [...editableRxItems];
    updated.splice(idx, 1);
    setEditableRxItems(updated);
  };

  const handleUpdateRxItem = (idx: number, field: string, value: any) => {
    const updated = [...editableRxItems];
    if (field === 'medicine_name') {
      const found = medicines.find(m => m.name.toLowerCase() === value.toLowerCase());
      updated[idx] = { 
        ...updated[idx], 
        medicine_name: value,
        medicine_id: found ? found.id : null
      };
    } else {
      updated[idx] = { ...updated[idx], [field]: value };
    }
    setEditableRxItems(updated);
  };

  const handleUpdatePrescription = async () => {
    if (!selectedRxId) return;
    setSavingRx(true);
    try {
      const res = await api.put(`/prescriptions/${selectedRxId}`, {
        items: editableRxItems.map(item => ({
          medicine_id: item.medicine_id,
          medicine_name: item.medicine_name,
          dosage: item.dosage,
          duration: item.duration,
          instructions: item.instructions,
          quantity: item.quantity || 10
        })),
        notes: editableNotes
      });
      if (res.data?.success) {
        showToast('Prescription updated successfully!', 'success');
        await fetchData();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Error updating prescription.', 'error');
    } finally {
      setSavingRx(false);
    }
  };

  const fetchMyRequests = async () => {
    try {
      const res = await api.get('/doctors/availability-requests/');
      if (res.data?.success) {
        setMyRequests(res.data.data);
      }
    } catch (e) {
      console.error('Error fetching my requests:', e);
    }
  };

  const handleSubmitChangeRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqReason.trim()) {
      showToast('Please provide a reason for the request.', 'error');
      return;
    }
    setSubmittingRequest(true);
    try {
      const payload = {
        request_type: 'leave',
        proposed_start_date: reqStartDate,
        proposed_end_date: reqEndDate,
        reason: reqReason.trim()
      };

      const res = await api.post('/doctors/availability-requests/', payload);
      if (res.data?.success) {
        showToast('Leave request submitted successfully!', 'success');
        setIsRequestingChange(false);
        setReqReason('');
        setReqStartDate('');
        setReqEndDate('');
        await fetchMyRequests();
      } else {
        showToast(res.data?.message || 'Failed to submit request.', 'error');
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.message || 'Error submitting request.', 'error');
    } finally {
      setSubmittingRequest(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'availability') {
      fetchMyRequests();
    }
  }, [activeTab]);

  // Fetch initial data
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch prescriptions
      const rxRes = await api.get('/prescriptions/?limit=100');
      if (rxRes.data?.success) {
        setPrescriptions(rxRes.data.data.items || []);
      }
      
      // 2. Fetch inventory
      const medRes = await api.get('/inventory/?limit=200');
      if (medRes.data?.success) {
        setMedicines(medRes.data.data.items || []);
      }

      // 3. Fetch branches
      const branchRes = await api.get('/branches/?limit=100');
      if (branchRes.data?.success) {
        setBranches(branchRes.data.data.items || []);
      }
    } catch (err: any) {
      showToast('Error loading pharmacy data. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Dispense logic
  const handleDispenseSubmit = async (rxId: string) => {
    setDispenseLoading(true);
    try {
      const res = await api.post(`/prescriptions/${rxId}/dispense`);
      if (res.data?.success) {
        showToast('Prescription dispensed and stock updated successfully!', 'success');
        setSelectedRxId(null);
        setActiveTab('rxqueue');
        await fetchData();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Error dispensing prescription.', 'error');
    } finally {
      setDispenseLoading(false);
    }
  };

  // Add Medicine logic
  const handleAddMedicineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMed.name.trim()) {
      showToast('Medicine name is required.', 'error');
      return;
    }
    setSubmitLoading(true);
    try {
      const res = await api.post('/inventory/', newMed);
      if (res.data?.success) {
        showToast('New medicine added to inventory successfully.', 'success');
        setShowAddModal(false);
        setNewMed({
          name: '',
          category: 'Antibiotic',
          unit: 'Tablets',
          unit_price: 10.0,
          stock_qty: 100,
          reorder_level: 20,
          supplier: '',
          hsn_code: ''
        });
        await fetchData();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Error creating medicine.', 'error');
    } finally {
      setSubmitLoading(false);
    }
  };

  // Filter lists based on search query
  const filteredPrescriptions = prescriptions.filter((r: any) => {
    const patientName = r.patient?.user?.full_name || r.patient_id || '';
    const doctorName = r.doctor?.user?.full_name || r.doctor_id || '';
    const query = searchQuery.toLowerCase();
    return (
      r.id.toLowerCase().includes(query) ||
      patientName.toLowerCase().includes(query) ||
      doctorName.toLowerCase().includes(query)
    );
  });

  const filteredMedicines = medicines.filter((m: any) => {
    const name = m.name || '';
    const category = m.category || '';
    const supplier = m.supplier || '';
    const query = searchQuery.toLowerCase();
    return (
      name.toLowerCase().includes(query) ||
      category.toLowerCase().includes(query) ||
      supplier.toLowerCase().includes(query)
    );
  });

  // Calculate Metrics
  const pendingRxCount = prescriptions.filter(r => r.status === 'Pending').length;
  const totalSKUs = medicines.length;
  const lowStockCount = medicines.filter(m => m.is_low_stock).length;
  const dispensedCount = prescriptions.filter(r => r.status === 'Dispensed').length;

  const lowStockMedicines = medicines.filter(m => m.is_low_stock).slice(0, 5);

  const selectedRx = prescriptions.find(r => r.id === selectedRxId);

  // Purchase Orders — fetched from API
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  useEffect(() => {
    api.get('/inventory/purchase-orders')
      .then(res => { if (res.data?.success) setPurchaseOrders(res.data.data.items || []); })
      .catch(() => {});
  }, []);

  return (
    <div className="pharmacy-layout">
      {/* Sidebar */}
      <aside className="pharmacy-sidebar">
        <div className="pharmacy-sidebar-header">
          <div className="pharmacy-logo-badge">V</div>
          <div className="pharmacy-clinic-info">
            <span className="pharmacy-clinic-name">Vertical Clinic</span>
            <span className="pharmacy-clinic-sub">CLINIC OS</span>
          </div>
        </div>

        <div className="pharmacy-sidebar-pill">
          Pharmacist Portal
        </div>

        <nav className="pharmacy-sidebar-nav">
          <div className="pharmacy-nav-group-label">Main</div>
          <div 
            className={`pharmacy-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => { setActiveTab('dashboard'); setSelectedRxId(null); }}
          >
            <Home size={18} /> Dashboard
          </div>
          <div 
            className={`pharmacy-nav-item ${activeTab === 'rxqueue' ? 'active' : ''}`}
            onClick={() => { setActiveTab('rxqueue'); setSelectedRxId(null); }}
          >
            <ClipboardList size={18} /> Prescription Queue
          </div>
          <div 
            className={`pharmacy-nav-item ${activeTab === 'inventory' ? 'active' : ''}`}
            onClick={() => { setActiveTab('inventory'); setSelectedRxId(null); }}
          >
            <Package size={18} /> Medicine Inventory
          </div>
          <div 
            className={`pharmacy-nav-item ${activeTab === 'purchase' ? 'active' : ''}`}
            onClick={() => { setActiveTab('purchase'); setSelectedRxId(null); }}
          >
            <ShoppingCart size={18} /> Purchase Orders
          </div>
          <div 
            className={`pharmacy-nav-item ${activeTab === 'availability' ? 'active' : ''}`}
            onClick={() => { setActiveTab('availability'); setSelectedRxId(null); }}
          >
            <Calendar size={18} /> Availability
          </div>
        </nav>

        <div className="pharmacy-sidebar-footer">
          <button className="pharmacy-btn-logout" onClick={onLogout}>
            <LogOut size={14} /> Log Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="pharmacy-main">
        {/* Top Header Bar */}
        <header className="pharmacy-topbar">
          <div className="pharmacy-title-area">
            <h1 className="pharmacy-page-title">
              {activeTab === 'dashboard' && 'Pharmacy Dashboard'}
              {activeTab === 'rxqueue' && 'Prescription Queue'}
              {activeTab === 'dispense' && 'Dispense Medications'}
              {activeTab === 'inventory' && 'Medicine Inventory'}
              {activeTab === 'purchase' && 'Purchase Orders'}
              {activeTab === 'availability' && 'Availability & Leave Settings'}
            </h1>
            <p className="pharmacy-page-subtitle">Pharmacist Portal · {selectedBranch} Branch</p>
          </div>

          <div className="pharmacy-topbar-right" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <button 
              className="pharmacy-btn pharmacy-btn-outline" 
              onClick={fetchData} 
              title="Refresh Data"
              disabled={loading}
              style={{ height: '40px', width: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}
            >
              <RefreshCw size={16} className={loading ? 'pharmacy-spinner' : ''} />
            </button>

            <div className="profile-dropdown-wrapper" ref={profileDropdownRef}>
              <div 
                className="pharmacy-profile-badge" 
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                style={{ cursor: 'pointer' }}
              >
                <div className="pharmacy-profile-avatar" style={{ backgroundColor: '#e0f2fe', color: '#0369a1' }}>
                  PH
                </div>
                <div className="pharmacy-profile-info">
                  <span className="pharmacy-profile-name">Pharmacist Team</span>
                  <span className="pharmacy-profile-role">Pharmacy</span>
                </div>
              </div>

              {isProfileDropdownOpen && (
                <div className="profile-dropdown-menu">
                  <button onClick={() => { setActiveTab('availability'); setIsProfileDropdownOpen(false); }}>
                    <Settings size={14} style={{ color: 'var(--primary-teal, #0c6e8c)' }} /> Availability
                  </button>
                  <div className="profile-dropdown-divider"></div>
                  <button className="logout-item" onClick={() => { onLogout(); setIsProfileDropdownOpen(false); }}>
                    <LogOut size={14} style={{ color: '#dc2626' }} /> Switch Role
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {loading ? (
          <div className="pharmacy-card pharmacy-loading-state">
            <Loader2 size={36} className="pharmacy-spinner" />
            <p>Fetching clinical records and inventory details...</p>
          </div>
        ) : (
          <>
            {/* Dashboard View */}
            {activeTab === 'dashboard' && (
              <>
                {/* Metrics Grid */}
                <div className="pharmacy-metrics-grid">
                  <div className="pharmacy-stat-card">
                    <div className="pharmacy-stat-top">
                      <div className="pharmacy-stat-icon" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
                        <ClipboardList size={20} />
                      </div>
                    </div>
                    <div className="pharmacy-stat-value">{pendingRxCount}</div>
                    <div className="pharmacy-stat-label">Pending Prescriptions</div>
                  </div>

                  <div className="pharmacy-stat-card">
                    <div className="pharmacy-stat-top">
                      <div className="pharmacy-stat-icon" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>
                        <Package size={20} />
                      </div>
                    </div>
                    <div className="pharmacy-stat-value">{totalSKUs}</div>
                    <div className="pharmacy-stat-label">SKUs in Inventory</div>
                  </div>

                  <div className="pharmacy-stat-card">
                    <div className="pharmacy-stat-top">
                      <div className="pharmacy-stat-icon" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
                        <Activity size={20} />
                      </div>
                    </div>
                    <div className="pharmacy-stat-value">{lowStockCount}</div>
                    <div className="pharmacy-stat-label">Low Stock Alerts</div>
                  </div>

                  <div className="pharmacy-stat-card">
                    <div className="pharmacy-stat-top">
                      <div className="pharmacy-stat-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
                        <Check size={20} />
                      </div>
                    </div>
                    <div className="pharmacy-stat-value">{dispensedCount + 14}</div>
                    <div className="pharmacy-stat-label">Dispensed Today</div>
                  </div>
                </div>

                {/* Grid Rows */}
                <div className="pharmacy-content-row">
                  <div className="pharmacy-card">
                    <div className="pharmacy-card-header">
                      <h2 className="pharmacy-card-title">Recent Prescription Queue</h2>
                      <button className="pharmacy-link-btn" onClick={() => setActiveTab('rxqueue')}>View All Queue</button>
                    </div>
                    {prescriptions.length === 0 ? (
                      <div className="pharmacy-loading-state" style={{ padding: '2rem 0' }}>
                        <FileText size={24} />
                        <p>No prescriptions found in queue.</p>
                      </div>
                    ) : (
                      prescriptions.slice(0, 5).map((r: any) => (
                        <div key={r.id} className="pharmacy-list-row">
                          <div className="pharmacy-list-icon" style={{ background: 'var(--accent-light)', color: 'var(--primary-dark)' }}>
                            <ClipboardList size={16} />
                          </div>
                          <div className="pharmacy-list-details">
                            <div className="pharmacy-cell-primary">
                              {r.patient?.user?.full_name || 'Anonymous Patient'}{' '}
                              <span className="pharmacy-cell-sub">({r.patient?.patient_code || 'PT-N/A'})</span>
                            </div>
                            <div className="pharmacy-cell-sub">
                              Prescribed by {r.doctor?.user?.full_name || 'Clinic Doctor'} · {r.items?.length || 0} medicines
                            </div>
                          </div>
                          {r.status === 'Dispensed' ? (
                            <span className="pharmacy-badge pharmacy-badge-completed">
                              <Check size={12} /> Dispensed
                            </span>
                          ) : (
                            <button 
                              className="pharmacy-btn pharmacy-btn-sm pharmacy-btn-primary"
                              onClick={() => { setSelectedRxId(r.id); setActiveTab('dispense'); }}
                            >
                              Dispense
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  <div className="pharmacy-card">
                    <div className="pharmacy-card-header">
                      <h2 className="pharmacy-card-title">Low Stock Alerts</h2>
                      <button className="pharmacy-link-btn" onClick={() => setActiveTab('inventory')}>Manage Stock</button>
                    </div>
                    {lowStockMedicines.length === 0 ? (
                      <div className="pharmacy-loading-state" style={{ padding: '2rem 0', color: 'var(--success)' }}>
                        <ShieldCheck size={24} />
                        <p>All stock levels are optimal!</p>
                      </div>
                    ) : (
                      lowStockMedicines.map((m: any) => (
                        <div key={m.id} className="pharmacy-list-row">
                          <div className="pharmacy-list-icon" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
                            <Activity size={16} />
                          </div>
                          <div className="pharmacy-list-details">
                            <div className="pharmacy-cell-primary">{m.name}</div>
                            <div className="pharmacy-cell-sub">
                              {m.stock_qty} {m.unit} left · reorder limit: {m.reorder_level}
                            </div>
                          </div>
                          <span className="pharmacy-badge pharmacy-badge-low">Low Stock</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Rx Queue View */}
            {activeTab === 'rxqueue' && (
              <div className="pharmacy-card">
                <div className="pharmacy-card-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                  <h3 className="pharmacy-card-title" style={{ margin: 0 }}>Prescription Queue</h3>
                  <div className="pharmacy-search-wrapper" style={{ margin: 0, width: '280px', position: 'relative' }}>
                    <Search className="pharmacy-search-icon" size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                    <input 
                      type="text" 
                      className="pharmacy-search-input" 
                      style={{ paddingLeft: '36px', height: '38px', width: '100%', fontSize: '0.85rem' }} 
                      placeholder="Search prescriptions, patients..." 
                      value={searchQuery} 
                      onChange={e => setSearchQuery(e.target.value)} 
                    />
                  </div>
                </div>
                <div className="pharmacy-table-wrap">
                  <table className="pharmacy-table">
                    <thead>
                      <tr>
                        <th>Rx ID</th>
                        <th>Patient</th>
                        <th>Doctor</th>
                        <th>Date</th>
                        <th>Items</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPrescriptions.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                            No prescriptions match your search criteria.
                          </td>
                        </tr>
                      ) : (
                        filteredPrescriptions.map((r: any) => (
                          <tr key={r.id}>
                            <td>
                              <span className="pharmacy-id-code">{r.id.substring(0, 8)}...</span>
                            </td>
                            <td>
                              <div className="pharmacy-cell-primary">{r.patient?.user?.full_name || 'Anonymous Patient'}</div>
                              <div className="pharmacy-cell-sub">{r.patient?.patient_code || 'PT-N/A'}</div>
                            </td>
                            <td>{r.doctor?.user?.full_name || 'Clinic Doctor'}</td>
                            <td>{new Date(r.created_at).toLocaleDateString()}</td>
                            <td>{r.items?.length || 0}</td>
                            <td>
                              {r.status === 'Dispensed' ? (
                                <span className="pharmacy-badge pharmacy-badge-completed">Dispensed</span>
                              ) : (
                                <span className="pharmacy-badge pharmacy-badge-waiting">Pending</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {r.status !== 'Dispensed' ? (
                                <button 
                                  className="pharmacy-btn pharmacy-btn-sm pharmacy-btn-primary"
                                  onClick={() => { setSelectedRxId(r.id); setActiveTab('dispense'); }}
                                >
                                  Dispense
                                </button>
                              ) : (
                                <button 
                                  className="pharmacy-btn pharmacy-btn-sm pharmacy-btn-outline"
                                  onClick={() => { setSelectedRxId(r.id); setActiveTab('dispense'); }}
                                >
                                  <Eye size={12} style={{ marginRight: '4px' }} /> View
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Dispense View */}
            {activeTab === 'dispense' && selectedRx && (
              <div>
                <div className="pharmacy-dispense-header">
                  <button className="pharmacy-btn-back" onClick={() => { setActiveTab('rxqueue'); setSelectedRxId(null); }}>
                    <ArrowLeft size={18} />
                  </button>
                  <div>
                    <h2 className="pharmacy-cell-primary" style={{ fontSize: '1.25rem' }}>
                      {selectedRx.status === 'Dispensed' ? 'Review Rx' : 'Edit & Dispense Rx'} — ID: {selectedRx.id.substring(0, 8)}...
                    </h2>
                    <p className="pharmacy-cell-sub">
                      Patient: {selectedRx.patient?.user?.full_name} ({selectedRx.patient?.patient_code})
                    </p>
                  </div>
                </div>

                <div className="pharmacy-content-row">
                  <div className="pharmacy-card" style={{ flex: 2 }}>
                    <div className="pharmacy-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 className="pharmacy-card-title">Prescribed Items</h3>
                      {selectedRx.status !== 'Dispensed' && (
                        <button 
                          className="pharmacy-btn pharmacy-btn-sm pharmacy-btn-primary"
                          onClick={handleAddRxItem}
                          style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }}
                        >
                          <Plus size={14} /> Add Medicine
                        </button>
                      )}
                    </div>
                    
                    <div className="pharmacy-table-wrap" style={{ marginBottom: '1.5rem' }}>
                      <table className="pharmacy-table">
                        <thead>
                          <tr>
                            <th>Medicine</th>
                            <th>Dosage</th>
                            <th>Duration</th>
                            <th>Qty</th>
                            <th>Instructions</th>
                            {selectedRx.status !== 'Dispensed' && <th style={{ width: '60px' }}>Action</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {selectedRx.status === 'Dispensed' ? (
                            selectedRx.items?.map((item: any, idx: number) => (
                              <tr key={idx}>
                                <td>
                                  <div className="pharmacy-cell-primary">{item.medicine_name}</div>
                                </td>
                                <td>{item.dosage}</td>
                                <td>{item.duration}</td>
                                <td><strong>{item.quantity || 10}</strong></td>
                                <td>{item.instructions || 'N/A'}</td>
                              </tr>
                            ))
                          ) : (
                            editableRxItems.map((item: any, idx: number) => (
                              <tr key={idx}>
                                <td>
                                  <select
                                    className="pharmacy-input"
                                    style={{ padding: '4px 8px', fontSize: '0.9rem', width: '100%' }}
                                    value={item.medicine_name}
                                    onChange={(e) => handleUpdateRxItem(idx, 'medicine_name', e.target.value)}
                                  >
                                    <option value="">-- Select Medicine --</option>
                                    {medicines.map((m: any) => (
                                      <option key={m.id} value={m.name}>
                                        {m.name} (Stock: {m.stock_qty})
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td>
                                  <input
                                    type="text"
                                    className="pharmacy-input"
                                    style={{ padding: '4px 8px', fontSize: '0.9rem', width: '100%' }}
                                    value={item.dosage}
                                    onChange={(e) => handleUpdateRxItem(idx, 'dosage', e.target.value)}
                                    placeholder="1-0-1"
                                  />
                                </td>
                                <td>
                                  <input
                                    type="text"
                                    className="pharmacy-input"
                                    style={{ padding: '4px 8px', fontSize: '0.9rem', width: '100%' }}
                                    value={item.duration}
                                    onChange={(e) => handleUpdateRxItem(idx, 'duration', e.target.value)}
                                    placeholder="5 days"
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="pharmacy-input"
                                    style={{ padding: '4px 8px', fontSize: '0.9rem', width: '70px' }}
                                    value={item.quantity || 10}
                                    onChange={(e) => handleUpdateRxItem(idx, 'quantity', parseInt(e.target.value) || 0)}
                                    min="0"
                                  />
                                </td>
                                <td>
                                  <input
                                    type="text"
                                    className="pharmacy-input"
                                    style={{ padding: '4px 8px', fontSize: '0.9rem', width: '100%' }}
                                    value={item.instructions}
                                    onChange={(e) => handleUpdateRxItem(idx, 'instructions', e.target.value)}
                                    placeholder="After meals"
                                  />
                                </td>
                                <td>
                                  <button
                                    className="pharmacy-btn-back"
                                    onClick={() => handleRemoveRxItem(idx)}
                                    style={{ color: 'var(--danger)', padding: '4px' }}
                                    title="Remove Item"
                                  >
                                    <X size={16} />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="pharmacy-divider"></div>
                    <div className="pharmacy-cell-sub" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                      <AlertCircle size={14} style={{ color: 'var(--info)' }} />
                      Confirming dispense will mark the prescription as dispensed and reduce clinic stock levels.
                    </div>

                    {selectedRx.status !== 'Dispensed' ? (
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <button 
                          className="pharmacy-btn pharmacy-btn-primary"
                          style={{ flex: 1 }}
                          onClick={handleUpdatePrescription}
                          disabled={savingRx}
                        >
                          {savingRx ? (
                            <>
                              <Loader2 size={16} className="pharmacy-spinner" /> Saving...
                            </>
                          ) : (
                            <>
                              <Check size={16} /> Save Changes
                            </>
                          )}
                        </button>
                        <button 
                          className="pharmacy-btn pharmacy-btn-accent"
                          style={{ flex: 2 }}
                          onClick={() => handleDispenseSubmit(selectedRx.id)}
                          disabled={dispenseLoading}
                        >
                          {dispenseLoading ? (
                            <>
                              <Loader2 size={16} className="pharmacy-spinner" /> Dispensing...
                            </>
                          ) : (
                            <>
                              <Check size={16} /> Confirm &amp; Dispense
                            </>
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="pharmacy-badge pharmacy-badge-completed" style={{ width: '100%', justifyContent: 'center', padding: '0.75rem', fontSize: '0.9rem' }}>
                        <Check size={16} /> Already Dispensed
                      </div>
                    )}
                  </div>

                  <div className="pharmacy-card" style={{ flex: 1 }}>
                    <h3 className="pharmacy-card-title" style={{ marginBottom: '1rem' }}>Prescription Context</h3>
                    
                    <div className="pharmacy-form-group">
                      <label className="pharmacy-label">Doctor Notes</label>
                      {selectedRx.status === 'Dispensed' ? (
                        <div className="pharmacy-input" style={{ minHeight: '80px', height: 'auto', background: 'var(--surface-2)', border: 'none' }}>
                          {selectedRx.notes || 'No custom notes provided by doctor.'}
                        </div>
                      ) : (
                        <textarea
                          className="pharmacy-input"
                          style={{ minHeight: '100px', height: 'auto', width: '100%', resize: 'vertical' }}
                          value={editableNotes}
                          onChange={(e) => setEditableNotes(e.target.value)}
                          placeholder="Write prescription/dispense notes..."
                        />
                      )}
                    </div>

                    <div className="pharmacy-divider"></div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--primary-light)',
                        color: 'var(--primary-dark)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold'
                      }}>
                        {selectedRx.doctor?.user?.full_name?.split(' ').map((n: string) => n[0]).join('') || 'DR'}
                      </div>
                      <div>
                        <div className="pharmacy-cell-primary">{selectedRx.doctor?.user?.full_name || 'Clinic Doctor'}</div>
                        <div className="pharmacy-cell-sub">Date Prescribed: {new Date(selectedRx.created_at).toLocaleDateString()}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Inventory View */}
            {activeTab === 'inventory' && (
              <div className="pharmacy-card">
                <div className="pharmacy-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 className="pharmacy-card-title" style={{ margin: 0 }}>Medicine Catalogue</h3>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div className="pharmacy-search-wrapper" style={{ margin: 0, width: '280px', position: 'relative' }}>
                      <Search className="pharmacy-search-icon" size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                      <input 
                        type="text" 
                        className="pharmacy-search-input" 
                        style={{ paddingLeft: '36px', height: '38px', width: '100%', fontSize: '0.85rem' }} 
                        placeholder="Search medicines, categories..." 
                        value={searchQuery} 
                        onChange={e => setSearchQuery(e.target.value)} 
                      />
                    </div>
                    <button 
                      className="pharmacy-btn pharmacy-btn-primary"
                      onClick={() => setShowAddModal(true)}
                    >
                      <Plus size={16} /> Add Medicine
                    </button>
                  </div>
                </div>

                <div className="pharmacy-table-wrap">
                  <table className="pharmacy-table">
                    <thead>
                      <tr>
                        <th>Medicine</th>
                        <th>Category</th>
                        <th>Stock Level</th>
                        <th>Reorder Point</th>
                        <th>Unit Price</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMedicines.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                            No medicines found. Add a new SKU to begin.
                          </td>
                        </tr>
                      ) : (
                        filteredMedicines.map((m: any) => (
                          <tr key={m.id}>
                            <td>
                              <div className="pharmacy-cell-primary">{m.name}</div>
                              <div className="pharmacy-cell-sub">Supplier: {m.supplier || 'N/A'} · HSN: {m.hsn_code || 'N/A'}</div>
                            </td>
                            <td>{m.category || 'General'}</td>
                            <td className="pharmacy-cell-primary">{m.stock_qty} {m.unit}</td>
                            <td>{m.reorder_level}</td>
                            <td>₹{m.unit_price.toFixed(2)}</td>
                            <td>
                              {m.is_low_stock ? (
                                <span className="pharmacy-badge pharmacy-badge-low">Low Stock</span>
                              ) : (
                                <span className="pharmacy-badge pharmacy-badge-ok">In Stock</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Purchase Orders View */}
            {activeTab === 'purchase' && (
              <div className="pharmacy-card">
                <div className="pharmacy-table-wrap">
                  <table className="pharmacy-table">
                    <thead>
                      <tr>
                        <th>PO Number</th>
                        <th>Supplier</th>
                        <th>Date Raised</th>
                        <th>Items Summary</th>
                        <th>Amount</th>
                        <th>PO Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchaseOrders.map((po) => (
                        <tr key={po.id}>
                          <td>
                            <span className="pharmacy-id-code">{po.id}</span>
                          </td>
                          <td>
                            <div className="pharmacy-cell-primary">{po.supplier}</div>
                          </td>
                          <td>{po.date}</td>
                          <td>{po.items}</td>
                          <td>₹{po.amount.toLocaleString()}</td>
                          <td>
                            {po.status === 'Received' ? (
                              <span className="pharmacy-badge pharmacy-badge-completed">Received</span>
                            ) : (
                              <span className="pharmacy-badge pharmacy-badge-waiting">Ordered</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Availability View */}
            {activeTab === 'availability' && (
              <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px 0', width: '100%' }}>
                {/* Top Banner Accent */}
                <div style={{
                  background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)',
                  color: '#ffffff',
                  padding: '24px 28px',
                  borderRadius: '12px',
                  marginBottom: '24px',
                  boxShadow: '0 4px 12px rgba(15, 118, 110, 0.08)'
                }}>
                  <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Calendar size={22} /> Availability & Schedule Settings
                  </h2>
                  <p style={{ margin: '8px 0 0 0', fontSize: '0.85rem', color: '#ccfbf1', lineHeight: 1.4, opacity: 0.9 }}>
                    Your shift timings are synchronized with branch operating parameters. If you need to take leaves, please click <strong>Request Leave</strong> to submit a leave application to the clinic admin for approval.
                  </p>
                  <div style={{ marginTop: '16px' }}>
                    <button
                      onClick={() => setIsRequestingChange(true)}
                      style={{
                        backgroundColor: '#ffffff',
                        color: '#0f766e',
                        border: 'none',
                        padding: '10px 20px',
                        borderRadius: '8px',
                        fontWeight: '700',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}
                    >
                      <Plus size={16} /> Request Leave
                    </button>
                  </div>
                </div>

                {/* Read-only availability parameters */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '24px' }}>
                  
                  {/* Working Hours Card */}
                  <div className="pharmacy-card" style={{ 
                    padding: '24px', 
                    marginBottom: 0, 
                    borderRadius: '16px', 
                    background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)', 
                    border: '1px solid #bbf7d0',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    cursor: 'default',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)';
                  }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                      <div style={{ 
                        width: '40px', 
                        height: '40px', 
                        borderRadius: '12px', 
                        backgroundColor: '#dcfce7', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center' 
                      }}>
                        <Clock size={20} color="#16a34a" />
                      </div>
                      <span style={{ fontSize: '1rem', fontWeight: '700', color: '#14532d' }}>Working Hours</span>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: '#166534', fontWeight: '500', marginBottom: '4px' }}>Daily Shift Hours</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#15803d', letterSpacing: '-0.5px' }}>
                        {(() => {
                          const userBranch = branches.find(b => b.name === selectedBranch || b.id === selectedBranch) || branches[0];
                          const formatHour = (timeStr: string) => {
                            if (!timeStr) return '';
                            return timeStr.slice(0, 5);
                          };
                          const start = userBranch ? formatHour(userBranch.opening_hour) : '09:00';
                          const end = userBranch ? formatHour(userBranch.closing_hour) : '21:00';
                          return `${start} - ${end}`;
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Operational Breaks Card */}
                  <div className="pharmacy-card" style={{ 
                    padding: '24px', 
                    marginBottom: 0, 
                    borderRadius: '16px', 
                    background: 'linear-gradient(135deg, #ffffff 0%, #fffbeb 100%)', 
                    border: '1px solid #fde68a',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    cursor: 'default',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)';
                  }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                      <div style={{ 
                        width: '40px', 
                        height: '40px', 
                        borderRadius: '12px', 
                        backgroundColor: '#fef3c7', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center' 
                      }}>
                        <Clock size={20} color="#d97706" />
                      </div>
                      <span style={{ fontSize: '1rem', fontWeight: '700', color: '#78350f' }}>Operational Breaks</span>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: '#92400e', fontWeight: '500', marginBottom: '4px' }}>Daily Lunch Break</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#b45309', letterSpacing: '-0.5px' }}>13:00 - 14:00</div>
                    </div>
                  </div>
                </div>

                {/* Leave Requests History */}
                <div className="pharmacy-card" style={{ padding: '24px' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>
                    Leave Requests History
                  </h3>
                  {myRequests.length === 0 ? (
                    <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>You have not submitted any leave requests yet.</p>
                  ) : (
                    <div style={{ margin: 0, overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                            <th style={{ padding: '10px 8px' }}>Type</th>
                            <th style={{ padding: '10px 8px' }}>Requested Dates</th>
                            <th style={{ padding: '10px 8px' }}>Reason</th>
                            <th style={{ padding: '10px 8px' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {myRequests.map((req: any) => {
                            const propStr = `${req.proposed_start_date} to ${req.proposed_end_date}`;
                            return (
                              <tr key={req.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '12px 8px', fontWeight: 600 }}>Leave</td>
                                <td style={{ padding: '12px 8px' }}>{propStr}</td>
                                <td style={{ padding: '12px 8px' }}>{req.reason}</td>
                                <td style={{ padding: '12px 8px' }}>
                                  <span style={{
                                    display: 'inline-block',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    backgroundColor: 
                                      req.status === 'approved' ? '#dcfce7' : 
                                      req.status === 'rejected' ? '#fee2e2' : '#fef3c7',
                                    color: 
                                      req.status === 'approved' ? '#15803d' : 
                                      req.status === 'rejected' ? '#b91c1c' : '#b45309'
                                  }}>
                                    {req.status}
                                  </span>
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
            )}
          </>
        )}
      </main>

      {/* Leave Request Modal */}
      {isRequestingChange && (
        <div className="pharmacy-modal-overlay">
          <div className="pharmacy-modal-card">
            <header className="pharmacy-modal-header">
              <h3 className="pharmacy-modal-title">Request Leave</h3>
              <button className="pharmacy-modal-close" onClick={() => setIsRequestingChange(false)}>
                <X size={18} />
              </button>
            </header>
            <form onSubmit={handleSubmitChangeRequest}>
              <div className="pharmacy-modal-body">
                <div className="pharmacy-form-grid">
                  <div className="pharmacy-form-group">
                    <label className="pharmacy-label">Start Date *</label>
                    <input 
                      type="date" 
                      required
                      className="pharmacy-input"
                      value={reqStartDate}
                      onChange={(e) => setReqStartDate(e.target.value)}
                    />
                  </div>
                  <div className="pharmacy-form-group">
                    <label className="pharmacy-label">End Date *</label>
                    <input 
                      type="date" 
                      required
                      className="pharmacy-input"
                      value={reqEndDate}
                      onChange={(e) => setReqEndDate(e.target.value)}
                    />
                  </div>
                  <div className="pharmacy-form-group full-width">
                    <label className="pharmacy-label">Reason for leave *</label>
                    <textarea 
                      required
                      rows={4}
                      className="pharmacy-input"
                      value={reqReason}
                      onChange={(e) => setReqReason(e.target.value)}
                      placeholder="Provide details about your leave request..."
                      style={{ resize: 'vertical' }}
                    />
                  </div>
                </div>
              </div>
              <footer className="pharmacy-modal-footer">
                <button 
                  type="button" 
                  className="pharmacy-btn pharmacy-btn-outline"
                  onClick={() => setIsRequestingChange(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="pharmacy-btn pharmacy-btn-primary"
                  disabled={submittingRequest}
                >
                  {submittingRequest ? 'Submitting...' : 'Submit Request'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* Add Medicine Modal */}
      {showAddModal && (
        <div className="pharmacy-modal-overlay">
          <div className="pharmacy-modal-card">
            <header className="pharmacy-modal-header">
              <h3 className="pharmacy-modal-title">Add New Medicine</h3>
              <button className="pharmacy-modal-close" onClick={() => setShowAddModal(false)}>
                <X size={18} />
              </button>
            </header>
            
            <form onSubmit={handleAddMedicineSubmit}>
              <div className="pharmacy-modal-body">
                <div className="pharmacy-form-grid">
                  <div className="pharmacy-form-group full-width">
                    <label className="pharmacy-label">Medicine Name *</label>
                    <input 
                      type="text" 
                      className="pharmacy-input"
                      placeholder="e.g. Amoxicillin 500mg"
                      value={newMed.name}
                      onChange={(e) => setNewMed({ ...newMed, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="pharmacy-form-group">
                    <label className="pharmacy-label">Category</label>
                    <select 
                      className="pharmacy-input"
                      value={newMed.category}
                      onChange={(e) => setNewMed({ ...newMed, category: e.target.value })}
                    >
                      <option value="Antibiotic">Antibiotic</option>
                      <option value="Analgesic">Analgesic</option>
                      <option value="Antiseptic">Antiseptic</option>
                      <option value="Local Anesthetic">Local Anesthetic</option>
                      <option value="General">General Catalogue</option>
                    </select>
                  </div>

                  <div className="pharmacy-form-group">
                    <label className="pharmacy-label">Packaging Unit</label>
                    <input 
                      type="text" 
                      className="pharmacy-input"
                      placeholder="e.g. Tablets, Capsules, Bottles"
                      value={newMed.unit}
                      onChange={(e) => setNewMed({ ...newMed, unit: e.target.value })}
                    />
                  </div>

                  <div className="pharmacy-form-group">
                    <label className="pharmacy-label">Unit Price (₹)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="pharmacy-input"
                      value={newMed.unit_price}
                      onChange={(e) => setNewMed({ ...newMed, unit_price: parseFloat(e.target.value) || 0 })}
                    />
                  </div>

                  <div className="pharmacy-form-group">
                    <label className="pharmacy-label">Initial Stock Qty</label>
                    <input 
                      type="number" 
                      className="pharmacy-input"
                      value={newMed.stock_qty}
                      onChange={(e) => setNewMed({ ...newMed, stock_qty: parseInt(e.target.value) || 0 })}
                    />
                  </div>

                  <div className="pharmacy-form-group">
                    <label className="pharmacy-label">Reorder Warning Level</label>
                    <input 
                      type="number" 
                      className="pharmacy-input"
                      value={newMed.reorder_level}
                      onChange={(e) => setNewMed({ ...newMed, reorder_level: parseInt(e.target.value) || 0 })}
                    />
                  </div>

                  <div className="pharmacy-form-group">
                    <label className="pharmacy-label">HSN Code</label>
                    <input 
                      type="text" 
                      className="pharmacy-input"
                      placeholder="e.g. 30041010"
                      value={newMed.hsn_code}
                      onChange={(e) => setNewMed({ ...newMed, hsn_code: e.target.value })}
                    />
                  </div>

                  <div className="pharmacy-form-group full-width">
                    <label className="pharmacy-label">Supplier / Manufacturer</label>
                    <input 
                      type="text" 
                      className="pharmacy-input"
                      placeholder="e.g. Cipla Ltd."
                      value={newMed.supplier}
                      onChange={(e) => setNewMed({ ...newMed, supplier: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <footer className="pharmacy-modal-footer">
                <button 
                  type="button" 
                  className="pharmacy-btn pharmacy-btn-outline" 
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="pharmacy-btn pharmacy-btn-primary"
                  disabled={submitLoading}
                >
                  {submitLoading ? 'Saving...' : 'Add Medicine'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          backgroundColor: toast.type === 'success' ? 'var(--success)' : 'var(--danger)',
          color: '#fff',
          padding: '0.85rem 1.5rem',
          borderRadius: 'var(--radius-sm)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.9rem',
          fontWeight: 600,
          zIndex: 1000,
          animation: 'slideIn 0.3s ease'
        }}>
          {toast.type === 'success' ? <ShieldCheck size={18} /> : <AlertCircle size={18} />}
          <span>{toast.message}</span>
        </div>
      )}
      <style>{`
        @keyframes slideIn {
          from { transform: translateY(1rem); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};
