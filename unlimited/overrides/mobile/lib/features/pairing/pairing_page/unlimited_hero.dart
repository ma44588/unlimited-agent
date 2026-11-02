// Unlimited Agent welcome hero: the landing page's deep look on the phone.
//
// A short headline, one sentence, and a live-looking channel window where an
// employee posts a plan, you approve it, and the build passes. The window loops
// through a few employees while the screen is visible, and stays still when the
// device asks for reduced motion.
import 'dart:math' as math;

import 'package:flutter/material.dart';

class UnlimitedDeep {
  static const bg = Color(0xFF0C0814);
  static const line = Color(0x14FFFFFF);
  static const line2 = Color(0x24FFFFFF);
  static const text = Color(0xFFF4F0FA);
  static const sub = Color(0xFFB4A9C7);
  static const faint = Color(0xFF7D7290);
  static const purple = Color(0xFF7A4793);
  static const magenta = Color(0xFF9A3367);
  static const pink = Color(0xFFE06AA4);
  static const green = Color(0xFF3DDC97);
  static const amber = Color(0xFFF5B955);
  static const sky = Color(0xFF62B6FF);

  static const brandGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [purple, magenta],
  );
  static const headlineGradient = LinearGradient(
    colors: [Color(0xFFD9B8FF), Color(0xFFF08CC0), Color(0xFFFFC6E0)],
    stops: [0, .6, 1],
  );
}

class UnlimitedMark extends StatelessWidget {
  const UnlimitedMark({super.key, this.size = 40});
  final double size;

  @override
  Widget build(BuildContext context) => Container(
    width: size,
    height: size,
    alignment: Alignment.center,
    decoration: BoxDecoration(
      gradient: UnlimitedDeep.brandGradient,
      borderRadius: BorderRadius.circular(size * .3),
      boxShadow: const [
        BoxShadow(
          color: Color(0x99E06AA4),
          blurRadius: 24,
          offset: Offset(0, 8),
          spreadRadius: -6,
        ),
      ],
    ),
    child: Text(
      '∞',
      style: TextStyle(
        fontFamily: 'Inter',
        fontSize: size * .58,
        height: 1,
        fontWeight: FontWeight.w800,
        color: Colors.white,
      ),
    ),
  );
}

class UnlimitedHero extends StatelessWidget {
  const UnlimitedHero({super.key});

  @override
  Widget build(BuildContext context) {
    // Sized from the screen, not from layout constraints: the welcome view
    // measures this widget intrinsically, which a LayoutBuilder cannot answer.
    final h = MediaQuery.sizeOf(context).height;
    final showWindow = h >= 660;
    final showTeam = h >= 780;
    final headline = h < 680 ? 32.0 : 38.0;
    {
      {
        return Align(
          alignment: MediaQuery.sizeOf(context).width > 600
              ? Alignment.center
              : Alignment.topLeft,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 440),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                const UnlimitedMark(size: 40),
                SizedBox(height: h < 700 ? 16 : 26),
                Semantics(
                  header: true,
                  label: 'Your AI team, in your pocket.',
                  child: ExcludeSemantics(
                    child: Text.rich(
                      TextSpan(
                        children: [
                          const TextSpan(text: 'Your '),
                          WidgetSpan(
                            alignment: PlaceholderAlignment.baseline,
                            baseline: TextBaseline.alphabetic,
                            child: ShaderMask(
                              blendMode: BlendMode.srcIn,
                              shaderCallback:
                                  UnlimitedDeep.headlineGradient.createShader,
                              child: Text(
                                'AI team',
                                style: _headlineStyle(headline),
                              ),
                            ),
                          ),
                          const TextSpan(text: ',\nin your pocket.'),
                        ],
                      ),
                      style: _headlineStyle(headline),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                const Text(
                  'Approve plans, follow builds and talk to your employees '
                  'from anywhere. Nothing ships without you.',
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 15,
                    height: 1.5,
                    color: UnlimitedDeep.sub,
                  ),
                ),
                if (showWindow) ...[
                  const SizedBox(height: 20),
                  const _LiveChannelWindow(),
                ],
                if (showTeam) ...[const SizedBox(height: 18), const _TeamRow()],
              ],
            ),
          ),
        );
      }
    }
  }

  static TextStyle _headlineStyle(double size) => TextStyle(
    fontFamily: 'Inter',
    fontSize: size,
    height: 1.04,
    letterSpacing: -size * .04,
    fontWeight: FontWeight.w800,
    color: UnlimitedDeep.text,
  );
}

class _Scene {
  const _Scene(
    this.initials,
    this.name,
    this.role,
    this.colors,
    this.plan,
    this.check,
    this.result,
  );
  final String initials;
  final String name;
  final String role;
  final List<Color> colors;
  final String plan;
  final String check;
  final String result;
}

