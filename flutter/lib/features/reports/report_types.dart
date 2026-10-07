enum ReportCategory { consolidation, individualRecord, masterlist }

enum ExportFormat { pdf, excel }

class ReportTypeInfo {
  final String id;
  final String title;
  final ReportCategory category;
  final List<ExportFormat> formats;

  const ReportTypeInfo({
    required this.id,
    required this.title,
    required this.category,
    required this.formats,
  });
}

/// The registry of every report the app can generate. Adding a new
/// report type means adding one entry here — the hub screen, preview
/// screen, and export buttons all read from this list, not a hardcoded UI.
class ReportTypes {
  ReportTypes._();

  // 1. Consolidation Reports
  static const consolidation0to23 = ReportTypeInfo(
    id: 'consolidation_0_23',
    title: 'Consolidation, 0–23 months',
    category: ReportCategory.consolidation,
    formats: [ExportFormat.pdf, ExportFormat.excel],
  );
  static const consolidation24to59 = ReportTypeInfo(
    id: 'consolidation_24_59',
    title: 'Consolidation, 24–59 months',
    category: ReportCategory.consolidation,
    formats: [ExportFormat.pdf, ExportFormat.excel],
  );
  static const underweightSuw = ReportTypeInfo(
    id: 'uw_suw',
    title: 'Underweight / severely underweight',
    category: ReportCategory.consolidation,
    formats: [ExportFormat.pdf, ExportFormat.excel],
  );
  static const stuntedSst = ReportTypeInfo(
    id: 'stunted_sst',
    title: 'Stunted / severely stunted',
    category: ReportCategory.consolidation,
    formats: [ExportFormat.pdf, ExportFormat.excel],
  );
  static const wastedSw = ReportTypeInfo(
    id: 'wasted_sw',
    title: 'Wasted / severely wasted',
    category: ReportCategory.consolidation,
    formats: [ExportFormat.pdf, ExportFormat.excel],
  );

  // 2. Individual Records
  static const monthlyWeightRecord = ReportTypeInfo(
    id: 'monthly_weight_record',
    title: 'Monthly Record of Weight & Weight Status (Underweight/Severely Underweight)',
    category: ReportCategory.individualRecord,
    formats: [ExportFormat.excel],
  );
  static const quarterlyWeighing = ReportTypeInfo(
    id: 'quarterly_weighing',
    title: 'Quarterly Full Weighing Record (24–59 Months)',
    category: ReportCategory.individualRecord,
    formats: [ExportFormat.excel],
  );
  static const optPlus = ReportTypeInfo(
    id: 'opt_plus',
    title: 'OPT Plus Report',
    category: ReportCategory.individualRecord,
    formats: [ExportFormat.excel],
  );

  // 3. Masterlists
  static const childrenMasterlist = ReportTypeInfo(
    id: 'children_masterlist',
    title: 'Children Masterlist',
    category: ReportCategory.masterlist,
    formats: [ExportFormat.pdf, ExportFormat.excel],
  );
  static const lactatingMothersMasterlist = ReportTypeInfo(
    id: 'lactating_mothers_masterlist',
    title: 'Masterlist of Lactating Mothers',
    category: ReportCategory.masterlist,
    formats: [ExportFormat.pdf, ExportFormat.excel],
  );

  static const consolidationTypes = [
    consolidation0to23,
    consolidation24to59,
    underweightSuw,
    stuntedSst,
    wastedSw,
  ];
  static const recordTypes = [
    monthlyWeightRecord,
    quarterlyWeighing,
    optPlus,
  ];
  static const masterlistTypes = [
    childrenMasterlist,
    lactatingMothersMasterlist,
  ];
  static const all = [
    ...consolidationTypes,
    ...recordTypes,
    ...masterlistTypes,
  ];
}
