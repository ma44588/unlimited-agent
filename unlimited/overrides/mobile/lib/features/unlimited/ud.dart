// Unlimited Agent phone design system: the tokens and pieces of the approved
// mobile design board (pastel brand wash in light, deep purple in dark,
// white cards, 18 px radius, brand purple accent).
import 'package:flutter/material.dart';

import '../../shared/theme/mobile_appearance.dart' show ChatColors;

class Ud {
  Ud._(this.dark, this.accent, this.onAccent);
  final bool dark;

  /// The color picked in Appearance (Unlimited purple by default). It paints
  /// buttons, tabs and the page wash, so a new pick changes the whole app.
  final Color accent;
  final Color onAccent;

  static Ud of(BuildContext context) {
    final t = Theme.of(context);
    final chat = t.extension<ChatColors>();
    final dark = t.brightness == Brightness.dark;
    var accent = chat?.outgoing ?? t.colorScheme.primary;
    var on = chat?.foreground ?? t.colorScheme.onPrimary;
    if (accent.toARGB32() == 0xFF7A4794 || accent.toARGB32() == 0xFFC79FDB) {
      accent = dark ? const Color(0xFFC79FDB) : const Color(0xFF7A4794);
      on = dark ? const Color(0xFF2A1238) : Colors.white;
    }
    return Ud._(dark, accent, on);
  }

  static Color _mix(Color a, Color b, double t) => Color.lerp(a, b, t)!;
  bool get _brand =>
      accent.toARGB32() == 0xFF7A4794 || accent.toARGB32() == 0xFFC79FDB;

  Color get bg1 => _brand
      ? (dark ? const Color(0xFF26113A) : const Color(0xFFEEE5F6))
      : (dark
            ? _mix(const Color(0xFF141118), accent, .16)
            : _mix(const Color(0xFFF5F4F7), accent, .11));
  Color get bg2 => _brand
      ? (dark ? const Color(0xFF3A1430) : const Color(0xFFF8E5EF))
      : (dark
            ? _mix(const Color(0xFF0F0D12), accent, .07)
            : _mix(const Color(0xFFF7F6F8), accent, .04));
  Color get card => dark ? const Color(0xFF1F1A26) : Colors.white;
  Color get fg => dark ? const Color(0xFFEFEAF4) : const Color(0xFF1D1A22);
  Color get muted => dark ? const Color(0xFFA79FB2) : const Color(0xFF6B6475);
  Color get line => dark ? const Color(0xFF322A3C) : const Color(0xFFECE6F1);
  Color get accentSoft => _mix(card, accent, dark ? .2 : .1);
  Color get chip => dark ? const Color(0xFF2A2333) : const Color(0xFFF4F0F7);
  static const ok = Color(0xFF16A34A);
  static const warn = Color(0xFFD97706);
  static const danger = Color(0xFFDC2626);

  LinearGradient get wash => LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [bg1, bg2],
  );

  TextStyle get title =>
      TextStyle(fontSize: 14.5, fontWeight: FontWeight.w600, color: fg);
  TextStyle get sub => TextStyle(fontSize: 12.5, color: muted);
}

const udPalette = [
  Color(0xFFE11D48),
  Color(0xFF3B82F6),
  Color(0xFF10B981),
  Color(0xFFF59E0B),
  Color(0xFF6366F1),
  Color(0xFF8B5CF6),
  Color(0xFF0EA5E9),
  Color(0xFF7A4794),
];

Color udColorFor(String key) =>
    udPalette[key.codeUnits.fold<int>(0, (a, b) => a + b) % udPalette.length];

String udInitials(String name) {
  final parts = name
      .trim()
      .split(RegExp(r'\s+'))
      .where((p) => p.isNotEmpty)
      .toList();
  if (parts.isEmpty) return '?';
  return parts.take(2).map((p) => p[0].toUpperCase()).join();
}

/// Pages stay put: no rubber-band bounce that drags the whole screen up
/// and down; pull-to-refresh still works.
const udScroll = ClampingScrollPhysics(
  parent: AlwaysScrollableScrollPhysics(),
);

/// A page on the brand wash with the design's title row.
class UdPage extends StatelessWidget {
  const UdPage({
    super.key,
    this.title,
    this.header,
    this.actions = const [],
    required this.body,
    this.bottom,
    this.back = false,
  });

  final String? title;
  final Widget? header;
  final List<Widget> actions;
  final Widget body;
  final Widget? bottom;
  final bool back;

