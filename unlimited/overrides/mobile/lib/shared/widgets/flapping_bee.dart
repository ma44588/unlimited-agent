import 'dart:math' show min;

import 'package:flutter/material.dart';

/// Unlimited Agent: the infinity mark in place of the Buzz bee, with the same
/// API so the pull-to-refresh indicator, the tap-to-flutter mark and the huddle
/// avatars keep working. [flapAmount] gives a gentle squeeze instead of wings;
/// [eyeProgress] fades the mark in while pulling to refresh.
class FlappingBee extends StatelessWidget {
  /// The rendered width of the mark. Height follows the 466:309 aspect ratio.
  final double width;
  final Color color;

  /// 0..1, animated by callers; the mark squeezes slightly as it grows.
  final double flapAmount;

  /// 0..1 while pulling to refresh (fades the mark in), null otherwise.
  final double? eyeProgress;

  const FlappingBee({
    required this.width,
    required this.color,
    required this.flapAmount,
    this.eyeProgress,
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    return RepaintBoundary(
      child: CustomPaint(
        size: Size(width, width * 309 / 466),
        painter: InfinityMarkPainter(
          color: eyeProgress == null
              ? color
              : color.withValues(alpha: 0.35 + 0.65 * eyeProgress!.clamp(0.0, 1.0)),
          squeeze: flapAmount,
        ),
      ),
    );
  }
}

/// The Unlimited infinity mark (viewBox 466 x 309), stroked in [color].
class InfinityMarkPainter extends CustomPainter {
  const InfinityMarkPainter({required this.color, this.squeeze = 0});
  final Color color;
  final double squeeze;

  static Path markPath() => Path()
    ..moveTo(233, 154)
    ..cubicTo(192, 104, 156, 74, 118, 74)
    ..arcToPoint(const Offset(118, 234), radius: const Radius.circular(80), clockwise: false)
    ..cubicTo(156, 234, 192, 204, 233, 154)
    ..cubicTo(274, 104, 310, 74, 348, 74)
    ..arcToPoint(const Offset(348, 234), radius: const Radius.circular(80))
    ..cubicTo(310, 234, 274, 204, 233, 154)
    ..close();

  @override
  void paint(Canvas canvas, Size size) {
    final scale = min(size.width / 466, size.height / 309);
    final sx = 1 - 0.08 * squeeze.clamp(0.0, 1.0);
    canvas
      ..save()
      ..translate(size.width / 2, size.height / 2)
      ..scale(scale * sx, scale)
      ..translate(-233, -154.5)
      ..drawPath(
        markPath(),
        Paint()
          ..color = color
          ..style = PaintingStyle.stroke
          ..strokeWidth = 46
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round
          ..isAntiAlias = true,
      )
      ..restore();
  }

  @override
  bool shouldRepaint(InfinityMarkPainter old) => old.color != color || old.squeeze != squeeze;
}
