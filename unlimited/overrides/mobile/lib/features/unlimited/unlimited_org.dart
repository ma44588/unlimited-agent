// Unlimited Agent: Today, the org chart, the morning plan and the company
// Odoo link, built to the approved design (Nov 2026 board).
import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import 'ud.dart';
import 'unlimited_api.dart';
import 'unlimited_org_api.dart';
import 'unlimited_screens.dart';

// ---------------------------------------------------------------- pieces
const _weekdays = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];
const _months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

String _hm(String iso) {
  final t = DateTime.tryParse(iso)?.toLocal();
  if (t == null) return '';
  return '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';
}

String _hours(double h) =>
    h == h.roundToDouble() ? '${h.toInt()} h' : '${h.toStringAsFixed(1)} h';

void _toast(BuildContext context, String text) => ScaffoldMessenger.of(
  context,
).showSnackBar(SnackBar(content: Text(text)));

/// Round avatar with a soft two-tone fill and an AI / Human badge.
class UOrgAvatar extends StatelessWidget {
  const UOrgAvatar({
    super.key,
    required this.name,
    required this.id,
    this.url = '',
    this.ai = true,
    this.size = 40,
    this.badge,
  });
  final String name;
  final String id;
  final String url;
  final bool ai;
  final double size;
  final String? badge;

  @override
  Widget build(BuildContext context) {
    final u = Ud.of(context);
    final a = udColorFor(id);
    final b = udPalette[(udPalette.indexOf(a) + 3) % udPalette.length];
    final image = url.startsWith('https://') ? url : null;
    final label = badge ?? (ai ? 'AI' : 'Human');
    return SizedBox(
      width: size + 6,
      height: size + 4,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            width: size,
            height: size,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [a, b],
              ),
              image: image == null
                  ? null
                  : DecorationImage(
                      image: NetworkImage(image),
                      fit: BoxFit.cover,
                    ),
            ),
            child: image != null
                ? null
                : Text(
                    udInitials(name),
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                      fontSize: size * .34,
                    ),
                  ),
          ),
          if (size >= 28 && label.isNotEmpty)
            Positioned(
              right: 0,
              bottom: 0,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 3, vertical: 1),
                decoration: BoxDecoration(
                  color: ai ? u.accent : Ud.ok,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: u.card, width: 1.6),
                ),
                child: Text(
                  label,
                  style: TextStyle(
                    color: ai ? u.onAccent : Colors.white,
                    fontSize: 8,
                    fontWeight: FontWeight.w800,
                    height: 1.1,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Thin rounded progress bar that animates to its value.
class UBar extends StatelessWidget {
  const UBar(this.value, {super.key, this.height = 6});
  final double value;
  final double height;

  @override
  Widget build(BuildContext context) {
    final u = Ud.of(context);
    return ClipRRect(
      borderRadius: BorderRadius.circular(height),
      child: Container(
        height: height,
        color: u.accentSoft,
        alignment: Alignment.centerLeft,
        child: TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: value.clamp(0, 1).toDouble()),
          duration: const Duration(milliseconds: 700),
          curve: Curves.easeOutCubic,
          builder: (_, v, _) => FractionallySizedBox(
            widthFactor: v,
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(height),
                gradient: LinearGradient(
                  colors: [u.accent, Color.lerp(u.accent, Ud.danger, .35)!],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Ring extends StatelessWidget {
  const _Ring(this.percent);
  final int percent;

  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
    tween: Tween(begin: 0, end: percent / 100),
    duration: const Duration(milliseconds: 900),
    curve: Curves.easeOutCubic,
    builder: (_, v, _) => SizedBox(
      width: 76,
      height: 76,
      child: CustomPaint(
        painter: _RingPainter(v),
        child: Center(
          child: Text(
            '${(v * 100).round()}%',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
      ),
    ),
  );
}

class _RingPainter extends CustomPainter {
  _RingPainter(this.v);
  final double v;
  @override
  void paint(Canvas canvas, Size size) {
    final r = Rect.fromLTWH(4, 4, size.width - 8, size.height - 8);
    final bg = Paint()
      ..color = Colors.white.withValues(alpha: .15)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 8;
    final fg = Paint()
      ..color = const Color(0xFFE6BDF5)
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeWidth = 8;
    canvas.drawArc(r, 0, math.pi * 2, false, bg);
    if (v > 0) canvas.drawArc(r, -math.pi / 2, math.pi * 2 * v, false, fg);
  }

  @override
  bool shouldRepaint(_RingPainter oldDelegate) => oldDelegate.v != v;
}

/// Fades and lifts its child in once, staggered by [index].
class UEnter extends StatelessWidget {
  const UEnter({super.key, required this.index, required this.child});
  final int index;
  final Widget child;
  @override
  Widget build(BuildContext context) {
    if (MediaQuery.disableAnimationsOf(context)) return child;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Duration(milliseconds: 380 + 60 * math.min(index, 6)),
      curve: Curves.easeOutCubic,
      builder: (_, v, c) => Opacity(
        opacity: v,
        child: Transform.translate(offset: Offset(0, 14 * (1 - v)), child: c),
      ),
      child: child,
    );
  }
}

Widget _card(BuildContext context, List<Widget> rows) => UdCard(
  padding: const EdgeInsets.fromLTRB(14, 4, 14, 4),
  child: Column(children: rows),
);

// ---------------------------------------------------------------- Today
class _TodayLoad {
  _TodayLoad(this.today, this.board);
  final TodayData today;
  final UBoard? board;
}

Future<_TodayLoad> _loadToday(UnlimitedApi api) async {
  final boardF = loadBoard(
    api,
  ).then<UBoard?>((b) => b).catchError((Object _) => null);
  return _TodayLoad(await api.today(), await boardF);
}

class UTodayScreen extends ConsumerWidget {
  const UTodayScreen({super.key, this.onOpenTeam});

  /// Switches the app to the Team tab (org chart).
  final VoidCallback? onOpenTeam;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final u = Ud.of(context);
    final now = DateTime.now();
    final part = now.hour < 12
        ? 'Good morning'
        : (now.hour < 17 ? 'Good afternoon' : 'Good evening');
    return UdPage(
      header: Text(
        '${_weekdays[now.weekday - 1]} ${now.day} ${_months[now.month - 1]}',
        style: u.sub.copyWith(fontSize: 13),
      ),
      body: ULoad<_TodayLoad>(
        load: _loadToday,
        builder: (context, l, reload) {
          final t = l.today;
          final b = l.board;
          return ListView(
            physics: udScroll,
            padding: const EdgeInsets.fromLTRB(14, 0, 14, 24),
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(4, 0, 4, 12),
                child: Text(
                  '$part, ${t.me.first}',
                  style: TextStyle(
                    fontSize: 25,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -.5,
                    color: u.fg,
                  ),
                ),
              ),
              UEnter(index: 0, child: _Hero(t)),
              if (!t.odoo && t.me.isOwner)
                UEnter(
                  index: 1,
                  child: _SetupCard(
                    icon: Icons.link_rounded,
                    title: 'Connect your company Odoo',
                    text:
                        'Employees read their tasks from it every morning and update it as they work.',
                    action: 'Connect',
                    onTap: () async {
                      await Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => const UCompanyOdooScreen(),
                        ),
                      );
                      await reload();
                    },
                  ),
                )
              else if (t.odoo && !t.hasTeams && t.me.isOwner)
                UEnter(
                  index: 1,
                  child: _SetupCard(
                    icon: Icons.account_tree_outlined,
                    title: 'Set up your team',
                    text:
                        'Pick a lead and who reports to them. The lead drafts a plan every morning.',
                    action: 'Open org chart',
                    onTap: onOpenTeam,
                  ),
                ),
              ..._needs(context, ref, t, b, reload),
              for (final (i, team) in t.teams.indexed)
                UEnter(index: 3 + i, child: _TeamCard(team)),
              if (t.teams.isEmpty && t.odoo && t.hasTeams)
                Padding(
                  padding: const EdgeInsets.only(top: 18),
                  child: Text(
                    'No plan yet today. Leads draft at ${t.settings['plan_at'] ?? '08:00'} on workdays.',
                    textAlign: TextAlign.center,
                    style: u.sub,
                  ),
                ),
            ],
          );
        },
      ),
    );
  }

  List<Widget> _needs(
    BuildContext context,
    WidgetRef ref,
    TodayData t,
    UBoard? b,
    Future<void> Function() reload,
  ) {
    final u = Ud.of(context);
    final cards = <Widget>[];
    for (final ask in t.needs) {
      cards.add(
        UdCard(
          highlight: true,
          onTap: () async {
            await Navigator.of(context).push(
              MaterialPageRoute<void>(builder: (_) => UPlanScreen(id: ask.id)),
            );
            await reload();
          },
          child: Row(
            children: [
              UOrgAvatar(name: ask.lead.name, id: ask.lead.id),
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const UdPill('Plan to approve', tone: UdTone.accent),
                    const SizedBox(height: 5),
                    Text(
                      "${ask.lead.first}'s team: ${ask.tasks} tasks for ${ask.people} people",
                      style: u.title,
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right_rounded, color: u.muted),
            ],
          ),
        ),
      );
    }
    var waiting = 0;
    if (b != null) {
      for (final p in b.overview.projects) {
        for (final a in b.statuses[p.id]?.approvals ?? const <Approval>[]) {
          waiting++;
          if (cards.length >= 3) continue;
          cards.add(
            UdCard(
              highlight: true,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const UdPill('Needs you', tone: UdTone.warn),
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text(
                          p.name,
                          style: u.sub,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 7),
                  Text(
                    a.reason.isEmpty ? a.tool : a.reason,
                    style: u.title.copyWith(fontSize: 15),
                  ),
                  Text('${b.who(a.agent)} · ${a.tool}', style: u.sub),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: UdButton(
                          label: 'Approve',
                          small: true,
                          onTap: () async {
                            await _decideApproval(context, ref, a.id, true);
                            await reload();
                          },
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: UdButton(
                          label: 'Reject',
                          small: true,
                          ghost: true,
                          onTap: () async {
                            await _decideApproval(context, ref, a.id, false);
                            await reload();
                          },
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        }
      }
      waiting += b.emails.length;
    }
    final total = t.needs.length + waiting;
    if (total == 0) return const [];
    return [
      Padding(
        padding: const EdgeInsets.fromLTRB(4, 14, 4, 8),
        child: Row(
          children: [
            Expanded(child: Text('Needs you ($total)', style: u.sub)),
            if (b != null)
              GestureDetector(
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => const UInboxScreen(back: true),
                  ),
                ),
                child: Text(
                  'See all',
                  style: u.sub.copyWith(
                    color: u.accent,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
          ],
        ),
      ),
      for (final (i, c) in cards.indexed)
        UEnter(
          index: 1 + i,
          child: Padding(padding: const EdgeInsets.only(bottom: 10), child: c),
        ),
    ];
  }
}

Future<void> _decideApproval(
  BuildContext context,
  WidgetRef ref,
  String id,
  bool ok,
) async {
  try {
    await uApi(ref).decideApproval(id, ok);
    unawaited(HapticFeedback.mediumImpact());
    if (context.mounted) _toast(context, ok ? 'Approved' : 'Rejected');
  } catch (e) {
    if (context.mounted) _toast(context, e.toString());
  }
}

class _Hero extends StatelessWidget {
  const _Hero(this.t);
  final TodayData t;

  @override
  Widget build(BuildContext context) {
    final u = Ud.of(context);
    final approved = t.teams.where((x) => x.status == 'approved').toList();
    final pending = t.teams.where((x) => x.status == 'pending').toList();
    String pill;
    if (approved.isNotEmpty && approved.first.decidedBy != null) {
      final d = approved.first;
      pill = 'Approved by ${d.decidedBy!.first} at ${_hm(d.decidedAt)}';
    } else if (pending.isNotEmpty) {
      pill = 'Waiting for ${pending.first.approver?.first ?? 'approval'}';
    } else {
      pill = t.odoo ? 'No plan yet' : 'Odoo not connected';
    }
    final title = t.tasks == 0
        ? "Today's plan"
        : "Today's plan: ${t.tasks} task${t.tasks == 1 ? '' : 's'}";
    final line = t.tasks == 0
        ? (pending.isNotEmpty
              ? 'A plan is waiting for approval'
              : 'Tasks show here once a plan is approved')
        : '${t.done} done, ${t.open} in progress, ${t.blocked} blocked';
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color.lerp(u.accent, Colors.black, .45)!,
            Color.lerp(
              Color.lerp(u.accent, Ud.danger, .45)!,
              Colors.black,
              .35,
            )!,
          ],
        ),
      ),
      child: Row(
        children: [
          _Ring(t.percent),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  line,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: .78),
                    fontSize: 12.5,
                  ),
                ),
                const SizedBox(height: 9),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 9,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: .15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    pill,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SetupCard extends StatelessWidget {
  const _SetupCard({
    required this.icon,
    required this.title,
    required this.text,
    required this.action,
    this.onTap,
  });
  final IconData icon;
  final String title;
  final String text;
  final String action;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final u = Ud.of(context);
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: UdCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, color: u.accent, size: 20),
                const SizedBox(width: 8),
                Expanded(child: Text(title, style: u.title)),
              ],
            ),
            const SizedBox(height: 4),
            Text(text, style: u.sub),
            const SizedBox(height: 10),
            UdButton(label: action, small: true, onTap: onTap),
          ],
        ),
      ),
    );
  }
}

