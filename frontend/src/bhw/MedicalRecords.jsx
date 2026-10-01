import { useState, useEffect, useMemo } from 'react';
import axiosClient from '../api/axiosClient';
import {
  FileText,
  Search,
  Phone,
  ArrowLeft,
  Calendar,
  User,
  Activity,
  Heart,
  Baby,
  CheckCircle2,
  ChevronRight,
  X,
  PlusCircle,
  History,
  ShieldCheck,
  Clock,
  Printer,
  Plus,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import ReportPreviewModal from '../components/ui/ReportPreviewModal';

const statusColors = {
  normal: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200',
  MAM: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
  SAM: 'bg-red-100 text-red-800 ring-1 ring-red-200',
  underweight: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
  overweight: 'bg-blue-100 text-blue-800 ring-1 ring-blue-200',
  obese: 'bg-purple-100 text-purple-800 ring-1 ring-purple-200',
};

const severityColors = {
  low: 'bg-emerald-100 text-emerald-800',
  medium: 'bg-amber-100 text-amber-800',
  high: 'bg-red-100 text-red-800',
};

function MedicalRecords() {
  const [recordType, setRecordType] = useState('children'); // 'children' | 'mothers' | 'audit'
  const user = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');

  // Report Modal state (Item 30 & 34)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportData, setReportData] = useState(null);

  // ── Add Beneficiary Modal State (Item 25 & 36) ──
  const [showAddBeneficiaryModal, setShowAddBeneficiaryModal] = useState(false);
  const [beneficiaryType, setBeneficiaryType] = useState('child'); // 'child' | 'mother'
  const [newFirstName, setNewFirstName] = useState('');
  const [newMiddleInitial, setNewMiddleInitial] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newBirthDate, setNewBirthDate] = useState('');
  const [newSex, setNewSex] = useState('male');
  const [newGuardianName, setNewGuardianName] = useState('');
  const [newGuardianContact, setNewGuardianContact] = useState('');
  const [newBarangay, setNewBarangay] = useState(user.barangay || 'Antipolo');
  const [newPurok, setNewPurok] = useState('');
  const [addBeneficiarySubmitting, setAddBeneficiarySubmitting] = useState(false);
  const [addBeneficiaryError, setAddBeneficiaryError] = useState('');
  const [addBeneficiarySuccess, setAddBeneficiarySuccess] = useState('');

  // ── Children state ──
  const [children, setChildren] = useState([]);
  const [childLoading, setChildLoading] = useState(true);
  const [childError, setChildError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [ageFilter, setAgeFilter] = useState('all');
  const [selectedChild, setSelectedChild] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [activeTab, setActiveTab] = useState('growth');

  // ── Mothers state ──
  const [mothers, setMothers] = useState([]);
  const [motherLoading, setMotherLoading] = useState(false);
  const [motherError, setMotherError] = useState('');
  const [motherSearch, setMotherSearch] = useState('');
  const [selectedMother, setSelectedMother] = useState(null);
  const [motherDetail, setMotherDetail] = useState(null);
  const [motherDetailLoading, setMotherDetailLoading] = useState(false);
  const [motherDetailError, setMotherDetailError] = useState('');
  const [motherActiveTab, setMotherActiveTab] = useState('services');

  // ── Audit Trail state ──
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState('');

  // ── Add Intervention Modal State ──
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalBeneficiaryType, setModalBeneficiaryType] = useState('child');
  const [interventionCategory, setInterventionCategory] = useState('Medication');
  const [serviceName, setServiceName] = useState('');
  const [dosage, setDosage] = useState('');
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [nextSchedule, setNextSchedule] = useState('');
  const [interventionNotes, setInterventionNotes] = useState('');
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  const fetchChildren = async () => {
    try {
      const response = await axiosClient.get('/bhw/medical-records', {
        params: { barangay: user.barangay },
      });
      setChildren(response.data || []);
      if (response.data && response.data.length > 0 && window.innerWidth >= 1024 && !selectedChild) {
        openChild(response.data[0]);
      }
    } catch {
      setChildError('Failed to load registered children.');
    } finally {
      setChildLoading(false);
    }
  };

  useEffect(() => {
    fetchChildren();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (recordType === 'mothers' && mothers.length === 0) {
      fetchMothers();
    } else if (recordType === 'audit') {
      fetchAuditLogs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordType]);

  const fetchMothers = async () => {
    setMotherLoading(true);
    try {
      const res = await axiosClient.get('/bhw/medical-records/mothers', {
        params: { barangay: user.barangay },
      });
      setMothers(res.data || []);
      if (res.data && res.data.length > 0 && window.innerWidth >= 1024 && !selectedMother) {
        openMother(res.data[0]);
      }
    } catch {
      setMotherError('Failed to load registered mothers.');
    } finally {
      setMotherLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    setAuditLoading(true);
    setAuditError('');
    try {
      const res = await axiosClient.get('/bhw/medical-records/audit-trail');
      setAuditLogs(res.data || []);
    } catch {
      setAuditError('Failed to load audit trail.');
    } finally {
      setAuditLoading(false);
    }
  };

  const filteredChildren = useMemo(() => {
    let list = [...children];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) =>
        `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase().includes(q) ||
        (c.guardian_name || '').toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') {
      list = list.filter((c) => c.overall_status === statusFilter);
    }
    if (ageFilter !== 'all') {
      list = list.filter((c) => {
        if (ageFilter === '0-11') return c.age_in_months <= 11;
        if (ageFilter === '0-23') return c.age_in_months >= 0 && c.age_in_months <= 23;
        if (ageFilter === '0-24') return c.age_in_months >= 0 && c.age_in_months <= 24;
        if (ageFilter === '12-23') return c.age_in_months >= 12 && c.age_in_months <= 23;
        return c.age_in_months >= 24 && c.age_in_months <= 59;
      });
    }
    return list;
  }, [children, search, statusFilter, ageFilter]);

  const filteredMothers = useMemo(() => {
    if (!motherSearch.trim()) return mothers;
    const q = motherSearch.trim().toLowerCase();
    return mothers.filter((m) =>
      `${m.first_name || ''} ${m.last_name || ''}`.toLowerCase().includes(q) ||
      (m.contact_number || '').includes(q) ||
      (m.purok || '').toLowerCase().includes(q)
    );
  }, [mothers, motherSearch]);

  const openChild = async (child) => {
    setSelectedChild(child);
    setDetail(null);
    setDetailError('');
    setActiveTab('growth');
    setDetailLoading(true);
    try {
      const response = await axiosClient.get(`/bhw/medical-records/${child.child_id}`);
      const payload = response.data || {};
      setDetail({
        ...payload,
        growth_history: payload.growth_history || payload.nutritionHistory || [],
        services: payload.services || payload.servicesHistory || [],
        referrals: payload.referrals || [],
      });
    } catch {
      setDetailError('Failed to load clinical records for this child.');
    } finally {
      setDetailLoading(false);
    }
  };

  const openMother = async (mother) => {
    setSelectedMother(mother);
    setMotherDetail(null);
    setMotherDetailError('');
    setMotherActiveTab('services');
    setMotherDetailLoading(true);
    try {
      const response = await axiosClient.get(`/bhw/medical-records/mothers/${mother.mother_id}`);
      setMotherDetail(response.data || {});
    } catch {
      setMotherDetailError('Failed to load clinical records for this mother.');
    } finally {
      setMotherDetailLoading(false);
    }
  };

  const openAddInterventionModal = (type) => {
    setModalBeneficiaryType(type);
    setInterventionCategory('Medication');
    setServiceName('');
    setDosage('');
    setServiceDate(new Date().toISOString().slice(0, 10));
    setNextSchedule('');
    setInterventionNotes('');
    setModalError('');
    setShowAddModal(true);
  };

  const submitIntervention = async (e) => {
    e.preventDefault();
    if (!serviceName.trim()) {
      setModalError('Please enter the medication, supplement, or intervention name.');
      return;
    }

    setModalSubmitting(true);
    setModalError('');

    try {
      if (modalBeneficiaryType === 'child') {
        await axiosClient.post('/bhw/medical-records/child-services', {
          child_id: selectedChild.child_id,
          service_type: interventionCategory,
          service_name: serviceName.trim(),
          dosage: dosage.trim() || null,
          service_date: serviceDate,
          next_schedule: nextSchedule || null,
          notes: interventionNotes.trim() || null,
        });
        await openChild(selectedChild);
      } else {
        await axiosClient.post('/bhw/medical-records/mother-services', {
          mother_id: selectedMother.mother_id,
          service_type: interventionCategory,
          service_name: serviceName.trim(),
          dosage: dosage.trim() || null,
          service_date: serviceDate,
          next_schedule: nextSchedule || null,
          notes: interventionNotes.trim() || null,
        });
        await openMother(selectedMother);
      }
      setShowAddModal(false);
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to save medical intervention.');
    } finally {
      setModalSubmitting(false);
    }
  };

  // Prepare growth chart data
  const growthChartData = (detail?.growth_history || [])
    .map((g) => ({
      date: new Date(g.record_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      weight: Number(g.weight_kg) || 0,
      height: Number(g.height_cm) || 0,
      bmi: Number(g.bmi) || 0,
    }))
    .reverse();

  return (
    <div className="space-y-4">

      {/* ── Record Type Toggle & Action Bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl w-fit">
          <button
            type="button"
            onClick={() => { setRecordType('children'); setSelectedMother(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              recordType === 'children'
                ? 'bg-white text-[#2e7d32] shadow-sm'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Baby size={15} /> Children Records
          </button>
          <button
            type="button"
            onClick={() => { setRecordType('mothers'); setSelectedChild(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              recordType === 'mothers'
                ? 'bg-white text-[#2e7d32] shadow-sm'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Heart size={15} /> Lactating Mothers Records
          </button>
          <button
            type="button"
            onClick={() => { setRecordType('audit'); setSelectedChild(null); setSelectedMother(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              recordType === 'audit'
                ? 'bg-white text-[#2e7d32] shadow-sm'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <History size={15} /> Audit Trail
          </button>
        </div>


      </div>

      {/* ── CHILDREN VIEW ── */}
      {recordType === 'children' && (
        <>
          {childLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-10 h-10 rounded-full border-4 border-green-200 border-t-green-600 animate-spin" />
              <p className="text-sm font-medium text-gray-400">Loading medical records…</p>
            </div>
          ) : childError ? (
            <p className="text-red-600 p-6">{childError}</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

              {/* LEFT: Children Directory */}
              <div className={`lg:col-span-4 ${selectedChild ? 'hidden lg:block' : 'block'}`}>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col max-h-[82vh]">

                  <div className="p-4 border-b border-gray-100 space-y-3 bg-gray-50/50">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-gray-900">Registered Children</p>
                      <span className="text-xs font-bold bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                        {filteredChildren.length}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-gray-200 focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-100 transition">
                      <Search size={15} className="text-gray-400 shrink-0" />
                      <input
                        type="text"
                        placeholder="Search child or guardian…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="outline-none text-xs w-full bg-transparent text-gray-700 placeholder-gray-400"
                      />
                      {search && <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600"><X size={13} /></button>}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-gray-700 bg-white"
                      >
                        <option value="all">All Statuses</option>
                        <option value="normal">Normal</option>
                        <option value="MAM">MAM</option>
                        <option value="SAM">SAM</option>
                        <option value="underweight">Underweight</option>
                      </select>

                      {/* Age group filter — Item 33 (0-23, 0-24, 24-59) */}
                      <select
                        value={ageFilter}
                        onChange={(e) => setAgeFilter(e.target.value)}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-gray-700 bg-white"
                      >
                        <option value="all">All Ages</option>
                        <option value="0-23">0–23 mos</option>
                        <option value="0-24">0–24 mos</option>
                        <option value="24-59">24–59 mos</option>
                      </select>
                    </div>
                  </div>

                  <div className="overflow-y-auto divide-y divide-gray-50 flex-1">
                    {filteredChildren.length === 0 ? (
                      <div className="p-8 text-center text-gray-400 text-xs">No children found matching criteria.</div>
                    ) : (
                      filteredChildren.map((c) => {
                        const isSelected = selectedChild?.child_id === c.child_id;
                        return (
                          <button
                            key={c.child_id}
                            type="button"
                            onClick={() => openChild(c)}
                            className={`w-full text-left p-3.5 flex items-center gap-3 transition-colors ${
                              isSelected
                                ? 'bg-green-50/80 border-l-4 border-green-600'
                                : 'hover:bg-gray-50/70'
                            }`}
                          >
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white ${
                              isSelected
                                ? 'bg-linear-to-br from-[#1b5e20] to-[#2e7d32]'
                                : 'bg-gray-400'
                            }`}>
                              {(c.first_name ?? '?').charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-gray-900 truncate">{c.first_name} {c.last_name}</p>
                              <p className="text-[11px] text-gray-400 mt-0.5">
                                {c.age_in_months} mos · {c.sex ? c.sex.toUpperCase() : 'N/A'} · {c.guardian_name || 'No guardian'}
                              </p>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] shrink-0 ${statusColors[c.overall_status] || 'bg-gray-100 text-gray-700'}`}>
                              {c.overall_status || 'Normal'}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>

                </div>
              </div>

              {/* RIGHT: Medical Record Details */}
              <div className={`lg:col-span-8 ${selectedChild ? 'block' : 'hidden lg:block'}`}>
                {!selectedChild ? (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 text-center text-gray-400">
                    <FileText className="mx-auto mb-3 text-gray-300" size={36} />
                    <p className="text-sm font-semibold text-gray-700">Select a child from the directory</p>
                    <p className="text-xs text-gray-400 mt-1">View growth history, health assessments, and recorded interventions.</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

                    <div className="p-4 border-b border-gray-100 lg:hidden flex items-center">
                      <button
                        type="button"
                        onClick={() => setSelectedChild(null)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-green-700 hover:text-green-900"
                      >
                        <ArrowLeft size={14} /> Back to Directory
                      </button>
                    </div>

                    <div className="bg-linear-to-r from-[#1b5e20] to-[#2e7d32] p-6 text-white flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-white text-xl font-black shadow-sm">
                          {(selectedChild.first_name ?? '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h2 className="text-xl font-black">{selectedChild.first_name} {selectedChild.last_name}</h2>
                          <p className="text-xs text-white/80 mt-0.5">
                            {selectedChild.age_in_months} months old · {selectedChild.sex ? selectedChild.sex.toUpperCase() : 'N/A'} · Guardian: {selectedChild.guardian_name || '—'}
                          </p>
                          {selectedChild.guardian_contact && (
                            <p className="text-xs text-emerald-100/75 mt-0.5 flex items-center gap-1">
                              <Phone size={11} /> {selectedChild.guardian_contact}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openAddInterventionModal('child')}
                          className="bg-white hover:bg-gray-100 text-[#1b5e20] px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                        >
                          <PlusCircle size={15} /> Record Medication / Intervention
                        </button>
                        <span className="bg-white/20 text-white text-xs font-black px-3.5 py-1.5 rounded-full uppercase">
                          {selectedChild.overall_status || 'Normal'}
                        </span>
                      </div>
                    </div>

                    <div className="flex border-b border-gray-100 bg-gray-50/70 px-6 gap-2">
                      {[
                        { key: 'growth', label: `Growth History & BMI (${detail?.growth_history?.length || 0})` },
                        { key: 'services', label: `Medications & Interventions (${detail?.services?.length || 0})` },
                        { key: 'referrals', label: `Referral Logs (${detail?.referrals?.length || 0})` },
                      ].map((tab) => (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setActiveTab(tab.key)}
                          className={`text-xs font-bold py-3.5 px-3 border-b-2 transition-all ${
                            activeTab === tab.key
                              ? 'border-[#2e7d32] text-[#2e7d32]'
                              : 'border-transparent text-gray-500 hover:text-gray-800'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <div className="p-6">
                      {detailLoading ? (
                        <div className="py-16 text-center text-gray-400 text-xs">Loading records…</div>
                      ) : detailError ? (
                        <div className="p-4 bg-red-50 text-red-700 text-xs rounded-xl font-medium">{detailError}</div>
                      ) : (
                        <>
                          {activeTab === 'growth' && (
                            <div className="space-y-6">
                              {growthChartData.length > 1 && (
                                <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-100">
                                  <p className="text-xs font-bold text-gray-700 mb-3">Weight (kg) Progress Over Time</p>
                                  <div className="h-44 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                      <LineChart data={growthChartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                                        <Tooltip />
                                        <Line type="monotone" dataKey="weight" name="Weight (kg)" stroke="#2e7d32" strokeWidth={2.5} dot={{ r: 3 }} />
                                      </LineChart>
                                    </ResponsiveContainer>
                                  </div>
                                </div>
                              )}

                              {!detail?.growth_history || detail.growth_history.length === 0 ? (
                                <p className="text-xs text-gray-400 py-8 text-center">No growth records recorded yet.</p>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="text-left font-semibold text-gray-400 border-b border-gray-100 pb-2">
                                        <th className="py-2.5">Date</th>
                                        <th className="py-2.5">Age</th>
                                        <th className="py-2.5">Weight</th>
                                        <th className="py-2.5">Height</th>
                                        <th className="py-2.5">Computed BMI</th>
                                        <th className="py-2.5">BMI Status</th>
                                        <th className="py-2.5">WHO Status</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                      {detail.growth_history.map((g, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50/60">
                                          <td className="py-3 font-semibold text-gray-800">
                                            {new Date(g.record_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                          </td>
                                          <td className="py-3 text-gray-600">{g.age_in_months} mos</td>
                                          <td className="py-3 font-bold text-gray-800">{g.weight_kg} kg</td>
                                          <td className="py-3 text-gray-600">{g.height_cm ? `${g.height_cm} cm` : '—'}</td>
                                          <td className="py-3 font-semibold text-gray-800">
                                            {g.bmi != null ? `${Number(g.bmi).toFixed(2)} kg/m²` : (g.height_cm && g.weight_kg ? `${(g.weight_kg / Math.pow(g.height_cm/100, 2)).toFixed(2)} kg/m²` : '—')}
                                          </td>
                                          <td className="py-3">
                                            <span className="font-semibold text-gray-700 capitalize">
                                              {g.bmi_status || (g.bmi ? (g.bmi < 18.5 ? 'Underweight' : g.bmi < 25 ? 'Normal' : g.bmi < 30 ? 'Overweight' : 'Obese') : '—')}
                                            </span>
                                          </td>
                                          <td className="py-3">
                                            <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${statusColors[g.overall_status] || 'bg-gray-100 text-gray-700'}`}>
                                              {g.overall_status || 'Normal'}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          )}

                          {activeTab === 'services' && (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">Medications, Supplements & Interventions</p>
                                <button
                                  type="button"
                                  onClick={() => openAddInterventionModal('child')}
                                  className="text-xs font-bold text-[#1b5e20] hover:text-[#154a1a] flex items-center gap-1"
                                >
                                  <PlusCircle size={14} /> Add New Entry
                                </button>
                              </div>

                              {!detail?.services || detail.services.length === 0 ? (
                                <p className="text-xs text-gray-400 py-8 text-center">No medications, supplements, or interventions logged yet.</p>
                              ) : (
                                <div className="space-y-3">
                                  {detail.services.map((s, idx) => (
                                    <div key={idx} className="p-3.5 rounded-xl bg-gray-50/70 border border-gray-100 flex items-start justify-between gap-3">
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-bold text-gray-900">
                                            {s.service_name || s.service_type?.replace('_', ' ')}
                                          </span>
                                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase">
                                            {s.service_type || 'Intervention'}
                                          </span>
                                        </div>
                                        {s.dosage && (
                                          <p className="text-xs text-gray-600 mt-0.5 font-medium">Dosage: {s.dosage}</p>
                                        )}
                                        <p className="text-[11px] text-gray-500 mt-0.5">
                                          Given on {new Date(s.service_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} · Provider: {s.provided_by || 'BHW'}
                                        </p>
                                        {s.next_schedule && (
                                          <p className="text-[11px] text-amber-700 mt-0.5 flex items-center gap-1">
                                            <Calendar size={11} /> Next follow-up: {new Date(s.next_schedule).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                          </p>
                                        )}
                                        {s.notes && <p className="text-xs text-gray-600 mt-1 italic">&quot;{s.notes}&quot;</p>}
                                      </div>
                                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0">
                                        Recorded
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {activeTab === 'referrals' && (
                            <div>
                              {!detail?.referrals || detail.referrals.length === 0 ? (
                                <p className="text-xs text-gray-400 py-8 text-center">No referrals made for this child.</p>
                              ) : (
                                <div className="space-y-3">
                                  {detail.referrals.map((r, idx) => (
                                    <div key={idx} className="p-4 rounded-xl bg-gray-50/70 border border-gray-100">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${severityColors[r.severity] || 'bg-gray-100'}`}>
                                          {r.severity} Priority
                                        </span>
                                        <span className="text-[11px] text-gray-400">
                                          {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </span>
                                      </div>
                                      <p className="text-xs font-semibold text-gray-800">{r.reason}</p>
                                      {r.notes && <p className="text-xs text-gray-500 mt-1">Feedback: {r.notes}</p>}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                  </div>
                )}
              </div>

            </div>
          )}
        </>
      )}

      {/* ── MOTHERS VIEW ── */}
      {recordType === 'mothers' && (
        <>
          {motherLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-10 h-10 rounded-full border-4 border-green-200 border-t-green-600 animate-spin" />
              <p className="text-sm font-medium text-gray-400">Loading mothers records…</p>
            </div>
          ) : motherError ? (
            <p className="text-red-600 p-6">{motherError}</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

              {/* LEFT: Mothers Directory */}
              <div className={`lg:col-span-4 ${selectedMother ? 'hidden lg:block' : 'block'}`}>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col max-h-[82vh]">

                  <div className="p-4 border-b border-gray-100 space-y-3 bg-gray-50/50">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-gray-900">Registered Lactating Mothers</p>
                      <span className="text-xs font-bold bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full">
                        {filteredMothers.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-gray-200 focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-100 transition">
                      <Search size={15} className="text-gray-400 shrink-0" />
                      <input
                        type="text"
                        placeholder="Search by name, contact, or purok…"
                        value={motherSearch}
                        onChange={(e) => setMotherSearch(e.target.value)}
                        className="outline-none text-xs w-full bg-transparent text-gray-700 placeholder-gray-400"
                      />
                      {motherSearch && <button onClick={() => setMotherSearch('')} className="text-gray-400 hover:text-gray-600"><X size={13} /></button>}
                    </div>
                  </div>

                  <div className="overflow-y-auto divide-y divide-gray-50 flex-1">
                    {filteredMothers.length === 0 ? (
                      <div className="p-8 text-center text-gray-400 text-xs">No lactating mothers found.</div>
                    ) : (
                      filteredMothers.map((m) => {
                        const isSelected = selectedMother?.mother_id === m.mother_id;
                        return (
                          <button
                            key={m.mother_id}
                            type="button"
                            onClick={() => openMother(m)}
                            className={`w-full text-left p-3.5 flex items-center gap-3 transition-colors ${
                              isSelected
                                ? 'bg-teal-50/80 border-l-4 border-[#2e7d32]'
                                : 'hover:bg-gray-50/70'
                            }`}
                          >
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white ${
                              isSelected ? 'bg-linear-to-br from-[#1b5e20] to-[#2e7d32]' : 'bg-teal-600'
                            }`}>
                              {(m.first_name ?? '?').charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-gray-900 truncate">{m.first_name} {m.last_name}</p>
                              <p className="text-[11px] text-gray-400 mt-0.5">
                                {m.age_years != null ? `${m.age_years} yrs` : '—'} · {m.purok || 'Purok N/A'}
                              </p>
                            </div>
                            <span className="bg-teal-50 text-teal-700 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                              {m.child_count || 0} {m.child_count === 1 ? 'child' : 'children'}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>

                </div>
              </div>

              {/* RIGHT: Mother Details */}
              <div className={`lg:col-span-8 ${selectedMother ? 'block' : 'hidden lg:block'}`}>
                {!selectedMother ? (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 text-center text-gray-400">
                    <Heart className="mx-auto mb-3 text-gray-300" size={36} />
                    <p className="text-sm font-semibold text-gray-700">Select a mother from the directory</p>
                    <p className="text-xs text-gray-400 mt-1">Review medical history, medications, supplements, and counseling provided.</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

                    <div className="p-4 border-b border-gray-100 lg:hidden flex items-center">
                      <button
                        type="button"
                        onClick={() => setSelectedMother(null)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 hover:text-teal-900"
                      >
                        <ArrowLeft size={14} /> Back to Directory
                      </button>
                    </div>

                    <div className="bg-linear-to-r from-[#1b5e20] to-[#2e7d32] p-6 text-white flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-white text-xl font-black shadow-sm">
                          {(selectedMother.first_name ?? '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h2 className="text-xl font-black">{selectedMother.first_name} {selectedMother.last_name}</h2>
                          <p className="text-xs text-white/80 mt-0.5">
                            Lactating Mother · {selectedMother.age_years != null ? `${selectedMother.age_years} years old` : 'Age N/A'} · {selectedMother.purok || 'Purok N/A'} · {selectedMother.barangay}
                          </p>
                          {selectedMother.contact_number && (
                            <p className="text-xs text-emerald-100/80 mt-0.5 flex items-center gap-1">
                              <Phone size={11} /> {selectedMother.contact_number}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openAddInterventionModal('mother')}
                          className="bg-white hover:bg-gray-100 text-[#2e7d32] px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                        >
                          <PlusCircle size={15} /> Record Medication / Supplement
                        </button>
                        <span className="bg-white/20 text-white text-xs font-black px-3.5 py-1.5 rounded-full uppercase">
                          Active
                        </span>
                      </div>
                    </div>

                    <div className="flex border-b border-gray-100 bg-gray-50/70 px-6 gap-2">
                      {[
                        { key: 'services', label: `Medications & Supplements (${motherDetail?.servicesHistory?.length || 0})` },
                        { key: 'info', label: 'Personal Information' },
                        { key: 'referrals', label: `Referrals (${motherDetail?.referrals?.length || 0})` },
                      ].map((tab) => (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setMotherActiveTab(tab.key)}
                          className={`text-xs font-bold py-3.5 px-3 border-b-2 transition-all ${
                            motherActiveTab === tab.key
                              ? 'border-[#2e7d32] text-[#2e7d32]'
                              : 'border-transparent text-gray-500 hover:text-gray-800'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <div className="p-6">
                      {motherDetailLoading ? (
                        <div className="py-16 text-center text-gray-400 text-xs">Loading mother medical records…</div>
                      ) : motherDetailError ? (
                        <div className="p-4 bg-red-50 text-red-700 text-xs rounded-xl font-medium">{motherDetailError}</div>
                      ) : (
                        <>
                          {motherActiveTab === 'services' && (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">Recorded Medications, Supplements & Interventions</p>
                                <button
                                  type="button"
                                  onClick={() => openAddInterventionModal('mother')}
                                  className="text-xs font-bold text-[#2e7d32] hover:text-[#1b5e20] flex items-center gap-1"
                                >
                                  <PlusCircle size={14} /> Add New Entry
                                </button>
                              </div>

                              {!motherDetail?.servicesHistory || motherDetail.servicesHistory.length === 0 ? (
                                <p className="text-xs text-gray-400 py-8 text-center">No medications or supplements logged for this mother yet.</p>
                              ) : (
                                <div className="space-y-3">
                                  {motherDetail.servicesHistory.map((s, idx) => (
                                    <div key={idx} className="p-3.5 rounded-xl bg-gray-50/70 border border-gray-100 flex items-start justify-between gap-3">
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-bold text-gray-900">
                                            {s.service_name || s.service_type}
                                          </span>
                                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 uppercase">
                                            {s.service_type}
                                          </span>
                                        </div>
                                        {s.dosage && (
                                          <p className="text-xs text-gray-600 mt-0.5 font-medium">Dosage: {s.dosage}</p>
                                        )}
                                        <p className="text-[11px] text-gray-500 mt-0.5">
                                          Given on {new Date(s.service_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} · Provider: {s.provided_by || 'BHW'}
                                        </p>
                                        {s.next_schedule && (
                                          <p className="text-[11px] text-amber-700 mt-0.5 flex items-center gap-1">
                                            <Calendar size={11} /> Next follow-up: {new Date(s.next_schedule).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                          </p>
                                        )}
                                        {s.notes && <p className="text-xs text-gray-600 mt-1 italic">&quot;{s.notes}&quot;</p>}
                                      </div>
                                      <span className="bg-teal-100 text-teal-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0">
                                        Recorded
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {motherActiveTab === 'info' && (
                            <div className="space-y-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="bg-gray-50/70 rounded-xl p-4 border border-gray-100">
                                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Birth Date</p>
                                  <p className="text-sm font-bold text-gray-800">
                                    {selectedMother.birth_date
                                      ? new Date(selectedMother.birth_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                                      : '—'}
                                  </p>
                                </div>
                                <div className="bg-gray-50/70 rounded-xl p-4 border border-gray-100">
                                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Contact Number</p>
                                  <p className="text-sm font-bold text-gray-800">{selectedMother.contact_number || '—'}</p>
                                </div>
                                <div className="bg-gray-50/70 rounded-xl p-4 border border-gray-100">
                                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Purok / Address</p>
                                  <p className="text-sm font-bold text-gray-800">{selectedMother.purok || '—'}</p>
                                </div>
                                <div className="bg-gray-50/70 rounded-xl p-4 border border-gray-100">
                                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Barangay</p>
                                  <p className="text-sm font-bold text-gray-800">{selectedMother.barangay || '—'}</p>
                                </div>
                              </div>

                              {motherDetail?.children && motherDetail.children.length > 0 && (
                                <div className="bg-gray-50/70 rounded-xl p-4 border border-gray-100">
                                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Linked Children</p>
                                  <div className="divide-y divide-gray-100">
                                    {motherDetail.children.map((c) => (
                                      <div key={c.child_id} className="py-2 flex items-center justify-between text-xs">
                                        <span className="font-semibold text-gray-800">{c.first_name} {c.last_name}</span>
                                        <span className="text-gray-500">{c.age_in_months} mos old ({c.sex})</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {motherActiveTab === 'referrals' && (
                            <div>
                              {!motherDetail?.referrals || motherDetail.referrals.length === 0 ? (
                                <p className="text-xs text-gray-400 py-8 text-center">No referrals logged for this mother.</p>
                              ) : (
                                <div className="space-y-3">
                                  {motherDetail.referrals.map((r, idx) => (
                                    <div key={idx} className="p-4 rounded-xl bg-gray-50/70 border border-gray-100">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${severityColors[r.severity] || 'bg-gray-100'}`}>
                                          {r.severity} Priority
                                        </span>
                                        <span className="text-[11px] text-gray-400">
                                          {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </span>
                                      </div>
                                      <p className="text-xs font-semibold text-gray-800">{r.reason}</p>
                                      {r.notes && <p className="text-xs text-gray-500 mt-1">Notes: {r.notes}</p>}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                  </div>
                )}
              </div>

            </div>
          )}
        </>
      )}

      {/* ── AUDIT TRAIL VIEW ── */}
      {/* Module 4 Requirement: "The system shall maintain an audit trail to track all modifications made to medical records, including the user and timestamp." */}
      {recordType === 'audit' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div>
              <h3 className="font-bold text-base text-gray-900 flex items-center gap-2">
                <ShieldCheck className="text-[#2e7d32]" size={20} /> Medical Records Audit Trail
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Tracks all modifications and records logged by users with timestamps to ensure clinical integrity.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchAuditLogs}
              className="text-xs font-bold text-[#1b5e20] hover:text-[#154a1a] border border-gray-200 bg-white px-3 py-1.5 rounded-xl shadow-xs"
            >
              Refresh Logs
            </button>
          </div>

          <div className="p-6">
            {auditLoading ? (
              <div className="py-16 text-center text-gray-400 text-xs">Loading audit trail…</div>
            ) : auditError ? (
              <div className="p-4 bg-red-50 text-red-700 text-xs rounded-xl font-medium">{auditError}</div>
            ) : auditLogs.length === 0 ? (
              <div className="p-12 text-center text-gray-400 text-xs">No medical modifications recorded in the audit trail yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left font-semibold text-gray-400 border-b border-gray-100 pb-2">
                      <th className="py-2.5">Timestamp</th>
                      <th className="py-2.5">User</th>
                      <th className="py-2.5">Beneficiary</th>
                      <th className="py-2.5">Action</th>
                      <th className="py-2.5">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {auditLogs.map((log) => (
                      <tr key={log.audit_id} className="hover:bg-gray-50/60">
                        <td className="py-3 font-semibold text-gray-800 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-3 font-medium text-gray-700">
                          {log.modifier_name || `User #${log.modified_by}`}
                        </td>
                        <td className="py-3 font-semibold text-gray-800">
                          <span className="capitalize">{log.beneficiary_name || `${log.beneficiary_type} #${log.beneficiary_id}`}</span>
                          <span className="text-[10px] text-gray-400 block uppercase">{log.beneficiary_type}</span>
                        </td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            log.action === 'CREATE' ? 'bg-emerald-100 text-emerald-800' :
                            log.action === 'UPDATE' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 text-gray-600 max-w-md break-words">
                          {log.action_details || 'Medical record logged'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Add Medication / Supplement / Intervention Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-hidden" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="bg-linear-to-r from-[#1b5e20] to-[#2e7d32] px-6 py-5 flex items-center justify-between text-white">
              <div>
                <h3 className="font-bold text-base">Record Medical Intervention</h3>
                <p className="text-xs text-white/80 mt-0.5">
                  Beneficiary: {modalBeneficiaryType === 'child'
                    ? `${selectedChild?.first_name} ${selectedChild?.last_name} (Child)`
                    : `${selectedMother?.first_name} ${selectedMother?.last_name} (Lactating Mother)`}
                </p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={submitIntervention} className="p-6 space-y-3.5">
              {modalError && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200 font-medium">{modalError}</div>}

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Intervention Category *</label>
                <select
                  value={interventionCategory}
                  onChange={(e) => setInterventionCategory(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2e7d32]"
                >
                  <option value="Medication">Medication</option>
                  <option value="Supplement">Supplement (Vitamin A, Iron Folic Acid, Calcium, Deworming)</option>
                  <option value="Health Intervention">Health Intervention (Counseling, Checkup)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                  {interventionCategory === 'Medication' ? 'Medication Name *' : interventionCategory === 'Supplement' ? 'Supplement Name *' : 'Intervention Name *'}
                </label>
                <input
                  type="text"
                  placeholder={
                    interventionCategory === 'Medication' ? 'e.g., Amoxicillin, Paracetamol' :
                    interventionCategory === 'Supplement' ? 'e.g., Vitamin A 100,000 IU, Iron Folic Acid' :
                    'e.g., Exclusive Breastfeeding Counseling, Nutrition Advice'
                  }
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2e7d32]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Dosage / Frequency</label>
                <input
                  type="text"
                  placeholder="e.g., 1 capsule once daily, 5ml every 8 hours"
                  value={dosage}
                  onChange={(e) => setDosage(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2e7d32]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Date Administered *</label>
                  <input
                    type="date"
                    value={serviceDate}
                    onChange={(e) => setServiceDate(e.target.value)}
                    required
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2e7d32]"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Next Follow-up</label>
                  <input
                    type="date"
                    value={nextSchedule}
                    onChange={(e) => setNextSchedule(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2e7d32]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Clinical Notes & Observations</label>
                <textarea
                  rows={2}
                  placeholder="Additional instructions, patient response, counseling notes…"
                  value={interventionNotes}
                  onChange={(e) => setInterventionNotes(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2e7d32] resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting || !serviceName.trim()}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-linear-to-r from-[#1b5e20] to-[#2e7d32] hover:from-[#154a1a] hover:to-[#256427] disabled:opacity-60"
                >
                  {modalSubmitting ? 'Saving…' : 'Record Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add Beneficiary Modal (Item 25 & 36) ── */}
      {showAddBeneficiaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col my-8">
            <div className="bg-linear-to-r from-[#1b5e20] to-[#2e7d32] px-6 py-4 flex items-center justify-between text-white shrink-0">
              <div className="flex items-center gap-2">
                <PlusCircle size={20} />
                <div>
                  <h3 className="text-base font-bold">Register New Beneficiary</h3>
                  <p className="text-xs text-white/80">Add child or mother to barangay masterlist</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddBeneficiaryModal(false)}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                // Call handlesubmit default
                const bDate = newBirthDate ? new Date(newBirthDate) : null;
                const now = new Date();
                if (beneficiaryType === 'child' && bDate) {
                  let ageMonths = (now.getFullYear() - bDate.getFullYear()) * 12 + (now.getMonth() - bDate.getMonth());
                  if (now.getDate() < bDate.getDate()) ageMonths--;
                  if (ageMonths < 0 || ageMonths > 59) {
                    setAddBeneficiaryError('Child age must be between 0 and 59 months (under 5 years old).');
                    return;
                  }
                }
                setAddBeneficiaryError('');
                setAddBeneficiarySubmitting(true);
                const endpoint = beneficiaryType === 'child' ? '/mobile/children' : '/mobile/mothers';
                const payload = beneficiaryType === 'child' ? {
                  first_name: newFirstName,
                  middle_initial: newMiddleInitial || null,
                  last_name: newLastName,
                  birth_date: newBirthDate,
                  sex: newSex,
                  guardian_name: newGuardianName,
                  guardian_contact: newGuardianContact,
                  barangay: newBarangay || user.barangay,
                  purok: newPurok || null,
                } : {
                  first_name: newFirstName,
                  middle_initial: newMiddleInitial || null,
                  last_name: newLastName,
                  contact_number: newGuardianContact,
                  barangay: newBarangay || user.barangay,
                  purok: newPurok || null,
                };
                axiosClient.post(endpoint, payload)
                  .then(() => {
                    setAddBeneficiarySuccess(`Successfully registered ${newFirstName} ${newLastName}!`);
                    if (beneficiaryType === 'child') fetchChildren(); else fetchMothers();
                    setNewFirstName(''); setNewMiddleInitial(''); setNewLastName(''); setNewBirthDate(''); setNewGuardianName(''); setNewGuardianContact(''); setNewPurok('');
                  })
                  .catch((err) => setAddBeneficiaryError(err.response?.data?.message || 'Failed to register beneficiary.'))
                  .finally(() => setAddBeneficiarySubmitting(false));
              }}
              className="p-6 space-y-4 max-h-[80vh] overflow-y-auto"
            >
              {addBeneficiaryError && (
                <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200 font-medium flex items-center gap-2">
                  <X size={16} className="shrink-0 text-red-500" />
                  <span>{addBeneficiaryError}</span>
                </div>
              )}
              {addBeneficiarySuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 text-xs border border-emerald-200 font-medium flex items-center gap-2">
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                  <span>{addBeneficiarySuccess}</span>
                </div>
              )}

              {/* Beneficiary Type Selector */}
              <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setBeneficiaryType('child')}
                  className={`py-2 text-xs font-bold rounded-lg transition ${beneficiaryType === 'child' ? 'bg-white text-green-900 shadow-xs' : 'text-gray-600'}`}
                >
                  Child (0–59 Months)
                </button>
                <button
                  type="button"
                  onClick={() => setBeneficiaryType('mother')}
                  className={`py-2 text-xs font-bold rounded-lg transition ${beneficiaryType === 'mother' ? 'bg-white text-green-900 shadow-xs' : 'text-gray-600'}`}
                >
                  Lactating Mother
                </button>
              </div>

              {/* Names */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="text-[11px] font-bold text-gray-500 uppercase block mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-green-600"
                    placeholder="First Name"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase block mb-1">M.I.</label>
                  <input
                    type="text"
                    maxLength={2}
                    value={newMiddleInitial}
                    onChange={(e) => setNewMiddleInitial(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-green-600 text-center"
                    placeholder="M"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase block mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-green-600"
                    placeholder="Last Name"
                  />
                </div>
              </div>

              {beneficiaryType === 'child' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-gray-500 uppercase block mb-1">Birth Date (0-59 mos) *</label>
                    <input
                      type="date"
                      required
                      value={newBirthDate}
                      onChange={(e) => setNewBirthDate(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-green-600"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-500 uppercase block mb-1">Sex *</label>
                    <select
                      value={newSex}
                      onChange={(e) => setNewSex(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-green-600"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase block mb-1">
                    {beneficiaryType === 'child' ? 'Guardian Name' : 'Contact Number'}
                  </label>
                  <input
                    type="text"
                    value={beneficiaryType === 'child' ? newGuardianName : newGuardianContact}
                    onChange={(e) => beneficiaryType === 'child' ? setNewGuardianName(e.target.value) : setNewGuardianContact(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-green-600"
                    placeholder={beneficiaryType === 'child' ? 'Mother/Father Name' : '09123456789'}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase block mb-1">Purok / Zone</label>
                  <input
                    type="text"
                    value={newPurok}
                    onChange={(e) => setNewPurok(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-green-600"
                    placeholder="Purok 1"
                  />
                </div>
              </div>

              {/* Action Buttons: Includes "Save & Add Another" so user is NOT kicked out to home (Item 25) */}
              <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddBeneficiaryModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={addBeneficiarySubmitting || !newFirstName || !newLastName}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-linear-to-r from-[#1b5e20] to-[#2e7d32] hover:opacity-95 disabled:opacity-50 cursor-pointer"
                >
                  {addBeneficiarySubmitting ? 'Saving…' : 'Save & Add Another'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Official Report Preview Modal (Item 30 & 34) */}
      <ReportPreviewModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        reportData={reportData}
        title={`BHW ${recordType === 'mothers' ? 'Lactating Mothers' : 'Child Nutrition & Health'} Report`}
        barangay={user.barangay || 'Community'}
      />

    </div>
  );
}

export default MedicalRecords;