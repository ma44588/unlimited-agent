// Unlimited Agent phone screens, built to the approved design board:
// Inbox, Projects, Project, Team, Employee, Logs, Outbox, More.
// Live data from the Unlimited server (same API as the desktop).
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../shared/relay/relay_provider.dart';
import '../channels/channel_detail_page.dart';
import '../channels/channel_management_provider.dart';
import 'ud.dart';
import 'unlimited_call_screen.dart';
import 'unlimited_ai.dart';
import 'unlimited_api.dart';
import 'unlimited_org.dart';

UnlimitedApi uApi(WidgetRef ref) => UnlimitedApi(ref.read(relayConfigProvider));

String _ago(String iso) {
  final t = DateTime.tryParse(iso);
  if (t == null) return '';
  final d = DateTime.now().toUtc().difference(t.toUtc());
  if (d.inMinutes < 1) return 'now';
  if (d.inMinutes < 60) return '${d.inMinutes} min ago';
  if (d.inHours < 24) return '${d.inHours} h ago';
  return '${d.inDays} d ago';
}

/// Loads, shows a spinner or a retry message, and supports pull to refresh.
class ULoad<T> extends ConsumerStatefulWidget {
  const ULoad({super.key, required this.load, required this.builder});
  final Future<T> Function(UnlimitedApi api) load;
  final Widget Function(BuildContext, T, Future<void> Function()) builder;

  @override
  ConsumerState<ULoad<T>> createState() => _ULoadState<T>();
}

class _ULoadState<T> extends ConsumerState<ULoad<T>>
    with AutomaticKeepAliveClientMixin {
  late Future<T> _f = widget.load(uApi(ref));

  Future<void> _reload() async {
    final f = widget.load(uApi(ref));
    setState(() => _f = f);
    try {
      await f;
    } catch (_) {}
  }

  @override
  bool get wantKeepAlive => true;

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return FutureBuilder<T>(
      future: _f,
      builder: (context, snap) {
        if (snap.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator.adaptive());
        }
        if (snap.hasError) {
          return UdMessage(
            icon: Icons.cloud_off_rounded,
            title: "Couldn't reach the Unlimited server",
            text: snap.error.toString(),
            action: 'Try again',
            onAction: _reload,
          );
        }
        return RefreshIndicator.adaptive(
          onRefresh: _reload,
          child: widget.builder(context, snap.data as T, _reload),
        );
      },
    );
  }
}

// ---------------------------------------------------------------- board data
class UBoard {
  UBoard(this.overview, this.statuses, this.emails, this.employees);
  final Overview overview;
  final Map<String, ProjectStatus> statuses;
  final List<OutboxItem> emails;
  final List<Employee> employees;

  Employee? employee(String agent) {
    final a = agent.toLowerCase();
    for (final e in employees) {
      if (e.slug == a || e.name.toLowerCase() == a) return e;
    }
    return null;
  }

  String who(String agent) => employee(agent)?.displayName ?? agent;
}

Future<UBoard> loadBoard(UnlimitedApi api) async {
  final overviewF = api.overview();
  final emailsF = api.outbox().catchError((_) => <OutboxItem>[]);
  final employeesF = api.employees().catchError((_) => <Employee>[]);
  final overview = await overviewF;
  final statuses = <String, ProjectStatus>{};
  await Future.wait(
    overview.projects.map((p) async {
      try {
        statuses[p.id] = await api.projectStatus(p.id);
      } catch (_) {}
    }),
  );
  return UBoard(overview, statuses, await emailsF, await employeesF);
}

/// Real work by the employees, not the server's own admin bookkeeping.
bool isEmployeeActivity(ActivityItem a) =>
    !a.agent.startsWith('owner:') &&
    !a.tool.startsWith('admin/') &&
    a.agent != 'owner';

Future<void> _decide(
  BuildContext context,
  WidgetRef ref,
  Approval a,
  bool ok,
  Future<void> Function() reload,
) async {
  final messenger = ScaffoldMessenger.of(context);
  try {
    await uApi(ref).decideApproval(a.id, ok);
    unawaited(HapticFeedback.mediumImpact());
    messenger.showSnackBar(
      SnackBar(content: Text(ok ? 'Approved' : 'Rejected')),
    );
  } catch (e) {
    messenger.showSnackBar(SnackBar(content: Text(e.toString())));
  }
  await reload();
}

