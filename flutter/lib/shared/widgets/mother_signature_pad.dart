import 'dart:convert';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_text_styles.dart';

class MotherSignaturePad extends StatefulWidget {
  final String? initialSignature;
  final ValueChanged<String?> onSignatureChanged;
  final String title;

  const MotherSignaturePad({
    super.key,
    this.initialSignature,
    required this.onSignatureChanged,
    this.title = "Mother / Guardian Signature",
  });

  @override
  State<MotherSignaturePad> createState() => _MotherSignaturePadState();
}

class _MotherSignaturePadState extends State<MotherSignaturePad> {
  final List<List<Offset>> _strokes = [];
  String? _signatureBase64;
  bool _isDrawing = false;

  @override
  void initState() {
    super.initState();
    _signatureBase64 = widget.initialSignature;
  }

  Future<void> _captureSignature() async {
    if (_strokes.isEmpty) {
      widget.onSignatureChanged(null);
      setState(() => _signatureBase64 = null);
      return;
    }

    try {
      final recorder = ui.PictureRecorder();
      final canvas = Canvas(recorder, const Rect.fromLTWH(0, 0, 300, 140));
      final paint = Paint()
        ..color = const Color(0xFF1B5E20)
        ..strokeCap = StrokeCap.round
        ..strokeWidth = 3.0;

      // Draw light background
      canvas.drawRect(
        const Rect.fromLTWH(0, 0, 300, 140),
        Paint()..color = Colors.white,
      );

      for (final stroke in _strokes) {
        for (int i = 0; i < stroke.length - 1; i++) {
          canvas.drawLine(stroke[i], stroke[i + 1], paint);
        }
      }

      final picture = recorder.endRecording();
      final img = await picture.toImage(300, 140);
      final byteData = await img.toByteData(format: ui.ImageByteFormat.png);
      if (byteData != null) {
        final base64Str = base64Encode(byteData.buffer.asUint8List());
        final dataUrl = 'data:image/png;base64,$base64Str';
        setState(() {
          _signatureBase64 = dataUrl;
          _isDrawing = false;
        });
        widget.onSignatureChanged(dataUrl);
      }
    } catch (e) {
      debugPrint('Signature capture error: $e');
    }
  }

  void _clear() {
    setState(() {
      _strokes.clear();
      _signatureBase64 = null;
      _isDrawing = true;
    });
    widget.onSignatureChanged(null);
  }

  @override
  Widget build(BuildContext context) {
    final hasExistingSignature = _signatureBase64 != null && _signatureBase64!.isNotEmpty;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade300),
      ),
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Icon(Icons.draw_outlined, size: 18, color: AppColors.primaryGreen),
                  const SizedBox(width: 6),
                  Text(
                    widget.title,
                    style: AppTextStyles.label.copyWith(
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
              if (hasExistingSignature && !_isDrawing)
                TextButton.icon(
                  onPressed: () {
                    setState(() {
                      _isDrawing = true;
                      _strokes.clear();
                    });
                  },
                  icon: const Icon(Icons.edit, size: 14, color: AppColors.primaryGreen),
                  label: const Text('Re-sign', style: TextStyle(fontSize: 12, color: AppColors.primaryGreen)),
                ),
            ],
          ),
          const SizedBox(height: 8),

          if (hasExistingSignature && !_isDrawing) ...[
            Container(
              height: 110,
              width: double.infinity,
              decoration: BoxDecoration(
                color: Colors.grey.shade50,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  if (_signatureBase64!.startsWith('data:image')) ...[
                    Builder(
                      builder: (ctx) {
                        try {
                          final clean = _signatureBase64!.split(',').last;
                          final bytes = base64Decode(clean);
                          return Image.memory(bytes, height: 90, fit: BoxFit.contain);
                        } catch (_) {
                          return const Text('Signature saved', style: TextStyle(color: Colors.grey));
                        }
                      },
                    ),
                  ] else ...[
                    const Text('Signature verified', style: TextStyle(color: AppColors.primaryGreen, fontWeight: FontWeight.bold)),
                  ],
                  Positioned(
                    bottom: 4,
                    right: 8,
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: const [
                        Icon(Icons.check_circle, size: 12, color: AppColors.primaryGreen),
                        SizedBox(width: 4),
                        Text('Signed', style: TextStyle(fontSize: 10, color: AppColors.primaryGreen, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ] else ...[
            Container(
              height: 130,
              width: double.infinity,
              decoration: BoxDecoration(
                color: Colors.grey.shade50,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: AppColors.primaryGreen.withValues(alpha: 0.3),
                  width: 1.5,
                ),
              ),
              child: Stack(
                children: [
                  GestureDetector(
                    onPanStart: (details) {
                      setState(() {
                        _strokes.add([details.localPosition]);
                      });
                    },
                    onPanUpdate: (details) {
                      setState(() {
                        if (_strokes.isNotEmpty) {
                          _strokes.last.add(details.localPosition);
                        }
                      });
                    },
                    onPanEnd: (_) {
                      _captureSignature();
                    },
                    child: CustomPaint(
                      painter: _SignaturePainter(_strokes),
                      size: Size.infinite,
                    ),
                  ),
                  if (_strokes.isEmpty)
                    Center(
                      child: Text(
                        'Sign with finger here',
                        style: TextStyle(
                          color: Colors.grey.shade400,
                          fontSize: 12,
                          fontStyle: FontStyle.italic,
                        ),
                      ),
                    ),
                  Positioned(
                    bottom: 6,
                    left: 12,
                    right: 12,
                    child: Divider(
                      color: Colors.grey.shade300,
                      thickness: 1,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 6),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton.icon(
                  onPressed: _strokes.isEmpty ? null : _clear,
                  icon: const Icon(Icons.clear, size: 14),
                  label: const Text('Clear', style: TextStyle(fontSize: 12)),
                  style: TextButton.styleFrom(
                    foregroundColor: Colors.red.shade700,
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _SignaturePainter extends CustomPainter {
  final List<List<Offset>> strokes;

  _SignaturePainter(this.strokes);

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0xFF1B5E20)
      ..strokeCap = StrokeCap.round
      ..strokeWidth = 3.0;

    for (final stroke in strokes) {
      for (int i = 0; i < stroke.length - 1; i++) {
        canvas.drawLine(stroke[i], stroke[i + 1], paint);
      }
    }
  }

  @override
  bool shouldRepaint(_SignaturePainter oldDelegate) => true;
}
