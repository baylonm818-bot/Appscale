import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import axiosClient from '../api/axiosClient';
import { useQuery } from '@tanstack/react-query';
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
  Plus,
  Download,
  Utensils,
  FileSpreadsheet,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { CountUp, ShimmerSkeleton, modalVariants, backdropVariants } from '../components/ui/motion';
import FormLabel, { FormRequiredNote, sanitizeContact, validateContact } from '../components/ui/FormLabel';
import { capitalizeWords, formatChildAge, COMMON_DISABILITIES } from '../utils/i18n';

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
  const [newDisability, setNewDisability] = useState('None');
  const [motherBirthDate, setMotherBirthDate] = useState('');
  const [purokOptions, setPurokOptions] = useState([]);
  const [purokFilter, setPurokFilter] = useState('all');
  const [addBeneficiarySubmitting, setAddBeneficiarySubmitting] = useState(false);
  const [addBeneficiaryError, setAddBeneficiaryError] = useState('');
  const [addBeneficiarySuccess, setAddBeneficiarySuccess] = useState('');
  const [addBeneficiaryErrors, setAddBeneficiaryErrors] = useState({});
  const [interventionErrors, setInterventionErrors] = useState({});

  // Dynamic purok loader based on barangay
  useEffect(() => {
    const targetBrgy = newBarangay || user.barangay || 'Antipolo';
    axiosClient.get(`/puroks?barangay=${encodeURIComponent(targetBrgy)}`)
      .then((res) => {
        const list = res.data || [];
        setPurokOptions(list);
        if (list.length > 0) {
          setNewPurok(list[0].name);
        }
      })
      .catch((err) => {
        console.warn('Could not load puroks for barangay:', err);
      });
  }, [newBarangay, user.barangay]);

  // ── Children state ──
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [ageFilter, setAgeFilter] = useState('all');
  const [selectedChild, setSelectedChild] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [activeTab, setActiveTab] = useState('growth');

  // ── Mothers state ──
  const [motherSearch, setMotherSearch] = useState('');
  const [selectedMother, setSelectedMother] = useState(null);
  const [motherDetail, setMotherDetail] = useState(null);
  const [motherDetailLoading, setMotherDetailLoading] = useState(false);
  const [motherDetailError, setMotherDetailError] = useState('');
  const [motherActiveTab, setMotherActiveTab] = useState('services');

  // ── Audit Trail state ──

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

  const {
    data: childrenData,
    isLoading: childLoading,
    error: childQueryError,
    refetch: refetchChildren,
  } = useQuery({
    queryKey: ['medical-records', user.barangay || ''],
    queryFn: async () => {
      const res = await axiosClient.get('/bhw/medical-records', { params: { barangay: user.barangay } });
      return res.data || [];
    },
    enabled: recordType === 'children',
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 2,
  });
  const children = useMemo(() => (Array.isArray(childrenData) ? childrenData : []), [childrenData]);
  const childError = childQueryError ? (childQueryError.response?.data?.message || 'Failed to load registered children.') : '';

  useEffect(() => {
    if (children && children.length > 0 && window.innerWidth >= 1024 && !selectedChild) {
      openChild(children[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children]);

  const { data: mothersData, isLoading: motherLoading, error: motherQueryError, refetch: _refetchMothers } = useQuery({
    queryKey: ['medical-records-mothers', user.barangay || ''],
    queryFn: async () => {
      const res = await axiosClient.get('/bhw/medical-records/mothers', { params: { barangay: user.barangay } });
      return res.data || [];
    },
    enabled: recordType === 'mothers',
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 2,
  });
  const mothers = useMemo(() => (Array.isArray(mothersData) ? mothersData : []), [mothersData]);
  const motherError = motherQueryError ? (motherQueryError.response?.data?.message || 'Failed to load registered mothers.') : '';

  useEffect(() => {
    if (mothers && mothers.length > 0 && window.innerWidth >= 1024 && !selectedMother) {
      openMother(mothers[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mothers]);

  const normalizePurok = (raw) => {
    if (!raw) return '';
    const trimmed = raw.trim();
    if (!trimmed) return '';
    const lower = trimmed.toLowerCase();
    if (['uni', 'uno', 'isa'].includes(lower)) return 'Purok 1';
    if (['dos', 'dalawa'].includes(lower)) return 'Purok 2';
    if (['tres', 'tatlo'].includes(lower)) return 'Purok 3';
    if (['cuatro', 'kwatro', 'apat'].includes(lower)) return 'Purok 4';
    if (['cinco', 'singko', 'lima'].includes(lower)) return 'Purok 5';
    if (['seis', 'anim'].includes(lower)) return 'Purok 6';
    if (['siete', 'syete', 'pito'].includes(lower)) return 'Purok 7';
    if (['ocho', 'otso', 'walo'].includes(lower)) return 'Purok 8';
    if (/^\d+$/.test(lower)) return `Purok ${lower}`;
    const numMatch = trimmed.match(/^(?:purok|prk\.?)\s*[-#]?\s*(\d+)$/i);
    if (numMatch) return `Purok ${numMatch[1]}`;
    const toTitle = (s) => s.split(/\s+/).filter(Boolean).map(w => /^(?:[ivxlcdm]+)$/i.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    const namedMatch = trimmed.match(/^(?:purok|prk\.?)\s*[-#]?\s*(.+)$/i);
    if (namedMatch) return `Purok ${toTitle(namedMatch[1])}`;
    return toTitle(trimmed);
  };

  const existingPuroks = useMemo(() => {
    const set = new Set();
    if (Array.isArray(childrenData)) {
      childrenData.forEach(c => {
        const norm = normalizePurok(c.purok);
        if (norm) set.add(norm);
      });
    }
    if (Array.isArray(mothersData)) {
      mothersData.forEach(m => {
        const norm = normalizePurok(m.purok);
        if (norm) set.add(norm);
      });
    }
    return Array.from(set).sort();
  }, [childrenData, mothersData]);

  const { data: auditData, isLoading: auditLoading, error: auditQueryError, refetch: _refetchAudit } = useQuery({
    queryKey: ['medical-records-audit'],
    queryFn: async () => {
      const res = await axiosClient.get('/bhw/medical-records/audit-trail');
      return res.data || [];
    },
    enabled: recordType === 'audit',
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 2,
  });
  const auditLogs = useMemo(() => (Array.isArray(auditData) ? auditData : []), [auditData]);
  const auditError = auditQueryError ? (auditQueryError.response?.data?.message || 'Failed to load audit trail.') : '';

  const filteredChildren = useMemo(() => {
    let list = [...children];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) =>
        `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase().includes(q) ||
        (c.guardian_name || '').toLowerCase().includes(q) ||
        (c.purok || '').toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') {
      list = list.filter((c) => c.overall_status === statusFilter);
    }
    if (purokFilter !== 'all') {
      list = list.filter((c) => normalizePurok(c.purok) === normalizePurok(purokFilter));
    }
    if (ageFilter !== 'all') {
      list = list.filter((c) => {
        if (ageFilter === '6-59') return c.age_in_months >= 6 && c.age_in_months <= 59;
        if (ageFilter === '0-23') return c.age_in_months >= 0 && c.age_in_months <= 23;
        if (ageFilter === '24-59') return c.age_in_months >= 24 && c.age_in_months <= 59;
        return true;
      });
    }
    return list;
  }, [children, search, statusFilter, purokFilter, ageFilter]);

  const exportChildrenList = () => {
    if (!filteredChildren || filteredChildren.length === 0) return;
    const headers = ['Child ID', 'First Name', 'Last Name', 'Sex', 'Age (Months)', 'Birth Date', 'Guardian Name', 'Guardian Contact', 'Barangay', 'Purok', 'Disability', 'Nutritional Status', 'Last Visit'];
    const rows = filteredChildren.map(c => [
      c.child_id,
      `"${c.first_name || ''}"`,
      `"${c.last_name || ''}"`,
      c.sex || '',
      c.age_in_months || 0,
      c.birth_date ? c.birth_date.slice(0, 10) : '',
      `"${c.guardian_name || ''}"`,
      `"${c.guardian_contact || ''}"`,
      `"${c.barangay || ''}"`,
      `"${c.purok || ''}"`,
      `"${c.disability || 'None'}"`,
      `"${c.overall_status || 'normal'}"`,
      c.last_visit ? c.last_visit.slice(0, 10) : '',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Children_Masterlist_${user.barangay || 'All'}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
        feeding_history: payload.feeding_history || payload.feedingHistory || [],
        feeding_effectiveness: payload.feeding_effectiveness || payload.feedingEffectiveness || null,
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
    setInterventionErrors({});
    setShowAddModal(true);
  };

  const submitIntervention = async (e) => {
    e.preventDefault();
    setModalError('');

    const errs = {};
    if (!serviceName.trim()) errs.serviceName = 'This field is required';
    if (!serviceDate) errs.serviceDate = 'This field is required';

    if (Object.keys(errs).length > 0) {
      setInterventionErrors(errs);
      return;
    }

    setInterventionErrors({});
    setModalSubmitting(true);

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
    <main role="main" aria-label="Medical Records" className="space-y-4 bg-gray-50 min-h-screen p-6">

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
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-4 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
                <ShimmerSkeleton className="h-9 rounded-xl w-full" />
                {[1, 2, 3, 4, 5].map((i) => (
                  <ShimmerSkeleton key={i} className="h-16 rounded-xl w-full" />
                ))}
              </div>
              <div className="lg:col-span-8 bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
                <ShimmerSkeleton className="h-8 rounded-xl w-1/3" />
                <ShimmerSkeleton className="h-64 rounded-xl w-full" />
              </div>
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
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-gray-900">Registered Children</p>
                        <span className="text-xs font-bold bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                          <CountUp value={filteredChildren.length} />
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={exportChildrenList}
                        disabled={filteredChildren.length === 0}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-[#1b5e20] bg-white border border-green-200 hover:bg-green-50 shadow-2xs transition disabled:opacity-50 cursor-pointer"
                        title="Export filtered list to Excel/CSV"
                      >
                        <Download size={13} />
                        <span>Export</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-gray-200 focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-100 transition">
                      <Search size={15} className="text-gray-400 shrink-0" />
                      <input
                        type="text"
                        placeholder="Search child, guardian, or purok…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="outline-none text-xs w-full bg-transparent text-gray-700 placeholder-gray-400"
                      />
                      {search && <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600"><X size={13} /></button>}
                    </div>

                    <div className="grid grid-cols-3 gap-1.5">
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-gray-700 bg-white"
                      >
                        <option value="all">All Status</option>
                        <option value="normal">Normal</option>
                        <option value="MAM">MAM</option>
                        <option value="SAM">SAM</option>
                        <option value="underweight">Underweight</option>
                      </select>

                      {/* Age group filter — with 6-59 mos */}
                      <select
                        value={ageFilter}
                        onChange={(e) => setAgeFilter(e.target.value)}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-gray-700 bg-white"
                      >
                        <option value="all">All Ages</option>
                        <option value="6-59">6–59 mos</option>
                        <option value="0-23">0–23 mos</option>
                        <option value="24-59">24–59 mos</option>
                      </select>

                      {/* Purok filter */}
                      <select
                        value={purokFilter}
                        onChange={(e) => setPurokFilter(e.target.value)}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-gray-700 bg-white"
                      >
                        <option value="all">All Puroks</option>
                        {existingPuroks.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
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
                            className={`w-full text-left p-3.5 flex items-center gap-3 transition-all duration-150 cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-50/90 border-l-4 border-emerald-600 shadow-2xs'
                                : 'hover:bg-slate-50/90 border-l-4 border-transparent'
                            }`}
                          >
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white transition-transform duration-200 ${
                              isSelected
                                ? 'bg-linear-to-br from-[#1b5e20] to-[#2e7d32] scale-105 shadow-sm'
                                : 'bg-gray-400'
                            }`}>
                              {(c.first_name ?? '?').charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className={`text-xs font-bold truncate transition-colors ${isSelected ? 'text-emerald-950' : 'text-gray-900'}`}>{c.first_name} {c.last_name}</p>
                              <p className="text-[11px] text-gray-400 mt-0.5">
                                {formatChildAge(c.birth_date, Boolean(user.age_format_days), c.age_in_months, user.language || 'en')} · {c.sex ? c.sex.toUpperCase() : 'N/A'}{c.purok ? ` · ${c.purok}` : ''}
                              </p>
                              {c.disability && c.disability !== 'None' && (
                                <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 rounded px-1.5 py-0.5 mt-1 inline-block">
                                  {c.disability}
                                </span>
                              )}
                            </div>
                            <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] shrink-0 transition-colors ${statusColors[c.overall_status] || 'bg-gray-100 text-gray-700'}`}>
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
                  <motion.div
                    key={selectedChild.child_id}
                    initial={{ opacity: 0, y: 12, scale: 0.995 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
                  >

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
                            {formatChildAge(selectedChild.birth_date, Boolean(user.age_format_days), selectedChild.age_in_months, user.language || 'en')} · {selectedChild.sex ? selectedChild.sex.toUpperCase() : 'N/A'}{selectedChild.purok ? ` · ${selectedChild.purok}` : ''}{selectedChild.barangay ? `, ${selectedChild.barangay}` : ''}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-xs text-emerald-100/90">
                              Guardian: {selectedChild.guardian_name || '—'} {selectedChild.guardian_contact ? `(${selectedChild.guardian_contact})` : ''}
                            </span>
                            <span className="text-[10px] font-semibold bg-white/20 px-2 py-0.5 rounded-full text-white">
                              Disability: {selectedChild.disability || 'None'}
                            </span>
                          </div>
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

                    <div className="flex border-b border-gray-100 bg-gray-50/70 px-6 gap-2 overflow-x-auto">
                      {[
                        { key: 'growth', label: `Growth History & BMI (${detail?.growth_history?.length || 0})` },
                        { key: 'services', label: `Medications & Interventions (${detail?.services?.length || 0})` },
                        { key: 'feeding', label: `Feeding History (${detail?.feeding_history?.length || 0})` },
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
                        <div className="space-y-4 animate-pulse">
                          <div className="h-44 bg-gray-100 rounded-xl" />
                          <div className="h-24 bg-gray-100 rounded-xl" />
                        </div>
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

                          {activeTab === 'feeding' && (
                            <div className="space-y-5">
                              {/* Effectiveness Summary Card */}
                              {detail?.feeding_effectiveness ? (
                                <div className="p-4 rounded-2xl bg-linear-to-br from-emerald-50/80 to-teal-50/50 border border-emerald-200/70 shadow-2xs">
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                      <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                                        <Utensils size={14} />
                                      </div>
                                      <p className="text-xs font-bold text-emerald-950">Feeding Program Effectiveness</p>
                                    </div>
                                    <span className={`text-[11px] font-black px-2.5 py-1 rounded-full uppercase ${
                                      detail.feeding_effectiveness.is_effective
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-amber-500 text-white'
                                    }`}>
                                      {detail.feeding_effectiveness.outcome}
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                                    <div className="bg-white/90 p-3 rounded-xl border border-emerald-100">
                                      <p className="text-[10px] font-bold text-gray-400 uppercase">Baseline / Initial</p>
                                      <p className="text-xs font-bold text-gray-800 mt-0.5">{detail.feeding_effectiveness.initial_weight} kg · {detail.feeding_effectiveness.initial_status}</p>
                                      <p className="text-[10px] text-gray-400">{detail.feeding_effectiveness.initial_date ? new Date(detail.feeding_effectiveness.initial_date).toLocaleDateString() : '—'}</p>
                                    </div>
                                    <div className="bg-white/90 p-3 rounded-xl border border-emerald-100">
                                      <p className="text-[10px] font-bold text-gray-400 uppercase">Latest Assessment</p>
                                      <p className="text-xs font-bold text-gray-800 mt-0.5">{detail.feeding_effectiveness.latest_weight} kg · {detail.feeding_effectiveness.latest_status}</p>
                                      <p className="text-[10px] text-gray-400">{detail.feeding_effectiveness.latest_date ? new Date(detail.feeding_effectiveness.latest_date).toLocaleDateString() : '—'}</p>
                                    </div>
                                    <div className="bg-white/90 p-3 rounded-xl border border-emerald-100">
                                      <p className="text-[10px] font-bold text-gray-400 uppercase">Weight Progression</p>
                                      <p className={`text-xs font-bold mt-0.5 ${detail.feeding_effectiveness.weight_diff >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                                        {detail.feeding_effectiveness.weight_diff > 0 ? `+${detail.feeding_effectiveness.weight_diff}` : detail.feeding_effectiveness.weight_diff} kg net change
                                      </p>
                                      <p className="text-[10px] text-gray-500 font-medium">Progress over monitoring period</p>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-500 text-center">
                                  Initial assessment comparison will appear as clinical measurements are recorded.
                                </div>
                              )}

                              {/* Feeding Attendance & Meals Log */}
                              <div>
                                <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">Meal Attendance & Consumption History</p>
                                {!detail?.feeding_history || detail.feeding_history.length === 0 ? (
                                  <p className="text-xs text-gray-400 py-8 text-center bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                                    No feeding attendance sessions recorded for this child yet.
                                  </p>
                                ) : (
                                  <div className="overflow-x-auto rounded-xl border border-gray-100">
                                    <table className="w-full text-xs">
                                      <thead className="bg-gray-50/80 text-gray-600 font-bold border-b border-gray-100">
                                        <tr>
                                          <th className="py-2.5 px-3 text-left">Date</th>
                                          <th className="py-2.5 px-3 text-left">Food / Meal Served</th>
                                          <th className="py-2.5 px-3 text-center">Calories</th>
                                          <th className="py-2.5 px-3 text-center">Status</th>
                                          <th className="py-2.5 px-3 text-left">Remarks & Observation</th>
                                          <th className="py-2.5 px-3 text-center">Mother Signature</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100 bg-white">
                                        {detail.feeding_history.map((f, fIdx) => (
                                          <tr key={f.attendance_id || fIdx} className="hover:bg-gray-50/60">
                                            <td className="py-2.5 px-3 font-semibold text-gray-800 whitespace-nowrap">
                                              {new Date(f.attendance_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </td>
                                            <td className="py-2.5 px-3 font-medium text-gray-800">
                                              {f.meal_description || 'Standard Supplemental Meal'}
                                            </td>
                                            <td className="py-2.5 px-3 text-center text-gray-600">
                                              {f.calories ? `${f.calories} kcal` : '—'}
                                            </td>
                                            <td className="py-2.5 px-3 text-center">
                                              <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                                                f.status === 'present' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                                              }`}>
                                                {f.status || 'present'}
                                              </span>
                                            </td>
                                            <td className="py-2.5 px-3 text-gray-600 italic">
                                              {f.remarks || '—'}
                                            </td>
                                            <td className="py-2.5 px-3 text-center">
                                              {f.signature ? (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                                  <CheckCircle2 size={11} /> Verified Signed
                                                </span>
                                              ) : (
                                                <span className="text-[10px] text-gray-400">Not captured</span>
                                              )}
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

                  </motion.div>
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
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-4 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
                <ShimmerSkeleton className="h-9 rounded-xl w-full" />
                {[1, 2, 3, 4, 5].map((i) => (
                  <ShimmerSkeleton key={i} className="h-16 rounded-xl w-full" />
                ))}
              </div>
              <div className="lg:col-span-8 bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
                <ShimmerSkeleton className="h-8 rounded-xl w-1/3" />
                <ShimmerSkeleton className="h-64 rounded-xl w-full" />
              </div>
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
                        <CountUp value={filteredMothers.length} />
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
                            className={`w-full text-left p-3.5 flex items-center gap-3 transition-all duration-150 cursor-pointer ${
                              isSelected
                                ? 'bg-teal-50/90 border-l-4 border-[#2e7d32] shadow-2xs'
                                : 'hover:bg-slate-50/90 border-l-4 border-transparent'
                            }`}
                          >
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white transition-transform duration-200 ${
                              isSelected ? 'bg-linear-to-br from-[#1b5e20] to-[#2e7d32] scale-105 shadow-sm' : 'bg-teal-600'
                            }`}>
                              {(m.first_name ?? '?').charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className={`text-xs font-bold truncate transition-colors ${isSelected ? 'text-emerald-950' : 'text-gray-900'}`}>{m.first_name} {m.last_name}</p>
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
                  <motion.div
                    key={selectedMother.mother_id}
                    initial={{ opacity: 0, y: 12, scale: 0.995 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
                  >

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
                        <div className="space-y-4 animate-pulse">
                          <div className="h-44 bg-gray-100 rounded-xl" />
                          <div className="h-24 bg-gray-100 rounded-xl" />
                        </div>
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

                  </motion.div>
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
              onClick={() => _refetchAudit()}
              className="text-xs font-bold text-[#1b5e20] hover:text-[#154a1a] border border-gray-200 bg-white px-3 py-1.5 rounded-xl shadow-xs"
            >
              Refresh Logs
            </button>
          </div>

          <div className="p-6">
            {auditLoading ? (
              <div className="space-y-3 animate-pulse">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-10 bg-gray-100 rounded-lg" />
                ))}
              </div>
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
                        <td className="py-3 text-gray-600 max-w-md wrap-break-word">
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
      {showAddModal && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-9999 p-4 overflow-hidden" onClick={() => setShowAddModal(false)}>
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

            <form onSubmit={submitIntervention} noValidate className="p-6 space-y-3.5 overflow-y-auto flex-1">
              {modalError && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200 font-medium">{modalError}</div>}
              <FormRequiredNote />

              <div>
                <FormLabel label="Intervention Category" required />
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
                <FormLabel
                  label={interventionCategory === 'Medication' ? 'Medication Name' : interventionCategory === 'Supplement' ? 'Supplement Name' : 'Intervention Name'}
                  required
                />
                <input
                  name="serviceName"
                  type="text"
                  placeholder={
                    interventionCategory === 'Medication' ? 'e.g., Amoxicillin, Paracetamol' :
                    interventionCategory === 'Supplement' ? 'e.g., Vitamin A 100,000 IU, Iron Folic Acid' :
                    'e.g., Exclusive Breastfeeding Counseling, Nutrition Advice'
                  }
                  value={serviceName}
                  onChange={(e) => {
                    setServiceName(e.target.value);
                    if (interventionErrors.serviceName) setInterventionErrors((prev) => ({ ...prev, serviceName: '' }));
                  }}
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none transition ${
                    interventionErrors.serviceName ? 'border-[#D32F2F] ring-1 ring-[#D32F2F] focus:border-[#D32F2F]' : 'border-gray-200 focus:border-[#2e7d32]'
                  }`}
                />
                {interventionErrors.serviceName && <p className="text-xs text-[#D32F2F] mt-1">{interventionErrors.serviceName}</p>}
              </div>

              <div>
                <FormLabel label="Dosage / Frequency" />
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
                  <FormLabel label="Date Administered" required />
                  <input
                    name="serviceDate"
                    type="date"
                    value={serviceDate}
                    onChange={(e) => {
                      setServiceDate(e.target.value);
                      if (interventionErrors.serviceDate) setInterventionErrors((prev) => ({ ...prev, serviceDate: '' }));
                    }}
                    className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none transition ${
                      interventionErrors.serviceDate ? 'border-[#D32F2F] ring-1 ring-[#D32F2F] focus:border-[#D32F2F]' : 'border-gray-200 focus:border-[#2e7d32]'
                    }`}
                  />
                  {interventionErrors.serviceDate && <p className="text-xs text-[#D32F2F] mt-1">{interventionErrors.serviceDate}</p>}
                </div>
                <div>
                  <FormLabel label="Next Follow-up" />
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

            </form>
            <div className="p-4 border-t border-gray-100 bg-white flex gap-3 pt-2 sticky bottom-0">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={modalSubmitting || !serviceName.trim()}
                onClick={submitIntervention}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-linear-to-r from-[#1b5e20] to-[#2e7d32] hover:from-[#154a1a] hover:to-[#256427] disabled:opacity-60"
              >
                {modalSubmitting ? 'Saving…' : 'Record Entry'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Add Beneficiary Modal (Item 25 & 36) ── */}
      {showAddBeneficiaryModal && createPortal(
        <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
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
                setAddBeneficiaryError('');
                setAddBeneficiarySuccess('');

                const errs = {};
                if (!newFirstName.trim()) errs.first_name = 'This field is required';
                if (!newLastName.trim()) errs.last_name = 'This field is required';

                if (beneficiaryType === 'child') {
                  if (!newBirthDate) errs.birth_date = 'Birthday is required';
                  if (!newSex) errs.sex = 'This field is required';
                  if (!newGuardianContact.trim()) {
                    errs.contact_number = 'Contact number is required';
                  } else {
                    const contactErr = validateContact(newGuardianContact, true);
                    if (contactErr) errs.contact_number = contactErr;
                  }
                } else {
                  if (!motherBirthDate) errs.mother_birth_date = 'Birthday is required';
                  if (!newGuardianContact.trim()) {
                    errs.contact_number = 'Contact number is required';
                  } else {
                    const contactErr = validateContact(newGuardianContact, true);
                    if (contactErr) errs.contact_number = contactErr;
                  }
                }

                if (Object.keys(errs).length > 0) {
                  setAddBeneficiaryErrors(errs);
                  const firstInvalid = Object.keys(errs)[0];
                  setTimeout(() => {
                    const el = document.querySelector(`[name="${firstInvalid}"]`);
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      el.focus();
                    }
                  }, 50);
                  return;
                }

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

                setAddBeneficiaryErrors({});
                setAddBeneficiarySubmitting(true);
                const endpoint = beneficiaryType === 'child' ? '/mobile/children' : '/mobile/mothers';
                const payload = beneficiaryType === 'child' ? {
                  first_name: capitalizeWords(newFirstName.trim()),
                  middle_initial: newMiddleInitial ? newMiddleInitial.trim().toUpperCase() : null,
                  last_name: capitalizeWords(newLastName.trim()),
                  birth_date: newBirthDate,
                  sex: newSex,
                  guardian_name: newGuardianName.trim() ? capitalizeWords(newGuardianName.trim()) : null,
                  guardian_contact: newGuardianContact.trim(),
                  barangay: newBarangay || user.barangay,
                  purok: newPurok ? capitalizeWords(newPurok.trim()) : null,
                  disability: newDisability || 'None',
                } : {
                  first_name: capitalizeWords(newFirstName.trim()),
                  middle_initial: newMiddleInitial ? newMiddleInitial.trim().toUpperCase() : null,
                  last_name: capitalizeWords(newLastName.trim()),
                  birth_date: motherBirthDate,
                  contact_number: newGuardianContact.trim(),
                  barangay: newBarangay || user.barangay,
                  purok: newPurok ? capitalizeWords(newPurok.trim()) : null,
                };
                axiosClient.post(endpoint, payload)
                  .then(() => {
                    setAddBeneficiarySuccess(`Successfully registered ${newFirstName} ${newLastName}!`);
                    if (beneficiaryType === 'child') refetchChildren(); else _refetchMothers();
                    setNewFirstName(''); setNewMiddleInitial(''); setNewLastName(''); setNewBirthDate(''); setNewGuardianName(''); setNewGuardianContact(''); setMotherBirthDate(''); setNewDisability('None');
                  })
                  .catch((err) => setAddBeneficiaryError(err.response?.data?.message || 'Failed to register beneficiary.'))
                  .finally(() => setAddBeneficiarySubmitting(false));
              }}
              noValidate
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

              <FormRequiredNote />

              {/* Beneficiary Type Selector */}
              <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => { setBeneficiaryType('child'); setAddBeneficiaryErrors({}); }}
                  className={`py-2 text-xs font-bold rounded-lg transition ${beneficiaryType === 'child' ? 'bg-white text-green-900 shadow-xs' : 'text-gray-600'}`}
                >
                  Child (0–59 Months)
                </button>
                <button
                  type="button"
                  onClick={() => { setBeneficiaryType('mother'); setAddBeneficiaryErrors({}); }}
                  className={`py-2 text-xs font-bold rounded-lg transition ${beneficiaryType === 'mother' ? 'bg-white text-green-900 shadow-xs' : 'text-gray-600'}`}
                >
                  Lactating Mother
                </button>
              </div>

              {/* Barangay & Purok */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FormLabel label="Barangay" required />
                  <input
                    type="text"
                    readOnly
                    value={newBarangay || user.barangay || 'Antipolo'}
                    className="w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-xs text-gray-700 font-semibold focus:outline-none"
                  />
                </div>
                <div>
                  <FormLabel label="Purok / Zone" required />
                  {purokOptions.length > 0 ? (
                    <select
                      name="purok"
                      value={newPurok}
                      onChange={(e) => setNewPurok(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-green-600 bg-white"
                    >
                      {purokOptions.map((p) => (
                        <option key={p.id || p.name} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      name="purok"
                      type="text"
                      value={newPurok}
                      onChange={(e) => setNewPurok(capitalizeWords(e.target.value))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-green-600"
                      placeholder="Purok 1"
                    />
                  )}
                </div>
              </div>

              {/* Names (Auto-capitalized) */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <FormLabel label="First Name" required />
                  <input
                    name="first_name"
                    type="text"
                    value={newFirstName}
                    onChange={(e) => {
                      setNewFirstName(capitalizeWords(e.target.value));
                      if (addBeneficiaryErrors.first_name) setAddBeneficiaryErrors(prev => ({ ...prev, first_name: '' }));
                    }}
                    className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none transition ${
                      addBeneficiaryErrors.first_name ? 'border-[#D32F2F] ring-1 ring-[#D32F2F] focus:border-[#D32F2F]' : 'border-gray-200 focus:border-green-600'
                    }`}
                    placeholder="First Name"
                  />
                  {addBeneficiaryErrors.first_name && <p className="text-xs text-[#D32F2F] mt-1">{addBeneficiaryErrors.first_name}</p>}
                </div>
                <div>
                  <FormLabel label="M.I." />
                  <input
                    name="middle_initial"
                    type="text"
                    maxLength={2}
                    value={newMiddleInitial}
                    onChange={(e) => setNewMiddleInitial(e.target.value.toUpperCase())}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-green-600 text-center uppercase"
                    placeholder="M"
                  />
                </div>
                <div>
                  <FormLabel label="Last Name" required />
                  <input
                    name="last_name"
                    type="text"
                    value={newLastName}
                    onChange={(e) => {
                      setNewLastName(capitalizeWords(e.target.value));
                      if (addBeneficiaryErrors.last_name) setAddBeneficiaryErrors(prev => ({ ...prev, last_name: '' }));
                    }}
                    className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none transition ${
                      addBeneficiaryErrors.last_name ? 'border-[#D32F2F] ring-1 ring-[#D32F2F] focus:border-[#D32F2F]' : 'border-gray-200 focus:border-green-600'
                    }`}
                    placeholder="Last Name"
                  />
                  {addBeneficiaryErrors.last_name && <p className="text-xs text-[#D32F2F] mt-1">{addBeneficiaryErrors.last_name}</p>}
                </div>
              </div>

              {beneficiaryType === 'child' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <FormLabel label="Birth Date (Required)" required />
                      <input
                        name="birth_date"
                        type="date"
                        value={newBirthDate}
                        onChange={(e) => {
                          setNewBirthDate(e.target.value);
                          if (addBeneficiaryErrors.birth_date) setAddBeneficiaryErrors(prev => ({ ...prev, birth_date: '' }));
                        }}
                        className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none transition ${
                          addBeneficiaryErrors.birth_date ? 'border-[#D32F2F] ring-1 ring-[#D32F2F] focus:border-[#D32F2F]' : 'border-gray-200 focus:border-green-600'
                        }`}
                      />
                      {addBeneficiaryErrors.birth_date && <p className="text-xs text-[#D32F2F] mt-1">{addBeneficiaryErrors.birth_date}</p>}
                    </div>
                    <div>
                      <FormLabel label="Sex" required />
                      <select
                        name="sex"
                        value={newSex}
                        onChange={(e) => {
                          setNewSex(e.target.value);
                          if (addBeneficiaryErrors.sex) setAddBeneficiaryErrors(prev => ({ ...prev, sex: '' }));
                        }}
                        className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none transition ${
                          addBeneficiaryErrors.sex ? 'border-[#D32F2F] ring-1 ring-[#D32F2F] focus:border-[#D32F2F]' : 'border-gray-200 focus:border-green-600'
                        }`}
                      >
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                      </select>
                      {addBeneficiaryErrors.sex && <p className="text-xs text-[#D32F2F] mt-1">{addBeneficiaryErrors.sex}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <FormLabel label="Guardian Name" />
                      <input
                        name="guardian_name"
                        type="text"
                        value={newGuardianName}
                        onChange={(e) => setNewGuardianName(capitalizeWords(e.target.value))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-green-600"
                        placeholder="Mother/Father Name"
                      />
                    </div>
                    <div>
                      <FormLabel label="Guardian Contact (Required)" required />
                      <input
                        name="contact_number"
                        type="tel"
                        inputMode="numeric"
                        maxLength={11}
                        value={newGuardianContact}
                        onChange={(e) => {
                          setNewGuardianContact(sanitizeContact(e.target.value));
                          if (addBeneficiaryErrors.contact_number) setAddBeneficiaryErrors(prev => ({ ...prev, contact_number: '' }));
                        }}
                        className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none transition ${
                          addBeneficiaryErrors.contact_number ? 'border-[#D32F2F] ring-1 ring-[#D32F2F] focus:border-[#D32F2F]' : 'border-gray-200 focus:border-green-600'
                        }`}
                        placeholder="09123456789"
                      />
                      {addBeneficiaryErrors.contact_number && <p className="text-xs text-[#D32F2F] mt-1">{addBeneficiaryErrors.contact_number}</p>}
                    </div>
                  </div>

                  {/* Common Disabilities Dropdown */}
                  <div>
                    <FormLabel label="Common Disabilities / Needs" />
                    <select
                      name="disability"
                      value={newDisability}
                      onChange={(e) => setNewDisability(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-green-600 bg-white"
                    >
                      {COMMON_DISABILITIES.map((dis) => (
                        <option key={dis} value={dis}>{dis}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {beneficiaryType === 'mother' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FormLabel label="Birth Date (Required)" required />
                    <input
                      name="mother_birth_date"
                      type="date"
                      value={motherBirthDate}
                      onChange={(e) => {
                        setMotherBirthDate(e.target.value);
                        if (addBeneficiaryErrors.mother_birth_date) setAddBeneficiaryErrors(prev => ({ ...prev, mother_birth_date: '' }));
                      }}
                      className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none transition ${
                        addBeneficiaryErrors.mother_birth_date ? 'border-[#D32F2F] ring-1 ring-[#D32F2F] focus:border-[#D32F2F]' : 'border-gray-200 focus:border-green-600'
                      }`}
                    />
                    {addBeneficiaryErrors.mother_birth_date && <p className="text-xs text-[#D32F2F] mt-1">{addBeneficiaryErrors.mother_birth_date}</p>}
                  </div>
                  <div>
                    <FormLabel label="Contact Number (Required)" required />
                    <input
                      name="contact_number"
                      type="tel"
                      inputMode="numeric"
                      maxLength={11}
                      value={newGuardianContact}
                      onChange={(e) => {
                        setNewGuardianContact(sanitizeContact(e.target.value));
                        if (addBeneficiaryErrors.contact_number) setAddBeneficiaryErrors(prev => ({ ...prev, contact_number: '' }));
                      }}
                      className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none transition ${
                        addBeneficiaryErrors.contact_number ? 'border-[#D32F2F] ring-1 ring-[#D32F2F] focus:border-[#D32F2F]' : 'border-gray-200 focus:border-green-600'
                      }`}
                      placeholder="09123456789"
                    />
                    {addBeneficiaryErrors.contact_number && <p className="text-xs text-[#D32F2F] mt-1">{addBeneficiaryErrors.contact_number}</p>}
                  </div>
                </div>
              )}

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
                  disabled={addBeneficiarySubmitting}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-linear-to-r from-[#1b5e20] to-[#2e7d32] hover:opacity-95 disabled:opacity-50 cursor-pointer"
                >
                  {addBeneficiarySubmitting ? 'Saving…' : 'Save & Add Another'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

    </main>
  );
}

export default MedicalRecords;