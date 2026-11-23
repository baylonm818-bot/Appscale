import 'dart:convert';
import 'dart:ui' as ui;
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_text_styles.dart';

class MotherSignaturePad extends StatefulWidget {
  final String? initialSignature;
  final ValueChanged<String?> onSignatureChanged;
  final String title;
  final bool isRequired;
  final String? errorMessage;

  const MotherSignaturePad({
    super.key,
    this.initialSignature,
    required this.onSignatureChanged,
    this.title = "Mother / Guardian Signature",
    this.isRequired = false,
    this.errorMessage,
  });

  @override
  State<MotherSignaturePad> createState() => _MotherSignaturePadState();
}

class _MotherSignaturePadState extends State<MotherSignaturePad> {
  final List<List<Offset>> _strokes = [];
  String? _signatureBase64;
  bool _isDrawing = true;

  @override
  void initState() {
    super.initState();
    _signatureBase64 = widget.initialSignature;
    _isDrawing = widget.initialSignature == null || widget.initialSignature!.isEmpty;
  }

  @override
  void didUpdateWidget(MotherSignaturePad oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.initialSignature != oldWidget.initialSignature &&
        widget.initialSignature != _signatureBase64) {
      setState(() {
        _signatureBase64 = widget.initialSignature;
        _isDrawing = widget.initialSignature == null || widget.initialSignature!.isEmpty;
      });
    }
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
        ..strokeJoin = StrokeJoin.round
        ..strokeWidth = 3.0;

      // Draw light background
      canvas.drawRect(
        const Rect.fromLTWH(0, 0, 300, 140),
        Paint()..color = Colors.white,
      );

      for (final stroke in _strokes) {
        if (stroke.isEmpty) continue;
        if (stroke.length == 1) {
          canvas.drawCircle(stroke[0], 2.0, paint);
        } else {
          for (int i = 0; i < stroke.length - 1; i++) {
            canvas.drawLine(stroke[i], stroke[i + 1], paint);
          }
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
          // Keep _isDrawing = true so user can draw additional strokes if needed
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
    final isMissing = widget.isRequired && !hasExistingSignature;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isMissing ? Colors.red.shade300 : Colors.grey.shade300,
          width: isMissing ? 1.5 : 1.0,
        ),
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
                  Icon(
                    Icons.draw_outlined,
                    size: 18,
                    color: isMissing ? Colors.red.shade700 : AppColors.primaryGreen,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    widget.title,
                    style: AppTextStyles.label.copyWith(
                      color: isMissing ? Colors.red.shade900 : AppColors.textPrimary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  if (widget.isRequired) ...[
                    const SizedBox(width: 4),
                    const Text(
                      '*',
                      style: TextStyle(
                        color: Colors.red,
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                      ),
                    ),
                  ],
                ],
              ),
              if (hasExistingSignature && !_isDrawing)
                TextButton.icon(
                  onPressed: () {
                    setState(() {
                      _isDrawing = true;
                      _strokes.clear();
                      _signatureBase64 = null;
                    });
                    widget.onSignatureChanged(null);
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
                  color: isMissing
                      ? Colors.red.shade400
                      : (_strokes.isNotEmpty
                          ? AppColors.primaryGreen
                          : AppColors.primaryGreen.withValues(alpha: 0.3)),
                  width: 1.5,
                ),
              ),
              child: Stack(
                children: [
                  RawGestureDetector(
                    gestures: {
                      _EagerSignatureGestureRecognizer:
                          GestureRecognizerFactoryWithHandlers<_EagerSignatureGestureRecognizer>(
                        () => _EagerSignatureGestureRecognizer(),
                        (_EagerSignatureGestureRecognizer instance) {
                          instance.onStart = (pos) {
                            setState(() {
                              _strokes.add([pos]);
                            });
                          };
                          instance.onUpdate = (pos) {
                            setState(() {
                              if (_strokes.isNotEmpty) {
                                _strokes.last.add(pos);
                              }
                            });
                          };
                          instance.onEnd = () {
                            _captureSignature();
                          };
                        },
                      ),
                    },
                    behavior: HitTestBehavior.opaque,
                    child: CustomPaint(
                      painter: _SignaturePainter(_strokes),
                      size: Size.infinite,
                    ),
                  ),
                  if (_strokes.isEmpty)
                    IgnorePointer(
                      child: Center(
                        child: Text(
                          'Sign with finger here',
                          style: TextStyle(
                            color: Colors.grey.shade400,
                            fontSize: 12,
                            fontStyle: FontStyle.italic,
                          ),
                        ),
                      ),
                    ),
                  Positioned(
                    bottom: 6,
                    left: 12,
                    right: 12,
                    child: IgnorePointer(
                      child: Divider(
                        color: Colors.grey.shade300,
                        thickness: 1,
                      ),
                    ),
                  ),
                  if (hasExistingSignature)
                    Positioned(
                      top: 6,
                      right: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.primaryGreen.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.check, size: 12, color: AppColors.primaryGreen),
                            SizedBox(width: 3),
                            Text('Signed', style: TextStyle(fontSize: 10, color: AppColors.primaryGreen, fontWeight: FontWeight.bold)),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 6),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                if (isMissing)
                  Text(
                    widget.errorMessage ?? 'Signature is required',
                    style: TextStyle(
                      fontSize: 11,
                      color: Colors.red.shade700,
                      fontWeight: FontWeight.w600,
                    ),
                  )
                else
                  const SizedBox.shrink(),
                TextButton.icon(
                  onPressed: (_strokes.isEmpty && _signatureBase64 == null) ? null : _clear,
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

/// Eager gesture recognizer that unconditionally accepts the pointer immediately on down,
/// disabling any parent Scrollable or drag listeners while drawing.
class _EagerSignatureGestureRecognizer extends OneSequenceGestureRecognizer {
  _EagerSignatureGestureRecognizer() : super(debugOwner: 'EagerSignatureGestureRecognizer');

  ValueChanged<Offset>? onStart;
  ValueChanged<Offset>? onUpdate;
  VoidCallback? onEnd;

  @override
  void addAllowedPointer(PointerDownEvent event) {
    startTrackingPointer(event.pointer, event.transform);
    resolve(GestureDisposition.accepted);
  }

  @override
  void handleEvent(PointerEvent event) {
    if (event is PointerDownEvent) {
      onStart?.call(event.localPosition);
    } else if (event is PointerMoveEvent) {
      onUpdate?.call(event.localPosition);
    } else if (event is PointerUpEvent || event is PointerCancelEvent) {
      onEnd?.call();
      stopTrackingPointer(event.pointer);
    }
  }

  @override
  String get debugDescription => 'eagerSignature';

  @override
  void didStopTrackingLastPointer(int pointer) {}
}

class _SignaturePainter extends CustomPainter {
  final List<List<Offset>> strokes;

  _SignaturePainter(this.strokes);

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0xFF1B5E20)
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..strokeWidth = 3.0;

    for (final stroke in strokes) {
      if (stroke.isEmpty) continue;
      if (stroke.length == 1) {
        canvas.drawCircle(stroke[0], 2.0, paint);
      } else {
        for (int i = 0; i < stroke.length - 1; i++) {
          canvas.drawLine(stroke[i], stroke[i + 1], paint);
        }
      }
    }
  }

  @override
  bool shouldRepaint(_SignaturePainter oldDelegate) => true;
}
