// Unlimited Agent: Team, Projects and Outbox on the phone, from the same
// server API as the desktop. Opened from the community menu ("Team").
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../shared/relay/relay_provider.dart';
import 'unlimited_api.dart';

Future<void> showUnlimitedHub(BuildContext context, {int tab = 0}) =>
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => UnlimitedHubPage(initialTab: tab),
      ),
    );

UnlimitedApi _api(WidgetRef ref) => UnlimitedApi(ref.read(relayConfigProvider));

const _palette = [
  [Color(0xFFE2457A), Color(0xFFA3245A)],
  [Color(0xFF4F7DFF), Color(0xFF2C4FC9)],
  [Color(0xFF10B981), Color(0xFF047857)],
  [Color(0xFFF59E0B), Color(0xFFB45309)],
  [Color(0xFF7A4793), Color(0xFF421C63)],
  [Color(0xFF06B6D4), Color(0xFF0E7490)],
  [Color(0xFFEF4444), Color(0xFF991B1B)],
  [Color(0xFF8B5CF6), Color(0xFF5B21B6)],
];

List<Color> _colorsFor(String key) =>
    _palette[key.codeUnits.fold<int>(0, (a, b) => a + b) % _palette.length];

const _brand = LinearGradient(
  begin: Alignment.topLeft,
  end: Alignment.bottomRight,
  colors: [Color(0xFF7A4793), Color(0xFF9A3367)],
);
const _green = Color(0xFF22C55E);
const _amber = Color(0xFFF59E0B);