const _scenes = [
  _Scene(
    'OH',
    'Omar',
    'Developer',
    [Color(0xFFE2457A), Color(0xFFA3245A)],
    'Plan ready · POS dark mode',
    '6 configs checked',
    'build passed on staging',
  ),
  _Scene(
    'LM',
    'Laila',
    'Analyst',
    [Color(0xFF4F7DFF), Color(0xFF2C4FC9)],
    'Spec ready · Sales by branch report',
    '3 branches compared',
    'report live on staging',
  ),
  _Scene(
    'MF',
    'Mariam',
    'Documentation',
    [Color(0xFF10B981), Color(0xFF047857)],
    'Draft ready · POS user guide',
    '12 screenshots taken',
    'guide shared with the team',
  ),
];

class _LiveChannelWindow extends StatefulWidget {
  const _LiveChannelWindow();

  @override
  State<_LiveChannelWindow> createState() => _LiveChannelWindowState();
}

class _LiveChannelWindowState extends State<_LiveChannelWindow>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 8),
  );
  int _scene = 0;
  bool _still = false;

  @override
  void initState() {
    super.initState();
    _c.addStatusListener((s) {
      if (s == AnimationStatus.completed && mounted && !_still) {
        setState(() => _scene = (_scene + 1) % _scenes.length);
        _c.forward(from: 0);
      }
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _still = MediaQuery.disableAnimationsOf(context);
    if (_still) {
      _c.stop();
      _c.value = 1;
    } else if (!_c.isAnimating) {
      _c.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  // Progress (0..1) of a step that runs between [a] and [b] of the loop.
  double _step(double t, double a, double b) =>
      ((t - a) / (b - a)).clamp(0.0, 1.0);

  @override
  Widget build(BuildContext context) {
    final s = _scenes[_scene];
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: UnlimitedDeep.line2),
        gradient: const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xF01D1430), Color(0xF5120C1D)],
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0xCC000000),
            blurRadius: 60,
            offset: Offset(0, 30),
            spreadRadius: -20,
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
            decoration: const BoxDecoration(
              border: Border(bottom: BorderSide(color: UnlimitedDeep.line)),
            ),
            child: Row(
              children: [
                for (var i = 0; i < 3; i++) ...[
                  Container(
                    width: 7,
                    height: 7,
                    decoration: const BoxDecoration(
                      color: Color(0x24FFFFFF),
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 6),
                ],
                const Expanded(
                  child: Text(
                    '# unlimited-solutions',
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: UnlimitedDeep.sub,
                    ),
                  ),
                ),
                const _LiveDot(),
              ],
            ),
          ),
          SizedBox(
            height: 176,
            child: AnimatedBuilder(
              animation: _c,
              builder: (context, _) {
                final t = _c.value;
                final typing = !_still && t < .14;
                final plan = _still ? 1.0 : _step(t, .12, .22);
                final approve = _still ? 1.0 : _step(t, .40, .50);
                final passed = _still ? 1.0 : _step(t, .62, .72);
                final out = _still ? 0.0 : _step(t, .93, 1);
                final pulse = _still
                    ? 0.0
                    : (math.sin(t * math.pi * 10) * .5 + .5) * (1 - approve);
                return Opacity(
                  opacity: 1 - out,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _Message(
                          initials: s.initials,
                          colors: s.colors,
                          name: s.name,
                          role: s.role,
                          child: typing
                              ? const Padding(
                                  padding: EdgeInsets.only(top: 6),
                                  child: _TypingDots(),
                                )
                              : _reveal(plan, _planCard(s, approve, pulse)),
                        ),
                        const SizedBox(height: 10),
                        _reveal(
                          approve,
                          _Message(
                            initials: 'MG',
                            colors: const [
                              Color(0xFF4C5A7A),
                              Color(0xFF2E3850),
                            ],
                            name: 'You',
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Padding(
                                  padding: EdgeInsets.only(top: 2),
                                  child: Text(
                                    'Approved, start ✅',
                                    style: TextStyle(
                                      fontFamily: 'Inter',
                                      fontSize: 12.5,
                                      color: UnlimitedDeep.text,
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 6),
                                Opacity(
                                  opacity: passed == 0 ? 0 : 1,
                                  child: _Chip(
                                    s.result,
                                    Color.lerp(
                                      UnlimitedDeep.faint,
                                      UnlimitedDeep.green,
                                      passed,
                                    )!,
                                    glow: passed > 0 && passed < 1 ? 1 : 0,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          fromRight: true,
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _planCard(_Scene s, double approve, double pulse) => Container(
    margin: const EdgeInsets.only(top: 6),
    padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
    decoration: BoxDecoration(
      borderRadius: BorderRadius.circular(11),
      border: Border.all(color: UnlimitedDeep.line2),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          s.plan,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            fontFamily: 'Inter',
            fontSize: 12.5,
            fontWeight: FontWeight.w700,
            color: UnlimitedDeep.text,
          ),
        ),
        const SizedBox(height: 6),
        Wrap(
          spacing: 6,
          runSpacing: 4,
          children: [
            _Chip(s.check, UnlimitedDeep.sky),
            _Chip(
              approve >= 1 ? 'approved' : 'waiting for you',
              approve >= 1 ? UnlimitedDeep.green : UnlimitedDeep.amber,
              glow: pulse,
            ),
          ],
        ),
      ],
    ),
  );

  Widget _reveal(double p, Widget child, {bool fromRight = false}) {
    if (p <= 0) return Opacity(opacity: 0, child: child);
    final e = Curves.easeOutCubic.transform(p);
    return Opacity(
      opacity: e,
      child: Transform.translate(
        offset: Offset(fromRight ? 14 * (1 - e) : 0, 8 * (1 - e)),
        child: child,
      ),
    );
  }
}

class _Message extends StatelessWidget {
  const _Message({
    required this.initials,
    required this.colors,
    required this.name,
    this.role,
    required this.child,
  });
  final String initials;
  final List<Color> colors;
  final String name;
  final String? role;
  final Widget child;

  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Container(
        width: 28,
        height: 28,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(9),
          gradient: LinearGradient(
            colors: colors,
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: Text(
          initials,
          style: const TextStyle(
            fontFamily: 'Inter',
            fontSize: 10.5,
            fontWeight: FontWeight.w700,
            color: Colors.white,
          ),
        ),
      ),
      const SizedBox(width: 9),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(
                  name,
                  style: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                    color: UnlimitedDeep.text,
                  ),
                ),
                if (role != null) ...[
                  const SizedBox(width: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 6,
                      vertical: 1,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0x2EB06AD9),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      role!,
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFFD9B8FF),
                      ),
                    ),
                  ),
                ],
              ],
            ),
            child,
          ],
        ),
      ),
    ],
  );
}