Widget _approveRow(
  BuildContext context,
  WidgetRef ref,
  Approval a,
  Future<void> Function() reload,
) => Row(
  children: [
    Expanded(
      child: UdButton(
        label: 'Approve',
        small: true,
        onTap: () => _decide(context, ref, a, true, reload),
      ),
    ),
    const SizedBox(width: 8),
    Expanded(
      child: UdButton(
        label: 'Reject',
        small: true,
        ghost: true,
        onTap: () => _decide(context, ref, a, false, reload),
      ),
    ),
  ],
);

// ---------------------------------------------------------------- Inbox
class UInboxScreen extends ConsumerWidget {
  const UInboxScreen({super.key, this.back = false});
  final bool back;

  @override
  Widget build(BuildContext context, WidgetRef ref) => UdPage(
    title: 'Inbox',
    back: back,
    body: ULoad<UBoard>(
      load: loadBoard,
      builder: (context, b, reload) {
        final u = Ud.of(context);
        final needs = <Widget>[];
        for (final p in b.overview.projects) {
          for (final a in b.statuses[p.id]?.approvals ?? const <Approval>[]) {
            needs.add(
              UdCard(
                highlight: true,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const UdPill('Needs you', tone: UdTone.accent),
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
                    const SizedBox(height: 8),
                    Text(
                      a.reason.isEmpty ? a.tool : a.reason,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: u.fg,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text('${b.who(a.agent)} · ${a.tool}', style: u.sub),
                    const SizedBox(height: 10),
                    _approveRow(context, ref, a, reload),
                  ],
                ),
              ),
            );
          }
        }
        final activity = [
          for (final p in b.overview.projects)
            for (final a
                in b.statuses[p.id]?.activity ?? const <ActivityItem>[])
              if (isEmployeeActivity(a)) (p, a),
        ]..sort((x, y) => y.$2.ts.compareTo(x.$2.ts));
        final recent = activity.take(8).toList();
        final rows = <Widget>[
          for (final m in b.emails)
            UdItem(
              leading: UdAvatar(name: b.who(m.agent), colorKey: m.agent),
              title: Text('${b.who(m.agent)} · Outbox'),
              subtitle: 'Email to ${m.to.join(', ')} waits for you',
              trailing: const UdPill('Approve', tone: UdTone.warn),
              onTap: () async {
                final changed = await Navigator.of(context).push<bool>(
                  MaterialPageRoute(
                    builder: (_) =>
                        UOutboxScreen(item: m, from: b.who(m.agent)),
                  ),
                );
                if (changed == true) await reload();
              },
            ),
          for (final (p, a) in recent)
            UdItem(
              leading: UdAvatar(name: b.who(a.agent), colorKey: a.agent),
              title: Text('${b.who(a.agent)} · #${p.name}'),
              subtitle: a.detail.isNotEmpty
                  ? a.detail
                  : '${a.tool} · ${a.outcome}',
              trailing: Text(_ago(a.ts), style: u.sub),
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => UProjectScreen(project: p),
                ),
              ),
            ),
        ];
        return ListView(
physics: udScroll,
          padding: const EdgeInsets.fromLTRB(14, 0, 14, 24),
          children: [
            if (needs.isEmpty && b.emails.isEmpty) ...[
              UdCard(
                child: Row(
                  children: [
                    const Icon(Icons.task_alt_rounded, color: Ud.ok),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'All clear. Nothing waits for you.',
                        style: u.title,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 10),
            ],
            for (final w in needs) ...[w, const SizedBox(height: 10)],
            if (rows.isNotEmpty)
              UdCard(
                padding: const EdgeInsets.fromLTRB(14, 4, 14, 4),
                child: Column(children: _lastless(rows)),
              ),
          ],
        );
      },
    ),
  );
}