class UnlimitedHubPage extends StatelessWidget {
  const UnlimitedHubPage({super.key, this.initialTab = 0});
  final int initialTab;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return DefaultTabController(
      length: 3,
      initialIndex: initialTab,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Unlimited'),
          bottom: TabBar(
            indicatorSize: TabBarIndicatorSize.tab,
            dividerColor: Colors.transparent,
            labelColor: Colors.white,
            unselectedLabelColor: scheme.onSurfaceVariant,
            labelStyle: const TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 14,
            ),
            indicator: BoxDecoration(
              gradient: _brand,
              borderRadius: BorderRadius.circular(12),
            ),
            indicatorPadding: const EdgeInsets.symmetric(
              horizontal: 6,
              vertical: 6,
            ),
            tabs: const [
              Tab(text: 'Team'),
              Tab(text: 'Projects'),
              Tab(text: 'Outbox'),
            ],
          ),
        ),
        body: const SafeArea(
          top: false,
          child: TabBarView(
            children: [_TeamTab(), _ProjectsTab(), _OutboxTab()],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------- shared bits
class _Loader<T> extends ConsumerStatefulWidget {
  const _Loader({required this.load, required this.builder});
  final Future<T> Function(UnlimitedApi api) load;
  final Widget Function(
    BuildContext context,
    T data,
    Future<void> Function() reload,
  )
  builder;

  @override
  ConsumerState<_Loader<T>> createState() => _LoaderState<T>();
}

class _LoaderState<T> extends ConsumerState<_Loader<T>>
    with AutomaticKeepAliveClientMixin {
  late Future<T> _future = widget.load(_api(ref));

  Future<void> _reload() async {
    final f = widget.load(_api(ref));
    setState(() => _future = f);
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
      future: _future,
      builder: (context, snap) {
        if (snap.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator.adaptive());
        }
        if (snap.hasError) {
          return _Message(
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

class _Message extends StatelessWidget {
  const _Message({
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
    final scheme = Theme.of(context).colorScheme;
    return ListView(
      padding: const EdgeInsets.fromLTRB(32, 80, 32, 32),
      children: [
        Icon(icon, size: 40, color: scheme.onSurfaceVariant),
        const SizedBox(height: 14),
        Text(
          title,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 6),
        Text(
          text,
          textAlign: TextAlign.center,
          style: TextStyle(color: scheme.onSurfaceVariant),
        ),
        if (action != null) ...[
          const SizedBox(height: 18),
          Center(
            child: FilledButton.tonal(
              onPressed: onAction,
              child: Text(action!),
            ),
          ),
        ],
      ],
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.child, this.onTap, this.highlight = false});
  final Widget child;
  final VoidCallback? onTap;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Material(
      color: scheme.surfaceContainerHigh,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: BorderSide(
          color: highlight
              ? const Color(0xFF9A3367).withValues(alpha: .6)
              : scheme.outlineVariant.withValues(alpha: .5),
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(padding: const EdgeInsets.all(14), child: child),
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill(this.label, this.color);
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
    decoration: BoxDecoration(
      color: color.withValues(alpha: .14),
      borderRadius: BorderRadius.circular(999),
    ),
    child: Text(
      label,
      style: TextStyle(
        fontSize: 11.5,
        fontWeight: FontWeight.w600,
        color: color,
      ),
    ),
  );
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(4, 20, 4, 8),
    child: Text(
      text,
      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
    ),
  );
}

class EmployeeAvatar extends StatelessWidget {
  const EmployeeAvatar({super.key, required this.employee, this.size = 44});
  final Employee employee;
  final double size;

  @override
  Widget build(BuildContext context) {
    final url = employee.avatar.startsWith('http') ? employee.avatar : null;
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          width: size,
          height: size,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(size * .32),
            gradient: LinearGradient(
              colors: _colorsFor(employee.slug),
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            image: url == null
                ? null
                : DecorationImage(image: NetworkImage(url), fit: BoxFit.cover),
          ),
          child: url != null
              ? null
              : Text(
                  employee.initials,
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: size * .34,
                  ),
                ),
        ),
        Positioned(
          right: -2,
          bottom: -2,
          child: Container(
            width: size * .3,
            height: size * .3,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: employee.running ? _green : const Color(0xFF9CA3AF),
              border: Border.all(
                color: Theme.of(context).colorScheme.surface,
                width: 2,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------- Team
class _TeamTab extends StatelessWidget {
  const _TeamTab();

  @override
  Widget build(BuildContext context) => _Loader<List<Employee>>(
    load: (api) => api.employees(),
    builder: (context, list, reload) {
      if (list.isEmpty) {
        return const _Message(
          icon: Icons.groups_rounded,
          title: 'No employees yet',
          text: 'Add employees from Agents on your computer.',
        );
      }
      final groups = <String, List<Employee>>{};
      for (final e in list) {
        groups.putIfAbsent(e.group, () => []).add(e);
      }
      final scheme = Theme.of(context).colorScheme;
      final online = list.where((e) => e.running).length;
      return ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
        children: [
          Text(
            '$online of ${list.length} working now',
            style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13),
          ),
          for (final g in groups.entries) ...[
            _SectionTitle(g.key),
            for (final e in g.value)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: _EmployeeRow(employee: e),
              ),
          ],
        ],
      );
    },
  );
}

class _EmployeeRow extends StatelessWidget {
  const _EmployeeRow({required this.employee});
  final Employee employee;

  @override
  Widget build(BuildContext context) {
    final e = employee;
    final scheme = Theme.of(context).colorScheme;
    return _Card(
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute<void>(builder: (_) => EmployeePage(employee: e)),
      ),
      child: Row(
        children: [
          EmployeeAvatar(employee: e),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  e.displayName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  e.role,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: scheme.onSurfaceVariant,
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
          if (e.telegramBot.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(left: 6),
              child: Icon(
                Icons.send_rounded,
                size: 17,
                color: e.telegramPaired
                    ? const Color(0xFF29A9EB)
                    : scheme.outline,
              ),
            ),
          if (e.email.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(left: 6),
              child: Icon(
                Icons.mail_rounded,
                size: 17,
                color: e.emailOk ? _green : scheme.outline,
              ),
            ),
          const SizedBox(width: 4),
          Icon(Icons.chevron_right_rounded, color: scheme.outline),
        ],
      ),
    );
  }
}

class EmployeePage extends ConsumerStatefulWidget {
  const EmployeePage({super.key, required this.employee});
  final Employee employee;

  @override
  ConsumerState<EmployeePage> createState() => _EmployeePageState();
}

class _EmployeePageState extends ConsumerState<EmployeePage> {
  bool _busy = false;

  Future<void> _restart() async {
    final e = widget.employee;
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog.adaptive(
        title: Text('Restart ${e.displayName}?'),
        content: const Text(
          'Their memory is kept. They are back in about a minute.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(c, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(c, true),
            child: const Text('Restart'),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    setState(() => _busy = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await _api(ref).employeeAction(e.slug, 'restart');
      messenger.showSnackBar(
        SnackBar(content: Text('${e.displayName} is restarting')),
      );
    } catch (err) {
      messenger.showSnackBar(SnackBar(content: Text(err.toString())));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _open(String url) =>
      launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);

  @override
  Widget build(BuildContext context) {
    final e = widget.employee;
    final scheme = Theme.of(context).colorScheme;
    final muted = TextStyle(color: scheme.onSurfaceVariant, fontSize: 13.5);
    final telegramUrl = e.telegramPairLink.isNotEmpty
        ? e.telegramPairLink
        : 'https://t.me/${e.telegramBot.replaceFirst('@', '')}';
    Widget row(IconData icon, String label, String value, {Widget? trailing}) =>
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(
            children: [
              Icon(icon, size: 19, color: scheme.onSurfaceVariant),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                    Text(value, style: muted),
                  ],
                ),
              ),
              ?trailing,
            ],
          ),
        );
    final model = e.model.isEmpty
        ? 'Default'
        : 'Claude ${e.model[0].toUpperCase()}${e.model.substring(1)}';
    final projects = e.projects.isEmpty
        ? 'None'
        : e.projects.contains('*')
        ? 'All projects'
        : e.projects.join(', ');
    return Scaffold(
      appBar: AppBar(title: Text(e.displayName)),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 40),
        children: [
          Center(child: EmployeeAvatar(employee: e, size: 88)),
          const SizedBox(height: 14),
          Text(
            e.displayName,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w800,
              letterSpacing: -.4,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            [e.role, if (e.department.isNotEmpty) e.department].join(' · '),
            textAlign: TextAlign.center,
            style: muted,
          ),
          const SizedBox(height: 10),
          Center(
            child: _Pill(
              e.running ? 'Working' : (e.status.isEmpty ? 'Offline' : e.status),
              e.running ? _green : scheme.outline,
            ),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(
                child: _Action(
                  icon: Icons.receipt_long_rounded,
                  label: 'Logs',
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => EmployeeLogsPage(employee: e),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _Action(
                  icon: Icons.send_rounded,
                  label: 'Telegram',
                  onTap: e.telegramBot.isEmpty
                      ? null
                      : () => _open(telegramUrl),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _Action(
                  icon: Icons.restart_alt_rounded,
                  label: 'Restart',
                  onTap: _busy ? null : _restart,
                ),
              ),
            ],
          ),
          if (e.about.isNotEmpty) ...[
            const _SectionTitle('About'),
            _Card(child: Text(e.about, style: const TextStyle(height: 1.45))),
          ],
          const _SectionTitle('Channels'),
          _Card(
            child: Column(
              children: [
                row(
                  Icons.send_rounded,
                  'Telegram',
                  e.telegramBot.isEmpty
                      ? 'Not connected. Connect a bot from the profile on your computer.'
                      : e.telegramPaired
                      ? '${e.telegramBot} · connected to you'
                      : '${e.telegramBot} · open it once to pair',
                  trailing:
                      e.telegramBot.isNotEmpty &&
                          !e.telegramPaired &&
                          e.telegramPairLink.isNotEmpty
                      ? TextButton(
                          onPressed: () => _open(e.telegramPairLink),
                          child: const Text('Pair'),
                        )
                      : null,
                ),
                const Divider(height: 14),
                row(
                  Icons.mail_rounded,
                  'Email',
                  e.email.isEmpty ? 'No address yet' : e.email,
                  trailing: e.email.isEmpty
                      ? null
                      : _Pill(
                          e.emailOk ? 'Active' : 'Not set up',
                          e.emailOk ? _green : scheme.outline,
                        ),
                ),
              ],
            ),
          ),
          const _SectionTitle('Work'),
          _Card(
            child: Column(
              children: [
                row(Icons.memory_rounded, 'Model', model),
                const Divider(height: 14),
                row(Icons.folder_rounded, 'Projects', projects),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Action extends StatelessWidget {
  const _Action({required this.icon, required this.label, this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Opacity(
      opacity: onTap != null ? 1 : .45,
      child: _Card(
        onTap: onTap,
        child: Column(
          children: [
            Icon(icon, color: scheme.primary),
            const SizedBox(height: 6),
            Text(
              label,
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
            ),
          ],
        ),
      ),
    );
  }
}

class EmployeeLogsPage extends ConsumerStatefulWidget {
  const EmployeeLogsPage({super.key, required this.employee});
  final Employee employee;

  @override
  ConsumerState<EmployeeLogsPage> createState() => _EmployeeLogsPageState();
}

class _EmployeeLogsPageState extends ConsumerState<EmployeeLogsPage> {
  late Future<String> _log = _api(ref).employeeLogs(widget.employee.slug);
  final _scroll = ScrollController();

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        title: Text('${widget.employee.displayName} · Logs'),
        actions: [
          IconButton(
            tooltip: 'Copy',
            icon: const Icon(Icons.copy_rounded),
            onPressed: () async {
              final text = await _log.catchError((_) => '');
              await Clipboard.setData(ClipboardData(text: text));
            },
          ),
          IconButton(
            tooltip: 'Refresh',
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => setState(
              () => _log = _api(ref).employeeLogs(widget.employee.slug),
            ),
          ),
        ],
      ),
      body: FutureBuilder<String>(
        future: _log,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator.adaptive());
          }
          if (snap.hasError) {
            return _Message(
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
          return ColoredBox(
            color: scheme.surfaceContainerLowest,
            child: Scrollbar(
              controller: _scroll,
              child: SingleChildScrollView(
                controller: _scroll,
                padding: const EdgeInsets.all(14),
                child: SelectableText(
                  text.isEmpty ? 'No log lines yet.' : text,
                  style: TextStyle(
                    fontFamily: 'GeistMono',
                    fontSize: 11.5,
                    height: 1.45,
                    color: scheme.onSurface,
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

// ---------------------------------------------------------------- Projects
class _ProjectsTab extends StatelessWidget {
  const _ProjectsTab();

  @override
  Widget build(BuildContext context) => _Loader<Overview>(
    load: (api) => api.overview(),
    builder: (context, o, reload) {
      final scheme = Theme.of(context).colorScheme;
      if (o.projects.isEmpty) {
        return const _Message(
          icon: Icons.folder_open_rounded,
          title: 'No projects yet',
          text: 'Connect an Odoo project from Projects on your computer.',
        );
      }
      return ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
        children: [
          if (o.approvals > 0)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  gradient: _brand,
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.verified_user_rounded,
                      color: Colors.white,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        o.approvals == 1
                            ? '1 action waits for your approval'
                            : '${o.approvals} actions wait for your approval',
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          for (final p in o.projects)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: _Card(
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => ProjectPage(project: p),
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(14),
                        gradient: LinearGradient(colors: _colorsFor(p.id)),
                      ),
                      child: Text(
                        p.name.isEmpty ? '#' : p.name[0].toUpperCase(),
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          fontSize: 18,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            p.name,
                            style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 15,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            [
                              p.provider,
                              if (p.branch.isNotEmpty) p.branch,
                              if (p.version.isNotEmpty) 'Odoo ${p.version}',
                            ].join(' · '),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: scheme.onSurfaceVariant,
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Icon(Icons.chevron_right_rounded, color: scheme.outline),
                  ],
                ),
              ),
            ),
        ],
      );
    },
  );
}

class ProjectPage extends ConsumerStatefulWidget {
  const ProjectPage({super.key, required this.project});
  final Project project;

  @override
  ConsumerState<ProjectPage> createState() => _ProjectPageState();
}

class _ProjectPageState extends ConsumerState<ProjectPage> {
  late Future<ProjectStatus> _status = _api(ref)
      .projectStatus(widget.project.id);

  void _refresh() =>
      setState(() => _status = _api(ref).projectStatus(widget.project.id));

  Future<void> _decide(Approval a, bool approve) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      await _api(ref).decideApproval(a.id, approve);
      messenger.showSnackBar(
        SnackBar(content: Text(approve ? 'Approved' : 'Rejected')),
      );
      _refresh();
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.project;
    final scheme = Theme.of(context).colorScheme;
    final muted = TextStyle(color: scheme.onSurfaceVariant, fontSize: 13);
    return Scaffold(
      appBar: AppBar(title: Text(p.name)),
      body: FutureBuilder<ProjectStatus>(
        future: _status,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator.adaptive());
          }
          if (snap.hasError) {
            return _Message(
              icon: Icons.cloud_off_rounded,
              title: "Couldn't load the project",
              text: snap.error.toString(),
              action: 'Try again',
              onAction: _refresh,
            );
          }
          final s = snap.data!;
          return RefreshIndicator.adaptive(
            onRefresh: () async => _refresh(),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 40),
              children: [
                _Card(
                  onTap: s.buildUrl.isEmpty
                      ? null
                      : () => launchUrl(
                          Uri.parse(s.buildUrl),
                          mode: LaunchMode.externalApplication,
                        ),
                  child: Row(
                    children: [
                      Icon(
                        s.buildOk
                            ? Icons.check_circle_rounded
                            : Icons.error_rounded,
                        color: s.buildOk ? _green : _amber,
                        size: 30,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Staging build',
                              style: TextStyle(fontWeight: FontWeight.w700),
                            ),
                            Text(
                              [
                                p.branch,
                                if (s.buildState.isNotEmpty) s.buildState,
                              ].join(' · '),
                              style: muted,
                            ),
                          ],
                        ),
                      ),
                      if (s.buildUrl.isNotEmpty)
                        Icon(
                          Icons.open_in_new_rounded,
                          size: 18,
                          color: scheme.outline,
                        ),
                    ],
                  ),
                ),
                if (s.approvals.isNotEmpty) ...[
                  const _SectionTitle('Waiting for you'),
                  for (final a in s.approvals)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: _ApprovalCard(
                        approval: a,
                        onDecide: (ok) => _decide(a, ok),
                      ),
                    ),
                ],
                const _SectionTitle('Recent activity'),
                if (s.activity.isEmpty)
                  Padding(
                    padding: const EdgeInsets.all(8),
                    child: Text('Nothing yet.', style: muted),
                  )
                else
                  _Card(
                    child: Column(
                      children: [
                        for (final (i, a)
                            in s.activity.reversed.take(30).indexed) ...[
                          if (i > 0) const Divider(height: 14),
                          _ActivityRow(item: a),
                        ],
                      ],
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _ApprovalCard extends StatelessWidget {
  const _ApprovalCard({required this.approval, required this.onDecide});
  final Approval approval;
  final ValueChanged<bool> onDecide;

  @override
  Widget build(BuildContext context) {
    final a = approval;
    final scheme = Theme.of(context).colorScheme;
    return _Card(
      highlight: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            a.reason.isEmpty ? a.tool : a.reason,
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 4),
          Text(
            '${a.agent} · ${a.tool}',
            style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13),
          ),
          if (a.args.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              a.args,
              maxLines: 4,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontFamily: 'GeistMono',
                fontSize: 11.5,
                color: scheme.onSurfaceVariant,
              ),
            ),
          ],
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => onDecide(false),
                  child: const Text('Reject'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton(
                  onPressed: () => onDecide(true),
                  child: const Text('Approve'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ActivityRow extends StatelessWidget {
  const _ActivityRow({required this.item});
  final ActivityItem item;

  @override
  Widget build(BuildContext context) {
    final a = item;
    final scheme = Theme.of(context).colorScheme;
    final bad = a.outcome.contains('denied') || a.outcome.contains('error');
    final good = a.outcome == 'ok' || a.outcome == 'allowed';
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(
          good
              ? Icons.check_rounded
              : bad
              ? Icons.close_rounded
              : Icons.circle_outlined,
          size: 16,
          color: scheme.onSurfaceVariant,
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${a.agent} · ${a.tool}',
                style: const TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
              ),
              if (a.detail.isNotEmpty)
                Text(
                  a.detail,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: scheme.onSurfaceVariant,
                    fontSize: 13,
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------- Outbox
class _OutboxTab extends StatelessWidget {
  const _OutboxTab();

  @override
  Widget build(BuildContext context) => _Loader<List<OutboxItem>>(
    load: (api) => api.outbox(),
    builder: (context, items, reload) {
      final scheme = Theme.of(context).colorScheme;
      if (items.isEmpty) {
        return const _Message(
          icon: Icons.outbox_rounded,
          title: 'Nothing waiting',
          text: 'Emails your employees write wait here until you approve them.',
        );
      }
      return ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
        children: [
          for (final m in items)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: _Card(
                highlight: true,
                onTap: () async {
                  final changed = await showModalBottomSheet<bool>(
                    context: context,
                    isScrollControlled: true,
                    useSafeArea: true,
                    showDragHandle: true,
                    builder: (_) => _OutboxSheet(item: m),
                  );
                  if (changed == true) await reload();
                },
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const _Pill('Waits for you', _amber),
                        const Spacer(),
                        Text(
                          m.agent,
                          style: TextStyle(
                            color: scheme.onSurfaceVariant,
                            fontSize: 12.5,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      m.subject.isEmpty ? '(no subject)' : m.subject,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 15,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'To ${m.to.join(', ')}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: scheme.onSurfaceVariant,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      );
    },
  );
}

class _OutboxSheet extends ConsumerStatefulWidget {
  const _OutboxSheet({required this.item});
  final OutboxItem item;

  @override
  ConsumerState<_OutboxSheet> createState() => _OutboxSheetState();
}

class _OutboxSheetState extends ConsumerState<_OutboxSheet> {
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
      await _api(ref).decideEmail(widget.item.id, approve);
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
    final scheme = Theme.of(context).colorScheme;
    final muted = TextStyle(color: scheme.onSurfaceVariant, fontSize: 13);
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: .85,
      maxChildSize: .95,
      builder: (context, scroll) => Column(
        children: [
          Expanded(
            child: ListView(
              controller: scroll,
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
              children: [
                Text(
                  m.subject.isEmpty ? '(no subject)' : m.subject,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 8),
                Text('From ${m.from.isEmpty ? m.agent : m.from}', style: muted),
                Text('To ${m.to.join(', ')}', style: muted),
                const Divider(height: 26),
                SelectableText(m.body, style: const TextStyle(height: 1.5)),
              ],
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _busy ? null : () => _decide(false),
                      child: const Text('Reject'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    flex: 2,
                    child: FilledButton(
                      onPressed: _busy ? null : () => _decide(true),
                      child: const Text('Approve & send'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
