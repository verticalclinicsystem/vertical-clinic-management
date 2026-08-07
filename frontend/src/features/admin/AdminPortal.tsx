import React, { useState, useEffect, useRef } from 'react';
import {
  Home, BarChart2, Package, Users, Layers,
  Settings, ArrowLeft, LogOut, Search, Bell, Plus,
  RefreshCw, Edit, X, Calendar, Check, AlertCircle,
  Eye, EyeOff, Building, Shield, Clock
} from 'lucide-react';
import { api } from '../../services/api';
import './AdminPortal.css';

interface AdminPortalProps { onLogout: () => void; }

const CIRC = 314.16; // 2 * PI * 50

function DonutChart({ segments, total, label }: { segments: { value: number; color: string; name: string }[]; total: number; label: string }) {
  let offset = 0;
  return (
    <div className="admin-donut-wrapper">
      <div className="admin-donut-graphic">
        <svg className="admin-donut-svg" width="140" height="140">
          <circle className="admin-donut-circle-bg" cx="70" cy="70" r="50" />
          {segments.map((seg, i) => {
            const dash = total > 0 ? (seg.value / total) * CIRC : 0;
            const el = (
              <circle key={i} className="admin-donut-segment" cx="70" cy="70" r="50"
                stroke={seg.color} strokeDasharray={`${dash} ${CIRC}`} strokeDashoffset={-offset} />
            );
            offset += dash;
            return el;
          })}
        </svg>
        <div className="admin-donut-center">
          <span className="admin-donut-center-num">{total}</span>
          <span className="admin-donut-center-label">{label}</span>
        </div>
      </div>
      <div className="admin-donut-legend">
        {segments.map((seg, i) => (
          <div className="admin-legend-item" key={i}>
            <span className="admin-legend-label-box">
              <span className="admin-legend-color" style={{ backgroundColor: seg.color }} />
              <span className="admin-legend-label">{seg.name}</span>
            </span>
            <span className="admin-legend-value">{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const AdminPortal: React.FC<AdminPortalProps> = ({ onLogout }) => {
  const [activeTab, setActiveTabInternal] = useState<string>(() => localStorage.getItem('admin_portal_tab') || 'dashboard');
  const [tabHistory, setTabHistory] = useState<string[]>([]);

  const changeTab = (newTab: string, pushToHistory = true) => {
    if (newTab === activeTab) return;
    if (pushToHistory) {
      setTabHistory(prev => {
        const next = [...prev, activeTab];
        if (next.length > 10) return next.slice(1);
        return next;
      });
    }
    setActiveTabInternal(newTab);
    localStorage.setItem('admin_portal_tab', newTab);
  };

  const goBackTab = () => {
    if (tabHistory.length === 0) return;
    const prevTab = tabHistory[tabHistory.length - 1];
    setTabHistory(prev => prev.slice(0, -1));
    setActiveTabInternal(prevTab);
    localStorage.setItem('admin_portal_tab', prevTab);
  };

  const handleRootTabChange = (newTab: string) => {
    setTabHistory([]);
    changeTab(newTab, false);
  };
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

  useEffect(() => {
    localStorage.setItem('admin_portal_tab', activeTab);
  }, [activeTab]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDashboardBranch, setSelectedDashboardBranch] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // ── Notifications System State & Listeners ──
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isNotiOpen, setIsNotiOpen] = useState(false);
  const notiDropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      if (res.data?.success) {
        setNotifications(res.data.data);
      }
    } catch (err) {
      console.error("Failed to load admin notifications", err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, []);

  const markNotificationRead = async (id: string, actionTarget?: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      if (actionTarget) handleRootTabChange(actionTarget);
    } catch (err) {
      console.error(err);
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error(err);
    }
  };

  const clearAllNotifications = async () => {
    try {
      await api.delete('/notifications/clear-all');
      setNotifications([]);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const handleClickOutsideNoti = (event: MouseEvent) => {
      if (notiDropdownRef.current && !notiDropdownRef.current.contains(event.target as Node)) {
        setIsNotiOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutsideNoti);
    return () => document.removeEventListener('mousedown', handleClickOutsideNoti);
  }, []);

  // ── Reports Analytics System State & Handlers ──
  const [reportType, setReportType] = useState<'financial' | 'doctor_revenue' | 'staff_performance' | 'pharmacy_branch' | 'clinical' | 'inventory'>('financial');
  const [activePreset, setActivePreset] = useState<'today' | '7days' | 'month' | 'all'>('month');
  const [reportStartDate, setReportStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [reportEndDate, setReportEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [reportBranchId, setReportBranchId] = useState<string>('');
  const [reportData, setReportData] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const fetchReports = async (startOverride?: string, endOverride?: string, typeOverride?: string, branchOverride?: string) => {
    setReportLoading(true);
    try {
      const sDate = startOverride !== undefined ? startOverride : reportStartDate;
      const eDate = endOverride !== undefined ? endOverride : reportEndDate;
      const rType = typeOverride !== undefined ? typeOverride : reportType;
      const rBranch = branchOverride !== undefined ? branchOverride : reportBranchId;

      let url = `/admin/reports?report_type=${rType}`;
      if (sDate) url += `&start_date=${sDate}`;
      if (eDate) url += `&end_date=${eDate}`;
      if (rBranch) url += `&branch_id=${rBranch}`;
      const res = await api.get(url);
      if (res.data?.success) {
        setReportData(res.data.data);
      }
    } catch (err) {
      console.error("Failed to fetch reports:", err);
    }
    setReportLoading(false);
  };

  const setDatePreset = (preset: 'today' | '7days' | 'month' | 'all') => {
    setActivePreset(preset);
    const today = new Date().toISOString().split('T')[0];
    let start = today;
    let end = today;

    if (preset === 'today') {
      start = today;
      end = today;
    } else if (preset === '7days') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      start = d.toISOString().split('T')[0];
      end = today;
    } else if (preset === 'month') {
      const d = new Date();
      d.setDate(1);
      start = d.toISOString().split('T')[0];
      end = today;
    } else if (preset === 'all') {
      start = '';
      end = '';
    }

    setReportStartDate(start);
    setReportEndDate(end);
    fetchReports(start, end, reportType, reportBranchId);
  };

  useEffect(() => {
    if (activeTab === 'reports') {
      fetchReports();
    }
  }, [activeTab, reportType, reportStartDate, reportEndDate, reportBranchId]);

  const exportToCSV = () => {
    if (!reportData || !reportData.rows || reportData.rows.length === 0) {
      alert("No report data available to export as CSV.");
      return;
    }

    const titleText = reportType === 'financial' ? 'Financial & Revenue Report' : reportType === 'clinical' ? 'Patient Visits & Clinical Report' : 'Pharmacy Inventory Report';
    const dateRangeText = `${reportStartDate || 'All Time'} to ${reportEndDate || 'All Time'}`;

    const metadataHeader = [
      `"VERTICAL CLINIC MANAGEMENT SYSTEM — ADMINISTRATIVE ANALYTICS REPORT"`,
      `"Report Category: ${titleText}"`,
      `"Date Filter Period: ${dateRangeText}"`,
      `"Generated On: ${new Date().toLocaleString()}"`,
      `""`
    ].join('\n');

    const headers = Object.keys(reportData.rows[0]).map(h => `"${h.toUpperCase()}"`).join(',');
    const rows = reportData.rows.map((row: any) => Object.values(row).map(val => `"${val}"`).join(','));
    
    const csvContent = "data:text/csv;charset=utf-8," + metadataHeader + '\n' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `vertical_clinic_${reportType}_report_${reportStartDate || 'all'}_to_${reportEndDate || 'all'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    if (!reportData || !reportData.rows || reportData.rows.length === 0) {
      alert("No report data available to export as PDF.");
      return;
    }

    const printWin = window.open('', '_blank');
    if (!printWin) {
      alert("Please allow popups to export PDF.");
      return;
    }

    const titleText = 
      reportType === 'financial' ? 'Financial & Revenue Analytics Report' : 
      reportType === 'doctor_revenue' ? 'Doctor-wise Revenue & Performance Report' :
      reportType === 'staff_performance' ? 'Staff Performance Analytics Report' :
      reportType === 'pharmacy_branch' ? 'Pharmacy Sales by Clinic Branch Report' :
      reportType === 'clinical' ? 'Patient Visits & Clinical Report' : 
      'Pharmacy & Inventory Stock Report';

    const dateRangeText = `${reportStartDate || 'All Time'} to ${reportEndDate || 'All Time'}`;

    let summaryCardsHtml = '';
    if (reportType === 'financial') {
      summaryCardsHtml = `
        <div class="summary-card">
          <div class="card-label">Total Period Revenue</div>
          <div class="card-val green">₹${(reportData.summary?.total_revenue || 0).toLocaleString()}</div>
        </div>
        <div class="summary-card">
          <div class="card-label">Total Invoices</div>
          <div class="card-val blue">${reportData.summary?.total_invoices || 0}</div>
        </div>
        <div class="summary-card">
          <div class="card-label">Average Invoice Value</div>
          <div class="card-val purple">₹${(reportData.summary?.avg_invoice_value || 0).toLocaleString()}</div>
        </div>
      `;
    } else if (reportType === 'doctor_revenue') {
      summaryCardsHtml = `
        <div class="summary-card">
          <div class="card-label">Total Doctors</div>
          <div class="card-val blue">${reportData.summary?.total_doctors || 0}</div>
        </div>
        <div class="summary-card">
          <div class="card-label">Doctor Generated Revenue</div>
          <div class="card-val green">₹${(reportData.summary?.total_revenue || 0).toLocaleString()}</div>
        </div>
        <div class="summary-card">
          <div class="card-label">Average Revenue / Doctor</div>
          <div class="card-val purple">₹${(reportData.summary?.avg_revenue_per_doctor || 0).toLocaleString()}</div>
        </div>
      `;
    } else if (reportType === 'staff_performance') {
      summaryCardsHtml = `
        <div class="summary-card">
          <div class="card-label">Total Staff Members</div>
          <div class="card-val blue">${reportData.summary?.total_staff || 0}</div>
        </div>
        <div class="summary-card">
          <div class="card-label">Active Personnel</div>
          <div class="card-val green">${reportData.summary?.active_staff || 0}</div>
        </div>
      `;
    } else if (reportType === 'pharmacy_branch') {
      summaryCardsHtml = `
        <div class="summary-card">
          <div class="card-label">Total Operating Branches</div>
          <div class="card-val blue">${reportData.summary?.total_branches || 0}</div>
        </div>
        <div class="summary-card">
          <div class="card-label">Branch Pharmacy Valuation</div>
          <div class="card-val green">₹${(reportData.summary?.total_valuation || 0).toLocaleString()}</div>
        </div>
      `;
    } else if (reportType === 'clinical') {
      summaryCardsHtml = `
        <div class="summary-card">
          <div class="card-label">Total Appointments</div>
          <div class="card-val blue">${reportData.summary?.total_appointments || 0}</div>
        </div>
        <div class="summary-card">
          <div class="card-label">Completed Consultations</div>
          <div class="card-val green">${reportData.summary?.completed || 0}</div>
        </div>
        <div class="summary-card">
          <div class="card-label">Completion Rate</div>
          <div class="card-val cyan">${reportData.summary?.completion_rate || 0}%</div>
        </div>
      `;
    } else {
      summaryCardsHtml = `
        <div class="summary-card">
          <div class="card-label">Total Stock Valuation</div>
          <div class="card-val green">₹${(reportData.summary?.total_valuation || 0).toLocaleString()}</div>
        </div>
        <div class="summary-card">
          <div class="card-label">Total Medicine SKUs</div>
          <div class="card-val blue">${reportData.summary?.total_skus || 0}</div>
        </div>
        <div class="summary-card">
          <div class="card-label">Low Stock Warnings</div>
          <div class="card-val red">${reportData.summary?.low_stock_skus || 0}</div>
        </div>
      `;
    }

    let tableHeadersHtml = '';
    let tableRowsHtml = '';

    if (reportType === 'financial') {
      tableHeadersHtml = '<th>Invoice #</th><th>Date</th><th>Patient Name</th><th>Payment Method</th><th>Status</th><th style="text-align:right">Amount</th>';
      tableRowsHtml = reportData.rows.map((r: any) => `
        <tr>
          <td><strong>${r.invoice_number}</strong></td>
          <td>${r.date}</td>
          <td>${r.patient_name}</td>
          <td>${r.payment_mode}</td>
          <td><span class="badge active">${r.status}</span></td>
          <td style="text-align:right; font-weight:700; color:#059669">₹${r.amount?.toLocaleString()}</td>
        </tr>
      `).join('');
    } else if (reportType === 'doctor_revenue') {
      tableHeadersHtml = '<th>Doctor Name</th><th>Specialization</th><th>Completed Consultations</th><th>Consultation Fee</th><th style="text-align:right">Total Revenue</th>';
      tableRowsHtml = (reportData.rows || []).map((r: any) => `
        <tr>
          <td><strong>${r.doctor_name}</strong></td>
          <td>${r.specialization}</td>
          <td>${r.completed_consultations}</td>
          <td>₹${r.consultation_fee?.toLocaleString()}</td>
          <td style="text-align:right; font-weight:700; color:#059669">₹${r.total_revenue?.toLocaleString()}</td>
        </tr>
      `).join('');
    } else if (reportType === 'staff_performance') {
      tableHeadersHtml = '<th>Staff Member</th><th>Role</th><th>Assigned Branch</th><th>Last Login</th><th>Status</th>';
      tableRowsHtml = (reportData.rows || []).map((r: any) => `
        <tr>
          <td><strong>${r.staff_name}</strong></td>
          <td style="text-transform:capitalize">${r.role}</td>
          <td>${r.branch_name}</td>
          <td>${r.last_login}</td>
          <td><span class="badge active">${r.status}</span></td>
        </tr>
      `).join('');
    } else if (reportType === 'pharmacy_branch') {
      tableHeadersHtml = '<th>Branch Location</th><th>City</th><th>SKUs Available</th><th style="text-align:right">Allocated Valuation</th>';
      tableRowsHtml = (reportData.rows || []).map((r: any) => `
        <tr>
          <td><strong>${r.branch_name}</strong></td>
          <td>${r.city || '-'}</td>
          <td>${r.skus_available}</td>
          <td style="text-align:right; font-weight:700; color:#2563eb">₹${r.stock_valuation?.toLocaleString()}</td>
        </tr>
      `).join('');
    } else if (reportType === 'clinical') {
      tableHeadersHtml = '<th>Appointment Date</th><th>Treatment</th><th>Consultation Type</th><th>Status</th>';
      tableRowsHtml = (reportData.rows || []).map((r: any) => `
        <tr>
          <td><strong>${r.date}</strong></td>
          <td>${r.treatment}</td>
          <td style="text-transform:capitalize">${r.type}</td>
          <td><span class="badge ${r.status === 'completed' ? 'active' : 'warning'}">${r.status}</span></td>
        </tr>
      `).join('');
    } else {
      tableHeadersHtml = '<th>Medicine Name</th><th>Category</th><th>Current Stock</th><th>Reorder Level</th><th>Unit Price</th><th style="text-align:right">Total Valuation</th>';
      tableRowsHtml = (reportData.rows || []).map((r: any) => `
        <tr>
          <td><strong>${r.name}</strong></td>
          <td>${r.category}</td>
          <td>${r.stock}</td>
          <td>${r.reorder_level}</td>
          <td>₹${r.unit_price}</td>
          <td style="text-align:right; font-weight:700">₹${r.valuation?.toLocaleString()}</td>
        </tr>
      `).join('');
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Vertical Clinic Report — ${titleText}</title>
        <style>
          body { font-family: 'Inter', system-ui, -apple-system, sans-serif; color: #0f172a; margin: 0; padding: 24px; background: #fff; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0c6e8c; padding-bottom: 16px; margin-bottom: 20px; }
          .brand-title { font-size: 1.6rem; font-weight: 800; color: #0c6e8c; margin: 0; letter-spacing: -0.5px; }
          .brand-subtitle { font-size: 0.85rem; color: #64748b; margin-top: 2px; }
          .report-meta { text-align: right; font-size: 0.8rem; color: #475569; }
          .report-title-section { background: #f8fafc; border: 1px solid #e2e8f0; padding: 14px 18px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
          .report-name { font-size: 1.1rem; font-weight: 700; color: #0f172a; margin: 0; }
          .report-dates { font-size: 0.82rem; color: #64748b; font-weight: 500; }
          .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 24px; }
          .summary-card { background: #fff; border: 1px solid #cbd5e1; padding: 14px; border-radius: 8px; text-align: center; }
          .card-label { font-size: 0.75rem; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
          .card-val { font-size: 1.4rem; font-weight: 800; margin-top: 4px; }
          .green { color: #059669; } .blue { color: #2563eb; } .purple { color: #7c3aed; } .cyan { color: #0891b2; } .red { color: #dc2626; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 0.85rem; }
          th { background: #0c6e8c; color: #fff; text-align: left; padding: 10px 12px; font-weight: 600; font-size: 0.8rem; }
          td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; color: #334155; }
          tr:nth-child(even) { background: #f8fafc; }
          .badge { padding: 3px 8px; border-radius: 12px; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; }
          .badge.active { background: #d1fae5; color: #065f46; }
          .badge.warning { background: #fef3c7; color: #92400e; }
          .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 0.75rem; color: #94a3b8; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="brand-title">🏥 VERTICAL CLINIC</h1>
            <div class="brand-subtitle">Smart Healthcare & Multi-Branch Clinic System</div>
          </div>
          <div class="report-meta">
            <div><strong>Generated:</strong> ${new Date().toLocaleString()}</div>
            <div><strong>Issued By:</strong> Clinic Administration</div>
          </div>
        </div>

        <div class="report-title-section">
          <div>
            <h2 class="report-name">${titleText}</h2>
            <div class="report-dates">Filter Period: <strong>${dateRangeText}</strong></div>
          </div>
        </div>

        <div class="summary-grid">
          ${summaryCardsHtml}
        </div>

        <table style="width:100%">
          <thead><tr>${tableHeadersHtml}</tr></thead>
          <tbody>${tableRowsHtml}</tbody>
        </table>

        <div class="footer">
          <div>Report generated automatically from Vertical Clinic System</div>
          <div>Page 1 of 1</div>
        </div>

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `;

    printWin.document.write(htmlContent);
    printWin.document.close();
  };

  const [editingBranch, setEditingBranch] = useState<any>(null);
  const [branchForm, setBranchForm] = useState<any>({
    name: '',
    code: '',
    city: '',
    address: '',
    phone: '',
    email: '',
    gst_number: '',
    opening_hour: '09:00',
    closing_hour: '21:00',
    is_active: true
  });

  const [isAddingBranch, setIsAddingBranch] = useState(false);
  const [newBranchForm, setNewBranchForm] = useState({
    name: '',
    code: '',
    city: '',
    address: '',
    phone: '',
    email: '',
    gst_number: '',
    opening_hour: '09:00',
    closing_hour: '21:00'
  });

  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [newStaffForm, setNewStaffForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    role: 'doctor',
    branch_id: ''
  });

  const [editingStaff, setEditingStaff] = useState<any>(null);
  const [staffForm, setStaffForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    role: 'doctor',
    branch_id: '',
    is_active: true
  });
  const [staffStatus, setStaffStatus] = useState<'active' | 'inactive' | 'suspended'>('active');
  const [suspensionUntilDate, setSuspensionUntilDate] = useState<string>('');
  const [suspensionReason, setSuspensionReason] = useState('Disruptive behavior');

  const [availabilityRequests, setAvailabilityRequests] = useState<any[]>([]);
  const [resolvingRequest, setResolvingRequest] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [conflictWarning, setConflictWarning] = useState<any[] | null>(null);

  const fetchAvailabilityRequests = async () => {
    try {
      const res = await api.get('/doctors/availability-requests/');
      if (res.data?.success) {
        setAvailabilityRequests(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching availability requests:', err);
    }
  };

  const [systemSettings, setSystemSettings] = useState({
    gst_rate: 18,
    default_teleconsultation_fee: 500,
    currency_symbol: '₹',
    clinic_name: 'Vertical Clinic'
  });
  const [savingSettings, setSavingSettings] = useState(false);

  const fetchSystemSettings = async () => {
    try {
      const res = await api.get('/admin/settings');
      if (res.data?.success && res.data.data) {
        setSystemSettings({
          gst_rate: res.data.data.gst_rate ?? 18,
          default_teleconsultation_fee: res.data.data.default_teleconsultation_fee ?? 500,
          currency_symbol: res.data.data.currency_symbol || '₹',
          clinic_name: res.data.data.clinic_name || 'Vertical Clinic'
        });
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await api.put('/admin/settings', systemSettings);
      if (res.data?.success) {
        alert('System settings updated successfully!');
      } else {
        alert(res.data?.message || 'Failed to update settings');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error saving system settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const [sessionsData, setSessionsData] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const fetchActiveSessions = async () => {
    setLoadingSessions(true);
    try {
      const res = await api.get('/admin/sessions');
      if (res.data?.success) {
        setSessionsData(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching active sessions:', err);
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleForceLogout = async (userId: string, userName: string) => {
    if (!window.confirm(`Are you sure you want to force logout ${userName}? This will invalidate their current active session immediately.`)) {
      return;
    }
    try {
      const res = await api.post(`/admin/sessions/${userId}/revoke`);
      if (res.data?.success) {
        alert(res.data.message || `Revoked session for ${userName}`);
        fetchActiveSessions();
      } else {
        alert(res.data?.message || 'Failed to revoke session');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error revoking session');
    }
  };

  const [attendanceData, setAttendanceData] = useState<any>({ summary: null, records: [] });
  const [attendanceDateFilter, setAttendanceDateFilter] = useState('');
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  const fetchStaffAttendance = async (dateStr?: string) => {
    setLoadingAttendance(true);
    try {
      const url = dateStr ? `/admin/attendance?attendance_date=${dateStr}` : '/admin/attendance';
      const res = await api.get(url);
      if (res.data?.success) {
        setAttendanceData(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching attendance:', err);
    } finally {
      setLoadingAttendance(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'availability-requests') {
      fetchAvailabilityRequests();
    }
    if (activeTab === 'settings') {
      fetchSystemSettings();
    }
    if (activeTab === 'active-sessions') {
      fetchActiveSessions();
    }
    if (activeTab === 'attendance') {
      fetchStaffAttendance(attendanceDateFilter);
    }
  }, [activeTab, attendanceDateFilter]);

  const handleEditBranchClick = (br: any) => {
    setEditingBranch(br);
    setBranchForm({
      name: br.name || '',
      code: br.code || '',
      city: br.city || '',
      address: br.address || '',
      phone: br.phone || '',
      email: br.email || '',
      gst_number: br.gst_number || '',
      opening_hour: br.opening_hour || '09:00',
      closing_hour: br.closing_hour || '21:00',
      is_active: br.is_active !== undefined ? br.is_active : br.status === 'active'
    });
  };

  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.put(`/branches/${editingBranch.id}`, branchForm);
      if (res.data?.success) {
        setEditingBranch(null);
        fetchDashboard();
      } else {
        alert(res.data?.message || 'Failed to update branch.');
      }
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Error occurred while updating branch.');
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/branches/', newBranchForm);
      if (res.data?.success) {
        setIsAddingBranch(false);
        setNewBranchForm({ name: '', code: '', city: '', address: '', phone: '', email: '', gst_number: '', opening_hour: '09:00', closing_hour: '21:00' });
        fetchDashboard();
      } else {
        alert(res.data?.message || 'Failed to create branch.');
      }
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Error occurred while creating branch.');
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...newStaffForm,
        branch_id: newStaffForm.branch_id || null
      };
      const res = await api.post('/users/', payload);
      if (res.data?.success) {
        alert('Staff member created successfully!');
        setIsAddingStaff(false);
        setShowPassword(false);
        setNewStaffForm({ full_name: '', email: '', phone: '', password: '', role: 'doctor', branch_id: '' });
        fetchDashboard();
      } else {
        alert(res.data?.message || 'Failed to create staff member.');
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.detail || err.response?.data?.message || 'Error occurred while creating staff member.';
      alert(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
    }
  };

  const handleEditStaffClick = (s: any) => {
    setEditingStaff(s);
    setShowEditPassword(false);
    setStaffForm({
      full_name: s.name || '',
      email: s.email || '',
      phone: s.phone === '—' ? '' : (s.phone || ''),
      password: '',
      role: s.role || 'doctor',
      branch_id: s.branch_id || '',
      is_active: s.status === 'active' || s.status === 'suspended'
    });
    setStaffStatus(s.status as 'active' | 'inactive' | 'suspended');
    if (s.suspended_until) {
      setSuspensionUntilDate(s.suspended_until.split('T')[0]);
    } else {
      const d = new Date();
      d.setDate(d.getDate() + 3);
      const month = '' + (d.getMonth() + 1);
      const day = '' + d.getDate();
      const year = d.getFullYear();
      setSuspensionUntilDate([year, month.padStart(2, '0'), day.padStart(2, '0')].join('-'));
    }
    setSuspensionReason(s.suspension_reason || 'Disruptive behavior');
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (staffStatus === 'suspended') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const selected = new Date(suspensionUntilDate);
        selected.setHours(0, 0, 0, 0);
        const diffTime = selected.getTime() - today.getTime();
        let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (isNaN(diffDays) || diffDays < 1) {
          diffDays = 1;
        }

        await api.post(`/users/${editingStaff.id}/suspend`, {
          action: 'suspend',
          duration_days: diffDays,
          reason: suspensionReason
        });
      } else if (editingStaff.status === 'suspended') {
        await api.post(`/users/${editingStaff.id}/suspend`, {
          action: 'unsuspend'
        });
      }

      const payload: any = {
        full_name: staffForm.full_name,
        email: staffForm.email,
        phone: staffForm.phone || null,
        role: staffForm.role,
        branch_id: staffForm.branch_id || null,
        is_active: staffStatus === 'active' || staffStatus === 'suspended'
      };
      if (staffForm.password) {
        payload.password = staffForm.password;
      }
      const res = await api.put(`/users/${editingStaff.id}`, payload);
      if (res.data?.success) {
        setEditingStaff(null);
        setShowEditPassword(false);
        fetchDashboard();
      } else {
        alert(res.data?.message || 'Failed to update staff member.');
      }
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Error occurred while updating staff member.');
    }
  };

  const handleDeleteStaff = async (staffId: string) => {
    if (staffId === currentUser?.id) {
      alert("You cannot delete your own admin account.");
      return;
    }
    if (!window.confirm("Are you sure you want to permanently delete this staff member? This action will cascade delete all their associated records and cannot be undone.")) {
      return;
    }
    try {
      const res = await api.delete(`/users/${staffId}`);
      if (res.data?.success) {
        setEditingStaff(null);
        fetchDashboard();
      } else {
        alert(res.data?.message || 'Failed to delete staff member.');
      }
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Error occurred while deleting staff member.');
    }
  };

  const fetchDashboard = async (branchIdOverride?: string) => {
    setLoading(true);
    try {
      const targetBranch = branchIdOverride !== undefined ? branchIdOverride : selectedDashboardBranch;
      const url = targetBranch ? `/admin/dashboard?branch_id=${targetBranch}` : '/admin/dashboard';
      const [dashRes, meRes] = await Promise.all([
        api.get(url),
        api.get('/auth/me'),
      ]);
      if (dashRes.data?.success) setData(dashRes.data.data);
      if (meRes.data?.success) setCurrentUser(meRes.data.data);
      if (activeTab === 'availability-requests') {
        await fetchAvailabilityRequests();
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleResolveRequest = async (requestId: string, status: 'approved' | 'rejected') => {
    try {
      const res = await api.put(`/doctors/availability-requests/${requestId}`, {
        status,
        rejection_reason: status === 'rejected' ? rejectionReason : undefined
      });
      if (res.data?.success) {
        setResolvingRequest(null);
        setRejectionReason('');
        await fetchAvailabilityRequests();
        const conflicts = res.data.data?.conflicts || [];
        if (conflicts.length > 0) {
          setConflictWarning(conflicts);
        } else {
          alert(`Request successfully ${status}.`);
        }
      } else {
        alert(res.data?.message || 'Failed to update request.');
      }
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Error occurred while resolving request.');
    }
  };

  useEffect(() => { fetchDashboard(); }, []);

  const kpis = data?.kpis || {};
  const apptStatus = data?.appointment_status_today || {};
  const stockHealth = data?.medicine_stock_health || {};
  const visitsTrend = data?.patient_visits_trend || [];
  const branches = data?.branches || [];
  const staff = data?.staff || [];
  const inventory = data?.inventory || [];
  const workflow = data?.workflow || { reception: [], consultation: [], billing: [], dispensary: [] };
  const recentActivities = data?.recent_activities || [];

  const fmtCurrency = (n?: number | null) => `₹${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  const initials = currentUser?.full_name?.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) || 'AD';

  const revGrowth = kpis.revenue_growth_pct;
  const apptGrowth = kpis.appointments_growth_pct;

  const stats = [
    {
      id: 'revenue',
      label: 'Total Revenue (MTD)',
      value: fmtCurrency(kpis.total_revenue_mtd || 0),
      trend: revGrowth !== undefined ? `${revGrowth >= 0 ? '+' : ''}${revGrowth}%` : 'MTD',
      trendType: revGrowth !== undefined && revGrowth >= 0 ? 'up' : revGrowth < 0 ? 'warning' : 'neutral',
      color: 'var(--revenue-green)'
    },
    { id: 'patients', label: 'Total Patients', value: String(kpis.total_patients || 0), trend: 'Registered', trendType: 'neutral', color: 'var(--patients-blue)' },
    { id: 'doctors', label: 'Doctors Available', value: String(kpis.active_doctors || 0), trend: 'Active', trendType: 'neutral', color: 'var(--doctors-teal)' },
    {
      id: 'appointments',
      label: 'Appointments Today',
      value: String(kpis.appointments_today || 0),
      trend: apptGrowth !== undefined ? `${apptGrowth >= 0 ? '+' : ''}${apptGrowth}% vs yesterday` : 'Today',
      trendType: apptGrowth !== undefined && apptGrowth >= 0 ? 'up' : apptGrowth < 0 ? 'warning' : 'neutral',
      color: 'var(--appt-orange)'
    },
    { id: 'inventory', label: 'Inventory SKUs', value: String(kpis.total_skus || 0), trend: kpis.low_stock_count > 0 ? `${kpis.low_stock_count} low` : 'OK', trendType: kpis.low_stock_count > 0 ? 'warning' : 'neutral', color: 'var(--inv-red)' },
    { id: 'branches', label: 'Active Branches', value: String(kpis.active_branches || 0), trend: 'Operational', trendType: 'neutral', color: 'var(--branch-indigo)' },
  ];

  const apptSegments = [
    { name: 'Confirmed', value: apptStatus.confirmed || 0, color: '#3b82f6' },
    { name: 'Waiting', value: (apptStatus.checked_in || 0) + (apptStatus.pending || 0), color: '#f59e0b' },
    { name: 'Completed', value: apptStatus.completed || 0, color: '#10b981' },
    { name: 'Cancelled', value: apptStatus.cancelled || 0, color: '#ef4444' },
  ];

  const stockSegments = [
    { name: 'In Stock', value: stockHealth.in_stock || 0, color: '#10b981' },
    { name: 'Low Stock', value: stockHealth.low_stock || 0, color: '#ef4444' },
  ];

  const maxVisits = Math.max(...visitsTrend.map((v: any) => v.count), 1);

  const filteredInventory = inventory.filter((i: any) =>
    i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.category.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredStaff = staff.filter((s: any) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.role.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredBranches = branches.filter((b: any) =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <div className="admin-logo-badge">V</div>
          <div className="admin-clinic-info">
            <span className="admin-clinic-name">Vertical Clinic</span>
            <span className="admin-clinic-sub">CLINIC OS</span>
          </div>
        </div>
        <div className="admin-sidebar-pill">Admin Portal</div>
        <nav className="admin-sidebar-nav">
          <div className="admin-nav-group-label">Main</div>
          {[
            { id: 'dashboard', icon: <Home size={18} />, label: 'Dashboard' },
            { id: 'reports', icon: <BarChart2 size={18} />, label: 'Reports' },
            { id: 'inventory', icon: <Package size={18} />, label: 'Inventory Reports' },
          ].map(tab => (
            <div key={tab.id} className={`admin-nav-item ${activeTab === tab.id ? 'active' : ''}`} onClick={() => handleRootTabChange(tab.id)}>
              {tab.icon} {tab.label}
            </div>
          ))}
          <div className="admin-nav-group-label">Manage</div>
          {[
            { id: 'staff', icon: <Users size={18} />, label: 'Staff Management' },
            { id: 'attendance', icon: <Clock size={18} />, label: 'Staff Attendance' },
            { id: 'branches', icon: <Layers size={18} />, label: 'Branch Management' },
            { id: 'availability-requests', icon: <Calendar size={18} />, label: 'Availability Requests' },
            { id: 'active-sessions', icon: <Shield size={18} />, label: 'Active Sessions & Security' },
            { id: 'settings', icon: <Settings size={18} />, label: 'Settings' },
          ].map(tab => (
            <div key={tab.id} className={`admin-nav-item ${activeTab === tab.id ? 'active' : ''}`} onClick={() => handleRootTabChange(tab.id)}>
              {tab.icon} {tab.label}
            </div>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <button className="admin-btn-switch" onClick={onLogout}>
            <LogOut size={14} /> Log Out
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div className="admin-title-area" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '14px' }}>
            {tabHistory.length > 0 && (
              <button 
                onClick={goBackTab} 
                className="admin-back-btn" 
                title="Go Back"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div>
              <h1 className="admin-page-title" style={{ margin: 0 }}>
                {activeTab === 'dashboard' && 'Dashboard'}
                {activeTab === 'reports' && 'Reports'}
                {activeTab === 'inventory' && 'Inventory Reports'}
                {activeTab === 'staff' && 'Staff Management'}
                {activeTab === 'attendance' && 'Staff Attendance Dashboard'}
                {activeTab === 'branches' && 'Branch Management'}
                {activeTab === 'availability-requests' && 'Availability Change Requests'}
                {activeTab === 'active-sessions' && 'Active Sessions & Security Controls'}
                {activeTab === 'settings' && 'Settings'}
              </h1>
              <p className="admin-page-subtitle" style={{ marginTop: '2px', margin: 0 }}>Admin Portal · Vertical Clinic</p>
            </div>
          </div>
          <div className="admin-topbar-right">
            <button className="admin-icon-btn" title="Refresh" onClick={() => fetchDashboard()}>
              <RefreshCw size={16} className={loading ? 'spin' : ''} />
            </button>
            <div className="notifications-wrapper" ref={notiDropdownRef} style={{ position: 'relative' }}>
              <button
                className="admin-icon-btn"
                title="Notifications"
                onClick={() => setIsNotiOpen(!isNotiOpen)}
                style={{ position: 'relative' }}
              >
                <Bell size={18} />
                {notifications.filter(n => !n.is_read).length > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-2px',
                      right: '-2px',
                      backgroundColor: '#ef4444',
                      color: '#fff',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      borderRadius: '50%',
                      width: '16px',
                      height: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '2px solid #fff'
                    }}
                  >
                    {notifications.filter(n => !n.is_read).length > 9 ? '9+' : notifications.filter(n => !n.is_read).length}
                  </span>
                )}
              </button>

              {isNotiOpen && (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '42px',
                    width: '320px',
                    background: '#ffffff',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                    border: '1px solid #e2e8f0',
                    zIndex: 1000,
                    overflow: 'hidden'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>System Alerts & Notifications</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {notifications.filter(n => !n.is_read).length > 0 && (
                        <button onClick={markAllNotificationsRead} style={{ border: 'none', background: 'none', color: '#3b82f6', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer' }}>
                          Mark Read
                        </button>
                      )}
                      {notifications.length > 0 && (
                        <button onClick={clearAllNotifications} style={{ border: 'none', background: 'none', color: '#64748b', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer' }}>
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {notifications.length === 0 ? (
                      <div style={{ padding: '24px', textAlign: 'center', fontSize: '0.82rem', color: '#94a3b8' }}>
                        No notifications available
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div
                          key={n.id}
                          onClick={() => markNotificationRead(n.id, n.target_tab || 'availability-requests')}
                          style={{
                            padding: '12px 16px',
                            borderBottom: '1px solid #f1f5f9',
                            background: !n.is_read ? '#f0f9ff' : '#ffffff',
                            cursor: 'pointer',
                            transition: 'background 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.82rem', color: '#0f172a' }}>{n.title}</span>
                            {!n.is_read && <span style={{ width: '6px', height: '6px', background: '#3b82f6', borderRadius: '50%' }} />}
                          </div>
                          <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#64748b', lineHeight: 1.35 }}>{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="profile-dropdown-wrapper" ref={profileDropdownRef}>
              <div 
                className="admin-profile-badge" 
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                style={{ cursor: 'pointer' }}
              >
                <div className="admin-profile-avatar">{initials}</div>
                <div className="admin-profile-info">
                  <span className="admin-profile-name">{currentUser?.full_name || 'Admin'}</span>
                  <span className="admin-profile-role">Admin</span>
                </div>
              </div>

              {isProfileDropdownOpen && (
                <div className="profile-dropdown-menu">
                  <button onClick={() => { handleRootTabChange('settings'); setIsProfileDropdownOpen(false); }}>
                    <Settings size={14} style={{ color: 'var(--primary-teal, #0c6e8c)' }} /> Settings
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

        <div className="admin-content">

          {/* ── DASHBOARD ── */}
          {activeTab === 'dashboard' && (
            <>
              {/* Branch Selection & Quick Actions Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', background: '#ffffff', padding: '14px 20px', borderRadius: '12px', border: '1px solid var(--admin-border)', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Building size={18} style={{ color: 'var(--admin-primary)' }} />
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>Location Filter:</span>
                  <select
                    value={selectedDashboardBranch}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedDashboardBranch(val);
                      fetchDashboard(val);
                    }}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.88rem',
                      fontWeight: 600,
                      color: '#0f172a',
                      background: '#f8fafc',
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                  >
                    <option value="">🌐 All Clinic Branches</option>
                    {branches.map((br: any) => (
                      <option key={br.id} value={br.id}>{br.name} Branch ({br.city})</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button className="admin-btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={() => handleRootTabChange('staff')}>
                    <Plus size={14} /> Add Staff
                  </button>
                  <button className="admin-btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={() => handleRootTabChange('branches')}>
                    <Building size={14} /> Add Branch
                  </button>
                  <button className="admin-btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={() => handleRootTabChange('inventory')}>
                    <Package size={14} /> View Inventory
                  </button>
                </div>
              </div>

              {loading ? (
                <div style={{ textAlign: 'center', padding: '60px', color: 'var(--admin-text-muted)' }}>Loading dashboard data…</div>
              ) : (
                <>
                  <div className="admin-stats-grid">
                    {stats.map(st => (
                      <div className="admin-stat-card" key={st.id}>
                        <div className="admin-stat-top">
                          <span className="admin-stat-label">{st.label}</span>
                          <span className={`admin-stat-trend ${st.trendType === 'up' ? 'admin-trend-up' : st.trendType === 'warning' ? 'admin-trend-warning' : 'admin-trend-neutral'}`}>{st.trend}</span>
                        </div>
                        <div className="admin-stat-val">{st.value}</div>
                        <div style={{ height: '4px', width: '40px', backgroundColor: st.color, borderRadius: '2px', marginTop: '8px' }} />
                      </div>
                    ))}
                  </div>

                  <div className="admin-charts-grid">
                    {/* Patient Visits Trend */}
                    <div className="admin-card">
                      <div className="admin-card-header">
                        <h2 className="admin-card-title">Patient Visits — Last 6 Months</h2>
                      </div>
                      <div className="admin-bar-chart-container">
                        {visitsTrend.map((v: any, i: number) => (
                          <div className="admin-bar-column-wrapper" key={i}>
                            <span className="admin-bar-value">{v.count}</span>
                            <div className="admin-bar-column blue-grad" style={{ height: `${Math.max((v.count / maxVisits) * 155, 4)}px` }} />
                            <span className="admin-bar-label">{v.month}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Appointment Status Today */}
                    <div className="admin-card">
                      <div className="admin-card-header">
                        <h2 className="admin-card-title">Appointment Status Today</h2>
                      </div>
                      <DonutChart segments={apptSegments} total={apptStatus.total || 0} label="total" />
                    </div>
                  </div>

                  <div className="admin-charts-grid" style={{ marginTop: '20px' }}>
                    {/* Revenue This Month */}
                    <div className="admin-card">
                      <div className="admin-card-header">
                        <h2 className="admin-card-title">Revenue This Month</h2>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '160px', flexDirection: 'column', gap: '8px' }}>
                        <span style={{ fontSize: '2.2rem', fontWeight: 700, color: 'var(--revenue-green)' }}>{fmtCurrency(kpis.total_revenue_mtd || 0)}</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)' }}>
                          Month-to-date total from clinic invoices {revGrowth !== undefined ? `(${revGrowth >= 0 ? '+' : ''}${revGrowth}% vs last month)` : ''}
                        </span>
                      </div>
                    </div>

                    {/* Medicine Stock Health */}
                    <div className="admin-card">
                      <div className="admin-card-header">
                        <h2 className="admin-card-title">Medicine Stock Health</h2>
                      </div>
                      <DonutChart segments={stockSegments} total={stockHealth.total || 0} label="total" />
                    </div>
                  </div>

                  {/* Today's Live Patient Queue Kanban Board */}
                  <div className="admin-card" style={{ marginTop: '20px' }}>
                    <div className="admin-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h2 className="admin-card-title">Today's Live Patient Workflow Queue</h2>
                        <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--admin-text-muted)' }}>Real-time patient progression across clinic operational stages</p>
                      </div>
                      <span style={{ fontSize: '0.78rem', background: '#e0f2fe', color: '#0369a1', padding: '4px 10px', borderRadius: '12px', fontWeight: 600 }}>
                        🟢 Live Tracking
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginTop: '16px' }}>
                      {/* Stage 1: Reception */}
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#334155' }}>🚪 Reception / Waiting</span>
                          <span style={{ background: '#3b82f6', color: '#fff', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>
                            {workflow.reception?.length || 0}
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {workflow.reception?.map((c: any) => (
                            <div key={c.id} style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                              <div style={{ fontWeight: 600, fontSize: '0.84rem', color: '#0f172a' }}>{c.title}</div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>{c.desc}</div>
                              <div style={{ fontSize: '0.72rem', color: '#3b82f6', marginTop: '6px', fontWeight: 600 }}>🕒 {c.time}</div>
                            </div>
                          ))}
                          {(!workflow.reception || workflow.reception.length === 0) && (
                            <div style={{ textAlign: 'center', padding: '16px', fontSize: '0.78rem', color: '#94a3b8' }}>No patients waiting</div>
                          )}
                        </div>
                      </div>

                      {/* Stage 2: Consultation */}
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#334155' }}>🩺 In Consultation</span>
                          <span style={{ background: '#f59e0b', color: '#fff', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>
                            {workflow.consultation?.length || 0}
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {workflow.consultation?.map((c: any) => (
                            <div key={c.id} style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                              <div style={{ fontWeight: 600, fontSize: '0.84rem', color: '#0f172a' }}>{c.title}</div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>{c.desc}</div>
                              <div style={{ fontSize: '0.72rem', color: '#d97706', marginTop: '6px', fontWeight: 600 }}>🕒 {c.time}</div>
                            </div>
                          ))}
                          {(!workflow.consultation || workflow.consultation.length === 0) && (
                            <div style={{ textAlign: 'center', padding: '16px', fontSize: '0.78rem', color: '#94a3b8' }}>No active consultations</div>
                          )}
                        </div>
                      </div>

                      {/* Stage 3: Billing */}
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#334155' }}>💳 Billing & Payment</span>
                          <span style={{ background: '#10b981', color: '#fff', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>
                            {workflow.billing?.length || 0}
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {workflow.billing?.map((c: any) => (
                            <div key={c.id} style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                              <div style={{ fontWeight: 600, fontSize: '0.84rem', color: '#0f172a' }}>{c.title}</div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>{c.desc}</div>
                              <div style={{ fontSize: '0.72rem', color: '#059669', marginTop: '6px', fontWeight: 600 }}>🕒 {c.time}</div>
                            </div>
                          ))}
                          {(!workflow.billing || workflow.billing.length === 0) && (
                            <div style={{ textAlign: 'center', padding: '16px', fontSize: '0.78rem', color: '#94a3b8' }}>No pending invoices</div>
                          )}
                        </div>
                      </div>

                      {/* Stage 4: Dispensary */}
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#334155' }}>💊 Dispensary / Pharmacy</span>
                          <span style={{ background: '#8b5cf6', color: '#fff', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>
                            {workflow.dispensary?.length || 0}
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {workflow.dispensary?.map((c: any) => (
                            <div key={c.id} style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                              <div style={{ fontWeight: 600, fontSize: '0.84rem', color: '#0f172a' }}>{c.title}</div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>{c.desc}</div>
                              <div style={{ fontSize: '0.72rem', color: '#7c3aed', marginTop: '6px', fontWeight: 600 }}>🕒 {c.time}</div>
                            </div>
                          ))}
                          {(!workflow.dispensary || workflow.dispensary.length === 0) && (
                            <div style={{ textAlign: 'center', padding: '16px', fontSize: '0.78rem', color: '#94a3b8' }}>No pending dispensary items</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recent Activity Feed */}
                  <div className="admin-card" style={{ marginTop: '20px' }}>
                    <div className="admin-card-header">
                      <h2 className="admin-card-title">Recent Activity Feed</h2>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '8px 0' }}>
                      {recentActivities.map((act: any) => (
                        <div key={act.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '1.2rem' }}>📅</span>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.84rem', color: '#0f172a' }}>{act.title}</div>
                              <div style={{ fontSize: '0.76rem', color: '#64748b' }}>{act.detail}</div>
                            </div>
                          </div>
                          <span style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 500 }}>{act.time}</span>
                        </div>
                      ))}
                      {recentActivities.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '0.82rem' }}>No recent system activities</div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* ── REPORTS TAB ── */}
          {activeTab === 'reports' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Filter Bar */}
              <div style={{ background: '#ffffff', padding: '20px', borderRadius: '16px', border: '1px solid var(--admin-border)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>Clinical & Financial Analytics Reports</h2>
                    <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#64748b' }}>Generate detailed financial revenue, patient visits, and medicine inventory usage reports.</p>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      className="admin-btn-primary"
                      onClick={exportToCSV}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '0.86rem', background: '#0284c7', border: 'none' }}
                    >
                      📊 Export CSV
                    </button>
                    <button
                      type="button"
                      className="admin-btn-primary"
                      onClick={exportToPDF}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '0.86rem', background: '#0c6e8c', border: 'none' }}
                    >
                      📄 Export PDF / Print
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  {/* Report Type Selector */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569' }}>Report Category:</label>
                    <select
                      value={reportType}
                      onChange={(e: any) => {
                        setReportData(null);
                        setReportType(e.target.value);
                      }}
                      style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 600, color: '#0f172a', background: '#fff' }}
                    >
                      <option value="financial">💵 Financial & Revenue Report</option>
                      <option value="doctor_revenue">👨‍⚕️ Doctor-wise Revenue & Performance</option>
                      <option value="staff_performance">👥 Staff Performance Analytics</option>
                      <option value="pharmacy_branch">💊 Pharmacy Sales by Clinic Branch</option>
                      <option value="clinical">🩺 Patient Visits & Clinical Report</option>
                      <option value="inventory">📦 Pharmacy & Inventory Stock Report</option>
                    </select>
                  </div>

                  {/* Start Date */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569' }}>Start Date:</label>
                    <input
                      type="date"
                      value={reportStartDate}
                      onChange={(e) => setReportStartDate(e.target.value)}
                      style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', background: '#fff' }}
                    />
                  </div>

                  {/* End Date */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569' }}>End Date:</label>
                    <input
                      type="date"
                      value={reportEndDate}
                      onChange={(e) => setReportEndDate(e.target.value)}
                      style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', background: '#fff' }}
                    />
                  </div>

                  {/* Branch Filter */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569' }}>Branch Location:</label>
                    <select
                      value={reportBranchId}
                      onChange={(e) => setReportBranchId(e.target.value)}
                      style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', background: '#fff' }}
                    >
                      <option value="">🌐 All Clinic Locations</option>
                      {branches.map((b: any) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginLeft: 'auto' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569' }}>Quick Presets:</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => setDatePreset('today')}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: activePreset === 'today' ? '1px solid #2563eb' : '1px solid #cbd5e1',
                          background: activePreset === 'today' ? '#2563eb' : '#fff',
                          color: activePreset === 'today' ? '#fff' : '#334155',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: activePreset === 'today' ? '0 2px 4px rgba(37,99,235,0.2)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => setDatePreset('7days')}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: activePreset === '7days' ? '1px solid #2563eb' : '1px solid #cbd5e1',
                          background: activePreset === '7days' ? '#2563eb' : '#fff',
                          color: activePreset === '7days' ? '#fff' : '#334155',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: activePreset === '7days' ? '0 2px 4px rgba(37,99,235,0.2)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        Last 7 Days
                      </button>
                      <button
                        type="button"
                        onClick={() => setDatePreset('month')}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: activePreset === 'month' ? '1px solid #2563eb' : '1px solid #cbd5e1',
                          background: activePreset === 'month' ? '#2563eb' : '#fff',
                          color: activePreset === 'month' ? '#fff' : '#334155',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: activePreset === 'month' ? '0 2px 4px rgba(37,99,235,0.2)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        This Month
                      </button>
                      <button
                        type="button"
                        onClick={() => setDatePreset('all')}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: activePreset === 'all' ? '1px solid #2563eb' : '1px solid #cbd5e1',
                          background: activePreset === 'all' ? '#2563eb' : '#fff',
                          color: activePreset === 'all' ? '#fff' : '#334155',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: activePreset === 'all' ? '0 2px 4px rgba(37,99,235,0.2)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        🌐 All Time
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary Metric Cards */}
              {reportData?.summary && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  {reportType === 'financial' && (
                    <>
                      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>Total Period Revenue</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#10b981', marginTop: '4px' }}>{fmtCurrency(reportData.summary.total_revenue || 0)}</div>
                      </div>
                      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>Total Invoices Generated</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#3b82f6', marginTop: '4px' }}>{reportData.summary.total_invoices || 0}</div>
                      </div>
                      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>Average Invoice Value</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#8b5cf6', marginTop: '4px' }}>{fmtCurrency(reportData.summary.avg_invoice_value || 0)}</div>
                      </div>
                    </>
                  )}

                  {reportType === 'clinical' && (
                    <>
                      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>Total Appointments</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#3b82f6', marginTop: '4px' }}>{reportData.summary.total_appointments || 0}</div>
                      </div>
                      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>Completed Consultations</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#10b981', marginTop: '4px' }}>{reportData.summary.completed || 0}</div>
                      </div>
                      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>Completion Rate</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#06b6d4', marginTop: '4px' }}>{reportData.summary.completion_rate || 0}%</div>
                      </div>
                    </>
                  )}

                  {reportType === 'inventory' && (
                    <>
                      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>Total Inventory Valuation</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#10b981', marginTop: '4px' }}>{fmtCurrency(reportData.summary.total_valuation || 0)}</div>
                      </div>
                      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>Total Medicine SKUs</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#3b82f6', marginTop: '4px' }}>{reportData.summary.total_skus || 0}</div>
                      </div>
                      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>Low Stock Warnings</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#ef4444', marginTop: '4px' }}>{reportData.summary.low_stock_skus || 0}</div>
                      </div>
                    </>
                  )}

                  {reportType === 'doctor_revenue' && (
                    <>
                      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>Total Doctors</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#3b82f6', marginTop: '4px' }}>{reportData.summary.total_doctors || 0}</div>
                      </div>
                      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>Doctor Generated Revenue</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#10b981', marginTop: '4px' }}>{fmtCurrency(reportData.summary.total_revenue || 0)}</div>
                      </div>
                      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>Average Revenue / Doctor</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#8b5cf6', marginTop: '4px' }}>{fmtCurrency(reportData.summary.avg_revenue_per_doctor || 0)}</div>
                      </div>
                    </>
                  )}

                  {reportType === 'staff_performance' && (
                    <>
                      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>Total Staff Members</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#3b82f6', marginTop: '4px' }}>{reportData.summary.total_staff || 0}</div>
                      </div>
                      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>Active Personnel</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#10b981', marginTop: '4px' }}>{reportData.summary.active_staff || 0}</div>
                      </div>
                    </>
                  )}

                  {reportType === 'pharmacy_branch' && (
                    <>
                      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>Total Operating Branches</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#3b82f6', marginTop: '4px' }}>{reportData.summary.total_branches || 0}</div>
                      </div>
                      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>Branch Pharmacy Valuation</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#10b981', marginTop: '4px' }}>{fmtCurrency(reportData.summary.total_valuation || 0)}</div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Detailed Data Table */}
              <div className="admin-card">
                <div className="admin-card-header">
                  <h2 className="admin-card-title">Report Detail Records ({reportData?.rows?.length || 0})</h2>
                </div>

                {reportLoading ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Generating report data…</div>
                ) : (
                  <div className="admin-table-container">
                    <table className="admin-table">
                      {reportType === 'financial' && (
                        <>
                          <thead><tr><th>Invoice #</th><th>Date</th><th>Patient</th><th>Payment Method</th><th>Status</th><th>Amount</th></tr></thead>
                          <tbody>
                            {reportData?.rows?.map((row: any) => (
                              <tr key={row.id}>
                                <td style={{ fontWeight: 600 }}>{row.invoice_number}</td>
                                <td>{row.date}</td>
                                <td>{row.patient_name}</td>
                                <td>{row.payment_mode}</td>
                                <td><span className="admin-status-badge active">{row.status}</span></td>
                                <td style={{ fontWeight: 700, color: '#10b981' }}>{fmtCurrency(row.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </>
                      )}

                      {reportType === 'clinical' && (
                        <>
                          <thead><tr><th>Appointment Date</th><th>Treatment</th><th>Consultation Type</th><th>Status</th></tr></thead>
                          <tbody>
                            {reportData?.rows?.map((row: any) => (
                              <tr key={row.id}>
                                <td style={{ fontWeight: 600 }}>{row.date}</td>
                                <td>{row.treatment}</td>
                                <td style={{ textTransform: 'capitalize' }}>{row.type}</td>
                                <td><span className={`admin-status-badge ${row.status === 'completed' ? 'active' : 'suspended'}`}>{row.status}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </>
                      )}

                      {reportType === 'inventory' && (
                        <>
                          <thead><tr><th>Medicine Name</th><th>Category</th><th>Current Stock</th><th>Reorder Level</th><th>Unit Price</th><th>Valuation</th><th>Status</th></tr></thead>
                          <tbody>
                            {reportData?.rows?.map((row: any) => (
                              <tr key={row.id}>
                                <td style={{ fontWeight: 600 }}>{row.name}</td>
                                <td>{row.category}</td>
                                <td>{row.stock}</td>
                                <td>{row.reorder_level}</td>
                                <td>₹{row.unit_price}</td>
                                <td style={{ fontWeight: 700 }}>₹{row.valuation}</td>
                                <td><span className={`admin-status-badge ${row.status === 'Low Stock' ? 'low' : 'active'}`}>{row.status}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </>
                      )}

                      {reportType === 'doctor_revenue' && (
                        <>
                          <thead><tr><th>Doctor Name</th><th>Specialization</th><th>Completed Consultations</th><th>Consultation Fee</th><th>Total Revenue</th><th>Status</th></tr></thead>
                          <tbody>
                            {reportData?.rows?.map((row: any) => (
                              <tr key={row.id}>
                                <td style={{ fontWeight: 600 }}>{row.doctor_name}</td>
                                <td>{row.specialization}</td>
                                <td>{row.completed_consultations}</td>
                                <td>₹{row.consultation_fee}</td>
                                <td style={{ fontWeight: 700, color: '#10b981' }}>{fmtCurrency(row.total_revenue)}</td>
                                <td><span className="admin-status-badge active">{row.status}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </>
                      )}

                      {reportType === 'staff_performance' && (
                        <>
                          <thead><tr><th>Staff Member</th><th>Role</th><th>Assigned Branch</th><th>Last Login</th><th>Status</th></tr></thead>
                          <tbody>
                            {reportData?.rows?.map((row: any) => (
                              <tr key={row.id}>
                                <td style={{ fontWeight: 600 }}>{row.staff_name}</td>
                                <td style={{ textTransform: 'capitalize' }}>{row.role}</td>
                                <td>{row.branch_name}</td>
                                <td>{row.last_login}</td>
                                <td><span className="admin-status-badge active">{row.status}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </>
                      )}

                      {reportType === 'pharmacy_branch' && (
                        <>
                          <thead><tr><th>Branch Location</th><th>City</th><th>SKUs Available</th><th>Allocated Valuation</th><th>Status</th></tr></thead>
                          <tbody>
                            {reportData?.rows?.map((row: any) => (
                              <tr key={row.id}>
                                <td style={{ fontWeight: 600 }}>{row.branch_name}</td>
                                <td>{row.city}</td>
                                <td>{row.skus_available}</td>
                                <td style={{ fontWeight: 700, color: '#2563eb' }}>{fmtCurrency(row.stock_valuation)}</td>
                                <td><span className="admin-status-badge active">{row.status}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </>
                      )}
                    </table>

                    {(!reportData?.rows || reportData.rows.length === 0) && (
                      <div style={{ padding: '36px', textAlign: 'center', color: '#94a3b8', fontSize: '0.86rem' }}>
                        No report records found for the selected date range and branch filter.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── INVENTORY ── */}
          {activeTab === 'inventory' && (
            <div className="admin-card">
              <div className="admin-card-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 className="admin-card-title">Pharmacy Medicine Stock</h2>
                <div className="admin-search-wrapper" style={{ margin: 0, width: '250px', position: 'relative' }}>
                  <Search className="admin-search-icon" size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--admin-text-muted)' }} />
                  <input type="text" className="admin-search-input" style={{ paddingLeft: '36px', height: '36px', width: '100%', fontSize: '0.85rem' }} placeholder="Search medicines..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
              </div>
              {loading ? <div style={{ padding: '40px', textAlign: 'center' }}>Loading…</div> : (
                <div className="admin-table-container">
                  <table className="admin-table">
                    <thead><tr><th>Medicine Name</th><th>Category</th><th>Stock</th><th>Reorder Point</th><th>Unit Price</th><th>Status</th></tr></thead>
                    <tbody>
                      {filteredInventory.map((item: any) => (
                        <tr key={item.id}>
                          <td style={{ fontWeight: 600 }}>{item.name}</td>
                          <td>{item.category}</td>
                          <td>{item.stock} {item.unit}</td>
                          <td>{item.reorder_level}</td>
                          <td>₹{item.unit_price}</td>
                          <td><span className={`admin-status-badge ${item.is_low_stock ? 'low' : 'active'}`}>{item.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'staff' && (
            <div className="admin-card">
              <div className="admin-card-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 className="admin-card-title">Clinic Staff Directory</h2>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div className="admin-search-wrapper" style={{ margin: 0, width: '250px', position: 'relative' }}>
                    <Search className="admin-search-icon" size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--admin-text-muted)' }} />
                    <input type="text" className="admin-search-input" style={{ paddingLeft: '36px', height: '36px', width: '100%', fontSize: '0.85rem' }} placeholder="Search staff..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                  </div>
                  <button className="admin-btn-primary" onClick={() => { setIsAddingStaff(true); setShowPassword(false); }}>
                    <Plus size={16} /> Add Staff Member
                  </button>
                </div>
              </div>
              {loading ? <div style={{ padding: '40px', textAlign: 'center' }}>Loading…</div> : (
                <div className="admin-table-container">
                  <table className="admin-table">
                    <thead><tr><th>Full Name</th><th>Role</th><th>Email</th><th>Phone</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                      {filteredStaff.map((s: any) => (
                        <tr key={s.id}>
                          <td style={{ fontWeight: 600 }}>{s.name}</td>
                          <td style={{ textTransform: 'capitalize' }}>{s.role}</td>
                          <td>{s.email}</td>
                          <td>{s.phone}</td>
                          <td><span className={`admin-status-badge ${s.status}`}>{s.status}</span></td>
                          <td>
                            <button
                              onClick={() => handleEditStaffClick(s)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--admin-primary)',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.8rem',
                                fontWeight: '600'
                              }}
                            >
                              <Edit size={14} /> Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── BRANCHES ── */}
          {activeTab === 'branches' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="admin-card-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 className="admin-card-title" style={{ margin: 0 }}>Active Branches</h2>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div className="admin-search-wrapper" style={{ margin: 0, width: '250px', position: 'relative' }}>
                    <Search className="admin-search-icon" size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--admin-text-muted)' }} />
                    <input type="text" className="admin-search-input" style={{ paddingLeft: '36px', height: '36px', width: '100%', fontSize: '0.85rem' }} placeholder="Search branches..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                  </div>
                  <button className="admin-btn-primary" onClick={() => setIsAddingBranch(true)}>
                    <Plus size={16} /> Add Branch
                  </button>
                </div>
              </div>
              {loading ? <div style={{ padding: '40px', textAlign: 'center' }}>Loading…</div> : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                  {filteredBranches.map((br: any) => (
                    <div key={br.id} className="branch-card" style={{
                      background: '#fff',
                      border: '1px solid var(--admin-border)',
                      borderRadius: '16px',
                      padding: '24px',
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)',
                      display: 'flex',
                      flexDirection: 'column',
                      position: 'relative'
                    }}>
                      <div className="flex-between" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <div className="stat-icon" style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '10px',
                          background: 'var(--admin-primary-light)',
                          color: 'var(--admin-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <Building size={20} />
                        </div>
                        <span className={`admin-status-badge ${br.status}`} style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          textTransform: 'capitalize',
                          borderRadius: '20px',
                          padding: '4px 12px',
                          fontSize: '0.75rem',
                          lineHeight: '1',
                          backgroundColor: br.status === 'active' ? '#d1fae5' : '#fee2e2',
                          color: br.status === 'active' ? '#065f46' : '#991b1b'
                        }}>
                          <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: br.status === 'active' ? '#059669' : '#dc2626'
                          }} />
                          {br.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--admin-text-dark)' }}>{br.name}</h3>
                      <div className="cell-sub" style={{ fontSize: '0.85rem', color: 'var(--admin-text-muted)', marginBottom: '16px', minHeight: '38px' }}>
                        {br.address || `${br.city}`}
                      </div>
                      <div style={{ height: '1px', background: 'var(--admin-border)', margin: '0 0 16px 0' }} />
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px', fontSize: '0.9rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                          <span style={{ color: 'var(--admin-text-muted)' }}>Phone</span>
                          <strong style={{ color: 'var(--admin-text-dark)' }}>{br.phone}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderTop: '1px dashed var(--admin-border)' }}>
                          <span style={{ color: 'var(--admin-text-muted)' }}>Staff</span>
                          <strong style={{ color: 'var(--admin-text-dark)' }}>{br.staff || 0}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderTop: '1px dashed var(--admin-border)' }}>
                          <span style={{ color: 'var(--admin-text-muted)' }}>Revenue (MTD)</span>
                          <strong style={{ color: 'var(--admin-text-dark)' }}>{fmtCurrency(br.revenue || 0)}</strong>
                        </div>
                      </div>
                      
                      <button
                        className="admin-btn-secondary"
                        onClick={() => handleEditBranchClick(br)}
                        style={{
                          width: '100%',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          padding: '10px',
                          borderRadius: '10px',
                          border: '1px solid var(--admin-border)',
                          background: '#fff',
                          color: 'var(--admin-text-dark)',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.12s ease',
                          fontSize: '0.9rem'
                        }}
                      >
                        <Edit size={14} /> Manage Branch
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── SETTINGS ── */}
          {activeTab === 'settings' && (
            <div className="admin-card" style={{ gap: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 className="admin-card-title" style={{ margin: 0 }}>System Settings & Operations Configuration</h2>
                  <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#64748b' }}>Configure global tax rates, default consultation fees, and clinic branding preferences.</p>
                </div>
              </div>

              <form onSubmit={handleSaveSettings}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                  
                  {/* Financial & Tax Settings */}
                  <div style={{ border: '1px solid var(--admin-border)', padding: '20px', borderRadius: '12px', background: '#fff' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 16px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      💵 Financial & Tax Settings
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div className="admin-form-group">
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>GST Rate (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          required
                          value={systemSettings.gst_rate}
                          onChange={e => setSystemSettings({ ...systemSettings, gst_rate: Number(e.target.value) })}
                          style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--admin-border)', borderRadius: '8px', fontSize: '0.9rem' }}
                        />
                      </div>

                      <div className="admin-form-group">
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Default Teleconsultation Fee (₹)</label>
                        <input
                          type="number"
                          required
                          value={systemSettings.default_teleconsultation_fee}
                          onChange={e => setSystemSettings({ ...systemSettings, default_teleconsultation_fee: Number(e.target.value) })}
                          style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--admin-border)', borderRadius: '8px', fontSize: '0.9rem' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* General Clinic Information */}
                  <div style={{ border: '1px solid var(--admin-border)', padding: '20px', borderRadius: '12px', background: '#fff' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 16px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      🏥 General Branding & Currency
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div className="admin-form-group">
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Clinic Organization Name</label>
                        <input
                          type="text"
                          required
                          value={systemSettings.clinic_name}
                          onChange={e => setSystemSettings({ ...systemSettings, clinic_name: e.target.value })}
                          style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--admin-border)', borderRadius: '8px', fontSize: '0.9rem' }}
                        />
                      </div>

                      <div className="admin-form-group">
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Currency Symbol</label>
                        <input
                          type="text"
                          required
                          value={systemSettings.currency_symbol}
                          onChange={e => setSystemSettings({ ...systemSettings, currency_symbol: e.target.value })}
                          style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--admin-border)', borderRadius: '8px', fontSize: '0.9rem' }}
                        />
                      </div>
                    </div>
                  </div>

                </div>

                <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="submit"
                    className="admin-btn-primary"
                    disabled={savingSettings}
                    style={{ padding: '10px 24px', fontSize: '0.9rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                  >
                    💾 {savingSettings ? 'Saving Settings...' : 'Save Settings'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── AVAILABILITY & LEAVE REQUESTS ── */}
          {activeTab === 'availability-requests' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Section 1: Pending Requests */}
              <div className="admin-card">
                <div className="admin-card-actions">
                  <div>
                    <h2 className="admin-card-title">Pending Staff & Doctor Requests</h2>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--admin-text-muted)' }}>
                      Schedule and leave requests requiring admin approval
                    </p>
                  </div>
                  <button className="admin-btn-primary" onClick={fetchAvailabilityRequests} style={{ gap: '6px' }}>
                    <RefreshCw size={14} /> Refresh List
                  </button>
                </div>

                {loading ? (
                  <div style={{ padding: '40px', textAlign: 'center' }}>Loading requests…</div>
                ) : (() => {
                  const pendingReqs = availabilityRequests.filter((r: any) => r.status === 'pending');
                  if (pendingReqs.length === 0) {
                    return (
                      <div style={{ padding: '30px', textAlign: 'center', color: 'var(--admin-text-muted)', fontSize: '0.88rem' }}>
                        No pending availability change requests.
                      </div>
                    );
                  }
                  return (
                    <div className="admin-table-container">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Staff / Doctor</th>
                            <th>Request Type</th>
                            <th>Proposed Change</th>
                            <th>Reason</th>
                            <th>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pendingReqs.map((req: any) => {
                            let proposedStr = '';
                            if (req.request_type === 'leave') {
                              proposedStr = `${req.proposed_start_date} to ${req.proposed_end_date}`;
                            } else if (req.request_type === 'lunch_break' || req.request_type === 'teleconsultation' || req.request_type === 'shift_timing') {
                              proposedStr = `${req.proposed_start_time} - ${req.proposed_end_time}`;
                            }

                            return (
                              <tr key={req.id}>
                                <td style={{ fontWeight: 600 }}>{req.doctor_name}</td>
                                <td>
                                  <span style={{ textTransform: 'capitalize', fontSize: '0.85rem' }}>
                                    {req.request_type.replace('_', ' ')}
                                  </span>
                                </td>
                                <td>{proposedStr}</td>
                                <td style={{ maxWidth: '250px', whiteSpace: 'normal', fontSize: '0.85rem' }}>{req.reason}</td>
                                <td>
                                  <span className="admin-status-badge pending" style={{ textTransform: 'uppercase' }}>
                                    Pending
                                  </span>
                                </td>
                                <td>
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                      onClick={() => handleResolveRequest(req.id, 'approved')}
                                      style={{
                                        background: '#10b981',
                                        border: 'none',
                                        color: '#fff',
                                        cursor: 'pointer',
                                        padding: '5px 10px',
                                        borderRadius: '6px',
                                        fontSize: '0.75rem',
                                        fontWeight: '600',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                      }}
                                    >
                                      <Check size={12} /> Approve
                                    </button>
                                    <button
                                      onClick={() => setResolvingRequest(req)}
                                      style={{
                                        background: '#ef4444',
                                        border: 'none',
                                        color: '#fff',
                                        cursor: 'pointer',
                                        padding: '5px 10px',
                                        borderRadius: '6px',
                                        fontSize: '0.75rem',
                                        fontWeight: '600',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                      }}
                                    >
                                      <X size={12} /> Reject
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>

              {/* Section 2: Past Requests History */}
              <div className="admin-card">
                <div className="admin-card-header" style={{ marginBottom: '16px' }}>
                  <h2 className="admin-card-title">Past Request History</h2>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--admin-text-muted)' }}>
                    Record of previously approved and rejected leave & schedule requests
                  </p>
                </div>

                {loading ? (
                  <div style={{ padding: '40px', textAlign: 'center' }}>Loading history…</div>
                ) : (() => {
                  const pastReqs = availabilityRequests.filter((r: any) => r.status !== 'pending');
                  if (pastReqs.length === 0) {
                    return (
                      <div style={{ padding: '30px', textAlign: 'center', color: 'var(--admin-text-muted)', fontSize: '0.88rem' }}>
                        No past request history recorded yet.
                      </div>
                    );
                  }
                  return (
                    <div className="admin-table-container">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Staff / Doctor</th>
                            <th>Request Type</th>
                            <th>Proposed Change</th>
                            <th>Reason</th>
                            <th>Status</th>
                            <th>Admin Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pastReqs.map((req: any) => {
                            let proposedStr = '';
                            if (req.request_type === 'leave') {
                              proposedStr = `${req.proposed_start_date} to ${req.proposed_end_date}`;
                            } else if (req.request_type === 'lunch_break' || req.request_type === 'teleconsultation' || req.request_type === 'shift_timing') {
                              proposedStr = `${req.proposed_start_time} - ${req.proposed_end_time}`;
                            }

                            return (
                              <tr key={req.id}>
                                <td style={{ fontWeight: 600 }}>{req.doctor_name}</td>
                                <td>
                                  <span style={{ textTransform: 'capitalize', fontSize: '0.85rem' }}>
                                    {req.request_type.replace('_', ' ')}
                                  </span>
                                </td>
                                <td>{proposedStr}</td>
                                <td style={{ maxWidth: '250px', whiteSpace: 'normal', fontSize: '0.85rem' }}>{req.reason}</td>
                                <td>
                                  <span style={{
                                    display: 'inline-block',
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    backgroundColor: req.status === 'approved' ? '#dcfce7' : '#fee2e2',
                                    color: req.status === 'approved' ? '#15803d' : '#b91c1c'
                                  }}>
                                    {req.status}
                                  </span>
                                </td>
                                <td style={{ fontSize: '0.82rem', color: 'var(--admin-text-muted)' }}>
                                  {req.admin_notes || '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>

            </div>
          )}

          {/* ── ACTIVE SESSIONS & SECURITY ── */}
          {activeTab === 'active-sessions' && (
            <div className="admin-card" style={{ gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 className="admin-card-title" style={{ margin: 0 }}>Active Login Sessions & Security Control</h2>
                  <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#64748b' }}>Monitor logged-in clinic staff and immediately revoke sessions if unauthorized activity is detected.</p>
                </div>
                <button className="admin-btn-secondary" onClick={() => fetchActiveSessions()}>
                  <RefreshCw size={14} className={loadingSessions ? 'spin' : ''} /> Refresh Sessions
                </button>
              </div>

              {loadingSessions ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading active sessions…</div>
              ) : (
                <div className="admin-table-container">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Staff Member</th>
                        <th>Role</th>
                        <th>Assigned Branch</th>
                        <th>Last Active / Login</th>
                        <th>Token Ver</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessionsData.map((s: any) => (
                        <tr key={s.id}>
                          <td style={{ fontWeight: 600 }}>
                            {s.full_name}
                            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 400 }}>{s.email}</div>
                          </td>
                          <td style={{ textTransform: 'capitalize' }}>
                            <span style={{ padding: '2px 8px', borderRadius: '12px', background: '#f1f5f9', fontSize: '0.78rem', fontWeight: 600 }}>{s.role}</span>
                          </td>
                          <td>{s.branch_name}</td>
                          <td>{s.last_login_at}</td>
                          <td>v{s.token_version}</td>
                          <td>
                            <span className={`admin-status-badge ${s.is_active ? 'active' : 'suspended'}`}>
                              {s.is_active ? 'Active' : 'Deactivated'}
                            </span>
                          </td>
                          <td>
                            <button
                              onClick={() => handleForceLogout(s.id, s.full_name)}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                border: '1px solid #ef4444',
                                background: '#fef2f2',
                                color: '#dc2626',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              🔒 Force Logout
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── STAFF ATTENDANCE ── */}
          {activeTab === 'attendance' && (
            <div className="admin-card" style={{ gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h2 className="admin-card-title" style={{ margin: 0 }}>Staff Daily Attendance Sheet</h2>
                  <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#64748b' }}>Track automated daily punch-in times, late arrivals, and absence records across all clinic branches.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input
                    type="date"
                    value={attendanceDateFilter}
                    onChange={e => setAttendanceDateFilter(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                  <button className="admin-btn-secondary" onClick={() => fetchStaffAttendance(attendanceDateFilter)}>
                    <RefreshCw size={14} className={loadingAttendance ? 'spin' : ''} /> Filter Date
                  </button>
                </div>
              </div>

              {/* Attendance Summary Pill Cards */}
              {attendanceData.summary && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ fontSize: '0.78rem', color: '#166534', fontWeight: 600 }}>🟢 Present</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#15803d', marginTop: '4px' }}>{attendanceData.summary.present}</div>
                  </div>
                  <div style={{ background: '#fefce8', border: '1px solid #fef08a', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ fontSize: '0.78rem', color: '#854d0e', fontWeight: 600 }}>🟡 Late Arrivals</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#a16207', marginTop: '4px' }}>{attendanceData.summary.late}</div>
                  </div>
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ fontSize: '0.78rem', color: '#1e40af', fontWeight: 600 }}>🔵 On Leave</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1d4ed8', marginTop: '4px' }}>{attendanceData.summary.on_leave}</div>
                  </div>
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ fontSize: '0.78rem', color: '#991b1b', fontWeight: 600 }}>🔴 Absent</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#b91c1c', marginTop: '4px' }}>{attendanceData.summary.absent}</div>
                  </div>
                </div>
              )}

              {loadingAttendance ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading attendance records…</div>
              ) : (
                <div className="admin-table-container">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Staff Member</th>
                        <th>Role</th>
                        <th>Branch</th>
                        <th>Date</th>
                        <th>Punch-In Time</th>
                        <th>Punch-Out Time</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendanceData.records?.map((r: any) => (
                        <tr key={r.id}>
                          <td style={{ fontWeight: 600 }}>{r.staff_name}</td>
                          <td style={{ textTransform: 'capitalize' }}>{r.role}</td>
                          <td>{r.branch_name}</td>
                          <td>{r.date}</td>
                          <td style={{ fontWeight: 600, color: '#0f172a' }}>{r.punch_in}</td>
                          <td>{r.punch_out}</td>
                          <td>
                            <span className={`admin-status-badge ${
                              r.status === 'PRESENT' ? 'active' : r.status === 'LATE' ? 'low' : 'suspended'
                            }`}>
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {(!attendanceData.records || attendanceData.records.length === 0) && (
                    <div style={{ padding: '36px', textAlign: 'center', color: '#94a3b8', fontSize: '0.86rem' }}>
                      No staff punch-in records logged for {attendanceData.summary?.date || 'today'}.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      </main>

      {/* Edit Branch Modal */}
      {editingBranch && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content">
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">Edit Branch Details</h3>
              <button className="admin-modal-close-btn" onClick={() => setEditingBranch(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveBranch}>
              <div className="admin-form-grid">
                <div className="admin-form-group">
                  <label className="admin-form-label">Branch Name</label>
                  <input
                    type="text"
                    required
                    className="admin-form-input"
                    value={branchForm.name}
                    onChange={e => setBranchForm({ ...branchForm, name: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Branch Code</label>
                  <input
                    type="text"
                    required
                    className="admin-form-input"
                    value={branchForm.code}
                    onChange={e => setBranchForm({ ...branchForm, code: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">City</label>
                  <input
                    type="text"
                    required
                    className="admin-form-input"
                    value={branchForm.city}
                    onChange={e => setBranchForm({ ...branchForm, city: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">GST Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 24AACCS1234K1ZP"
                    className="admin-form-input"
                    value={branchForm.gst_number}
                    onChange={e => setBranchForm({ ...branchForm, gst_number: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Contact Phone</label>
                  <input
                    type="text"
                    required
                    className="admin-form-input"
                    value={branchForm.phone}
                    onChange={e => setBranchForm({ ...branchForm, phone: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Email Address</label>
                  <input
                    type="email"
                    className="admin-form-input"
                    value={branchForm.email}
                    onChange={e => setBranchForm({ ...branchForm, email: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Opening Hour</label>
                  <input
                    type="time"
                    required
                    className="admin-form-input"
                    value={branchForm.opening_hour}
                    onChange={e => setBranchForm({ ...branchForm, opening_hour: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Closing Hour</label>
                  <input
                    type="time"
                    required
                    className="admin-form-input"
                    value={branchForm.closing_hour}
                    onChange={e => setBranchForm({ ...branchForm, closing_hour: e.target.value })}
                  />
                </div>
                <div className="admin-form-group full-width">
                  <label className="admin-form-label">Address</label>
                  <textarea
                    rows={3}
                    className="admin-form-input"
                    style={{ fontFamily: 'inherit', resize: 'vertical' }}
                    value={branchForm.address}
                    onChange={e => setBranchForm({ ...branchForm, address: e.target.value })}
                  />
                </div>
                <div className="admin-form-group full-width">
                  <label className="admin-form-label" style={{ marginBottom: '8px', display: 'block' }}>Status</label>
                  <div className="status-pill-select" style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      className={`status-pill-opt ${branchForm.is_active ? 'selected' : ''}`}
                      onClick={() => setBranchForm({ ...branchForm, is_active: true })}
                      style={{
                        padding: '10px 20px',
                        borderRadius: '10px',
                        border: '1px solid',
                        borderColor: branchForm.is_active ? 'var(--admin-primary)' : 'var(--admin-border)',
                        background: branchForm.is_active ? 'var(--admin-primary-light)' : '#fff',
                        color: branchForm.is_active ? 'var(--admin-primary)' : 'var(--admin-text-muted)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.12s ease',
                        fontSize: '0.9rem'
                      }}
                    >
                      Active
                    </button>
                    <button
                      type="button"
                      className={`status-pill-opt ${!branchForm.is_active ? 'selected' : ''}`}
                      onClick={() => setBranchForm({ ...branchForm, is_active: false })}
                      style={{
                        padding: '10px 20px',
                        borderRadius: '10px',
                        border: '1px solid',
                        borderColor: !branchForm.is_active ? 'var(--admin-primary)' : 'var(--admin-border)',
                        background: !branchForm.is_active ? 'var(--admin-primary-light)' : '#fff',
                        color: !branchForm.is_active ? 'var(--admin-primary)' : 'var(--admin-text-muted)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.12s ease',
                        fontSize: '0.9rem'
                      }}
                    >
                      Inactive
                    </button>
                  </div>
                </div>
              </div>
              <div className="admin-modal-actions">
                <button type="button" className="admin-btn-switch" style={{ border: '1px solid var(--admin-border)' }} onClick={() => setEditingBranch(null)}>
                  Cancel
                </button>
                <button type="submit" className="admin-btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Branch Modal */}
      {isAddingBranch && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content">
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">Add New Branch</h3>
              <button className="admin-modal-close-btn" onClick={() => setIsAddingBranch(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateBranch}>
              <div className="admin-form-grid">
                <div className="admin-form-group">
                  <label className="admin-form-label">Branch Name</label>
                  <input
                    type="text"
                    required
                    className="admin-form-input"
                    value={newBranchForm.name}
                    onChange={e => setNewBranchForm({ ...newBranchForm, name: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Branch Code</label>
                  <input
                    type="text"
                    required
                    className="admin-form-input"
                    value={newBranchForm.code}
                    onChange={e => setNewBranchForm({ ...newBranchForm, code: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">City</label>
                  <input
                    type="text"
                    required
                    className="admin-form-input"
                    value={newBranchForm.city}
                    onChange={e => setNewBranchForm({ ...newBranchForm, city: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">GST Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 24AACCS1234K1ZP"
                    className="admin-form-input"
                    value={newBranchForm.gst_number}
                    onChange={e => setNewBranchForm({ ...newBranchForm, gst_number: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Contact Phone</label>
                  <input
                    type="text"
                    required
                    className="admin-form-input"
                    value={newBranchForm.phone}
                    onChange={e => setNewBranchForm({ ...newBranchForm, phone: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Email Address</label>
                  <input
                    type="email"
                    className="admin-form-input"
                    value={newBranchForm.email}
                    onChange={e => setNewBranchForm({ ...newBranchForm, email: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Opening Hour</label>
                  <input
                    type="time"
                    required
                    className="admin-form-input"
                    value={newBranchForm.opening_hour}
                    onChange={e => setNewBranchForm({ ...newBranchForm, opening_hour: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Closing Hour</label>
                  <input
                    type="time"
                    required
                    className="admin-form-input"
                    value={newBranchForm.closing_hour}
                    onChange={e => setNewBranchForm({ ...newBranchForm, closing_hour: e.target.value })}
                  />
                </div>
                <div className="admin-form-group full-width">
                  <label className="admin-form-label">Address</label>
                  <textarea
                    rows={3}
                    className="admin-form-input"
                    style={{ fontFamily: 'inherit', resize: 'vertical' }}
                    value={newBranchForm.address}
                    onChange={e => setNewBranchForm({ ...newBranchForm, address: e.target.value })}
                  />
                </div>
              </div>
              <div className="admin-modal-actions">
                <button type="button" className="admin-btn-cancel" onClick={() => setIsAddingBranch(false)}>
                  Cancel
                </button>
                <button type="submit" className="admin-btn-primary">
                  Create Branch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      {isAddingStaff && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content">
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">Add New Staff Member</h3>
              <button className="admin-modal-close-btn" onClick={() => { setIsAddingStaff(false); setShowPassword(false); }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateStaff}>
              <div className="admin-form-grid">
                <div className="admin-form-group">
                  <label className="admin-form-label">Full Name</label>
                  <input
                    type="text"
                    required
                    className="admin-form-input"
                    value={newStaffForm.full_name}
                    onChange={e => setNewStaffForm({ ...newStaffForm, full_name: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Email Address</label>
                  <input
                    type="email"
                    required
                    className="admin-form-input"
                    value={newStaffForm.email}
                    onChange={e => setNewStaffForm({ ...newStaffForm, email: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Contact Phone</label>
                  <input
                    type="text"
                    required
                    className="admin-form-input"
                    value={newStaffForm.phone}
                    onChange={e => setNewStaffForm({ ...newStaffForm, phone: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Password</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      className="admin-form-input"
                      style={{ width: '100%', paddingRight: '40px' }}
                      value={newStaffForm.password}
                      onChange={e => setNewStaffForm({ ...newStaffForm, password: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        color: 'var(--admin-text-muted)',
                        padding: '4px'
                      }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Role</label>
                  <select
                    className="admin-form-input"
                    value={newStaffForm.role}
                    onChange={e => setNewStaffForm({ ...newStaffForm, role: e.target.value })}
                  >
                    <option value="doctor">Doctor</option>
                    <option value="receptionist">Receptionist</option>
                    <option value="pharmacist">Pharmacist</option>
                    <option value="clinic_manager">Clinic Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Assign to Branch</label>
                  <select
                    className="admin-form-input"
                    value={newStaffForm.branch_id}
                    onChange={e => setNewStaffForm({ ...newStaffForm, branch_id: e.target.value })}
                  >
                    <option value="">No Branch / Global Admin</option>
                    {branches.map((br: any) => (
                      <option key={br.id} value={br.id}>
                        {br.name} ({br.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="admin-modal-actions">
                <button type="button" className="admin-btn-cancel" onClick={() => { setIsAddingStaff(false); setShowPassword(false); }}>
                  Cancel
                </button>
                <button type="submit" className="admin-btn-primary">
                  Create Staff
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {editingStaff && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content">
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">Edit Staff Details</h3>
              <button className="admin-modal-close-btn" onClick={() => { setEditingStaff(null); setShowEditPassword(false); }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveStaff}>
              <div className="admin-form-grid">
                <div className="admin-form-group">
                  <label className="admin-form-label">Full Name</label>
                  <input
                    type="text"
                    required
                    className="admin-form-input"
                    value={staffForm.full_name}
                    onChange={e => setStaffForm({ ...staffForm, full_name: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Email Address</label>
                  <input
                    type="email"
                    required
                    className="admin-form-input"
                    value={staffForm.email}
                    onChange={e => setStaffForm({ ...staffForm, email: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Contact Phone</label>
                  <input
                    type="text"
                    className="admin-form-input"
                    value={staffForm.phone}
                    onChange={e => setStaffForm({ ...staffForm, phone: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Password (leave blank to keep current)</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type={showEditPassword ? "text" : "password"}
                      placeholder="New password"
                      className="admin-form-input"
                      style={{ width: '100%', paddingRight: '40px' }}
                      value={staffForm.password}
                      onChange={e => setStaffForm({ ...staffForm, password: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowEditPassword(!showEditPassword)}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        color: 'var(--admin-text-muted)',
                        padding: '4px'
                      }}
                    >
                      {showEditPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Role</label>
                  <select
                    className="admin-form-input"
                    value={staffForm.role}
                    onChange={e => setStaffForm({ ...staffForm, role: e.target.value })}
                  >
                    <option value="doctor">Doctor</option>
                    <option value="receptionist">Receptionist</option>
                    <option value="pharmacist">Pharmacist</option>
                    <option value="clinic_manager">Clinic Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Assign to Branch</label>
                  <select
                    className="admin-form-input"
                    value={staffForm.branch_id}
                    onChange={e => setStaffForm({ ...staffForm, branch_id: e.target.value })}
                  >
                    <option value="">No Branch / Global Admin</option>
                    {branches.map((br: any) => (
                      <option key={br.id} value={br.id}>
                        {br.name} ({br.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="admin-form-group full-width">
                  <label className="admin-form-label">Account Status</label>
                  <select
                    className="admin-form-input"
                    value={staffStatus}
                    onChange={e => setStaffStatus(e.target.value as any)}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive (Deactivated)</option>
                    <option value="suspended">Temporarily Suspended</option>
                  </select>
                </div>

                {staffStatus === 'suspended' && (
                  <>
                    <div className="admin-form-group">
                      <label className="admin-form-label">Suspended Until</label>
                      <input
                        type="date"
                        required
                        className="admin-form-input"
                        value={suspensionUntilDate}
                        onChange={e => setSuspensionUntilDate(e.target.value)}
                        min={(() => {
                          const d = new Date();
                          d.setDate(d.getDate() + 1);
                          const month = '' + (d.getMonth() + 1);
                          const day = '' + d.getDate();
                          const year = d.getFullYear();
                          return [year, month.padStart(2, '0'), day.padStart(2, '0')].join('-');
                        })()}
                      />
                    </div>
                    <div className="admin-form-group">
                      <label className="admin-form-label">Reason for Suspension</label>
                      <input
                        type="text"
                        required
                        className="admin-form-input"
                        value={suspensionReason}
                        onChange={e => setSuspensionReason(e.target.value)}
                        placeholder="Reason (e.g. Disruptive behavior)"
                      />
                    </div>
                  </>
                )}
              </div>
              <div className="admin-modal-actions">
                {editingStaff.id !== currentUser?.id && (
                  <button 
                    type="button" 
                    className="admin-btn-danger" 
                    onClick={() => handleDeleteStaff(editingStaff.id)}
                    style={{ marginRight: 'auto' }}
                  >
                    Delete Staff
                  </button>
                )}
                <button type="button" className="admin-btn-cancel" onClick={() => { setEditingStaff(null); setShowEditPassword(false); }}>
                  Cancel
                </button>
                <button type="submit" className="admin-btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      {resolvingRequest && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content" style={{ maxWidth: '400px' }}>
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">Reject Request</h3>
              <button className="admin-modal-close-btn" onClick={() => setResolvingRequest(null)}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', padding: '15px 0' }}>
              <p style={{ fontSize: '0.88rem', color: 'var(--admin-text-muted)' }}>
                Please specify the reason for rejecting the availability request from <strong>{resolvingRequest.doctor_name}</strong>.
              </p>
              <div className="admin-form-group full-width">
                <label className="admin-form-label">Reason for Rejection</label>
                <textarea
                  rows={3}
                  required
                  className="admin-form-input"
                  style={{ fontFamily: 'inherit', resize: 'vertical' }}
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  placeholder="Explain why this request is being rejected..."
                />
              </div>
            </div>
            <div className="admin-modal-actions">
              <button type="button" className="admin-btn-cancel" onClick={() => setResolvingRequest(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="admin-btn-primary"
                style={{ background: '#ef4444' }}
                onClick={() => handleResolveRequest(resolvingRequest.id, 'rejected')}
                disabled={!rejectionReason.trim()}
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conflict Warning Modal */}
      {conflictWarning && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content" style={{ maxWidth: '500px' }}>
            <div className="admin-modal-header">
              <h3 className="admin-modal-title" style={{ color: '#eab308', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={20} /> Schedule Conflicts Detected
              </h3>
              <button className="admin-modal-close-btn" onClick={() => setConflictWarning(null)}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', padding: '15px 0' }}>
              <p style={{ fontSize: '0.9rem', lineHeight: '1.4' }}>
                The schedule change has been approved. However, the following existing appointments conflict with the new timings.
                They have been automatically marked as <strong>Pending Action</strong> and the patients have been notified:
              </p>
              <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--admin-border)', borderRadius: '6px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px', background: '#fef08a1a' }}>
                {conflictWarning.map((c: any) => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '6px 8px', background: '#fff', borderRadius: '4px', border: '1px solid var(--admin-border)' }}>
                    <span style={{ fontWeight: 600 }}>{c.patient_name}</span>
                    <span style={{ fontFamily: 'monospace' }}>
                      {new Date(c.appointment_datetime).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="admin-modal-actions">
              <button type="button" className="admin-btn-primary" onClick={() => setConflictWarning(null)}>
                Dismiss & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