class _Chip extends StatelessWidget {
  const _Chip(this.label, this.color, {this.glow = 0});
  final String label;
  final Color color;
  final double glow;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
    decoration: BoxDecoration(
      color: color.withValues(alpha: .14),
      borderRadius: BorderRadius.circular(6),
      boxShadow: glow > 0
          ? [
              BoxShadow(
                color: color.withValues(alpha: .35 * glow),
                blurRadius: 12,
              ),
            ]
          : null,
    ),
    child: Text(
      label,
      style: TextStyle(
        fontFamily: 'Inter',
        fontSize: 10.5,
        fontWeight: FontWeight.w600,
        color: color,
      ),
    ),
  );
}

class _LiveDot extends StatelessWidget {
  const _LiveDot();

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Container(
        width: 6,
        height: 6,
        decoration: const BoxDecoration(
          color: UnlimitedDeep.green,
          shape: BoxShape.circle,
          boxShadow: [BoxShadow(color: Color(0x2E3DDC97), spreadRadius: 3)],
        ),
      ),
      const SizedBox(width: 6),
      const Text(
        'live',
        style: TextStyle(
          fontFamily: 'Inter',
          fontSize: 11.5,
          color: UnlimitedDeep.sub,
        ),
      ),
    ],
  );
}

class _TypingDots extends StatefulWidget {
  const _TypingDots();

  @override
  State<_TypingDots> createState() => _TypingDotsState();
}

class _TypingDotsState extends State<_TypingDots>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  )..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Semantics(
    label: 'typing',
    child: AnimatedBuilder(
      animation: _c,
      builder: (context, _) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 0; i < 3; i++)
            Padding(
              padding: const EdgeInsets.only(right: 4),
              child: Opacity(
                opacity:
                    .35 +
                    .65 *
                        (math.sin((_c.value - i * .18) * math.pi * 2) * .5 +
                            .5),
                child: Container(
                  width: 6,
                  height: 6,
                  decoration: const BoxDecoration(
                    color: UnlimitedDeep.sub,
                    shape: BoxShape.circle,
                  ),
                ),
              ),
            ),
        ],
      ),
    ),
  );
}

class _TeamRow extends StatelessWidget {
  const _TeamRow();

  static const _people = [
    ('OH', [Color(0xFFE2457A), Color(0xFFA3245A)]),
    ('LM', [Color(0xFF4F7DFF), Color(0xFF2C4FC9)]),
    ('MF', [Color(0xFF10B981), Color(0xFF047857)]),
    ('NK', [Color(0xFFF59E0B), Color(0xFFB45309)]),
    ('FA', [Color(0xFF7A4793), Color(0xFF421C63)]),
  ];

  @override
  Widget build(BuildContext context) => Row(
    children: [
      SizedBox(
        width: 34 + 25.0 * (_people.length - 1),
        height: 34,
        child: Stack(
          children: [
            for (var i = 0; i < _people.length; i++)
              Positioned(
                left: 25.0 * i,
                child: Container(
                  width: 34,
                  height: 34,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: UnlimitedDeep.bg, width: 2),
                    gradient: LinearGradient(
                      colors: _people[i].$2,
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                  ),
                  child: Text(
                    _people[i].$1,
                    style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 10.5,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
      const SizedBox(width: 12),
      const Expanded(
        child: Text.rich(
          TextSpan(
            children: [
              TextSpan(
                text: 'Developers, analysts, sales\n',
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  color: UnlimitedDeep.text,
                ),
              ),
              TextSpan(text: 'work on your projects day and night'),
            ],
          ),
          style: TextStyle(
            fontFamily: 'Inter',
            fontSize: 12.5,
            height: 1.35,
            color: UnlimitedDeep.sub,
          ),
        ),
      ),
    ],
  );
}
