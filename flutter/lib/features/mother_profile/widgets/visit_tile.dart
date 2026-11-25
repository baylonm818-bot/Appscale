import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../data/models/mother_visit.dart';
import '../../../shared/utils/app_date_format.dart';
import '../../masterlist/widgets/status_badge.dart';

class VisitTile extends StatelessWidget {
  final MotherVisit visit;
  final bool isLatest;

  const VisitTile({super.key, required this.visit, required this.isLatest});

  @override
  Widget build(BuildContext context) {
    final statusLabel = !visit.present ? 'Missed' : (visit.observation ?? '—');
    final accentColor = !visit.present
        ? AppColors.textMuted
        : (visit.observation == 'Signs of concern'
              ? AppColors.statOrange
              : AppColors.primaryGreen);

    final note = !visit.present
        ? 'No show · rescheduled by BNS'
        : [
            if (visit.observationNote != null) visit.observationNote,
            if (visit.breastfeedingPractice != null)
              '${visit.breastfeedingPractice} confirmed',
            if (visit.hasMedicalConcern && visit.concernNote != null)
              'Concern: ${visit.concernNote}',
          ].whereType<String>().join(' · ');

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              width: 4,
              decoration: BoxDecoration(
                color: accentColor,
                borderRadius: const BorderRadius.horizontal(
                  left: Radius.circular(12),
                ),
              ),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          _formatDate(visit.date),
                          style: AppTextStyles.label.copyWith(fontSize: 14),
                        ),
                        if (isLatest) ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 3,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.lightGreenBg,
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(
                              'Latest',
                              style: TextStyle(
                                color: AppColors.darkGreen,
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                        const Spacer(),
                        StatusBadge(label: statusLabel, color: accentColor),
                      ],
                    ),
                    if (note.isNotEmpty) ...[
                      const SizedBox(height: 10),
                      const Divider(height: 1, color: AppColors.border),
                      const SizedBox(height: 10),
                      Text(
                        note,
                        style: AppTextStyles.body.copyWith(
                          fontSize: 12,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                    _buildSignatureSection(context),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _openSignatureDialog(BuildContext context, Uint8List bytes) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.draw, color: AppColors.primaryGreen, size: 20),
            SizedBox(width: 8),
            Text('Mother\'s Signature', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          ],
        ),
        content: Container(
          width: double.maxFinite,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.border),
          ),
          child: Image.memory(
            bytes,
            fit: BoxFit.contain,
            height: 180,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  Widget _buildSignatureSection(BuildContext context) {
    final sig = visit.signature?.trim();
    if (sig == null || sig.isEmpty) {
      return Padding(
        padding: const EdgeInsets.only(top: 8),
        child: Row(
          children: [
            const Icon(Icons.edit_off_outlined, size: 13, color: AppColors.textMuted),
            const SizedBox(width: 4),
            Text(
              'No signature (before signature feature)',
              style: TextStyle(
                fontSize: 11,
                color: AppColors.textMuted,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      );
    }

    Uint8List? bytes;
    try {
      final clean = sig.startsWith('data:') ? sig.split(',').last : sig;
      bytes = base64Decode(clean);
    } catch (_) {}

    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Row(
        children: [
          if (bytes != null) ...[
            InkWell(
              onTap: () => _openSignatureDialog(context, bytes!),
              borderRadius: BorderRadius.circular(6),
              child: Container(
                width: 56,
                height: 32,
                padding: const EdgeInsets.all(2),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: AppColors.border),
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: Image.memory(
                    bytes,
                    fit: BoxFit.contain,
                    errorBuilder: (_, _, _) => const Icon(Icons.draw, size: 16, color: AppColors.textMuted),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
          ],
          const Icon(Icons.draw, size: 13, color: AppColors.primaryGreen),
          const SizedBox(width: 4),
          InkWell(
            onTap: bytes != null ? () => _openSignatureDialog(context, bytes!) : null,
            child: const Text(
              'Mother\'s Signature Attached',
              style: TextStyle(
                fontSize: 11,
                color: AppColors.primaryGreen,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _formatDate(DateTime d) => AppDateFormat.format(d);
}
