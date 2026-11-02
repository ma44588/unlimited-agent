part of '../pairing_page.dart';

// Unlimited Agent: the landing page's night sky. Near-black violet, three soft
// brand glows, and a faint grid that fades out toward the edges.
class _OnboardingBackground extends StatelessWidget {
  final Widget child;

  const _OnboardingBackground({required this.child});

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      key: const Key('pairing-onboarding-background'),
      decoration: const BoxDecoration(color: Color(0xFF0C0814)),
      child: CustomPaint(
        painter: const _OnboardingShellPainter(isDark: true),
        child: child,
      ),
    );
  }
}

class _OnboardingShellPainter extends CustomPainter {
  final bool isDark;

  const _OnboardingShellPainter({required this.isDark});

  @override
  void paint(Canvas canvas, Size size) {
    if (size.isEmpty) return;
    canvas.save();
    canvas.clipRect(Offset.zero & size);
    _glow(
      canvas,
      size,
      const Offset(0.15, 0.08),
      const Size(0.6, 0.35),
      const Color(0x8C7A4793),
    );
    _glow(
      canvas,
      size,
      const Offset(0.95, 0.3),
      const Size(0.55, 0.3),
      const Color(0x669A3367),
    );
    _glow(
      canvas,
      size,
      const Offset(0.5, 1.0),
      const Size(0.7, 0.4),
      const Color(0xA6421C63),
    );
    _grid(canvas, size);
    canvas.restore();
  }

  void _glow(Canvas canvas, Size size, Offset at, Size radius, Color color) {
    canvas.save();
    canvas.translate(at.dx * size.width, at.dy * size.height);
    canvas.scale(
      radius.width * size.width * sqrt2,
      radius.height * size.height * sqrt2,
    );
    canvas.drawCircle(
      Offset.zero,
      1,
      Paint()
        ..shader = RadialGradient(
          colors: [color, color.withValues(alpha: 0)],
          stops: const [0, 0.7],
        ).createShader(const Rect.fromLTWH(-1, -1, 2, 2)),
    );
    canvas.restore();
  }

  void _grid(Canvas canvas, Size size) {
    const step = 34.0;
    final bounds = Offset.zero & size;
    canvas.saveLayer(bounds, Paint());
    final line = Paint()
      ..color = const Color(0x14FFFFFF)
      ..strokeWidth = 1;
    for (var x = 0.0; x <= size.width; x += step) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), line);
    }
    for (var y = 0.0; y <= size.height; y += step) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), line);
    }
    // Keep the grid only near the top, fading out like the landing page.
    final center = Offset(size.width * 0.5, size.height * 0.22);
    canvas.drawRect(
      bounds,
      Paint()
        ..blendMode = BlendMode.dstIn
        ..shader =
            const RadialGradient(
              colors: [Color(0xFF000000), Color(0x00000000)],
              stops: [0.25, 1],
            ).createShader(
              Rect.fromCenter(
                center: center,
                width: size.width * 1.6,
                height: size.height * 0.9,
              ),
            ),
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(_OnboardingShellPainter oldDelegate) => false;
}