/// Removes the hairline under the last row of a card.
List<Widget> _lastless(List<Widget> rows) => [
  for (final (i, w) in rows.indexed)
    if (i == rows.length - 1 && w is UdItem)
      UdItem(
        leading: w.leading,
        title: w.title,
        subtitle: w.subtitle,
        trailing: w.trailing,
        onTap: w.onTap,
        last: true,
      )
    else
      w,
];

// ---------------------------------------------------------------- Projects
class UProjectsScreen extends StatelessWidget {
  const UProjectsScreen({super.key});

  @override
  Widget build(BuildContext context) => UdPage(
    title: 'Projects',
    body: ULoad<UBoard>(
      load: loadBoard,
      builder: (context, b, reload) {
        final u = Ud.of(context);
        if (b.overview.projects.isEmpty) {
          return const UdMessage(
            icon: Icons.folder_open_rounded,
            title: 'No projects yet',
            text: 'Connect an Odoo project from Projects on your computer.',
          );
        }
        return ListView.separated(
physics: udScroll,
          padding: const EdgeInsets.fromLTRB(14, 0, 14, 24),
          itemCount: b.overview.projects.length,
          separatorBuilder: (_, _) => const SizedBox(height: 10),
          itemBuilder: (context, i) {
            final p = b.overview.projects[i];
            final s = b.statuses[p.id];
            final healthy = s?.buildOk ?? false;
            final waiting = s?.approvals.length ?? 0;
            final line = s == null
                ? 'Status unavailable'
                : s.buildState.isEmpty
                ? (healthy ? 'Online' : 'Check the build')
                : 'Build ${s.buildState}';
            return UdCard(
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => UProjectScreen(project: p),
                ),
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: u.accentSoft,
                          borderRadius: BorderRadius.circular(13),
                        ),
                        child: Icon(
                          Icons.grid_view_rounded,
                          color: u.accent,
                          size: 20,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(p.name, style: u.title),
                            Text('${p.provider} · ${p.branch}', style: u.sub),
                          ],
                        ),
                      ),
                      UdPill(
                        healthy ? 'Healthy' : 'Attention',
                        tone: healthy ? UdTone.ok : UdTone.warn,
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(child: Text(line, style: u.sub)),
                      Text(
                        waiting == 0
                            ? 'Odoo ${p.version}'
                            : '$waiting waiting for you',
                        style: u.sub,
                      ),
                    ],
                  ),
                ],
              ),
            );
          },
        );
      },
    ),
  );
}

class UProjectScreen extends ConsumerStatefulWidget {
  const UProjectScreen({super.key, required this.project});
  final Project project;

  @override
  ConsumerState<UProjectScreen> createState() => _UProjectScreenState();
}

class _UProjectScreenState extends ConsumerState<UProjectScreen> {
  int _seg = 0;

