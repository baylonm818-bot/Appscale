import 'package:flutter/foundation.dart';

/// Minimal global "something changed" signal. Any repository that writes
/// data calls AppDataBus.notifyChanged() after saving; any screen showing
/// aggregated data (Dashboard, and later Masterlist counts) wraps its
/// build in a ValueListenableBuilder on AppDataBus.version so it re-reads
/// the repositories the moment new data exists — without needing a full
/// state-management package for what is, for now, one simple event.
class AppDataBus {
  AppDataBus._();
  static final ValueNotifier<int> version = ValueNotifier<int>(0);
  static void notifyChanged() => version.value++;
  
  /// Simple app-wide sync status notifier. Set to `true` when background
  /// sync or resume sync is running so UI can show loading indicators.
  static final ValueNotifier<bool> isSyncing = ValueNotifier<bool>(false);
  static void setSyncing(bool v) => isSyncing.value = v;
}