  @override
  Widget build(BuildContext context) {
    final u = Ud.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(gradient: u.wash),
      child: Scaffold(
        backgroundColor: Colors.transparent,
        body: SafeArea(
          bottom: bottom == null,
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 6, 18, 10),
                child: Row(
                  children: [
                    if (back) ...[
                      UdIconButton(
                        icon: Icons.chevron_left_rounded,
                        tooltip: 'Back',
                        onTap: () => Navigator.of(context).maybePop(),
                      ),
                      const SizedBox(width: 10),
                    ],
                    Expanded(
                      child:
                          header ??
                          Text(
                            title ?? '',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 26,
                              fontWeight: FontWeight.w700,
                              letterSpacing: -.5,
                              color: u.fg,
                            ),
                          ),
                    ),
                    for (final a in actions) ...[const SizedBox(width: 8), a],
                  ],
                ),
              ),
              Expanded(child: body),
              ?bottom,
            ],
          ),
        ),
      ),
    );
  }
}

class UdHeader extends StatelessWidget {
  const UdHeader({super.key, required this.title, this.subtitle});
  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    final u = Ud.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: u.fg,
          ),
        ),
        if (subtitle != null && subtitle!.isNotEmpty)
          Text(
            subtitle!,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: u.sub,
          ),
      ],
    );
  }
}

class UdIconButton extends StatelessWidget {
  const UdIconButton({
    super.key,
    required this.icon,
    required this.tooltip,
    this.onTap,
  });
  final IconData icon;
  final String tooltip;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final u = Ud.of(context);
    return Tooltip(
      message: tooltip,
      child: Material(
        color: u.card,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: u.line),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: onTap,
          child: SizedBox.square(
            dimension: 36,
            child: Icon(icon, size: 20, color: u.fg),
          ),
        ),
      ),
    );
  }
}

class UdCard extends StatelessWidget {
  const UdCard({
    super.key,
    required this.child,
    this.onTap,
    this.padding = const EdgeInsets.fromLTRB(14, 12, 14, 12),
    this.highlight = false,
  });
  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsets padding;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    final u = Ud.of(context);
    return Material(
      color: u.card,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: BorderSide(
          color: highlight
              ? Color.alphaBlend(u.accent.withValues(alpha: .4), u.line)
              : u.line,
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(padding: padding, child: child),
      ),
    );
  }
}

enum UdTone { neutral, ok, warn, accent }

class UdPill extends StatelessWidget {
  const UdPill(this.label, {super.key, this.tone = UdTone.neutral});
  final String label;
  final UdTone tone;

  @override
  Widget build(BuildContext context) {
    final u = Ud.of(context);
    final (bg, fg) = switch (tone) {
      UdTone.ok => (Ud.ok.withValues(alpha: .12), Ud.ok),
      UdTone.warn => (Ud.warn.withValues(alpha: .13), Ud.warn),
      UdTone.accent => (u.accentSoft, u.accent),
      UdTone.neutral => (u.chip, u.muted),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (tone == UdTone.ok) ...[const UdDot(), const SizedBox(width: 5)],
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: fg,
            ),
          ),
        ],
      ),
    );
  }
}

class UdDot extends StatelessWidget {
  const UdDot({super.key, this.color = Ud.ok});
  final Color color;
  @override
  Widget build(BuildContext context) => Container(
    width: 7,
    height: 7,
    decoration: BoxDecoration(color: color, shape: BoxShape.circle),
  );
}