  @override
  Widget build(BuildContext context) {
    final p = widget.project;
    final u = Ud.of(context);
    return UdPage(
      back: true,
      header: UdHeader(
        title: p.name,
        subtitle: '${p.provider} · Odoo ${p.version}',
      ),
      body: ULoad<(ProjectStatus, List<Employee>)>(
        load: (api) async {
          final teamF = api.employees().catchError((_) => <Employee>[]);
          final status = await api.projectStatus(p.id);
          return (status, await teamF);
        },
        builder: (context, data, reload) {
          final (s, team) = data;
          String who(String agent) =>
              team
                  .where((e) => e.slug == agent || e.name == agent)
                  .firstOrNull
                  ?.displayName ??
              agent;
          final children = <Widget>[];
          if (_seg == 0) {
            children.addAll([
              UdCard(
                onTap: s.buildUrl.isEmpty
                    ? null
                    : () => launchUrl(
                        Uri.parse(s.buildUrl),
                        mode: LaunchMode.externalApplication,
                      ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(child: Text('Staging', style: u.title)),
                        UdPill(
                          s.buildOk ? 'Online' : 'Attention',
                          tone: s.buildOk ? UdTone.ok : UdTone.warn,
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      [
                        p.branch,
                        if (s.buildState.isNotEmpty) 'build ${s.buildState}',
                      ].join(' · '),
                      style: u.sub,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 10),
              UdCard(
                padding: const EdgeInsets.fromLTRB(14, 4, 14, 4),
                child: Column(
                  children: _lastless([
                    for (final a in p.agents)
                      UdItem(
                        leading: UdAvatar(name: who(a), colorKey: a, size: 32),
                        title: Text(who(a)),
                        subtitle: 'Works on this project',
                      ),
                    if (p.agents.isEmpty)
                      UdItem(
                        leading: Icon(Icons.groups_outlined, color: u.muted),
                        title: const Text('No employees assigned'),
                      ),
                  ]),
                ),
              ),
            ]);
          } else if (_seg == 1) {
            if (s.approvals.isEmpty) {
              children.add(
                UdCard(
                  child: Text('Nothing waits for you here.', style: u.sub),
                ),
              );
            }
            for (final a in s.approvals) {
              children.addAll([
                UdCard(
                  highlight: true,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              a.reason.isEmpty ? a.tool : a.reason,
                              style: u.title,
                            ),
                          ),
                          const UdPill('Waiting for you', tone: UdTone.accent),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text('${who(a.agent)} · ${a.tool}', style: u.sub),
                      if (a.args.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        Text(
                          a.args,
                          maxLines: 4,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontFamily: 'GeistMono',
                            fontSize: 11.5,
                            color: u.muted,
                          ),
                        ),
                      ],
                      const SizedBox(height: 10),
                      _approveRow(context, ref, a, reload),
                    ],
                  ),
                ),
                const SizedBox(height: 10),
              ]);
            }
          } else {
            children.add(
              UdCard(
                padding: const EdgeInsets.fromLTRB(14, 4, 14, 4),
                child: s.activity.where(isEmployeeActivity).isEmpty
                    ? Padding(
                        padding: const EdgeInsets.all(10),
                        child: Text('Nothing yet.', style: u.sub),
                      )
                    : Column(
                        children: _lastless([
                          for (final a
                              in s.activity.reversed
                                  .where(isEmployeeActivity)
                                  .take(40))
                            UdItem(
                              leading: UdAvatar(
                                name: who(a.agent),
                                colorKey: a.agent,
                                size: 32,
                              ),
                              title: Text('${who(a.agent)} · ${a.tool}'),
                              subtitle: a.detail.isNotEmpty
                                  ? a.detail
                                  : a.outcome,
                              trailing: Text(_ago(a.ts), style: u.sub),
                            ),
                        ]),
                      ),
              ),
            );
          }
          return ListView(
physics: udScroll,
            padding: const EdgeInsets.fromLTRB(14, 0, 14, 24),
            children: [
              Row(
                children: [
                  for (final (i, l) in const [
                    'Overview',
                    'Approvals',
                    'Activity',
                  ].indexed) ...[
                    if (i > 0) const SizedBox(width: 6),
                    _Seg(
                      label: l,
                      on: _seg == i,
                      onTap: () => setState(() => _seg = i),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 10),
              ...children,
            ],
          );
        },
      ),
    );
  }
}

class _Seg extends StatelessWidget {
  const _Seg({required this.label, required this.on, required this.onTap});
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

// ---------------------------------------------------------------- Team
class UTeamScreen extends StatelessWidget {
  const UTeamScreen({super.key});