class _TeamCard extends StatelessWidget {
  const _TeamCard(this.team);
  final TeamDay team;

  @override
  Widget build(BuildContext context) {
    final u = Ud.of(context);
    final lead = team.lead;
    final pending = team.status == 'pending';
    final rows = team.rows.where((r) => r.total > 0 || !pending).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 14, 4, 8),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  lead == null ? 'Team' : "${lead.first}'s team",
                  style: u.sub,
                ),
              ),
              if (pending)
                const UdPill('Waiting for approval', tone: UdTone.warn)
              else if (team.status == 'rejected')
                const UdPill('Sent back', tone: UdTone.warn)
              else
                Text('${team.rows.length}', style: u.sub),
            ],
          ),
        ),
        _card(context, [
          for (final (i, r) in rows.indexed)
            _PersonDayRow(
              row: r,
              last: i == rows.length - 1,
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => UPersonScreen(id: r.member.id),
                ),
              ),
            ),
          if (rows.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 14),
              child: Text('No tasks in this plan.', style: u.sub),
            ),
        ]),
        for (final n in team.notes)
          Padding(
            padding: const EdgeInsets.fromLTRB(4, 6, 4, 0),
            child: Text(n, style: u.sub),
          ),
      ],
    );
  }
}

class _PersonDayRow extends StatelessWidget {
  const _PersonDayRow({required this.row, required this.last, this.onTap});
  final PlanRow row;
  final bool last;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final u = Ud.of(context);
    final r = row;
    final allDone = r.total > 0 && r.done == r.total;
    final blockedTask = r.tasks.where((t) => t.blocked).firstOrNull;
    final line = allDone
        ? 'All done'
        : blockedTask != null
        ? 'Blocked: ${blockedTask.name}'
        : (r.now.isNotEmpty ? 'Now: ${r.now}' : 'No tasks');
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          border: last ? null : Border(bottom: BorderSide(color: u.line)),
        ),
        child: Row(
          children: [
            UOrgAvatar(
              name: r.member.name,
              id: r.member.id,
              url: r.member.avatar,
              ai: r.member.isAi,
              size: 34,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${r.member.first}, ${r.total} task${r.total == 1 ? '' : 's'}',
                    style: u.title.copyWith(fontSize: 13.5),
                  ),
                  const SizedBox(height: 6),
                  UBar(r.total == 0 ? 0 : r.done / r.total),
                  const SizedBox(height: 4),
                  Text(
                    line,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: u.sub.copyWith(
                      color: blockedTask != null && !allDone ? Ud.warn : null,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------- Plan
class UPlanScreen extends ConsumerStatefulWidget {
  const UPlanScreen({super.key, required this.id});
  final String id;
  @override
  ConsumerState<UPlanScreen> createState() => _UPlanScreenState();
}

class _UPlanScreenState extends ConsumerState<UPlanScreen> {
  late Future<(PlanDetail, int)> _f = _load();
  final _moves = <int, String>{}; // task id -> member id
  bool _busy = false;

  Future<(PlanDetail, int)> _load() async {
    final api = uApi(ref);
    final minutesF = api
        .today()
        .then((t) => t.escalateMinutes)
        .catchError((Object _) => 30);
    return (await api.plan(widget.id), await minutesF);
  }

  Future<void> _decide(bool approve) async {
    var note = '';
    if (!approve) {
      final c = TextEditingController();
      final ok = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Send the plan back'),
          content: TextField(
            controller: c,
            autofocus: true,
            maxLines: 3,
            decoration: const InputDecoration(hintText: 'What should change?'),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel'),
            ),
            TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Send back'),
            ),
          ],
        ),
      );
      if (ok != true) return;
      note = c.text;
    }
    setState(() => _busy = true);
    try {
      await uApi(ref).decidePlan(
        widget.id,
        approve: approve,
        note: note,
        moves: [
          for (final e in _moves.entries) {'task': e.key, 'to': e.value},
        ],
      );
      unawaited(HapticFeedback.mediumImpact());
      if (!mounted) return;
      _toast(
        context,
        approve ? 'Plan approved. The team has it.' : 'Sent back to the lead.',
      );
      Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) _toast(context, e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _move(PlanDetail p, PlanTask t, String from) async {
    final u = Ud.of(context);
    final to = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: u.card,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
              child: Text('Move "${t.name}" to', style: u.title),
            ),
            for (final m in p.team)
              if (m.id != from)
                ListTile(
                  leading: UOrgAvatar(
                    name: m.name,
                    id: m.id,
                    url: m.avatar,
                    ai: m.isAi,
                    size: 32,
                  ),
                  title: Text(m.name),
                  subtitle: Text(m.title),
                  onTap: () => Navigator.pop(ctx, m.id),
                ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
    if (to != null) setState(() => _moves[t.id] = to);
  }

  @override
  Widget build(BuildContext context) {
    final u = Ud.of(context);
    return FutureBuilder<(PlanDetail, int)>(
      future: _f,
      builder: (context, snap) {
        if (!snap.hasData) {
          return UdPage(
            back: true,
            title: 'Plan',
            body: snap.hasError
                ? UdMessage(
                    icon: Icons.cloud_off_rounded,
                    title: "Couldn't load the plan",
                    text: snap.error.toString(),
                    action: 'Try again',
                    onAction: () => setState(() => _f = _load()),
                  )
                : const Center(child: CircularProgressIndicator.adaptive()),
          );
        }
        final (p, minutes) = snap.data!;
        final day = DateTime.tryParse(p.date);
        final byMember = {for (final r in p.rows) r.member.id: <PlanTask>[]};
        for (final r in p.rows) {
          for (final t in r.tasks) {
            byMember[_moves[t.id] ?? r.member.id]?.add(t);
          }
        }
        final rows = p.rows;
        final total = rows.fold<int>(0, (a, r) => a + r.tasks.length);
        final pending = p.status == 'pending';
        return UdPage(
          back: true,
          title: day == null
              ? 'Plan'
              : 'Plan for ${_weekdays[day.weekday - 1]}',
          bottom: pending
              ? UdComposer(
                  children: [
                    Expanded(
                      child: UdButton(
                        label: 'Send back',
                        ghost: true,
                        onTap: _busy ? null : () => _decide(false),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      flex: 2,
                      child: UdButton(
                        label: 'Approve plan',
                        onTap: _busy ? null : () => _decide(true),
                      ),
                    ),
                  ],
                )
              : null,
          body: ListView(
            physics: udScroll,
            padding: const EdgeInsets.fromLTRB(14, 0, 14, 24),
            children: [
              UdCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        UOrgAvatar(name: p.lead.name, id: p.lead.id),
                        const SizedBox(width: 11),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                "${p.lead.first} drafted today's plan",
                                style: u.title,
                              ),
                              Text(
                                '${_hm(p.createdAt)} · $total Odoo tasks for ${rows.length} people',
                                style: u.sub,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        UdPill(
                          'Approver: ${p.approver.first}',
                          tone: UdTone.accent,
                        ),
                        if (pending && !p.approver.isOwner)
                          UdPill('Goes up if no answer in $minutes min'),
                        if (!pending)
                          UdPill(
                            p.status == 'approved' ? 'Approved' : 'Sent back',
                            tone: p.status == 'approved'
                                ? UdTone.ok
                                : UdTone.warn,
                          ),
                      ],
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(4, 14, 4, 8),
                child: Row(
                  children: [
                    Expanded(child: Text('Assignments', style: u.sub)),
                    if (pending) Text('Tap a task to move it', style: u.sub),
                  ],
                ),
              ),
              _card(context, [
                for (final (i, r) in rows.indexed)
                  _AssignRow(
                    member: r.member,
                    tasks: byMember[r.member.id] ?? const [],
                    moved: _moves,
                    last: i == rows.length - 1,
                    onTask: pending ? (t) => _move(p, t, r.member.id) : null,
                  ),
              ]),
              for (final n in p.notes)
                Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: UdCard(
                    child: Row(
                      children: [
                        const Icon(
                          Icons.info_outline_rounded,
                          color: Ud.warn,
                          size: 20,
                        ),
                        const SizedBox(width: 10),
                        Expanded(child: Text(n, style: u.sub)),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}

class _AssignRow extends StatelessWidget {
  const _AssignRow({
    required this.member,
    required this.tasks,
    required this.moved,
    required this.last,
    this.onTask,
  });
  final OrgPerson member;
  final List<PlanTask> tasks;
  final Map<int, String> moved;
  final bool last;
  final void Function(PlanTask)? onTask;

  @override
  Widget build(BuildContext context) {
    final u = Ud.of(context);
    final hours = tasks.fold<double>(0, (a, t) => a + t.hours);
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: BoxDecoration(
        border: last ? null : Border(bottom: BorderSide(color: u.line)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          UOrgAvatar(
            name: member.name,
            id: member.id,
            url: member.avatar,
            ai: member.isAi,
            size: 30,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(member.name, style: u.title.copyWith(fontSize: 13.5)),
                if (tasks.isEmpty) Text('Free today', style: u.sub),
                for (final t in tasks)
                  InkWell(
                    onTap: onTask == null ? null : () => onTask!(t),
                    child: Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(
                        '${t.ref} ${t.name}${moved.containsKey(t.id) ? '  (moved)' : ''}',
                        style: u.sub.copyWith(
                          color: moved.containsKey(t.id) ? u.accent : null,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          if (hours > 0) Text(_hours(hours), style: u.sub),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------- Team home
class _TeamLoad {
  _TeamLoad(this.org, this.today, this.employees);
  final OrgData org;
  final TodayData? today;
  final List<Employee> employees;
}

Future<_TeamLoad> _loadTeam(UnlimitedApi api) async {
  final todayF = api
      .today()
      .then<TodayData?>((t) => t)
      .catchError((Object _) => null);
  final empF = api.employees().catchError((Object _) => <Employee>[]);
  return _TeamLoad(await api.org(), await todayF, await empF);
}

/// Team tab: List, Org chart, Workload.
class UTeamHome extends ConsumerStatefulWidget {
  const UTeamHome({super.key});
  @override
  ConsumerState<UTeamHome> createState() => _UTeamHomeState();
}

class _UTeamHomeState extends ConsumerState<UTeamHome> {
  int _seg = 1;
  Key _key = UniqueKey();

  void _refresh() => setState(() => _key = UniqueKey());

  @override
  Widget build(BuildContext context) {
    final u = Ud.of(context);
    return UdPage(
      title: 'Team',
      actions: [
        UdIconButton(
          icon: Icons.person_add_alt_1_outlined,
          tooltip: 'Add a person',
          onTap: () async {
            final added = await Navigator.of(context).push<bool>(
              MaterialPageRoute(builder: (_) => const UAddPersonScreen()),
            );
            if (added == true) _refresh();
          },
        ),
      ],
      body: Column(
        children: [
          SizedBox(
            height: 44,
            child: ListView(
              scrollDirection: Axis.horizontal,
              physics: const ClampingScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 10),
              children: [
                for (final (i, l) in const [
                  'List',
                  'Org chart',
                  'Workload',
                ].indexed) ...[
                  if (i > 0) const SizedBox(width: 6),
                  USeg(
                    label: l,
                    on: _seg == i,
                    onTap: () => setState(() => _seg = i),
                  ),
                ],
              ],
            ),
          ),
          Expanded(
            child: ULoad<_TeamLoad>(
              key: _key,
              load: _loadTeam,
              builder: (context, l, reload) {
                Future<void> open(OrgPerson p) async {
                  if (p.isAi) {
                    final e = l.employees
                        .where((x) => x.slug == p.slug)
                        .firstOrNull;
                    if (e != null) {
                      await Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => UEmployeeScreen(employee: e),
                        ),
                      );
                      await reload();
                      return;
                    }
                  }
                  await Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => UPersonScreen(id: p.id),
                    ),
                  );
                  await reload();
                }

                return AnimatedSwitcher(
                  duration: const Duration(milliseconds: 180),
                  child: switch (_seg) {
                    0 => KeyedSubtree(
                      key: const ValueKey(0),
                      child: uTeamList(context, l.employees),
                    ),
                    1 => _OrgChart(
                      key: const ValueKey(1),
                      org: l.org,
                      today: l.today,
                      onOpen: open,
                      onEditDept: (d) async {
                        final changed = await Navigator.of(context).push<bool>(
                          MaterialPageRoute(
                            builder: (_) => UDeptEditScreen(org: l.org, dept: d),
                          ),
                        );
                        if (changed == true) await reload();
                      },
                    ),
                    _ => _Workload(
                      key: const ValueKey(2),
                      org: l.org,
                      today: l.today,
                      onOpen: open,
                      empty: Text(
                        'Workload fills in once a plan is approved today.',
                        textAlign: TextAlign.center,
                        style: u.sub,
                      ),
                    ),
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class USeg extends StatelessWidget {
  const USeg({
    super.key,
    required this.label,
    required this.on,
    required this.onTap,
  });
  final String label;
  final bool on;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final u = Ud.of(context);
    return Material(
      color: on ? u.accent : u.card,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(11),
        side: on ? BorderSide.none : BorderSide(color: u.line),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(11),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: on ? u.onAccent : u.muted,
            ),
          ),
        ),
      ),
    );
  }
}

(String, UdTone) _state(PlanRow? r) {
  if (r == null || r.total == 0) return ('Free', UdTone.neutral);
  if (r.done == r.total) return ('Done', UdTone.ok);
  if (r.blocked > 0) return ('Blocked', UdTone.warn);
  return ('On track', UdTone.ok);
}

class _OrgChart extends StatelessWidget {
  const _OrgChart({
    super.key,
    required this.org,
    required this.today,
    required this.onOpen,
    required this.onEditDept,
  });
  final OrgData org;
  final TodayData? today;
  final Future<void> Function(OrgPerson) onOpen;
  final Future<void> Function(Dept?) onEditDept;

  @override
  Widget build(BuildContext context) {
    if (org.people.isEmpty) {
      return Center(child: Text('The team is loading…', style: Ud.of(context).sub));
    }
    if (org.depts.isNotEmpty) return _deptTree(context);
    final u = Ud.of(context);
    final line = Color.lerp(u.line, u.accent, .25)!;
    Widget vline() => Container(
      width: 2,
      height: 12,
      margin: const EdgeInsets.symmetric(vertical: 5),
      color: line,
    );
    Widget node(OrgPerson p, {double size = 44}) => InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: () => onOpen(p),
      child: SizedBox(
        width: 96,
        child: Column(
          children: [
            UOrgAvatar(
              name: p.name,
              id: p.id,
              url: p.avatar,
              ai: p.isAi,
              size: size,
              badge: p.isOwner ? 'You' : null,
            ),
            const SizedBox(height: 4),
            Text(
              p.isOwner ? p.name : p.first,
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: u.title.copyWith(fontSize: 12),
            ),
            Text(
              p.title.isEmpty
                  ? (p.isAi ? 'AI employee' : 'Teammate')
                  : p.title,
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: u.sub.copyWith(fontSize: 10.5),
            ),
            if (!p.isAi && !p.isOwner && p.approves.contains('plan'))
              Text(
                'approves plans',
                style: TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w700,
                  color: u.accent,
                ),
              ),
          ],
        ),
      ),
    );

    String subOf(OrgPerson m) {
      if (!m.isAi) {
        return m.approves.isEmpty
            ? 'Teammate'
            : 'Approves ${m.approves.join(', ')}';
      }
      final r = today?.rowFor(m.id);
      return r == null
          ? 'Up to ${m.capacity} tasks a day'
          : '${r.total} task${r.total == 1 ? '' : 's'} today';
    }

    Widget teamRows(OrgPerson lead) {
      final team = org.below(lead.id);
      return Container(
        margin: const EdgeInsets.only(left: 22, top: 8),
        padding: const EdgeInsets.only(left: 14),
        decoration: BoxDecoration(
          border: Border(left: BorderSide(color: line, width: 2)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text("${lead.first}'s team", style: u.sub),
            for (final m in team)
              InkWell(
                onTap: () => onOpen(m),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(
                    children: [
                      UOrgAvatar(
                        name: m.name,
                        id: m.id,
                        url: m.avatar,
                        ai: m.isAi,
                        size: 32,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${m.first}${m.title.isEmpty ? '' : ', ${m.title}'}',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: u.title.copyWith(fontSize: 13.5),
                            ),
                            Text(subOf(m), style: u.sub),
                          ],
                        ),
                      ),
                      if (m.isAi)
                        Builder(
                          builder: (_) {
                            final (label, tone) = _state(today?.rowFor(m.id));
                            return UdPill(label, tone: tone);
                          },
                        ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      );
    }

    // The owner, then managers with one report in a line, then the first
    // level that branches as a row, and each branch's team as a list.
    final chain = <OrgPerson>[org.owner];
    var kids = org.reportsOf(org.owner.id);
    while (kids.length == 1 && org.reportsOf(kids.first.id).isNotEmpty) {
      chain.add(kids.first);
      kids = org.reportsOf(kids.first.id);
    }
    final children = <Widget>[];
    for (final (i, p) in chain.indexed) {
      if (i > 0) children.add(vline());
      children.add(node(p, size: i == 0 ? 50 : 44));
    }
    if (kids.isNotEmpty) {
      children.add(vline());
      if (kids.length > 1) {
        children.add(
          Container(
            height: 12,
            margin: EdgeInsets.symmetric(horizontal: kids.length >= 3 ? 48 : 90),
            decoration: BoxDecoration(
              border: Border(
                top: BorderSide(color: line, width: 2),
                left: BorderSide(color: line, width: 2),
                right: BorderSide(color: line, width: 2),
              ),
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(6),
              ),
            ),
          ),
        );
      }
      children.add(
        LayoutBuilder(
          builder: (context, c) => SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            physics: const ClampingScrollPhysics(),
            child: ConstrainedBox(
              constraints: BoxConstraints(minWidth: c.maxWidth),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [for (final b in kids) node(b)],
              ),
            ),
          ),
        ),
      );
      for (final b in kids) {
        if (org.reportsOf(b.id).isNotEmpty) children.add(teamRows(b));
      }
    }
    return ListView(
      physics: udScroll,
      padding: const EdgeInsets.fromLTRB(14, 0, 14, 24),
      children: [
        UEnter(
          index: 0,
          child: UdCard(
            padding: const EdgeInsets.fromLTRB(10, 16, 10, 14),
            child: Column(children: children),
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 12),
          child: Text(
            'Tap anyone to set who they report to and what they approve.',
            textAlign: TextAlign.center,
            style: u.sub,
          ),
        ),
      ],
    );
  }

  // CEO -> departments -> head -> people (departments nest).
  Widget _deptTree(BuildContext context) {
    final u = Ud.of(context);
    final line = Color.lerp(u.line, u.accent, .25)!;

    Widget person(OrgPerson m, {bool head = false}) {
      final r = today?.rowFor(m.id);
      final (label, tone) = _state(r);
      return InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => onOpen(m),
        child: Padding(
          padding: EdgeInsets.symmetric(vertical: head ? 8 : 6, horizontal: 4),
          child: Row(
            children: [
              UOrgAvatar(
                name: m.name,
                id: m.id,
                url: m.avatar,
                ai: m.isAi,
                size: head ? 42 : 34,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            m.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: u.title.copyWith(fontSize: head ? 15 : 13.5),
                          ),
                        ),
                        if (head) ...[
                          const SizedBox(width: 6),
                          const UdPill('Head', tone: UdTone.accent),
                        ],
                      ],
                    ),
                    Text(
                      [
                        if (m.title.isNotEmpty) m.title else (m.isAi ? 'AI employee' : 'Teammate'),
                        if (m.isAi && r != null) '${r.total} task${r.total == 1 ? '' : 's'} today',
                      ].join(' · '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: u.sub,
                    ),
                  ],
                ),
              ),
              if (m.isAi) UdPill(label, tone: tone),
            ],
          ),
        ),
      );
    }

    Widget dept(Dept d, int depth) {
      final head = org.people.where((p) => p.id == d.head).firstOrNull;
      final people = [
        for (final p in org.inDept(d.id))
          if (p.id != d.head) p,
      ];
      final kids = org.childDepts(d.id);
      return Container(
        margin: EdgeInsets.only(top: depth == 0 ? 0 : 8),
        padding: EdgeInsets.fromLTRB(depth == 0 ? 10 : 8, 8, 6, 8),
        decoration: BoxDecoration(
          color: depth == 0 ? u.card : u.chip,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: u.line),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    '${d.name}  ·  ${org.countIn(d.id)}',
                    style: u.title.copyWith(fontSize: depth == 0 ? 15.5 : 14),
                  ),
                ),
                IconButton(
                  visualDensity: VisualDensity.compact,
                  tooltip: 'Edit department',
                  icon: Icon(Icons.edit_outlined, size: 18, color: u.muted),
                  onPressed: () => onEditDept(d),
                ),
              ],
            ),
            if (head != null)
              person(head, head: true)
            else
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Text('No head yet. Tap edit to choose one.', style: u.sub),
              ),
            if (people.isNotEmpty)
              Container(
                margin: const EdgeInsets.only(left: 20),
                padding: const EdgeInsets.only(left: 10),
                decoration: BoxDecoration(
                  border: Border(left: BorderSide(color: line, width: 2)),
                ),
                child: Column(children: [for (final m in people) person(m)]),
              ),
            for (final k in kids) dept(k, depth + 1),
          ],
        ),
      );
    }

    final loose = [
      for (final p in org.people)
        if (!p.isOwner && org.dept(p.dept) == null) p,
    ];
    final top = org.topDepts;
    return ListView(
      physics: udScroll,
      padding: const EdgeInsets.fromLTRB(14, 0, 14, 24),
      children: [
        UEnter(
          index: 0,
          child: Column(
            children: [
              InkWell(
                borderRadius: BorderRadius.circular(12),
                onTap: () => onOpen(org.owner),
                child: Column(
                  children: [
                    UOrgAvatar(
                      name: org.owner.name,
                      id: org.owner.id,
                      url: org.owner.avatar,
                      ai: false,
                      size: 54,
                      badge: 'You',
                    ),
                    const SizedBox(height: 4),
                    Text(org.owner.name, style: u.title.copyWith(fontSize: 14)),
                    Text(org.owner.title.isEmpty ? 'CEO' : org.owner.title, style: u.sub),
                  ],
                ),
              ),
              Container(width: 2, height: 14, margin: const EdgeInsets.symmetric(vertical: 6), color: line),
            ],
          ),
        ),
        for (final (i, d) in top.indexed)
          UEnter(
            index: i + 1,
            child: Padding(padding: const EdgeInsets.only(bottom: 12), child: dept(d, 0)),
          ),
        if (loose.isNotEmpty)
          UdCard(
            padding: const EdgeInsets.fromLTRB(10, 10, 6, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Not in a department', style: u.title),
                for (final m in loose) person(m),
              ],
            ),
          ),
        const SizedBox(height: 4),
        UdButton(label: 'Add a department', ghost: true, onTap: () => onEditDept(null)),
        Padding(
          padding: const EdgeInsets.only(top: 10),
          child: Text(
            'Tap anyone to set their department, manager, approvers and photo.',
            textAlign: TextAlign.center,
            style: u.sub,
          ),
        ),
      ],
    );
  }
}

class _Workload extends StatelessWidget {
  const _Workload({
    super.key,
    required this.org,
    required this.today,
    required this.onOpen,
    required this.empty,
  });
  final OrgData org;
  final TodayData? today;
  final Future<void> Function(OrgPerson) onOpen;
  final Widget empty;

  @override
  Widget build(BuildContext context) {
    final u = Ud.of(context);
    final ai = org.people.where((p) => p.isAi).toList();
    if (ai.isEmpty) return Center(child: empty);
    return ListView(
      physics: udScroll,
      padding: const EdgeInsets.fromLTRB(14, 0, 14, 24),
      children: [
        _card(context, [
          for (final (i, p) in ai.indexed)
            InkWell(
              onTap: () => onOpen(p),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  border: i == ai.length - 1
                      ? null
                      : Border(bottom: BorderSide(color: u.line)),
                ),
                child: Row(
                  children: [
                    UOrgAvatar(
                      name: p.name,
                      id: p.id,
                      url: p.avatar,
                      size: 34,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  p.name,
                                  style: u.title.copyWith(fontSize: 13.5),
                                ),
                              ),
                              Text(
                                '${today?.rowFor(p.id)?.total ?? 0} of ${p.capacity}',
                                style: u.sub,
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          UBar((today?.rowFor(p.id)?.total ?? 0) / p.capacity),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ]),
        if (today == null || today!.teams.isEmpty)
          Padding(padding: const EdgeInsets.only(top: 14), child: empty),
      ],
    );
  }
}

// ---------------------------------------------------------------- a person's day
/// Today's Odoo tasks, who approves the work and the place in the team.
class UMemberDaySection extends ConsumerStatefulWidget {
  const UMemberDaySection({super.key, required this.id});
  final String id;
  @override
  ConsumerState<UMemberDaySection> createState() => _UMemberDaySectionState();
}

class _UMemberDaySectionState extends ConsumerState<UMemberDaySection> {
  late Future<(MemberDay, OrgData?)> _f = _load();

  Future<(MemberDay, OrgData?)> _load() async {
    final api = uApi(ref);
    final orgF = api
        .org()
        .then<OrgData?>((o) => o)
        .catchError((Object _) => null);
    return (await api.memberDay(widget.id), await orgF);
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<(MemberDay, OrgData?)>(
    future: _f,
    builder: (context, snap) {
      if (!snap.hasData) return const SizedBox(height: 8);
      final (d, org) = snap.data!;
      return UMemberDayBody(
        day: d,
        org: org,
        onChanged: () => setState(() => _f = _load()),
      );
    },
  );
}

class UMemberDayBody extends StatelessWidget {
  const UMemberDayBody({
    super.key,
    required this.day,
    this.org,
    this.onChanged,
  });
  final MemberDay day;
  final OrgData? org;
  final VoidCallback? onChanged;

  @override
  Widget build(BuildContext context) {
    final u = Ud.of(context);
    final d = day;
    final m = d.member;
    Widget row(String label, String value) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        children: [
          Expanded(child: Text(label, style: u.sub)),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: u.title.copyWith(fontSize: 13),
            ),
          ),
        ],
      ),
    );
    final a = d.approvers;
    final plan = a['drafted_by'] != null
        ? '${a['drafted_by']!.first} drafts, ${a['plan']?.first ?? 'you'} approves'
        : (a['plan']?.name ?? 'You');
    final firstOpen = d.tasks.where((x) => !x.done).firstOrNull;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (m.isAi) ...[
          const SizedBox(height: 12),
          UdCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(child: Text('Today, from Odoo', style: u.title)),
                    Text(
                      d.tasks.isEmpty
                          ? (d.planStatus == 'pending'
                                ? 'Plan waits for approval'
                                : 'No tasks yet')
                          : '${d.done} of ${d.tasks.length} done'
                                '${d.spent > 0 ? ', ${_hours(d.spent)} logged' : ''}',
                      style: u.sub,
                    ),
                  ],
                ),
                if (d.tasks.isNotEmpty) ...[
                  const SizedBox(height: 9),
                  UBar(d.done / d.tasks.length),
                  const SizedBox(height: 4),
                ],
                for (final (i, t) in d.tasks.indexed)
                  InkWell(
                    onTap: t.url.isEmpty
                        ? null
                        : () => launchUrl(
                            Uri.parse(t.url),
                            mode: LaunchMode.externalApplication,
                          ),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 9),
                      decoration: BoxDecoration(
                        border: i == 0
                            ? null
                            : Border(top: BorderSide(color: u.line)),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _Check(t),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  t.name,
                                  style: u.title.copyWith(fontSize: 13.5),
                                ),
                                Text(
                                  [
                                    t.ref,
                                    if (t.stage.isNotEmpty) t.stage,
                                    if (t.spent > 0) _hours(t.spent),
                                  ].join(' · '),
                                  style: u.sub,
                                ),
                              ],
                            ),
                          ),
                          if (identical(t, firstOpen))
                            UdPill(
                              t.blocked ? 'Blocked' : 'Now',
                              tone: t.blocked ? UdTone.warn : UdTone.accent,
                            ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 10),
        UdCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text("Who approves ${m.first}'s work", style: u.title),
              const SizedBox(height: 4),
              if (m.isAi) row('Daily plan', plan),
              row('Code to staging', a['staging']?.name ?? 'You'),
              row('Anything to production', a['production']?.name ?? 'You'),
            ],
          ),
        ),
        if (org != null && !m.isOwner) ...[
          const SizedBox(height: 10),
          UdCard(
            onTap: () async {
              final changed = await Navigator.of(context).push<bool>(
                MaterialPageRoute(
                  builder: (_) => UMemberEditScreen(
                    org: org!,
                    person: org!.byId(m.id) ?? m,
                  ),
                ),
              );
              if (changed == true) onChanged?.call();
            },
            child: Row(
              children: [
                Icon(Icons.account_tree_outlined, color: u.accent, size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Place in the team', style: u.title),
                      Text(
                        'Reports to ${d.manager?.name ?? 'you'}'
                        '${m.isAi ? ' · up to ${(org!.byId(m.id) ?? m).capacity} tasks a day' : ''}',
                        style: u.sub,
                      ),
                    ],
                  ),
                ),
                Icon(Icons.chevron_right_rounded, color: u.muted),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _Check extends StatelessWidget {
  const _Check(this.t);
  final PlanTask t;
  @override
  Widget build(BuildContext context) {
    final u = Ud.of(context);
    return Container(
      width: 18,
      height: 18,
      margin: const EdgeInsets.only(top: 1),
      decoration: BoxDecoration(
        color: t.done
            ? u.accent
            : (t.blocked ? Ud.warn.withValues(alpha: .15) : null),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(
          color: t.done ? u.accent : (t.blocked ? Ud.warn : u.line),
          width: 2,
        ),
      ),
      child: t.done
          ? Icon(Icons.check_rounded, size: 13, color: u.onAccent)
          : null,
    );
  }
}

/// Anyone in the org (opened from Today or the org chart).
class UPersonScreen extends ConsumerStatefulWidget {
  const UPersonScreen({super.key, required this.id});
  final String id;
  @override
  ConsumerState<UPersonScreen> createState() => _UPersonScreenState();
}

class _UPersonScreenState extends ConsumerState<UPersonScreen> {
  Key _k = UniqueKey();

  @override
  Widget build(BuildContext context) {
    final u = Ud.of(context);
    return UdPage(
      back: true,
      header: const SizedBox(),
      body: ULoad<(MemberDay, OrgData?)>(
        key: _k,
        load: (api) async {
          final orgF = api
              .org()
              .then<OrgData?>((o) => o)
              .catchError((Object _) => null);
          return (await api.memberDay(widget.id), await orgF);
        },
        builder: (context, data, reload) {
          final (d, org) = data;
          final m = d.member;
          return ListView(
            physics: udScroll,
            padding: const EdgeInsets.fromLTRB(14, 0, 14, 24),
            children: [
              Row(
                children: [
                  UOrgAvatar(
                    name: m.name,
                    id: m.id,
                    url: m.avatar,
                    ai: m.isAi,
                    size: 64,
                    badge: m.isOwner ? 'You' : null,
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          m.name,
                          style: TextStyle(
                            fontSize: 21,
                            fontWeight: FontWeight.w700,
                            color: u.fg,
                          ),
                        ),
                        Text(
                          [
                            if (m.title.isNotEmpty) m.title,
                            if (m.department.isNotEmpty) m.department,
                          ].join(', '),
                          style: u.sub.copyWith(fontSize: 13),
                        ),
                        const SizedBox(height: 7),
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: [
                            if (d.manager != null)
                              UdPill(
                                'Reports to ${d.manager!.first}',
                                tone: UdTone.accent,
                              ),
                            if (!m.isOwner)
                              for (final a in m.approves)
                                UdPill('Approves $a', tone: UdTone.ok),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              UMemberDayBody(
                day: d,
                org: org,
                onChanged: () => setState(() => _k = UniqueKey()),
              ),
            ],
          );
        },
      ),
    );
  }
}

// ---------------------------------------------------------------- edit and add
InputDecoration _field(BuildContext context, String label, {String? hint}) {
  final u = Ud.of(context);
  OutlineInputBorder b(Color c, [double w = 1]) => OutlineInputBorder(
    borderRadius: BorderRadius.circular(14),
    borderSide: BorderSide(color: c, width: w),
  );
  return InputDecoration(
    labelText: label,
    hintText: hint,
    filled: true,
    fillColor: u.card,
    border: b(u.line),
    enabledBorder: b(u.line),
    focusedBorder: b(u.accent, 1.6),
  );
}

Widget _managerPicker(
  BuildContext context,
  OrgData org,
  String self,
  String? value,
  ValueChanged<String?> onChanged,
) {
  final banned = {self, ...org.below(self).map((p) => p.id)};
  final options = [
    for (final p in org.people)
      if (!banned.contains(p.id)) p,
  ];
  final current = options.any((p) => p.id == value) ? value : 'owner';
  return DropdownButtonFormField<String>(
    initialValue: current,
    isExpanded: true,
    decoration: _field(context, 'Reports to'),
    items: [
      for (final p in options)
        DropdownMenuItem(
          value: p.id,
          child: Text(
            '${p.name}${p.title.isEmpty ? '' : ' · ${p.title}'}',
            overflow: TextOverflow.ellipsis,
          ),
        ),
    ],
    onChanged: onChanged,
  );
}

const _actionLabels = {
  'plan': 'Daily plans',
  'staging': 'Code to staging',
  'production': 'Anything to production',
};

Widget _approvesCard(
  BuildContext context,
  String title,
  Set<String> picked,
  void Function(String, bool) onChanged,
) {
  final u = Ud.of(context);
  return UdCard(
    padding: const EdgeInsets.fromLTRB(14, 6, 6, 6),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 6, bottom: 2),
          child: Text(title, style: u.title),
        ),
        for (final e in _actionLabels.entries)
          SwitchListTile.adaptive(
            contentPadding: EdgeInsets.zero,
            title: Text(e.value, style: u.title.copyWith(fontSize: 14)),
            value: picked.contains(e.key),
            onChanged: (v) => onChanged(e.key, v),
          ),
      ],
    ),
  );
}

class UMemberEditScreen extends ConsumerStatefulWidget {
  const UMemberEditScreen({
    super.key,
    required this.org,
    required this.person,
  });
  final OrgData org;
  final OrgPerson person;
  @override
  ConsumerState<UMemberEditScreen> createState() => _UMemberEditScreenState();
}

class _UMemberEditScreenState extends ConsumerState<UMemberEditScreen> {
  late String? _to = widget.person.reportsTo;
  late int _cap = widget.person.capacity;
  late final _odoo = TextEditingController(text: widget.person.odooUser);
  late final _title = TextEditingController(text: widget.person.title);
  late final _name = TextEditingController(text: widget.person.name);
  late final _avatar = TextEditingController(text: widget.person.avatar);
  final _odooKey = TextEditingController();
  late final Set<String> _approves = {...widget.person.approves};
  late String _dept = widget.person.dept;
  late final Map<String, String> _approverSet = {...widget.person.approverSet};
  bool _busy = false;
  bool _uploading = false;

  String? get _deptHead {
    final d = widget.org.dept(_dept);
    if (d == null) return null;
    if (d.head.isNotEmpty && d.head != widget.person.id) return d.head;
    final up = widget.org.dept(d.parent);
    return (up != null && up.head.isNotEmpty) ? up.head : 'owner';
  }

  Future<void> _pickPhoto() async {
    final x = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      maxWidth: 1024,
      maxHeight: 1024,
      imageQuality: 85,
    );
    if (x == null) return;
    setState(() => _uploading = true);
    try {
      final bytes = await x.readAsBytes();
      final o = await uApi(ref).photo(
        widget.person.id,
        'data:image/jpeg;base64,${base64Encode(bytes)}',
      );
      final url = o.people.where((m) => m.id == widget.person.id).firstOrNull?.avatar;
      if (url != null && mounted) setState(() => _avatar.text = url);
      unawaited(HapticFeedback.mediumImpact());
    } catch (e) {
      if (mounted) _toast(context, e.toString());
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _save() async {
    setState(() => _busy = true);
    final p = widget.person;
    try {
      final login = _odoo.text.trim();
      if (p.isAi && login.isNotEmpty &&
          (login != p.odooUser || _odooKey.text.trim().isNotEmpty || !p.odooConnected)) {
        await uApi(ref).memberOdoo(p.id, login: login, key: _odooKey.text.trim());
        _odooKey.clear();
      }
      await uApi(ref).updateMember(p.id, {
        if (!p.isOwner) 'reports_to': _to,
        if (!p.isAi) 'odoo_user': login,
        'avatar': _avatar.text.trim(),
        if (p.isAi) 'capacity': _cap,
        if (!p.isAi) 'approves': _approves.toList(),
        if (!p.isOwner) ...{
          'title': _title.text.trim(),
          'name': _name.text.trim(),
          'dept': _dept,
          'approvers': _approverSet,
        },
      });
      unawaited(HapticFeedback.mediumImpact());
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) _toast(context, e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _approversCard(BuildContext context) {
    final u = Ud.of(context);
    final humans = [
      for (final h in widget.org.people)
        if (!h.isAi) h,
    ];
    return UdCard(
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Approvers for ${widget.person.first}', style: u.title),
          const SizedBox(height: 8),
          for (final e in _actionLabels.entries) ...[
            DropdownButtonFormField<String>(
              initialValue: humans.any((h) => h.id == _approverSet[e.key])
                  ? _approverSet[e.key]
                  : '',
              isExpanded: true,
              decoration: _field(context, e.value),
              items: [
                const DropdownMenuItem(value: '', child: Text('Up the reporting line')),
                for (final h in humans)
                  DropdownMenuItem(
                    value: h.id,
                    child: Text(h.isOwner ? '${h.name} (you)' : h.name),
                  ),
              ],
              onChanged: (v) => setState(() {
                if (v == null || v.isEmpty) {
                  _approverSet.remove(e.key);
                } else {
                  _approverSet[e.key] = v;
                }
              }),
            ),
            const SizedBox(height: 8),
          ],
          Text(
            'Only people approve. If the approver does not answer in time, it goes to you.',
            style: u.sub,
          ),
        ],
      ),
    );
  }

  Future<void> _remove() async {
    try {
      await uApi(ref).removeMember(widget.person.id);
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) _toast(context, e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    final u = Ud.of(context);
    final p = widget.person;
    return UdPage(
      back: true,
      title: p.first,
      bottom: UdComposer(
        children: [
          Expanded(
            child: UdButton(label: 'Save', onTap: _busy ? null : _save),
          ),
        ],
      ),
      body: ListView(
        physics: udScroll,
        padding: const EdgeInsets.fromLTRB(14, 0, 14, 24),
        children: [
          Row(
            children: [
              UOrgAvatar(
                name: p.name,
                id: p.id,
                url: _avatar.text,
                ai: p.isAi,
                size: 58,
                badge: '',
              ),
              const SizedBox(width: 12),
              Expanded(
                child: UdButton(
                  label: _uploading ? 'Uploading…' : 'Upload a photo',
                  ghost: true,
                  onTap: _uploading ? null : _pickPhoto,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          if (!p.isOwner) ...[
            TextField(controller: _name, decoration: _field(context, 'Name')),
            const SizedBox(height: 12),
            TextField(controller: _title, decoration: _field(context, 'Job title')),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: widget.org.dept(_dept) == null ? '' : _dept,
              isExpanded: true,
              decoration: _field(context, 'Department'),
              items: [
                const DropdownMenuItem(value: '', child: Text('No department')),
                for (final d in widget.org.depts)
                  DropdownMenuItem(value: d.id, child: Text(d.name)),
              ],
              onChanged: (v) => setState(() => _dept = v ?? ''),
            ),
            const SizedBox(height: 12),
            _managerPicker(
              context,
              widget.org,
              p.id,
              _to,
              (v) => setState(() => _to = v),
            ),
            if (_deptHead != null && _deptHead != _to)
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: () => setState(() => _to = _deptHead),
                  child: const Text('Use the department head'),
                ),
              ),
            const SizedBox(height: 8),
            _approversCard(context),
            const SizedBox(height: 12),
          ],
          TextField(
            controller: _odoo,
            keyboardType: TextInputType.emailAddress,
            autocorrect: false,
            decoration: _field(
              context,
              p.isAi ? 'Odoo login' : 'Odoo user (login)',
              hint: 'name@unlimitedsolutions.technology',
            ),
          ),
          if (p.isAi) ...[
            const SizedBox(height: 12),
            TextField(
              controller: _odooKey,
              obscureText: true,
              autocorrect: false,
              enableSuggestions: false,
              decoration: _field(
                context,
                p.odooConnected
                    ? 'Odoo password or API key (empty keeps the saved one)'
                    : 'Odoo password or API key',
              ),
            ),
          ],
          Padding(
            padding: const EdgeInsets.fromLTRB(4, 6, 4, 12),
            child: Text(
              p.isAi
                  ? (p.odooConnected
                        ? '${p.first} logs in to the company Odoo as ${p.odooUser}. Tasks you assign to this user reach ${p.first} within minutes.'
                        : 'Create the user in Odoo, then enter its login and password here. ${p.first} reads its tasks and writes feedback as itself.')
                  : 'Shows their Odoo tasks next to the team.',
              style: u.sub,
            ),
          ),
          TextField(
            controller: _avatar,
            keyboardType: TextInputType.url,
            autocorrect: false,
            decoration: _field(
              context,
              'Photo link (optional)',
              hint: 'https://…',
            ),
          ),
          const SizedBox(height: 12),
          if (p.isAi)
            UdCard(
              child: Row(
                children: [
                  Expanded(child: Text('Tasks a day', style: u.title)),
                  IconButton(
                    onPressed: _cap > 1 ? () => setState(() => _cap--) : null,
                    icon: const Icon(Icons.remove_circle_outline),
                  ),
                  Text('$_cap', style: u.title.copyWith(fontSize: 17)),
                  IconButton(
                    onPressed: _cap < 6 ? () => setState(() => _cap++) : null,
                    icon: const Icon(Icons.add_circle_outline),
                  ),
                ],
              ),
            )
          else
            _approvesCard(
              context,
              '${p.first} approves',
              _approves,
              (k, v) => setState(() => v ? _approves.add(k) : _approves.remove(k)),
            ),
          if (!p.isAi && !p.isOwner) ...[
            const SizedBox(height: 16),
            UdButton(
              label: 'Remove from the team',
              ghost: true,
              danger: true,
              onTap: _remove,
            ),
          ],
        ],
      ),
    );
  }
}

/// Create or change a department: name, where it sits, its head and its people.
class UDeptEditScreen extends ConsumerStatefulWidget {
  const UDeptEditScreen({super.key, required this.org, this.dept});
  final OrgData org;
  final Dept? dept;
  @override
  ConsumerState<UDeptEditScreen> createState() => _UDeptEditScreenState();
}

class _UDeptEditScreenState extends ConsumerState<UDeptEditScreen> {
  late final _name = TextEditingController(text: widget.dept?.name ?? '');
  late String _parent = widget.dept?.parent ?? '';
  late String _head = widget.dept?.head ?? '';
  late final Set<String> _members = {
    if (widget.dept != null)
      for (final p in widget.org.inDept(widget.dept!.id)) p.id,
  };
  bool _apply = true;
  bool _busy = false;

  Set<String> get _banned {
    final out = <String>{};
    void mark(String id) {
      out.add(id);
      for (final k in widget.org.childDepts(id)) {
        mark(k.id);
      }
    }

    if (widget.dept != null) mark(widget.dept!.id);
    return out;
  }

  Future<void> _save() async {
    if (_name.text.trim().isEmpty) {
      _toast(context, 'Give the department a name.');
      return;
    }
    setState(() => _busy = true);
    try {
      await uApi(ref).department({
        if (widget.dept != null) 'id': widget.dept!.id,
        'name': _name.text.trim(),
        'parent': _parent,
        'head': _head,
        'members': _members.toList(),
        'apply': _apply,
      });
      unawaited(HapticFeedback.mediumImpact());
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) _toast(context, e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _delete() async {
    try {
      await uApi(ref).department({'id': widget.dept!.id, 'action': 'remove'});
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) _toast(context, e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    final u = Ud.of(context);
    final org = widget.org;
    final people = [
      for (final p in org.people)
        if (!p.isOwner) p,
    ];
    final banned = _banned;
    return UdPage(
      back: true,
      title: widget.dept == null ? 'New department' : widget.dept!.name,
      bottom: UdComposer(
        children: [
          Expanded(
            child: UdButton(
              label: widget.dept == null ? 'Create department' : 'Save department',
              onTap: _busy ? null : _save,
            ),
          ),
        ],
      ),
      body: ListView(
        physics: udScroll,
        padding: const EdgeInsets.fromLTRB(14, 0, 14, 24),
        children: [
          TextField(controller: _name, decoration: _field(context, 'Name', hint: 'Development')),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: org.dept(_parent) == null ? '' : _parent,
            isExpanded: true,
            decoration: _field(context, 'Under'),
            items: [
              const DropdownMenuItem(value: '', child: Text('The CEO (top level)')),
              for (final d in org.depts)
                if (!banned.contains(d.id)) DropdownMenuItem(value: d.id, child: Text(d.name)),
            ],
            onChanged: (v) => setState(() => _parent = v ?? ''),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: people.any((p) => p.id == _head) ? _head : '',
            isExpanded: true,
            decoration: _field(context, 'Head (manager of this department)'),
            items: [
              const DropdownMenuItem(value: '', child: Text('No head yet')),
              for (final p in people)
                DropdownMenuItem(
                  value: p.id,
                  child: Text(
                    '${p.name}${p.title.isEmpty ? '' : ' · ${p.title}'}',
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
            ],
            onChanged: (v) => setState(() => _head = v ?? ''),
          ),
          const SizedBox(height: 14),
          Text('People in this department', style: u.title),
          const SizedBox(height: 6),
          UdCard(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Column(
              children: [
                for (final p in people)
                  CheckboxListTile.adaptive(
                    dense: true,
                    value: _members.contains(p.id) || p.id == _head,
                    onChanged: p.id == _head
                        ? null
                        : (v) => setState(() => v == true ? _members.add(p.id) : _members.remove(p.id)),
                    secondary: UOrgAvatar(name: p.name, id: p.id, url: p.avatar, ai: p.isAi, size: 30, badge: ''),
                    title: Text(p.name, style: u.title.copyWith(fontSize: 14)),
                    subtitle: (!_members.contains(p.id) && p.id != _head && org.dept(p.dept) != null)
                        ? Text('now in ${org.dept(p.dept)!.name}', style: u.sub)
                        : null,
                  ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          SwitchListTile.adaptive(
            contentPadding: EdgeInsets.zero,
            value: _apply,
            onChanged: (v) => setState(() => _apply = v),
            title: Text('Update reporting lines', style: u.title.copyWith(fontSize: 14)),
            subtitle: Text(
              'The head reports to the head above (or you), and everyone here reports to the head.',
              style: u.sub,
            ),
          ),
          if (widget.dept != null) ...[
            const SizedBox(height: 12),
            UdButton(label: 'Delete department', ghost: true, danger: true, onTap: _delete),
          ],
        ],
      ),
    );
  }
}

class UAddPersonScreen extends ConsumerStatefulWidget {
  const UAddPersonScreen({super.key});
  @override
  ConsumerState<UAddPersonScreen> createState() => _UAddPersonScreenState();
}

class _UAddPersonScreenState extends ConsumerState<UAddPersonScreen> {
  final _npub = TextEditingController();
  final _name = TextEditingController();
  final _title = TextEditingController();
  String? _to = 'owner';
  final _approves = <String>{'plan'};
  bool _busy = false;

  Future<void> _add() async {
    setState(() => _busy = true);
    try {
      await uApi(ref).addPerson({
        'pubkey': _npub.text.trim(),
        'name': _name.text.trim(),
        'title': _title.text.trim(),
        'reports_to': _to,
        'approves': _approves.toList(),
      });
      unawaited(HapticFeedback.mediumImpact());
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) _toast(context, e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final u = Ud.of(context);
    return UdPage(
      back: true,
      title: 'Add a person',
      bottom: UdComposer(
        children: [
          Expanded(
            child: UdButton(label: 'Add', onTap: _busy ? null : _add),
          ),
        ],
      ),
      body: ULoad<OrgData>(
        load: (api) => api.org(),
        builder: (context, org, _) => ListView(
          physics: udScroll,
          padding: const EdgeInsets.fromLTRB(14, 0, 14, 24),
          children: [
            Text(
              'Add someone who runs the work with you, like a delivery manager who approves plans. '
              'They join the workspace first, then copy their key (npub) from their profile.',
              style: u.sub,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _npub,
              autocorrect: false,
              decoration: _field(context, 'Their key', hint: 'npub1…'),
            ),
            const SizedBox(height: 12),
            TextField(controller: _name, decoration: _field(context, 'Name')),
            const SizedBox(height: 12),
            TextField(
              controller: _title,
              decoration: _field(
                context,
                'Job title',
                hint: 'Head of Delivery',
              ),
            ),
            const SizedBox(height: 12),
            _managerPicker(
              context,
              org,
              '',
              _to,
              (v) => setState(() => _to = v),
            ),
            const SizedBox(height: 12),
            _approvesCard(
              context,
              'They approve',
              _approves,
              (k, v) => setState(() => v ? _approves.add(k) : _approves.remove(k)),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------- company Odoo
class UCompanyOdooScreen extends ConsumerStatefulWidget {
  const UCompanyOdooScreen({super.key});
  @override
  ConsumerState<UCompanyOdooScreen> createState() =>
      _UCompanyOdooScreenState();
}

class _UCompanyOdooScreenState extends ConsumerState<UCompanyOdooScreen> {
  final _url = TextEditingController(
    text: 'https://unlimitedsolutions.technology',
  );
  final _login = TextEditingController();
  final _key = TextEditingController();
  final _db = TextEditingController();
  bool _busy = false;
  Key _k = UniqueKey();

  Future<void> _connect() async {
    setState(() => _busy = true);
    try {
      await uApi(ref).connectCompanyOdoo({
        'url': _url.text.trim(),
        'login': _login.text.trim(),
        'key': _key.text.trim(),
        'db': _db.text.trim(),
      });
      _key.clear();
      unawaited(HapticFeedback.mediumImpact());
      if (mounted) {
        _toast(context, 'Connected');
        setState(() => _k = UniqueKey());
      }
    } catch (e) {
      if (mounted) _toast(context, e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final u = Ud.of(context);
    return UdPage(
      back: true,
      title: 'Company Odoo',
      body: ULoad<OrgData>(
        key: _k,
        load: (api) => api.org(),
        builder: (context, org, reload) {
          if (org.odooConnected) {
            return _OdooSettings(
              org: org,
              onChanged: () => setState(() => _k = UniqueKey()),
            );
          }
          return ListView(
            physics: udScroll,
            padding: const EdgeInsets.fromLTRB(14, 0, 14, 24),
            children: [
              Text(
                'Employees read their daily tasks from your company Odoo and update them as they work. '
                'Create an API key in Odoo: My Profile > Account Security > New API Key.',
                style: u.sub,
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _url,
                keyboardType: TextInputType.url,
                autocorrect: false,
                decoration: _field(context, 'Odoo address'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _login,
                keyboardType: TextInputType.emailAddress,
                autocorrect: false,
                decoration: _field(context, 'Login (email)'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _key,
                obscureText: true,
                autocorrect: false,
                enableSuggestions: false,
                decoration: _field(context, 'API key'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _db,
                autocorrect: false,
                decoration: _field(
                  context,
                  'Database (optional)',
                  hint: 'Found automatically when there is one',
                ),
              ),
              const SizedBox(height: 16),
              UdButton(
                label: _busy ? 'Checking…' : 'Connect',
                onTap: _busy ? null : _connect,
              ),
              const SizedBox(height: 10),
              Text(
                'The key stays on your Unlimited server, encrypted, and is never shown again.',
                textAlign: TextAlign.center,
                style: u.sub,
              ),
            ],
          );
        },
      ),
    );
  }
}

class _OdooSettings extends ConsumerStatefulWidget {
  const _OdooSettings({required this.org, required this.onChanged});
  final OrgData org;
  final VoidCallback onChanged;
  @override
  ConsumerState<_OdooSettings> createState() => _OdooSettingsState();
}

class _OdooSettingsState extends ConsumerState<_OdooSettings> {
  late final Future<List<Map<String, dynamic>>> _projects = uApi(
    ref,
  ).odooProjects();
  late final Set<int> _picked = {
    for (final p in (widget.org.settings['projects'] as List? ?? const []))
      (p as num).toInt(),
  };
  late String _plan = '${widget.org.settings['plan_at'] ?? '08:00'}';
  late String _report = '${widget.org.settings['report_at'] ?? '17:00'}';
  late final Set<int> _days = {
    for (final d in (widget.org.settings['workdays'] as List? ?? const []))
      (d as num).toInt(),
  };
  bool _busy = false;

  Future<void> _save() async {
    setState(() => _busy = true);
    try {
      await uApi(ref).orgSettings({
        'projects': _picked.toList(),
        'plan_at': _plan,
        'report_at': _report,
        'workdays': _days.toList(),
      });
      if (mounted) _toast(context, 'Saved');
    } catch (e) {
      if (mounted) _toast(context, e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _pickTime(bool plan) async {
    final cur = (plan ? _plan : _report).split(':');
    final t = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(
        hour: int.parse(cur[0]),
        minute: int.parse(cur[1]),
      ),
    );
    if (t == null) return;
    final v =
        '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';
    setState(() => plan ? _plan = v : _report = v);
  }

  Future<void> _draftNow() async {
    final leads = widget.org.leads;
    if (leads.isEmpty) {
      _toast(
        context,
        'First pick a lead: in Team, set who reports to them.',
      );
      return;
    }
    try {
      for (final l in leads) {
        await uApi(ref).draftPlan(l.id);
      }
      if (mounted) _toast(context, 'Drafted. It is waiting in Today.');
    } catch (e) {
      if (mounted) _toast(context, e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    final u = Ud.of(context);
    const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return ListView(
      physics: udScroll,
      padding: const EdgeInsets.fromLTRB(14, 0, 14, 24),
      children: [
        UdCard(
          child: Row(
            children: [
              const Icon(Icons.check_circle_rounded, color: Ud.ok),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  '${widget.org.odoo['detail'] ?? 'Connected'}',
                  style: u.sub,
                ),
              ),
            ],
          ),
        ),
        const UdSection('Projects the team plans from'),
        FutureBuilder<List<Map<String, dynamic>>>(
          future: _projects,
          builder: (context, s) {
            if (s.hasError) return Text(s.error.toString(), style: u.sub);
            if (!s.hasData) {
              return const Padding(
                padding: EdgeInsets.all(16),
                child: Center(child: CircularProgressIndicator.adaptive()),
              );
            }
            return UdCard(
              padding: const EdgeInsets.all(4),
              child: Column(
                children: [
                  for (final p in s.data!)
                    CheckboxListTile.adaptive(
                      dense: true,
                      title: Text(
                        '${p['name']}',
                        style: u.title.copyWith(fontSize: 14),
                      ),
                      value: _picked.contains((p['id'] as num).toInt()),
                      onChanged: (v) => setState(() {
                        final id = (p['id'] as num).toInt();
                        v == true ? _picked.add(id) : _picked.remove(id);
                      }),
                    ),
                  if (s.data!.isEmpty)
                    Padding(
                      padding: const EdgeInsets.all(12),
                      child: Text('No projects in Odoo yet.', style: u.sub),
                    ),
                ],
              ),
            );
          },
        ),
        const UdSection('Daily rhythm'),
        UdCard(
          padding: const EdgeInsets.fromLTRB(14, 4, 14, 4),
          child: Column(
            children: [
              UdItem(
                leading: Icon(
                  Icons.wb_sunny_outlined,
                  color: u.accent,
                  size: 20,
                ),
                title: const Text('Leads draft the plan'),
                trailing: Text(_plan, style: u.title),
                onTap: () => _pickTime(true),
              ),
              UdItem(
                leading: Icon(
                  Icons.nights_stay_outlined,
                  color: u.accent,
                  size: 20,
                ),
                title: const Text('End-of-day report'),
                trailing: Text(_report, style: u.title),
                onTap: () => _pickTime(false),
                last: true,
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            for (var d = 0; d < 7; d++)
              USeg(
                label: names[d],
                on: _days.contains(d),
                onTap: () => setState(
                  () => _days.contains(d) ? _days.remove(d) : _days.add(d),
                ),
              ),
          ],
        ),
        const SizedBox(height: 16),
        UdButton(label: 'Save', onTap: _busy ? null : _save),
        const SizedBox(height: 8),
        UdButton(
          label: "Draft today's plan now",
          ghost: true,
          onTap: _draftNow,
        ),
        const SizedBox(height: 8),
        UdButton(
          label: 'Disconnect',
          ghost: true,
          danger: true,
          onTap: () async {
            await uApi(ref).disconnectCompanyOdoo();
            widget.onChanged();
          },
        ),
      ],
    );
  }
}
