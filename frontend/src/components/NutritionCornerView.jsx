import { useState, useEffect, useMemo, useCallback } from 'react';
import axiosClient from '../api/axiosClient';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Printer,
  FileSpreadsheet,
  Calendar,
  MapPin,
  Search,
  Plus,
  Edit,
  Trash2,
  X,
  CheckCircle2,
  AlertTriangle,
  Info,
  BookOpen,
  Activity,
  HeartPulse,
  Users,
  Award,
  ShieldCheck,
  Download,
  Filter,
} from 'lucide-react';

const GASAN_BARANGAYS = [
  'Antipolo',
  'B. Ibaba',
  'B. Ilaya',
  'Bacong-Bacong',
  'Bahi',
  'Bangbang',
  'Banot',
  'Banuyo',
  'Bognuyan',
  'Brgy. Dos',
  'Brgy. Tres',
  'Brgy. Uno',
  'Cabugao',
  'Dawis',
  'Dili',
  'Libtangin',
  'Mahunig',
  'Mangiliol',
  'Masiga',
  'Mat. Gasan',
  'Pangi',
  'Pinggan',
  'Tabionan',
  'Tapuyan',
  'Tiguion',
];

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export default function NutritionCornerView({ role = 'admin', userBarangay = null }) {
  const isAdmin = role === 'admin';
  const [activeTab, setActiveTab] = useState('consolidation'); // 'consolidation', 'monitoring', 'programs', 'laws'

  // Tab A State
  const [consolidationYear, setConsolidationYear] = useState(() => new Date().getFullYear());
  const [consolidationBarangay, setConsolidationBarangay] = useState(() => (!isAdmin && userBarangay ? userBarangay : 'All'));
  const [consolidationData, setConsolidationData] = useState(null);
  const [consolidationLoading, setConsolidationLoading] = useState(false);
  const [signatories, setSignatories] = useState([]);

  // Tab B State
  const [monitoringYear, setMonitoringYear] = useState(() => new Date().getFullYear());
  const [monitoringSearch, setMonitoringSearch] = useState('');
  const [monitoringMatrix, setMonitoringMatrix] = useState([]);
  const [monitoringColumnTotals, setMonitoringColumnTotals] = useState([]);
  const [monitoringLoading, setMonitoringLoading] = useState(false);
  const [unweighedModal, setUnweighedModal] = useState(null); // { barangay, month, year, data, loading }
  const [unweighedSearch, setUnweighedSearch] = useState('');

  // Tab C State
  const [programsList, setProgramsList] = useState([]);
  const [programsSummary, setProgramsSummary] = useState(null);
  const [programsLoading, setProgramsLoading] = useState(false);
  const [showProgramModal, setShowProgramModal] = useState(false);
  const [editingProgram, setEditingProgram] = useState(null);
  const [programForm, setProgramForm] = useState({
    section: 'nutrition_specific',
    title: '',
    description: '',
    coverage_metric: '',
    sort_order: 1,
  });

  // Tab D State
  const [lawsList, setLawsList] = useState([]);
  const [lawsLoading, setLawsLoading] = useState(false);
  const [lawsSearch, setLawsSearch] = useState('');
  const [showLawModal, setShowLawModal] = useState(false);
  const [editingLaw, setEditingLaw] = useState(null);
  const [lawForm, setLawForm] = useState({
    title: '',
    legal_basis: '',
    description: '',
    file_url: '',
    category: 'National Law',
    sort_order: 1,
  });

  // Global Alerts / Messages
  const [alertMsg, setAlertMsg] = useState({ type: '', text: '' });

  const showAlert = (type, text) => {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg({ type: '', text: '' }), 4000);
  };

  // Fetch Signatories for Printing Tab A & B
  useEffect(() => {
    axiosClient.get('/reports/signatories', { params: { barangay: consolidationBarangay === 'All' ? 'All Barangays' : consolidationBarangay } })
      .then((res) => setSignatories(res.data || []))
      .catch(() => {});
  }, [consolidationBarangay]);

  // Fetch Tab A: Consolidation
  const fetchConsolidation = useCallback(async () => {
    setConsolidationLoading(true);
    try {
      const res = await axiosClient.get('/nutrition-corner/consolidation', {
        params: {
          year: consolidationYear,
          barangay: consolidationBarangay,
        },
      });
      setConsolidationData(res.data?.consolidation || []);
    } catch {
      showAlert('error', 'Failed to load nutritional status consolidation.');
    } finally {
      setConsolidationLoading(false);
    }
  }, [consolidationYear, consolidationBarangay]);

  // Fetch Tab B: Monitoring Matrix
  const fetchMonitoring = useCallback(async () => {
    setMonitoringLoading(true);
    try {
      const res = await axiosClient.get('/nutrition-corner/monthly-monitoring', {
        params: {
          year: monitoringYear,
          search: monitoringSearch,
        },
      });
      setMonitoringMatrix(res.data?.matrix || []);
      setMonitoringColumnTotals(res.data?.columnTotals || []);
    } catch {
      showAlert('error', 'Failed to load monthly weight monitoring matrix.');
    } finally {
      setMonitoringLoading(false);
    }
  }, [monitoringYear, monitoringSearch]);

  // Fetch Tab C: Programs
  const fetchPrograms = useCallback(async () => {
    setProgramsLoading(true);
    try {
      const res = await axiosClient.get('/nutrition-corner/programs', {
        params: {
          barangay: !isAdmin && userBarangay ? userBarangay : 'All',
        },
      });
      setProgramsList(res.data?.programs || []);
      setProgramsSummary(res.data?.summary || null);
    } catch {
      showAlert('error', 'Failed to load nutrition programs.');
    } finally {
      setProgramsLoading(false);
    }
  }, [isAdmin, userBarangay]);

  // Fetch Tab D: Laws
  const fetchLaws = useCallback(async () => {
    setLawsLoading(true);
    try {
      const res = await axiosClient.get('/nutrition-corner/laws');
      setLawsList(res.data || []);
    } catch {
      showAlert('error', 'Failed to load reference nutrition laws.');
    } finally {
      setLawsLoading(false);
    }
  }, []);

  // Trigger data load on tab changes
  useEffect(() => {
    if (activeTab === 'consolidation') fetchConsolidation();
    else if (activeTab === 'monitoring') fetchMonitoring();
    else if (activeTab === 'programs') fetchPrograms();
    else if (activeTab === 'laws') fetchLaws();
  }, [activeTab, fetchConsolidation, fetchMonitoring, fetchPrograms, fetchLaws]);

  // ─────────────────────────────────────────────────────────────
  // Tab A: Chart Formatter Data
  // ─────────────────────────────────────────────────────────────
  const wfaChartData = useMemo(() => {
    if (!consolidationData) return [];
    return consolidationData.map((d) => ({
      year: String(d.year),
      Normal: d.wfa.normal.count,
      Underweight: d.wfa.underweight.count,
      'Severely Underweight': d.wfa.severely_underweight.count,
      Overweight: d.wfa.overweight.count,
    }));
  }, [consolidationData]);

  const wfhChartData = useMemo(() => {
    if (!consolidationData) return [];
    return consolidationData.map((d) => ({
      year: String(d.year),
      Normal: d.wfh.normal.count,
      Wasted: d.wfh.wasted.count,
      'Severely Wasted': d.wfh.severely_wasted.count,
      Overweight: d.wfh.overweight.count,
      Obese: d.wfh.obese.count,
    }));
  }, [consolidationData]);

  const hfaChartData = useMemo(() => {
    if (!consolidationData) return [];
    return consolidationData.map((d) => ({
      year: String(d.year),
      Normal: d.hfa.normal.count,
      Stunted: d.hfa.stunted.count,
      'Severely Stunted': d.hfa.severely_stunted.count,
      Tall: d.hfa.tall.count,
    }));
  }, [consolidationData]);

  // ─────────────────────────────────────────────────────────────
  // Tab A: Print & Export
  // ─────────────────────────────────────────────────────────────
  const handlePrintConsolidation = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const bgyName = consolidationBarangay === 'All' ? 'MUNICIPALITY OF GASAN (CONSOLIDATED)' : `BARANGAY ${consolidationBarangay.toUpperCase()}`;
    const years = (consolidationData || []).map((d) => d.year);

    let html = `<!DOCTYPE html>
<html>
<head>
  <title>Consolidation of Nutritional Status - ${bgyName}</title>
  <style>
    @page { size: portrait; margin: 15mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #1e293b; margin: 0; padding: 10px; font-size: 11px; }
    .header { text-align: center; border-bottom: 2px solid #2E7D32; padding-bottom: 8px; margin-bottom: 12px; }
    .header h2 { margin: 0; font-size: 16px; color: #1B5E20; text-transform: uppercase; }
    .header h3 { margin: 3px 0; font-size: 13px; color: #334155; }
    .header p { margin: 0; font-size: 10px; color: #64748b; }
    .section-title { font-size: 12px; font-weight: bold; background: #e8f5e9; color: #1B5E20; padding: 4px 8px; margin-top: 14px; margin-bottom: 6px; border-left: 4px solid #2E7D32; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    th, td { border: 1px solid #cbd5e1; padding: 5px 8px; text-align: left; }
    th { background: #f1f5f9; font-weight: bold; color: #0f172a; font-size: 10.5px; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .signatures { display: flex; justify-content: space-between; margin-top: 30px; page-break-inside: avoid; }
    .sig-col { text-align: center; width: 30%; }
    .sig-line { border-bottom: 1px solid #334155; margin-top: 40px; margin-bottom: 4px; }
  </style>
</head>
<body>
  <div class="header">
    <p>Republic of the Philippines &bull; Province of Marinduque &bull; Municipality of Gasan</p>
    <h2>Consolidation of Nutritional Status</h2>
    <h3>${bgyName} &bull; Comparative Analysis (${years.join(' - ')})</h3>
    <p>Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
  </div>

  <div class="section-title">1. Weight for Age (WFA)</div>
  <table>
    <thead>
      <tr>
        <th>Indicator / Classification</th>
        ${years.map((y) => `<th class="text-center">${y}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      <tr><td><strong>Total Target Population</strong></td>${consolidationData.map((d) => `<td class="text-center">${d.total_population}</td>`).join('')}</tr>
      <tr><td><strong>Total Weighed / Measured</strong></td>${consolidationData.map((d) => `<td class="text-center">${d.total_weighed}</td>`).join('')}</tr>
      <tr><td><strong>% Weighed</strong></td>${consolidationData.map((d) => `<td class="text-center font-bold">${d.weighed_pct}%</td>`).join('')}</tr>
      <tr><td>Normal</td>${consolidationData.map((d) => `<td class="text-center">${d.wfa.normal.count} (${d.wfa.normal.pct}%)</td>`).join('')}</tr>
      <tr><td>Underweight</td>${consolidationData.map((d) => `<td class="text-center">${d.wfa.underweight.count} (${d.wfa.underweight.pct}%)</td>`).join('')}</tr>
      <tr><td>Severely Underweight</td>${consolidationData.map((d) => `<td class="text-center font-bold" style="color:#b91c1c;">${d.wfa.severely_underweight.count} (${d.wfa.severely_underweight.pct}%)</td>`).join('')}</tr>
      <tr><td>Overweight</td>${consolidationData.map((d) => `<td class="text-center">${d.wfa.overweight.count} (${d.wfa.overweight.pct}%)</td>`).join('')}</tr>
    </tbody>
  </table>

  <div class="section-title">2. Weight for Length/Height (WFH)</div>
  <table>
    <thead>
      <tr>
        <th>Classification</th>
        ${years.map((y) => `<th class="text-center">${y}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      <tr><td>Normal</td>${consolidationData.map((d) => `<td class="text-center">${d.wfh.normal.count} (${d.wfh.normal.pct}%)</td>`).join('')}</tr>
      <tr><td>Wasted (MAM)</td>${consolidationData.map((d) => `<td class="text-center">${d.wfh.wasted.count} (${d.wfh.wasted.pct}%)</td>`).join('')}</tr>
      <tr><td>Severely Wasted (SAM)</td>${consolidationData.map((d) => `<td class="text-center font-bold" style="color:#b91c1c;">${d.wfh.severely_wasted.count} (${d.wfh.severely_wasted.pct}%)</td>`).join('')}</tr>
      <tr><td>Overweight</td>${consolidationData.map((d) => `<td class="text-center">${d.wfh.overweight.count} (${d.wfh.overweight.pct}%)</td>`).join('')}</tr>
      <tr><td>Obese</td>${consolidationData.map((d) => `<td class="text-center">${d.wfh.obese.count} (${d.wfh.obese.pct}%)</td>`).join('')}</tr>
    </tbody>
  </table>

  <div class="section-title">3. Length/Height for Age (HFA)</div>
  <table>
    <thead>
      <tr>
        <th>Classification</th>
        ${years.map((y) => `<th class="text-center">${y}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      <tr><td>Normal</td>${consolidationData.map((d) => `<td class="text-center">${d.hfa.normal.count} (${d.hfa.normal.pct}%)</td>`).join('')}</tr>
      <tr><td>Stunted</td>${consolidationData.map((d) => `<td class="text-center">${d.hfa.stunted.count} (${d.hfa.stunted.pct}%)</td>`).join('')}</tr>
      <tr><td>Severely Stunted</td>${consolidationData.map((d) => `<td class="text-center font-bold" style="color:#b91c1c;">${d.hfa.severely_stunted.count} (${d.hfa.severely_stunted.pct}%)</td>`).join('')}</tr>
      <tr><td>Tall</td>${consolidationData.map((d) => `<td class="text-center">${d.hfa.tall.count} (${d.hfa.tall.pct}%)</td>`).join('')}</tr>
    </tbody>
  </table>

  <div class="signatures">
    ${signatories.map((sig) => `
      <div class="sig-col">
        <p style="margin: 0; font-size: 10px; color: #64748b;">${sig.position || 'Signatory'}:</p>
        <div class="sig-line"><strong>${sig.name || '__________________________'}</strong></div>
        <p style="margin: 0; font-size: 9.5px; color: #475569;">${sig.position || ''}</p>
      </div>
    `).join('')}
  </div>

  <script>
    window.onload = function() { window.print(); };
  </script>
</body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleExportConsolidationExcel = () => {
    if (!consolidationData || consolidationData.length === 0) return;
    const years = consolidationData.map((d) => d.year);
    const bgyName = consolidationBarangay === 'All' ? 'All_Barangays' : consolidationBarangay.replace(/\s+/g, '_');
    const todayStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    let tableHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Consolidation</x:Name>
                <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          body { font-family: Calibri, Arial, sans-serif; }
          .header-title { font-size: 14pt; font-weight: bold; color: #1b5e20; text-align: center; }
          .header-sub { font-size: 10pt; color: #475569; text-align: center; margin-bottom: 12px; }
          table { border-collapse: collapse; width: 100%; margin-top: 10px; }
          th { background-color: #2e7d32; color: #ffffff; font-weight: bold; font-size: 10.5pt; text-align: center; border: 1px solid #1b5e20; padding: 8px 12px; }
          td { font-size: 10pt; border: 1px solid #cbd5e1; padding: 7px 10px; vertical-align: middle; }
          .sec-header { background-color: #e8f5e9; color: #1b5e20; font-weight: bold; font-size: 11pt; border: 1px solid #a5d6a7; padding: 8px 10px; }
          .bold { font-weight: bold; }
          .center { text-align: center; }
          .right { text-align: right; }
          .danger { color: #b91c1c; font-weight: bold; }
          .zebra { background-color: #f8fafc; }
        </style>
      </head>
      <body>
        <div class="header-title">REPUBLIC OF THE PHILIPPINES · MUNICIPALITY OF GASAN</div>
        <div class="header-title" style="font-size: 12pt; color: #2e7d32;">OPERATION TIMBANG PLUS (OPT+) CONSOLIDATION OF NUTRITIONAL STATUS</div>
        <div class="header-sub">Barangay: <strong>${consolidationBarangay}</strong> | Comparative Coverage: <strong>${years.join(' - ')}</strong> | Generated: ${todayStr}</div>

        <table>
          <colgroup>
            <col width="300" style="width: 300px;" />
            ${years.map(() => '<col width="160" style="width: 160px;" />').join('')}
          </colgroup>

          <!-- 1. WFA -->
          <thead>
            <tr>
              <th colspan="${years.length + 1}" class="sec-header">1. WEIGHT FOR AGE (WFA) — COMPARATIVE BREAKDOWN</th>
            </tr>
            <tr>
              <th style="text-align: left; width: 300px;">Indicator / Nutritional Status</th>
              ${years.map((y) => `<th style="width: 160px;">Year ${y}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            <tr class="zebra">
              <td class="bold">Total Target Population</td>
              ${consolidationData.map((d) => `<td class="center bold">${d.total_population}</td>`).join('')}
            </tr>
            <tr>
              <td class="bold">Total Weighed / Measured</td>
              ${consolidationData.map((d) => `<td class="center bold">${d.total_weighed}</td>`).join('')}
            </tr>
            <tr class="zebra">
              <td class="bold">% Weighed Coverage</td>
              ${consolidationData.map((d) => `<td class="center bold" style="color:#1b5e20;">${d.weighed_pct}%</td>`).join('')}
            </tr>
            <tr>
              <td>Normal</td>
              ${consolidationData.map((d) => `<td class="center">${d.wfa.normal.count} (${d.wfa.normal.pct}%)</td>`).join('')}
            </tr>
            <tr class="zebra">
              <td>Underweight</td>
              ${consolidationData.map((d) => `<td class="center">${d.wfa.underweight.count} (${d.wfa.underweight.pct}%)</td>`).join('')}
            </tr>
            <tr>
              <td class="danger">Severely Underweight</td>
              ${consolidationData.map((d) => `<td class="center danger">${d.wfa.severely_underweight.count} (${d.wfa.severely_underweight.pct}%)</td>`).join('')}
            </tr>
            <tr class="zebra">
              <td>Overweight</td>
              ${consolidationData.map((d) => `<td class="center">${d.wfa.overweight.count} (${d.wfa.overweight.pct}%)</td>`).join('')}
            </tr>

            <!-- 2. WFH -->
            <tr><td colspan="${years.length + 1}" style="border: none; height: 14px;"></td></tr>
            <tr>
              <th colspan="${years.length + 1}" class="sec-header">2. WEIGHT FOR LENGTH/HEIGHT (WFH) — WASTING &amp; OBESITY</th>
            </tr>
            <tr>
              <th style="text-align: left;">Classification</th>
              ${years.map((y) => `<th>Year ${y}</th>`).join('')}
            </tr>
            <tr>
              <td>Normal</td>
              ${consolidationData.map((d) => `<td class="center">${d.wfh.normal.count} (${d.wfh.normal.pct}%)</td>`).join('')}
            </tr>
            <tr class="zebra">
              <td>Wasted (MAM)</td>
              ${consolidationData.map((d) => `<td class="center">${d.wfh.wasted.count} (${d.wfh.wasted.pct}%)</td>`).join('')}
            </tr>
            <tr>
              <td class="danger">Severely Wasted (SAM)</td>
              ${consolidationData.map((d) => `<td class="center danger">${d.wfh.severely_wasted.count} (${d.wfh.severely_wasted.pct}%)</td>`).join('')}
            </tr>
            <tr class="zebra">
              <td>Overweight</td>
              ${consolidationData.map((d) => `<td class="center">${d.wfh.overweight.count} (${d.wfh.overweight.pct}%)</td>`).join('')}
            </tr>
            <tr>
              <td>Obese</td>
              ${consolidationData.map((d) => `<td class="center">${d.wfh.obese.count} (${d.wfh.obese.pct}%)</td>`).join('')}
            </tr>

            <!-- 3. HFA -->
            <tr><td colspan="${years.length + 1}" style="border: none; height: 14px;"></td></tr>
            <tr>
              <th colspan="${years.length + 1}" class="sec-header">3. LENGTH/HEIGHT FOR AGE (HFA) — STUNTING</th>
            </tr>
            <tr>
              <th style="text-align: left;">Classification</th>
              ${years.map((y) => `<th>Year ${y}</th>`).join('')}
            </tr>
            <tr>
              <td>Normal</td>
              ${consolidationData.map((d) => `<td class="center">${d.hfa.normal.count} (${d.hfa.normal.pct}%)</td>`).join('')}
            </tr>
            <tr class="zebra">
              <td>Stunted</td>
              ${consolidationData.map((d) => `<td class="center">${d.hfa.stunted.count} (${d.hfa.stunted.pct}%)</td>`).join('')}
            </tr>
            <tr>
              <td class="danger">Severely Stunted</td>
              ${consolidationData.map((d) => `<td class="center danger">${d.hfa.severely_stunted.count} (${d.hfa.severely_stunted.pct}%)</td>`).join('')}
            </tr>
            <tr class="zebra">
              <td>Tall</td>
              ${consolidationData.map((d) => `<td class="center">${d.hfa.tall.count} (${d.hfa.tall.pct}%)</td>`).join('')}
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OPT_Plus_Consolidation_${bgyName}_${years.join('_')}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─────────────────────────────────────────────────────────────
  // Tab B: Cell Click -> Unweighed Children Modal
  // ─────────────────────────────────────────────────────────────
  const handleCellClick = async (barangay, month) => {
    setUnweighedModal({
      barangay,
      month,
      year: monitoringYear,
      data: null,
      loading: true,
    });

    try {
      const res = await axiosClient.get('/nutrition-corner/unweighed-children', {
        params: {
          barangay,
          month,
          year: monitoringYear,
        },
      });
      setUnweighedModal((prev) => ({
        ...prev,
        data: res.data?.children || [],
        loading: false,
      }));
    } catch {
      showAlert('error', 'Failed to load unweighed children list.');
      setUnweighedModal(null);
    }
  };

  const handlePrintMonitoringMatrix = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    let html = `<!DOCTYPE html>
<html>
<head>
  <title>BNS Monthly Weight Monitoring Chart - ${monitoringYear}</title>
  <style>
    @page { size: landscape; margin: 10mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #1e293b; margin: 0; padding: 10px; font-size: 10px; }
    .header { text-align: center; border-bottom: 2px solid #2E7D32; padding-bottom: 6px; margin-bottom: 10px; }
    .header h2 { margin: 0; font-size: 15px; color: #1B5E20; text-transform: uppercase; }
    .header p { margin: 2px 0 0; font-size: 10px; color: #64748b; }
    .legend { display: flex; justify-content: center; gap: 16px; margin-bottom: 10px; font-size: 9.5px; }
    .legend-item { display: flex; align-items: center; gap: 5px; }
    .dot { width: 10px; height: 10px; border-radius: 2px; }
    .dot-green { background: #dcfce7; border: 1px solid #16a34a; }
    .dot-orange { background: #ffedd5; border: 1px solid #ea580c; }
    .dot-red { background: #fee2e2; border: 1px solid #dc2626; }
    .dot-gray { background: #f1f5f9; border: 1px solid #94a3b8; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 9px; }
    th, td { border: 1px solid #cbd5e1; padding: 4px; text-align: center; }
    th { background: #f8fafc; font-weight: bold; color: #0f172a; }
    .th-bgy { text-align: left; padding-left: 6px; width: 140px; }
    .cell-green { background: #dcfce7; color: #15803d; font-weight: bold; }
    .cell-orange { background: #ffedd5; color: #c2410c; font-weight: bold; }
    .cell-red { background: #fee2e2; color: #b91c1c; font-weight: bold; }
    .cell-gray { background: #f8fafc; color: #94a3b8; }
    .totals-row td { background: #e2e8f0; font-weight: bold; }
    .signatures { display: flex; justify-content: space-between; margin-top: 20px; page-break-inside: avoid; }
    .sig-col { text-align: center; width: 30%; }
    .sig-line { border-bottom: 1px solid #334155; margin-top: 35px; margin-bottom: 3px; }
  </style>
</head>
<body>
  <div class="header">
    <p>Republic of the Philippines &bull; Province of Marinduque &bull; Municipality of Gasan</p>
    <h2>BNS Monthly Weight Monitoring Chart - Year ${monitoringYear}</h2>
    <p>Consolidated Monthly Coverage Across All 25 Barangays of Gasan</p>
  </div>

  <div class="legend">
    <div class="legend-item"><div class="dot dot-green"></div><span>&ge; 90% (Satisfactory)</span></div>
    <div class="legend-item"><div class="dot dot-orange"></div><span>60% - 89% (Needs Follow-up)</span></div>
    <div class="legend-item"><div class="dot dot-red"></div><span>&lt; 60% (Critical)</span></div>
    <div class="legend-item"><div class="dot dot-gray"></div><span>No data / Future</span></div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="th-bgy">Barangay</th>
        <th>Target</th>
        ${MONTH_NAMES.map((m) => `<th>${m}</th>`).join('')}
        <th>Annual Total</th>
      </tr>
    </thead>
    <tbody>
      ${monitoringMatrix.map((row) => `
        <tr>
          <td class="th-bgy"><strong>${row.barangay}</strong></td>
          <td>${row.target}</td>
          ${row.months.map((m) => `
            <td class="cell-${m.status}">
              ${m.target > 0 && !m.isFuture ? `${m.weighed}/${m.target}<br/>(${m.percentage}%)` : (m.weighed > 0 ? `${m.weighed}` : '-')}
            </td>
          `).join('')}
          <td class="cell-${row.rowTotal.status}">
            ${row.rowTotal.avgWeighed}/${row.target}<br/>(${row.rowTotal.percentage}%)
          </td>
        </tr>
      `).join('')}
      <tr class="totals-row">
        <td class="th-bgy"><strong>MUNICIPAL TOTAL</strong></td>
        <td><strong>${monitoringColumnTotals.reduce((s, c) => Math.max(s, c.totalTarget), 0)}</strong></td>
        ${monitoringColumnTotals.map((c) => `
          <td class="cell-${c.status}">
            ${c.totalTarget > 0 && !c.isFuture ? `${c.totalWeighed}/${c.totalTarget}<br/>(${c.percentage}%)` : (c.totalWeighed > 0 ? `${c.totalWeighed}` : '-')}
          </td>
        `).join('')}
        <td><strong>CONSOLIDATED</strong></td>
      </tr>
    </tbody>
  </table>

  <div class="signatures">
    ${signatories.map((sig) => `
      <div class="sig-col">
        <p style="margin: 0; font-size: 9px; color: #64748b;">${sig.position || 'Signatory'}:</p>
        <div class="sig-line"><strong>${sig.name || '__________________________'}</strong></div>
        <p style="margin: 0; font-size: 8.5px; color: #475569;">${sig.position || ''}</p>
      </div>
    `).join('')}
  </div>

  <script>
    window.onload = function() { window.print(); };
  </script>
</body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleExportMonitoringExcel = () => {
    if (!monitoringMatrix || monitoringMatrix.length === 0) return;
    const todayStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    let tableHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Monthly_Monitoring</x:Name>
                <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          body { font-family: Calibri, Arial, sans-serif; }
          .title { font-size: 14pt; font-weight: bold; color: #1b5e20; text-align: center; }
          .sub { font-size: 10pt; color: #475569; text-align: center; margin-bottom: 12px; }
          table { border-collapse: collapse; width: 100%; margin-top: 10px; }
          th { background-color: #2e7d32; color: #ffffff; font-weight: bold; font-size: 10pt; text-align: center; border: 1px solid #1b5e20; padding: 8px; }
          td { font-size: 9.5pt; border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: middle; }
          .bold { font-weight: bold; }
          .center { text-align: center; }
          .right { text-align: right; }
          .zebra { background-color: #f8fafc; }
          .total-row { background-color: #e8f5e9; font-weight: bold; border-top: 2px solid #2e7d32; }
        </style>
      </head>
      <body>
        <div class="title">BNS MONTHLY WEIGHT MONITORING CHART — YEAR ${monitoringYear}</div>
        <div class="sub">Municipality of Gasan, Marinduque | Generated: ${todayStr}</div>

        <table>
          <colgroup>
            <col width="180" style="width: 180px;" />
            <col width="80" style="width: 80px;" />
            ${MONTH_NAMES.map(() => '<col width="110" style="width: 110px;" />').join('')}
            <col width="90" style="width: 90px;" />
            <col width="85" style="width: 85px;" />
          </colgroup>
          <thead>
            <tr>
              <th style="width: 180px; text-align: left;">Barangay</th>
              <th style="width: 80px;">Target</th>
              ${MONTH_NAMES.map((m) => `<th style="width: 110px;">${m}</th>`).join('')}
              <th style="width: 90px;">Annual Avg</th>
              <th style="width: 85px;">Annual %</th>
            </tr>
          </thead>
          <tbody>
            ${monitoringMatrix.map((r, i) => `
              <tr class="${i % 2 === 1 ? 'zebra' : ''}">
                <td class="bold">${r.barangay}</td>
                <td class="center">${r.target}</td>
                ${r.months.map((m) => `<td class="center">${m.weighed}/${m.target} (${m.percentage}%)</td>`).join('')}
                <td class="center bold">${r.rowTotal.avgWeighed}</td>
                <td class="center bold" style="color: #1b5e20;">${r.rowTotal.percentage}%</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td class="bold">MUNICIPAL TOTAL</td>
              <td class="center bold">-</td>
              ${monitoringColumnTotals.map((c) => `<td class="center bold">${c.totalWeighed}/${c.totalTarget} (${c.percentage}%)</td>`).join('')}
              <td class="center bold">-</td>
              <td class="center bold">-</td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Monthly_Weight_Monitoring_${monitoringYear}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─────────────────────────────────────────────────────────────
  // Tab C & D: Admin Operations
  // ─────────────────────────────────────────────────────────────
  const handleSaveProgram = async (e) => {
    e.preventDefault();
    try {
      if (editingProgram) {
        await axiosClient.put(`/nutrition-corner/programs/${editingProgram.id}`, programForm);
        showAlert('success', 'Program updated successfully.');
      } else {
        await axiosClient.post('/nutrition-corner/programs', programForm);
        showAlert('success', 'Program created successfully.');
      }
      setShowProgramModal(false);
      setEditingProgram(null);
      fetchPrograms();
    } catch {
      showAlert('error', 'Failed to save program.');
    }
  };

  const handleDeleteProgram = async (id) => {
    if (!window.confirm('Are you sure you want to delete this nutrition program?')) return;
    try {
      await axiosClient.delete(`/nutrition-corner/programs/${id}`);
      showAlert('success', 'Program deleted successfully.');
      fetchPrograms();
    } catch {
      showAlert('error', 'Failed to delete program.');
    }
  };

  const handleSaveLaw = async (e) => {
    e.preventDefault();
    try {
      if (editingLaw) {
        await axiosClient.put(`/nutrition-corner/laws/${editingLaw.id}`, lawForm);
        showAlert('success', 'Law updated successfully.');
      } else {
        await axiosClient.post('/nutrition-corner/laws', lawForm);
        showAlert('success', 'Reference law added successfully.');
      }
      setShowLawModal(false);
      setEditingLaw(null);
      fetchLaws();
    } catch {
      showAlert('error', 'Failed to save reference law.');
    }
  };

  const handleDeleteLaw = async (id) => {
    if (!window.confirm('Are you sure you want to delete this reference law?')) return;
    try {
      await axiosClient.delete(`/nutrition-corner/laws/${id}`);
      showAlert('success', 'Law deleted successfully.');
      fetchLaws();
    } catch {
      showAlert('error', 'Failed to delete law.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Global Notification Alert */}
      {alertMsg.text && (
        <div
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-sm ${
            alertMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {alertMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {alertMsg.text}
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 overflow-x-auto gap-2 text-sm font-medium">
        <button
          onClick={() => setActiveTab('consolidation')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
            activeTab === 'consolidation'
              ? 'border-emerald-700 text-emerald-800 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Activity size={18} />
          <span>Tab A: Consolidation of Nutritional Status</span>
        </button>

        <button
          onClick={() => setActiveTab('monitoring')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
            activeTab === 'monitoring'
              ? 'border-emerald-700 text-emerald-800 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Calendar size={18} />
          <span>Tab B: BNS Monthly Weight Monitoring Chart</span>
        </button>

        <button
          onClick={() => setActiveTab('programs')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
            activeTab === 'programs'
              ? 'border-emerald-700 text-emerald-800 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Award size={18} />
          <span>Tab C: Nutrition Programs</span>
        </button>

        <button
          onClick={() => setActiveTab('laws')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
            activeTab === 'laws'
              ? 'border-emerald-700 text-emerald-800 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <BookOpen size={18} />
          <span>Tab D: Laws & References</span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB A: CONSOLIDATION OF NUTRITIONAL STATUS
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'consolidation' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Year Selector */}
              <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs sm:text-sm">
                <Calendar size={16} className="text-emerald-700" />
                <span className="font-semibold text-slate-600">Base Year:</span>
                <select
                  value={consolidationYear}
                  onChange={(e) => setConsolidationYear(Number(e.target.value))}
                  className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
                >
                  {[2024, 2025, 2026, 2027].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              {/* Barangay Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs sm:text-sm">
                <MapPin size={16} className="text-emerald-700" />
                <span className="font-semibold text-slate-600">Barangay:</span>
                {isAdmin ? (
                  <select
                    value={consolidationBarangay}
                    onChange={(e) => setConsolidationBarangay(e.target.value)}
                    className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
                  >
                    <option value="All">All Barangays (Municipal)</option>
                    {GASAN_BARANGAYS.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                ) : (
                  <span className="font-bold text-slate-800">{consolidationBarangay} (Assigned)</span>
                )}
              </div>
            </div>

            {/* Print & Export Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrintConsolidation}
                className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 shadow-sm transition"
              >
                <Printer size={16} />
                <span>Print PDF / View</span>
              </button>
              <button
                onClick={handleExportConsolidationExcel}
                className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 shadow-sm transition"
              >
                <FileSpreadsheet size={16} className="text-emerald-600" />
                <span>Export Excel</span>
              </button>
            </div>
          </div>

          {consolidationLoading ? (
            <div className="py-16 text-center text-slate-400 font-medium">Loading consolidation data...</div>
          ) : !consolidationData || consolidationData.length === 0 ? (
            <div className="py-16 text-center text-slate-400">No consolidation data available.</div>
          ) : (
            <div className="space-y-8">
              {/* Indicator 1: WFA */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-800">1. Weight for Age (WFA)</h2>
                    <p className="text-xs text-slate-500">Normal, Underweight, Severely Underweight, Overweight comparative breakdown</p>
                  </div>
                  <span className="text-xs px-2.5 py-1 bg-emerald-50 text-emerald-800 font-semibold rounded-lg border border-emerald-200">
                    OPT Plus Standard
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left: Recharts Bar Chart */}
                  <div className="lg:col-span-6 h-64 sm:h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={wfaChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="Normal" fill="#22c55e" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Underweight" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Severely Underweight" fill="#ef4444" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Overweight" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Right: Table */}
                  <div className="lg:col-span-6 overflow-x-auto">
                    <table className="w-full text-xs sm:text-sm text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                          <th className="py-2.5 px-3 font-semibold">Indicator / Status</th>
                          {consolidationData.map((d) => (
                            <th key={d.year} className="py-2.5 px-3 text-center font-bold text-slate-700">{d.year}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        <tr className="bg-slate-50/50 font-semibold">
                          <td className="py-2 px-3">Target Population</td>
                          {consolidationData.map((d) => (
                            <td key={d.year} className="py-2 px-3 text-center">{d.total_population}</td>
                          ))}
                        </tr>
                        <tr className="bg-slate-50/50 font-semibold">
                          <td className="py-2 px-3">Total Weighed</td>
                          {consolidationData.map((d) => (
                            <td key={d.year} className="py-2 px-3 text-center">{d.total_weighed}</td>
                          ))}
                        </tr>
                        <tr className="bg-emerald-50/40 font-bold text-emerald-800">
                          <td className="py-2 px-3">% Weighed Coverage</td>
                          {consolidationData.map((d) => (
                            <td key={d.year} className="py-2 px-3 text-center">{d.weighed_pct}%</td>
                          ))}
                        </tr>
                        <tr>
                          <td className="py-2 px-3 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Normal
                          </td>
                          {consolidationData.map((d) => (
                            <td key={d.year} className="py-2 px-3 text-center">
                              {d.wfa.normal.count} <span className="text-slate-400 text-xs font-normal">({d.wfa.normal.pct}%)</span>
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="py-2 px-3 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-500"></span> Underweight
                          </td>
                          {consolidationData.map((d) => (
                            <td key={d.year} className="py-2 px-3 text-center">
                              {d.wfa.underweight.count} <span className="text-slate-400 text-xs font-normal">({d.wfa.underweight.pct}%)</span>
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="py-2 px-3 flex items-center gap-1.5 text-rose-700 font-semibold">
                            <span className="w-2 h-2 rounded-full bg-rose-500"></span> Severely Underweight
                          </td>
                          {consolidationData.map((d) => (
                            <td key={d.year} className="py-2 px-3 text-center font-bold text-rose-700">
                              {d.wfa.severely_underweight.count} <span className="text-rose-400 text-xs font-normal">({d.wfa.severely_underweight.pct}%)</span>
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="py-2 px-3 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span> Overweight
                          </td>
                          {consolidationData.map((d) => (
                            <td key={d.year} className="py-2 px-3 text-center">
                              {d.wfa.overweight.count} <span className="text-slate-400 text-xs font-normal">({d.wfa.overweight.pct}%)</span>
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Indicator 2: WFH */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-800">2. Weight for Length/Height (WFH)</h2>
                    <p className="text-xs text-slate-500">Wasting indicator: Normal, Wasted (MAM), Severely Wasted (SAM), Overweight, Obese</p>
                  </div>
                  <span className="text-xs px-2.5 py-1 bg-amber-50 text-amber-800 font-semibold rounded-lg border border-amber-200">
                    Acute Malnutrition
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left: Recharts Bar Chart */}
                  <div className="lg:col-span-6 h-64 sm:h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={wfhChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="Normal" fill="#22c55e" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Wasted" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Severely Wasted" fill="#dc2626" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Overweight" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Obese" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Right: Table */}
                  <div className="lg:col-span-6 overflow-x-auto">
                    <table className="w-full text-xs sm:text-sm text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                          <th className="py-2.5 px-3 font-semibold">Classification</th>
                          {consolidationData.map((d) => (
                            <th key={d.year} className="py-2.5 px-3 text-center font-bold text-slate-700">{d.year}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        <tr>
                          <td className="py-2 px-3 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Normal
                          </td>
                          {consolidationData.map((d) => (
                            <td key={d.year} className="py-2 px-3 text-center">
                              {d.wfh.normal.count} <span className="text-slate-400 text-xs font-normal">({d.wfh.normal.pct}%)</span>
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="py-2 px-3 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-500"></span> Wasted (MAM)
                          </td>
                          {consolidationData.map((d) => (
                            <td key={d.year} className="py-2 px-3 text-center">
                              {d.wfh.wasted.count} <span className="text-slate-400 text-xs font-normal">({d.wfh.wasted.pct}%)</span>
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="py-2 px-3 flex items-center gap-1.5 text-rose-700 font-semibold">
                            <span className="w-2 h-2 rounded-full bg-rose-600"></span> Severely Wasted (SAM)
                          </td>
                          {consolidationData.map((d) => (
                            <td key={d.year} className="py-2 px-3 text-center font-bold text-rose-700">
                              {d.wfh.severely_wasted.count} <span className="text-rose-400 text-xs font-normal">({d.wfh.severely_wasted.pct}%)</span>
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="py-2 px-3 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span> Overweight
                          </td>
                          {consolidationData.map((d) => (
                            <td key={d.year} className="py-2 px-3 text-center">
                              {d.wfh.overweight.count} <span className="text-slate-400 text-xs font-normal">({d.wfh.overweight.pct}%)</span>
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="py-2 px-3 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-purple-500"></span> Obese
                          </td>
                          {consolidationData.map((d) => (
                            <td key={d.year} className="py-2 px-3 text-center">
                              {d.wfh.obese.count} <span className="text-slate-400 text-xs font-normal">({d.wfh.obese.pct}%)</span>
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Indicator 3: HFA */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-800">3. Length/Height for Age (HFA)</h2>
                    <p className="text-xs text-slate-500">Stunting indicator: Normal, Stunted, Severely Stunted, Tall</p>
                  </div>
                  <span className="text-xs px-2.5 py-1 bg-purple-50 text-purple-800 font-semibold rounded-lg border border-purple-200">
                    Chronic Malnutrition
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left: Recharts Bar Chart */}
                  <div className="lg:col-span-6 h-64 sm:h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={hfaChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="Normal" fill="#22c55e" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Stunted" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Severely Stunted" fill="#ef4444" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Tall" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Right: Table */}
                  <div className="lg:col-span-6 overflow-x-auto">
                    <table className="w-full text-xs sm:text-sm text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                          <th className="py-2.5 px-3 font-semibold">Classification</th>
                          {consolidationData.map((d) => (
                            <th key={d.year} className="py-2.5 px-3 text-center font-bold text-slate-700">{d.year}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        <tr>
                          <td className="py-2 px-3 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Normal
                          </td>
                          {consolidationData.map((d) => (
                            <td key={d.year} className="py-2 px-3 text-center">
                              {d.hfa.normal.count} <span className="text-slate-400 text-xs font-normal">({d.hfa.normal.pct}%)</span>
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="py-2 px-3 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-500"></span> Stunted
                          </td>
                          {consolidationData.map((d) => (
                            <td key={d.year} className="py-2 px-3 text-center">
                              {d.hfa.stunted.count} <span className="text-slate-400 text-xs font-normal">({d.hfa.stunted.pct}%)</span>
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="py-2 px-3 flex items-center gap-1.5 text-rose-700 font-semibold">
                            <span className="w-2 h-2 rounded-full bg-rose-500"></span> Severely Stunted
                          </td>
                          {consolidationData.map((d) => (
                            <td key={d.year} className="py-2 px-3 text-center font-bold text-rose-700">
                              {d.hfa.severely_stunted.count} <span className="text-rose-400 text-xs font-normal">({d.hfa.severely_stunted.pct}%)</span>
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="py-2 px-3 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-cyan-500"></span> Tall
                          </td>
                          {consolidationData.map((d) => (
                            <td key={d.year} className="py-2 px-3 text-center">
                              {d.hfa.tall.count} <span className="text-slate-400 text-xs font-normal">({d.hfa.tall.pct}%)</span>
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Signatories Block Preview */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Signatories & Approval</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {signatories.map((sig) => (
                    <div key={sig.id || sig.position} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs text-center">
                      <p className="text-xs text-slate-400 font-medium">{sig.position}</p>
                      <div className="h-9 flex items-center justify-center font-bold text-slate-800 text-sm border-b border-slate-200 mt-2">
                        {sig.name || 'Not yet assigned'}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">Official Signatory</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB B: BNS MONTHLY WEIGHT MONITORING CHART
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'monitoring' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Year Selector */}
              <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs sm:text-sm">
                <Calendar size={16} className="text-emerald-700" />
                <span className="font-semibold text-slate-600">Year:</span>
                <select
                  value={monitoringYear}
                  onChange={(e) => setMonitoringYear(Number(e.target.value))}
                  className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
                >
                  {[2024, 2025, 2026, 2027].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              {/* Search Filter */}
              <div className="relative">
                <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search barangay..."
                  value={monitoringSearch}
                  onChange={(e) => setMonitoringSearch(e.target.value)}
                  className="pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>
            </div>

            {/* Print & Export */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrintMonitoringMatrix}
                className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 shadow-sm transition"
              >
                <Printer size={16} />
                <span>Print Matrix (Landscape)</span>
              </button>
              <button
                onClick={handleExportMonitoringExcel}
                className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 shadow-sm transition"
              >
                <FileSpreadsheet size={16} className="text-emerald-600" />
                <span>Export Excel</span>
              </button>
            </div>
          </div>

          {/* Color Legend */}
          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="text-slate-400 uppercase tracking-wider text-[11px]">Legend:</span>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-emerald-100 border border-emerald-400"></span>
              <span>&ge; 90% (Satisfactory)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-amber-100 border border-amber-400"></span>
              <span>60% - 89% (Needs Follow-up)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-rose-100 border border-rose-400"></span>
              <span>&lt; 60% (Critical)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-slate-100 border border-slate-300"></span>
              <span>No data / Future month</span>
            </div>
            <span className="ml-auto text-slate-400 font-normal italic hidden md:inline">
              * Click any cell to view unweighed children
            </span>
          </div>

          {/* Matrix Table */}
          {monitoringLoading ? (
            <div className="py-16 text-center text-slate-400 font-medium">Loading monitoring matrix...</div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-center border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-700 border-b border-slate-200">
                      <th className="py-3 px-3 text-left font-bold text-slate-800 sticky left-0 bg-slate-50 z-10 w-36 shadow-xs">
                        Barangay
                      </th>
                      <th className="py-3 px-2 font-semibold">Target</th>
                      {MONTH_NAMES.map((m) => (
                        <th key={m} className="py-3 px-2 font-semibold">{m}</th>
                      ))}
                      <th className="py-3 px-2 font-bold bg-slate-100">Annual Avg</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {monitoringMatrix.map((row) => (
                      <tr key={row.barangay} className="hover:bg-slate-50/70 transition">
                        <td className="py-2.5 px-3 text-left font-bold text-slate-800 sticky left-0 bg-white z-10 shadow-xs">
                          {row.barangay}
                        </td>
                        <td className="py-2.5 px-2 font-semibold text-slate-600">{row.target}</td>
                        {row.months.map((m) => {
                          let bgClass = 'bg-slate-50 text-slate-400';
                          if (m.status === 'green') bgClass = 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200/60';
                          else if (m.status === 'orange') bgClass = 'bg-amber-50 text-amber-800 font-bold border border-amber-200/60';
                          else if (m.status === 'red') bgClass = 'bg-rose-50 text-rose-800 font-bold border border-rose-200/60';

                          return (
                            <td key={m.month} className="p-1">
                              <button
                                onClick={() => handleCellClick(row.barangay, m.month)}
                                className={`w-full py-1.5 px-1 rounded-lg transition hover:scale-105 cursor-pointer ${bgClass}`}
                                title={`Click to view unweighed children for ${row.barangay} in ${MONTH_NAMES[m.month - 1]}`}
                              >
                                {m.target > 0 && !m.isFuture ? (
                                  <div>
                                    <div className="text-[11px] leading-tight">{m.weighed}/{m.target}</div>
                                    <div className="text-[9.5px] opacity-80">{m.percentage}%</div>
                                  </div>
                                ) : m.weighed > 0 ? (
                                  <div>
                                    <div className="text-[11px] leading-tight">{m.weighed}</div>
                                    <div className="text-[9.5px] opacity-80">{m.percentage}%</div>
                                  </div>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </button>
                            </td>
                          );
                        })}
                        {/* Row Total */}
                        <td className="p-1 bg-slate-50">
                          <div className={`py-1.5 px-1 rounded-lg font-bold ${
                            row.rowTotal.status === 'green' ? 'bg-emerald-100 text-emerald-900' :
                            row.rowTotal.status === 'orange' ? 'bg-amber-100 text-amber-900' :
                            row.rowTotal.status === 'red' ? 'bg-rose-100 text-rose-900' :
                            'bg-slate-100 text-slate-500'
                          }`}>
                            <div className="text-[11px] leading-tight">{row.rowTotal.avgWeighed}/{row.target}</div>
                            <div className="text-[9.5px] opacity-80">{row.rowTotal.percentage}%</div>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {/* Column Totals Row */}
                    <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold">
                      <td className="py-3 px-3 text-left text-slate-800 sticky left-0 bg-slate-100 z-10 shadow-xs">
                        TOTAL
                      </td>
                      <td className="py-3 px-2 text-slate-800">
                        {monitoringColumnTotals.reduce((s, c) => Math.max(s, c.totalTarget), 0)}
                      </td>
                      {monitoringColumnTotals.map((c) => (
                        <td key={c.month} className="p-1">
                          <div className={`py-1.5 px-1 rounded-lg text-xs ${
                            c.status === 'green' ? 'bg-emerald-600 text-white' :
                            c.status === 'orange' ? 'bg-amber-500 text-white' :
                            c.status === 'red' ? 'bg-rose-600 text-white' :
                            'bg-slate-200 text-slate-600'
                          }`}>
                            <div className="text-[11px] leading-tight">{c.totalWeighed}/{c.totalTarget}</div>
                            <div className="text-[9.5px] opacity-90">{c.percentage}%</div>
                          </div>
                        </td>
                      ))}
                      <td className="py-3 px-2 text-slate-800">
                        CONSOLIDATED
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB C: NUTRITION PROGRAMS
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'programs' && (
        <div className="space-y-6">
          {/* Header Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Nutrition Programs & Interventions</h2>
              <p className="text-xs sm:text-sm text-slate-500">
                Philippine Plan of Action for Nutrition (PPAN) framework: Nutrition-Specific, Nutrition-Sensitive & Enabling
              </p>
            </div>

            {isAdmin && (
              <button
                onClick={() => {
                  setEditingProgram(null);
                  setProgramForm({
                    section: 'nutrition_specific',
                    title: '',
                    description: '',
                    coverage_metric: '',
                    sort_order: programsList.length + 1,
                  });
                  setShowProgramModal(true);
                }}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 shadow-sm transition"
              >
                <Plus size={16} />
                <span>Add Program</span>
              </button>
            )}
          </div>

          {/* Quick Metrics Cards */}
          {programsSummary && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                <div className="p-3 bg-emerald-100 text-emerald-800 rounded-xl">
                  <HeartPulse size={22} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500">Supplementary Feeding</p>
                  <p className="text-xl font-bold text-slate-800">
                    {programsSummary.feedingEnrolled}{' '}
                    <span className="text-xs font-normal text-slate-400">/ {programsSummary.totalTarget} enrolled</span>
                  </p>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                <div className="p-3 bg-amber-100 text-amber-800 rounded-xl">
                  <Activity size={22} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500">Vitamin A Supplementation</p>
                  <p className="text-xl font-bold text-slate-800">
                    {programsSummary.vitaminACount}{' '}
                    <span className="text-xs font-normal text-slate-400">/ {programsSummary.totalTarget} covered</span>
                  </p>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                <div className="p-3 bg-purple-100 text-purple-800 rounded-xl">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500">Deworming Program</p>
                  <p className="text-xl font-bold text-slate-800">
                    {programsSummary.dewormingCount}{' '}
                    <span className="text-xs font-normal text-slate-400">/ {programsSummary.totalTarget} covered</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Programs Sections */}
          {programsLoading ? (
            <div className="py-16 text-center text-slate-400 font-medium">Loading programs...</div>
          ) : (
            <div className="space-y-6">
              {[
                { key: 'nutrition_specific', title: '1. Nutrition-Specific Programs', badge: 'Direct Interventions', color: 'emerald' },
                { key: 'nutrition_sensitive', title: '2. Nutrition-Sensitive Programs', badge: 'Underlying Determinants', color: 'blue' },
                { key: 'enabling', title: '3. Enabling Programs & Support', badge: 'Policy & Governance', color: 'amber' },
              ].map((sec) => {
                const secPrograms = programsList.filter((p) => p.section === sec.key);
                return (
                  <div key={sec.key} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                      <div>
                        <h3 className="text-base font-bold text-slate-800">{sec.title}</h3>
                        <p className="text-xs text-slate-500">{sec.badge}</p>
                      </div>
                      <span className={`text-xs px-2.5 py-1 font-semibold rounded-lg ${
                        sec.color === 'emerald' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                        sec.color === 'blue' ? 'bg-blue-50 text-blue-800 border border-blue-200' :
                        'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}>
                        {secPrograms.length} Programs
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {secPrograms.map((prog) => (
                        <div key={prog.id} className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 flex flex-col justify-between hover:border-slate-300 transition">
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="text-sm font-bold text-slate-800">{prog.title}</h4>
                              {isAdmin && (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => {
                                      setEditingProgram(prog);
                                      setProgramForm({
                                        section: prog.section,
                                        title: prog.title,
                                        description: prog.description || '',
                                        coverage_metric: prog.coverage_metric || '',
                                        sort_order: prog.sort_order || 1,
                                      });
                                      setShowProgramModal(true);
                                    }}
                                    className="p-1 text-slate-400 hover:text-slate-600 rounded transition"
                                  >
                                    <Edit size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteProgram(prog.id)}
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{prog.description}</p>
                          </div>

                          {/* Live Coverage Stats if attached */}
                          {prog.coverage && (
                            <div className="mt-4 pt-3 border-t border-slate-200/60">
                              <div className="flex items-center justify-between text-xs font-semibold mb-1">
                                <span className="text-slate-600">{prog.coverage.label}</span>
                                <span className="text-emerald-700 font-bold">{prog.coverage.percentage}%</span>
                              </div>
                              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                                  style={{ width: `${Math.min(prog.coverage.percentage, 100)}%` }}
                                ></div>
                              </div>
                              <p className="text-[10.5px] text-slate-400 mt-1">
                                {prog.coverage_metric === 'feeding'
                                  ? `${prog.coverage.enrolled} active beneficiaries enrolled`
                                  : `${prog.coverage.covered} children covered out of ${prog.coverage.target}`}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB D: LAWS AND REFERENCES
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'laws' && (
        <div className="space-y-6">
          {/* Header Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Nutrition Laws & Statutory References</h2>
              <p className="text-xs sm:text-sm text-slate-500">
                Mandatory legal frameworks governing maternal, infant, and young child nutrition in the Philippines
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search laws..."
                  value={lawsSearch}
                  onChange={(e) => setLawsSearch(e.target.value)}
                  className="pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              {isAdmin && (
                <button
                  onClick={() => {
                    setEditingLaw(null);
                    setLawForm({
                      title: '',
                      legal_basis: '',
                      description: '',
                      file_url: '',
                      category: 'National Law',
                      sort_order: lawsList.length + 1,
                    });
                    setShowLawModal(true);
                  }}
                  className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 shadow-sm transition whitespace-nowrap"
                >
                  <Plus size={16} />
                  <span>Add Law / Ref</span>
                </button>
              )}
            </div>
          </div>

          {/* Reference Cards */}
          {lawsLoading ? (
            <div className="py-16 text-center text-slate-400 font-medium">Loading statutory references...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {lawsList
                .filter(
                  (l) =>
                    !lawsSearch ||
                    l.title.toLowerCase().includes(lawsSearch.toLowerCase()) ||
                    l.legal_basis.toLowerCase().includes(lawsSearch.toLowerCase())
                )
                .map((law) => (
                  <div key={law.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition">
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-xs rounded-lg">
                          {law.legal_basis}
                        </span>
                        {isAdmin && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setEditingLaw(law);
                                setLawForm({
                                  title: law.title,
                                  legal_basis: law.legal_basis,
                                  description: law.description || '',
                                  file_url: law.file_url || '',
                                  category: law.category || 'National Law',
                                  sort_order: law.sort_order || 1,
                                });
                                setShowLawModal(true);
                              }}
                              className="p-1 text-slate-400 hover:text-slate-600 rounded transition"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteLaw(law.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-slate-800 mt-2.5">{law.title}</h3>
                      <p className="text-xs text-slate-600 mt-2 leading-relaxed">{law.description}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                      <span>Category: {law.category || 'National Law'}</span>
                      <span className="text-emerald-700 font-semibold flex items-center gap-1">
                        <ShieldCheck size={14} /> Official Statutory Basis
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: UNWEIGHED CHILDREN
      ───────────────────────────────────────────────────────────── */}
      {unweighedModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[85vh] overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  Unweighed Children &bull; {unweighedModal.barangay}
                </h3>
                <p className="text-xs text-slate-500">
                  {MONTH_NAMES[unweighedModal.month - 1]} {unweighedModal.year} &bull; Active children with no measurement recorded
                </p>
              </div>
              <button
                onClick={() => setUnweighedModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter by child name or purok..."
                  value={unweighedSearch}
                  onChange={(e) => setUnweighedSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none"
                />
              </div>
              <span className="text-xs font-bold text-slate-600 whitespace-nowrap">
                {(unweighedModal.data || []).length} unweighed
              </span>
            </div>

            <div className="overflow-y-auto p-4 flex-1">
              {unweighedModal.loading ? (
                <div className="py-12 text-center text-slate-400 text-xs">Loading children...</div>
              ) : !unweighedModal.data || unweighedModal.data.length === 0 ? (
                <div className="py-12 text-center text-emerald-700 text-xs font-semibold flex flex-col items-center gap-2">
                  <CheckCircle2 size={32} />
                  <span>Great job! All children in this barangay were weighed for this month.</span>
                </div>
              ) : (
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 border-b border-slate-200">
                      <th className="py-2 px-2.5 font-semibold">Child Name</th>
                      <th className="py-2 px-2 font-semibold">Sex</th>
                      <th className="py-2 px-2 font-semibold">Age</th>
                      <th className="py-2 px-2.5 font-semibold">Purok</th>
                      <th className="py-2 px-2.5 font-semibold">Guardian / Contact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {unweighedModal.data
                      .filter(
                        (c) =>
                          !unweighedSearch ||
                          c.full_name.toLowerCase().includes(unweighedSearch.toLowerCase()) ||
                          c.purok.toLowerCase().includes(unweighedSearch.toLowerCase())
                      )
                      .map((c) => (
                        <tr key={c.child_id} className="hover:bg-slate-50">
                          <td className="py-2 px-2.5 font-bold text-slate-800">{c.full_name}</td>
                          <td className="py-2 px-2">{c.sex}</td>
                          <td className="py-2 px-2">{c.age_in_months} mos</td>
                          <td className="py-2 px-2.5 text-slate-600">{c.purok}</td>
                          <td className="py-2 px-2.5">
                            <div>{c.guardian}</div>
                            <div className="text-[10px] text-slate-400">{c.contact}</div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setUnweighedModal(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}



      {/* ─────────────────────────────────────────────────────────────
          MODAL: ADD / EDIT PROGRAM (Admin only)
      ───────────────────────────────────────────────────────────── */}
      {showProgramModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">
                {editingProgram ? 'Edit Nutrition Program' : 'Add Nutrition Program'}
              </h3>
              <button
                onClick={() => setShowProgramModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProgram} className="p-5 space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Section</label>
                <select
                  value={programForm.section}
                  onChange={(e) => setProgramForm({ ...programForm, section: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white font-semibold"
                >
                  <option value="nutrition_specific">Nutrition-Specific (Direct Interventions)</option>
                  <option value="nutrition_sensitive">Nutrition-Sensitive (Underlying Determinants)</option>
                  <option value="enabling">Enabling Programs & Support</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">Program Title</label>
                <input
                  type="text"
                  value={programForm.title}
                  onChange={(e) => setProgramForm({ ...programForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={programForm.description}
                  onChange={(e) => setProgramForm({ ...programForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Coverage Metric Link</label>
                  <select
                    value={programForm.coverage_metric}
                    onChange={(e) => setProgramForm({ ...programForm, coverage_metric: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="">None (Standard Info)</option>
                    <option value="feeding">Supplementary Feeding</option>
                    <option value="vitamin_a">Vitamin A Supplementation</option>
                    <option value="deworming">Deworming Program</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Sort Order</label>
                  <input
                    type="number"
                    value={programForm.sort_order}
                    onChange={(e) => setProgramForm({ ...programForm, sort_order: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowProgramModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-semibold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-semibold transition"
                >
                  Save Program
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: ADD / EDIT LAW (Admin only)
      ───────────────────────────────────────────────────────────── */}
      {showLawModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">
                {editingLaw ? 'Edit Statutory Reference' : 'Add Statutory Reference'}
              </h3>
              <button
                onClick={() => setShowLawModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveLaw} className="p-5 space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Legal Basis / Law Code</label>
                <input
                  type="text"
                  placeholder="e.g. Republic Act No. 10028"
                  value={lawForm.legal_basis}
                  onChange={(e) => setLawForm({ ...lawForm, legal_basis: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">Full Title</label>
                <input
                  type="text"
                  placeholder="e.g. Expanded Breastfeeding Promotion Act of 2009"
                  value={lawForm.title}
                  onChange={(e) => setLawForm({ ...lawForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">Description / Summary</label>
                <textarea
                  rows={3}
                  value={lawForm.description}
                  onChange={(e) => setLawForm({ ...lawForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Category</label>
                  <input
                    type="text"
                    value={lawForm.category}
                    onChange={(e) => setLawForm({ ...lawForm, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Sort Order</label>
                  <input
                    type="number"
                    value={lawForm.sort_order}
                    onChange={(e) => setLawForm({ ...lawForm, sort_order: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowLawModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-semibold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-semibold transition"
                >
                  Save Reference
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