  @override
  Widget build(BuildContext context) => UdPage(
    title: 'Team',
    body: ULoad<List<Employee>>(
      load: (api) => api.employees(),
      builder: (context, list, reload) => uTeamList(context, list),
    ),
  );
}

/// The employees grouped by department (the Team tab's List view).
Widget uTeamList(BuildContext context, List<Employee> list) {
        final u = Ud.of(context);
        if (list.isEmpty) {
          return const UdMessage(
            icon: Icons.groups_rounded,
            title: 'No employees yet',
            text: 'Add employees from Agents on your computer.',
          );
        }
        final groups = <String, List<Employee>>{};
        for (final e in list) {
          groups.putIfAbsent(e.group, () => []).add(e);
        }
        return ListView(
physics: udScroll,
          padding: const EdgeInsets.fromLTRB(14, 0, 14, 24),
          children: [
            for (final g in groups.entries) ...[
              UdSection(g.key),
              UdCard(
                padding: const EdgeInsets.fromLTRB(14, 4, 14, 4),
                child: Column(
                  children: _lastless([
                    for (final e in g.value)
                      UdItem(
                        leading: UdAvatar(
                          name: e.displayName,
                          colorKey: e.slug,
                          url: e.avatar,
                        ),
                        title: Row(
                          children: [
                            Flexible(
                              child: Text(
                                e.displayName,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            const SizedBox(width: 6),
                            UdDot(color: e.running ? Ud.ok : u.muted),
                          ],
                        ),
                        subtitle: e.role,
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (e.telegramBot.isNotEmpty)
                              Icon(
                                Icons.send_rounded,
                                size: 16,
                                color: e.telegramPaired
                                    ? const Color(0xFF29A9EB)
                                    : u.muted,
                              ),
                            if (e.email.isNotEmpty) ...[
                              const SizedBox(width: 6),
                              Icon(
                                Icons.mail_outline_rounded,
                                size: 16,
                                color: e.emailOk ? Ud.ok : u.muted,
                              ),
                            ],
                          ],
                        ),
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute<void>(
                            builder: (_) => UEmployeeScreen(employee: e),
                          ),
                        ),
                      ),
                  ]),
                ),
              ),
              const SizedBox(height: 6),
            ],
          ],
        );
}

class UEmployeeScreen extends ConsumerStatefulWidget {
  const UEmployeeScreen({super.key, required this.employee});
  final Employee employee;

  @override
  ConsumerState<UEmployeeScreen> createState() => _UEmployeeScreenState();
}

class _UEmployeeScreenState extends ConsumerState<UEmployeeScreen> {
  bool _opening = false;