class UdBadge extends StatelessWidget {
  const UdBadge(this.count, {super.key});
  final int count;
  @override
  Widget build(BuildContext context) {
    final u = Ud.of(context);
    return Container(
      constraints: const BoxConstraints(minWidth: 20),
      height: 20,
      padding: const EdgeInsets.symmetric(horizontal: 6),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: u.accent,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        '$count',
        style: TextStyle(
          color: u.onAccent,
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

/// The task cycle bar: done steps green, the current one in brand purple.
class UdStage extends StatelessWidget {
  const UdStage({super.key, required this.steps, required this.done});
  final int steps;
  final int done;

  @override
  Widget build(BuildContext context) {
    final u = Ud.of(context);
    return Row(
      children: [
        for (var i = 0; i < steps; i++) ...[
          if (i > 0) const SizedBox(width: 4),
          Expanded(
            child: Container(
              height: 5,
              decoration: BoxDecoration(
                color: i < done
                    ? Ud.ok
                    : i == done
                    ? u.accent
                    : u.line,
                borderRadius: BorderRadius.circular(3),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class UdAvatar extends StatelessWidget {
  const UdAvatar({
    super.key,
    required this.name,
    this.colorKey,
    this.url,
    this.size = 40,
    this.online = false,
  });
  final String name;
  final String? colorKey;
  final String? url;
  final double size;
  final bool online;

  @override
  Widget build(BuildContext context) {
    final u = Ud.of(context);
    final image = (url ?? '').startsWith('http') ? url : null;
    final box = Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: udColorFor(colorKey ?? name),
        borderRadius: BorderRadius.circular(size * .32),
        image: image == null
            ? null
            : DecorationImage(image: NetworkImage(image), fit: BoxFit.cover),
      ),
      child: image != null
          ? null
          : Text(
              udInitials(name),
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w700,
                fontSize: size * .35,
              ),
            ),
    );
    if (!online) return box;
    return Stack(
      clipBehavior: Clip.none,
      children: [
        box,
        Positioned(
          right: -2,
          bottom: -2,
          child: Container(
            width: size * .3,
            height: size * .3,
            decoration: BoxDecoration(
              color: Ud.ok,
              shape: BoxShape.circle,
              border: Border.all(color: u.card, width: 2),
            ),
          ),
        ),
      ],
    );
  }
}

/// A list row inside a card, separated by hairlines like the design.
class UdItem extends StatelessWidget {
  const UdItem({
    super.key,
    required this.leading,
    required this.title,
    this.subtitle,
    this.trailing,
    this.onTap,
    this.last = false,
  });
  final Widget leading;
  final Widget title;
  final String? subtitle;
  final Widget? trailing;
  final VoidCallback? onTap;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final u = Ud.of(context);
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 2),
        decoration: BoxDecoration(
          border: last ? null : Border(bottom: BorderSide(color: u.line)),
        ),
        child: Row(
          children: [
            leading,
            const SizedBox(width: 11),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  DefaultTextStyle.merge(
                    style: u.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    child: title,
                  ),
                  if (subtitle != null && subtitle!.isNotEmpty)
                    Text(
                      subtitle!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: u.sub,
                    ),
                ],
              ),
            ),
            if (trailing != null) ...[const SizedBox(width: 8), trailing!],
          ],
        ),
      ),
    );
  }
}

class UdButton extends StatelessWidget {
  const UdButton({
    super.key,
    required this.label,
    this.onTap,
    this.ghost = false,
    this.small = false,
    this.danger = false,
  });
  final String label;
  final VoidCallback? onTap;
  final bool ghost;
  final bool small;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final u = Ud.of(context);
    final bg = ghost ? u.card : u.accent;
    final fg = danger ? Ud.danger : (ghost ? u.fg : u.onAccent);
    final radius = BorderRadius.circular(small ? 11 : 14);
    return Opacity(
      opacity: onTap == null ? .5 : 1,
      child: Material(
        color: bg,
        shape: RoundedRectangleBorder(
          borderRadius: radius,
          side: ghost ? BorderSide(color: u.line) : BorderSide.none,
        ),
        child: InkWell(
          borderRadius: radius,
          onTap: onTap,
          child: Padding(
            padding: EdgeInsets.symmetric(
              vertical: small ? 8 : 12,
              horizontal: small ? 12 : 14,
            ),
            child: Center(
              child: Text(
                label,
                style: TextStyle(
                  color: fg,
                  fontWeight: FontWeight.w600,
                  fontSize: small ? 13 : 14,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The design's bottom bar for action screens (approve, send).
class UdComposer extends StatelessWidget {
  const UdComposer({super.key, required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final u = Ud.of(context);
    return Container(
      padding: EdgeInsets.fromLTRB(
        12,
        8,
        12,
        8 + MediaQuery.paddingOf(context).bottom,
      ),
      decoration: BoxDecoration(
        color: u.card.withValues(alpha: .9),
        border: Border(top: BorderSide(color: u.line)),
      ),
      child: Row(children: children),
    );
  }
}

class UdSection extends StatelessWidget {
  const UdSection(this.text, {super.key});
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(4, 6, 4, 6),
    child: Text(text, style: Ud.of(context).sub),
  );
}

class UdMessage extends StatelessWidget {
  const UdMessage({
    super.key,
    required this.icon,
    required this.title,
    required this.text,
    this.action,
    this.onAction,
  });
  final IconData icon;
  final String title;
  final String text;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final u = Ud.of(context);
    return ListView(
physics: udScroll,
      padding: const EdgeInsets.fromLTRB(32, 70, 32, 32),
      children: [
        Icon(icon, size: 40, color: u.muted),
        const SizedBox(height: 14),
        Text(
          title,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.w700,
            color: u.fg,
          ),
        ),
        const SizedBox(height: 6),
        Text(text, textAlign: TextAlign.center, style: u.sub),
        if (action != null) ...[
          const SizedBox(height: 18),
          Center(
            child: SizedBox(
              width: 180,
              child: UdButton(label: action!, onTap: onAction),
            ),
          ),
        ],
      ],
    );
  }
}