  Future<void> _message() async {
    final e = widget.employee;
    if (_opening || e.pubkey.isEmpty) return;
    setState(() => _opening = true);
    final nav = Navigator.of(context);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final channel = await ref
          .read(channelActionsProvider)
          .openDm(pubkeys: [e.pubkey], waitForChannelList: false);
      await nav.push(
        MaterialPageRoute<void>(
          builder: (_) => ChannelDetailPage(channel: channel),
        ),
      );
    } catch (err) {
      messenger.showSnackBar(
        SnackBar(content: Text('Could not open the chat. $err')),
      );
    } finally {
      if (mounted) setState(() => _opening = false);
    }
  }

  void _call() {
    if (!widget.employee.running) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('${widget.employee.displayName} is not running.'),
        ),
      );
      return;
    }
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        fullscreenDialog: true,
        builder: (_) => UCallScreen(employee: widget.employee),
      ),
    );
  }

  void _telegram() {
    final e = widget.employee;
    launchUrl(
      Uri.parse(
        e.telegramPairLink.isNotEmpty
            ? e.telegramPairLink
            : 'https://t.me/${e.telegramBot.replaceFirst('@', '')}',
      ),
      mode: LaunchMode.externalApplication,
    );
  }

  @override
  Widget build(BuildContext context) {
    final e = widget.employee;
    final u = Ud.of(context);
    Widget tile(IconData icon, String label, VoidCallback? onTap) => Expanded(
      child: UdCard(
        onTap: onTap,
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
        child: Column(
          children: [
            Icon(icon, size: 20, color: u.accent),
            const SizedBox(height: 3),
            Text(label, style: u.sub.copyWith(fontSize: 11.5)),
          ],
        ),
      ),
    );
    final model = e.model.isEmpty
        ? 'Claude'
        : 'Claude ${e.model[0].toUpperCase()}${e.model.substring(1)}';
    final telegram = e.telegramBot.isEmpty
        ? 'Not connected'
        : '${e.telegramBot} · ${e.telegramPaired ? 'connected' : 'open it to pair'}';
    final projects = e.projects.isEmpty
        ? 'None'
        : (e.projects.contains('*') ? 'All projects' : e.projects.join(', '));
    return UdPage(
      back: true,
      header: const SizedBox(),
      body: ListView(
physics: udScroll,
        padding: const EdgeInsets.fromLTRB(14, 0, 14, 24),
        children: [
          Center(
            child: UdAvatar(
              name: e.displayName,
              colorKey: e.slug,
              url: e.avatar,
              size: 84,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            e.displayName,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 21,
              fontWeight: FontWeight.w700,
              color: u.fg,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            [e.role, if (e.department.isNotEmpty) e.department].join(' · '),
            textAlign: TextAlign.center,
            style: u.sub,
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              UdPill(
                e.running ? 'Running' : 'Stopped',
                tone: e.running ? UdTone.ok : UdTone.warn,
              ),
              const SizedBox(width: 6),
              UdPill(model),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              tile(
                Icons.chat_bubble_outline_rounded,
                'Message',
                _opening ? null : _message,
              ),
              const SizedBox(width: 8),
              tile(Icons.call_outlined, 'Call', _call),
              const SizedBox(width: 8),
              tile(
                Icons.history_rounded,
                'History',
                _opening ? null : _message,
              ),
              const SizedBox(width: 8),
              tile(
                Icons.receipt_long_outlined,
                'Logs',
                () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => ULogsScreen(employee: e),
                  ),
                ),
              ),
            ],
          ),
          UMemberDaySection(id: 'ai:${e.slug}'),
          const SizedBox(height: 12),
          UdCard(
            padding: const EdgeInsets.fromLTRB(14, 4, 14, 4),
            child: Column(
              children: _lastless([
                UdItem(
                  leading: SizedBox(
                    width: 30,
                    child: Icon(Icons.send_rounded, size: 19, color: u.muted),
                  ),
                  title: const Text('Telegram'),
                  subtitle: telegram,
                  trailing: e.telegramBot.isEmpty
                      ? null
                      : Icon(Icons.chevron_right_rounded, color: u.muted),
                  onTap: e.telegramBot.isEmpty ? null : _telegram,
                ),
                UdItem(
                  leading: SizedBox(
                    width: 30,
                    child: Icon(
                      Icons.mail_outline_rounded,
                      size: 19,
                      color: u.muted,
                    ),
                  ),
                  title: const Text('Email'),
                  subtitle: e.email.isEmpty ? 'No address yet' : e.email,
                ),
                UdItem(
                  leading: SizedBox(
                    width: 30,
                    child: Icon(
                      Icons.mic_none_rounded,
                      size: 19,
                      color: u.muted,
                    ),
                  ),
                  title: const Text('Voice'),
                  subtitle: e.voiceLabel.isEmpty ? 'Default' : e.voiceLabel,
                ),
                UdItem(
                  leading: SizedBox(
                    width: 30,
                    child: Icon(
                      Icons.folder_outlined,
                      size: 19,
                      color: u.muted,
                    ),
                  ),
                  title: const Text('Projects'),
                  subtitle: projects,
                ),
              ]),
            ),
          ),
          if (e.about.isNotEmpty) ...[
            const SizedBox(height: 10),
            UdCard(
              child: Text(
                e.about,
                style: TextStyle(height: 1.5, color: u.fg, fontSize: 14),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class ULogsScreen extends ConsumerStatefulWidget {
  const ULogsScreen({super.key, required this.employee});
  final Employee employee;

  @override
  ConsumerState<ULogsScreen> createState() => _ULogsScreenState();
}

class _ULogsScreenState extends ConsumerState<ULogsScreen> {
  late Future<String> _log = uApi(ref).employeeLogs(widget.employee.slug);
  final _scroll = ScrollController();

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final u = Ud.of(context);
    return UdPage(
      back: true,
      header: UdHeader(title: 'Logs', subtitle: widget.employee.displayName),
      actions: [
        UdIconButton(
          icon: Icons.copy_rounded,
          tooltip: 'Copy',
          onTap: () async {
            final t = await _log.catchError((_) => '');
            await Clipboard.setData(ClipboardData(text: t));
          },
        ),
        UdIconButton(
          icon: Icons.refresh_rounded,
          tooltip: 'Refresh',
          onTap: () => setState(
            () => _log = uApi(ref).employeeLogs(widget.employee.slug),
          ),
        ),
      ],
      body: FutureBuilder<String>(
        future: _log,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator.adaptive());
          }
          if (snap.hasError) {
            return UdMessage(
              icon: Icons.error_outline_rounded,
              title: "Couldn't load the logs",
              text: snap.error.toString(),
            );
          }
          final text = (snap.data ?? '').trim();
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (_scroll.hasClients) {
              _scroll.jumpTo(_scroll.position.maxScrollExtent);
            }
          });
          return Padding(
            padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
            child: UdCard(
              padding: EdgeInsets.zero,
              child: SingleChildScrollView(
                controller: _scroll,
                padding: const EdgeInsets.all(12),
                child: SelectableText(
                  text.isEmpty ? 'No log lines yet.' : text,
                  style: TextStyle(
                    fontFamily: 'GeistMono',
                    fontSize: 11.5,
                    height: 1.45,
                    color: u.fg,
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

// ---------------------------------------------------------------- Outbox
class UOutboxListScreen extends StatelessWidget {
  const UOutboxListScreen({super.key});

  @override
  Widget build(BuildContext context) => UdPage(
    back: true,
    title: 'Outbox',
    body: ULoad<UBoard>(
      load: loadBoard,
      builder: (context, b, reload) {
        final u = Ud.of(context);
        if (b.emails.isEmpty) {
          return const UdMessage(
            icon: Icons.outbox_rounded,
            title: 'Nothing waiting',
            text:
                'Emails your employees write wait here until you approve them.',
          );
        }
        return ListView.separated(
physics: udScroll,
          padding: const EdgeInsets.fromLTRB(14, 0, 14, 24),
          itemCount: b.emails.length,
          separatorBuilder: (_, _) => const SizedBox(height: 10),
          itemBuilder: (context, i) {
            final m = b.emails[i];
            return UdCard(
              highlight: true,
              onTap: () async {
                final changed = await Navigator.of(context).push<bool>(
                  MaterialPageRoute(
                    builder: (_) =>
                        UOutboxScreen(item: m, from: b.who(m.agent)),
                  ),
                );
                if (changed == true) await reload();
              },
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const UdPill('Waits for you', tone: UdTone.warn),
                      const Spacer(),
                      Text(b.who(m.agent), style: u.sub),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    m.subject.isEmpty ? '(no subject)' : m.subject,
                    style: u.title,
                  ),
                  Text('To ${m.to.join(', ')}', style: u.sub),
                ],
              ),
            );
          },
        );
      },
    ),
  );
}

class UOutboxScreen extends ConsumerStatefulWidget {
  const UOutboxScreen({super.key, required this.item, required this.from});
  final OutboxItem item;
  final String from;

  @override
  ConsumerState<UOutboxScreen> createState() => _UOutboxScreenState();
}

class _UOutboxScreenState extends ConsumerState<UOutboxScreen> {
  bool _busy = false;

  Future<void> _decide(bool approve) async {
    if (approve) {
      final ok = await showDialog<bool>(
        context: context,
        builder: (c) => AlertDialog.adaptive(
          title: const Text('Send this email?'),
          content: Text('It goes to ${widget.item.to.join(', ')} now.'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(c, false),
              child: const Text('Cancel'),
            ),
            TextButton(
              onPressed: () => Navigator.pop(c, true),
              child: const Text('Send'),
            ),
          ],
        ),
      );
      if (ok != true) return;
    }
    if (!mounted) return;
    setState(() => _busy = true);
    final nav = Navigator.of(context);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await uApi(ref).decideEmail(widget.item.id, approve);
      messenger.showSnackBar(
        SnackBar(content: Text(approve ? 'Sent' : 'Rejected')),
      );
      nav.pop(true);
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.toString())));
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final m = widget.item;
    final u = Ud.of(context);
    Widget field(String label, String value) => Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: u.sub),
          Text(value, style: u.title.copyWith(fontSize: 14)),
        ],
      ),
    );
    return UdPage(
      back: true,
      header: UdHeader(
        title: 'Email to approve',
        subtitle: 'From ${widget.from}',
      ),
      body: ListView(
physics: udScroll,
        padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
        children: [
          UdCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                field('From', m.from.isEmpty ? widget.from : m.from),
                field('To', m.to.join(', ')),
                field(
                  'Subject',
                  m.subject.isEmpty ? '(no subject)' : m.subject,
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          UdCard(
            child: SelectableText(
              m.body,
              style: TextStyle(fontSize: 14, height: 1.7, color: u.fg),
            ),
          ),
        ],
      ),
      bottom: UdComposer(
        children: [
          Expanded(
            child: UdButton(
              label: 'Reject',
              ghost: true,
              onTap: _busy ? null : () => _decide(false),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            flex: 2,
            child: UdButton(
              label: 'Approve & send',
              onTap: _busy ? null : () => _decide(true),
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------- More
class UMoreScreen extends StatelessWidget {
  const UMoreScreen({
    super.key,
    required this.pending,
    required this.settingsPageBuilder,
    this.appearancePageBuilder,
    this.invitePageBuilder,
  });
  final int pending;
  final WidgetBuilder settingsPageBuilder;
  final WidgetBuilder? appearancePageBuilder;
  final WidgetBuilder? invitePageBuilder;

  @override
  Widget build(BuildContext context) {
    final u = Ud.of(context);
    void open(WidgetBuilder b) =>
        Navigator.of(context).push(MaterialPageRoute<void>(builder: b));
    Widget group(List<(IconData, String, String, VoidCallback)> items) =>
        UdCard(
          padding: const EdgeInsets.fromLTRB(14, 4, 14, 4),
          child: Column(
            children: _lastless([
              for (final it in items)
                UdItem(
                  leading: SizedBox(
                    width: 28,
                    child: Icon(it.$1, size: 19, color: u.accent),
                  ),
                  title: Text(it.$2),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(it.$3, style: u.sub),
                      Icon(Icons.chevron_right_rounded, color: u.muted),
                    ],
                  ),
                  onTap: it.$4,
                ),
            ]),
          ),
        );
    return UdPage(
      title: 'More',
      body: ListView(
physics: udScroll,
        padding: const EdgeInsets.fromLTRB(14, 0, 14, 24),
        children: [
          UdCard(
            onTap: () => open(settingsPageBuilder),
            child: Row(
              children: [
                const UdAvatar(name: 'Unlimited Solutions', colorKey: 'us'),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Your account', style: u.title),
                      Text('Unlimited Solutions · owner', style: u.sub),
                    ],
                  ),
                ),
                Icon(Icons.chevron_right_rounded, color: u.muted),
              ],
            ),
          ),
          const SizedBox(height: 10),
          group([
            (
              Icons.inbox_outlined,
              'Inbox',
              '',
              () => open((_) => const UInboxScreen(back: true)),
            ),
            (
              Icons.hub_outlined,
              'Company Odoo',
              '',
              () => open((_) => const UCompanyOdooScreen()),
            ),
            (
              Icons.auto_awesome_outlined,
              'AI provider',
              '',
              () => open((_) => const UAiProviderScreen()),
            ),
            (
              Icons.outbox_outlined,
              'Outbox',
              pending > 0 ? '$pending waiting' : '',
              () => open((_) => const UOutboxListScreen()),
            ),
            if (invitePageBuilder != null)
              (
                Icons.person_add_alt_1_outlined,
                'Invite',
                '',
                () => open(invitePageBuilder!),
              ),
          ]),
          const SizedBox(height: 10),
          group([
            (
              Icons.notifications_none_rounded,
              'Notifications',
              '',
              () => open(settingsPageBuilder),
            ),
            if (appearancePageBuilder != null)
              (
                Icons.palette_outlined,
                'Appearance',
                '',
                () => open(appearancePageBuilder!),
              ),
            (
              Icons.settings_outlined,
              'Settings',
              '',
              () => open(settingsPageBuilder),
            ),
          ]),
        ],
      ),
    );
  }
}
