// Unlimited Agent: the phone layout from the approved design. Five bottom
// tabs (Inbox, Chats, Projects, Team, More), brand purple, badges for what
// waits for the owner. Chats is the existing messaging home, unchanged.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../shared/relay/relay_provider.dart';
import 'unlimited_api.dart';
import 'unlimited_hub_page.dart';

const _brand = LinearGradient(
  begin: Alignment.topLeft,
  end: Alignment.bottomRight,
  colors: [Color(0xFF7A4793), Color(0xFF9A3367)],
);

class UnlimitedShell extends ConsumerStatefulWidget {
  const UnlimitedShell({
    super.key,
    required this.chats,
    required this.settingsPageBuilder,
    this.appearancePageBuilder,
    this.invitePageBuilder,
  });

  final Widget chats;
  final WidgetBuilder settingsPageBuilder;
  final WidgetBuilder? appearancePageBuilder;
  final WidgetBuilder? invitePageBuilder;

  @override
  ConsumerState<UnlimitedShell> createState() => _UnlimitedShellState();
}

class _UnlimitedShellState extends ConsumerState<UnlimitedShell> {
  int _tab = 1; // Chats first, like the desktop.
  int _pending = 0;
  Timer? _timer;
  final _visited = <int>{1};

  @override
  void initState() {
    super.initState();
    unawaited(_refresh());
    _timer = Timer.periodic(const Duration(seconds: 90), (_) => _refresh());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _refresh() async {
    try {
      final n = await unlimitedPendingCount(
        UnlimitedApi(ref.read(relayConfigProvider)),
      );
      if (mounted && n != _pending) setState(() => _pending = n);
    } catch (_) {
      if (mounted && _pending != 0) setState(() => _pending = 0);
    }
  }

  void _select(int i) {
    if (i == _tab) return;
    unawaited(HapticFeedback.selectionClick());
    setState(() {
      _tab = i;
      _visited.add(i);
    });
    unawaited(_refresh());
  }

  Widget _page(int i) => switch (i) {
    0 => const _TabPage(title: 'Inbox', child: UnlimitedInboxView()),
    1 => widget.chats,
    2 => const _TabPage(title: 'Projects', child: UnlimitedProjectsView()),
    3 => const _TabPage(title: 'Team', child: UnlimitedTeamView()),
    _ => _MorePage(
      settingsPageBuilder: widget.settingsPageBuilder,
      appearancePageBuilder: widget.appearancePageBuilder,
      invitePageBuilder: widget.invitePageBuilder,
    ),
  };

  @override
  Widget build(BuildContext context) {
    final wide = MediaQuery.sizeOf(context).width >= 900;
    final pages = IndexedStack(
      index: _tab,
      children: [
        for (var i = 0; i < 5; i++)
          _visited.contains(i) ? _page(i) : const SizedBox.shrink(),
      ],
    );
    if (wide) {
      // iPad and large screens: a side rail like the desktop sidebar.
      return Scaffold(
        body: Row(
          children: [
            SafeArea(
              right: false,
              child: NavigationRail(
                selectedIndex: _tab,
                onDestinationSelected: _select,
                labelType: NavigationRailLabelType.all,
                indicatorColor: const Color(0xFF7A4793).withValues(alpha: .18),
                leading: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Container(
                    width: 40,
                    height: 40,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      gradient: _brand,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Text(
                      '∞',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
                destinations: [
                  for (final d in _destinations(_pending))
                    NavigationRailDestination(
                      icon: d.icon,
                      selectedIcon: d.selectedIcon,
                      label: Text(d.label),
                    ),
                ],
              ),
            ),
            const VerticalDivider(width: 1),
            Expanded(child: pages),
          ],
        ),
      );
    }
    return Scaffold(
      body: pages,
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: _select,
        height: 64,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        indicatorColor: const Color(0xFF7A4793).withValues(alpha: .18),
        destinations: _destinations(_pending),
      ),
    );
  }
}

List<NavigationDestination> _destinations(int pending) {
  Widget badge(Widget icon, int n) => Badge(
    isLabelVisible: n > 0,
    backgroundColor: const Color(0xFF9A3367),
    label: Text('$n'),
    child: icon,
  );
  return [
    NavigationDestination(
      icon: badge(const Icon(Icons.inbox_outlined), pending),
      selectedIcon: badge(const Icon(Icons.inbox_rounded), pending),
      label: 'Inbox',
    ),
    const NavigationDestination(
      icon: Icon(Icons.chat_bubble_outline_rounded),
      selectedIcon: Icon(Icons.chat_bubble_rounded),
      label: 'Chats',
    ),
    const NavigationDestination(
      icon: Icon(Icons.folder_outlined),
      selectedIcon: Icon(Icons.folder_rounded),
      label: 'Projects',
    ),
    const NavigationDestination(
      icon: Icon(Icons.groups_outlined),
      selectedIcon: Icon(Icons.groups_rounded),
      label: 'Team',
    ),
    const NavigationDestination(
      icon: Icon(Icons.menu_rounded),
      selectedIcon: Icon(Icons.menu_open_rounded),
      label: 'More',
    ),
  ];
}

class _TabPage extends StatelessWidget {
  const _TabPage({required this.title, required this.child});
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(
        title,
        style: const TextStyle(
          fontWeight: FontWeight.w800,
          fontSize: 26,
          letterSpacing: -.5,
        ),
      ),
      centerTitle: false,
    ),
    body: child,
  );
}

class _MorePage extends StatelessWidget {
  const _MorePage({
    required this.settingsPageBuilder,
    this.appearancePageBuilder,
    this.invitePageBuilder,
  });
  final WidgetBuilder settingsPageBuilder;
  final WidgetBuilder? appearancePageBuilder;
  final WidgetBuilder? invitePageBuilder;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    void open(WidgetBuilder b) =>
        Navigator.of(context).push(MaterialPageRoute<void>(builder: b));
    Widget tile(
      IconData icon,
      String title,
      String subtitle,
      VoidCallback onTap,
    ) => ListTile(
      leading: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: const Color(0xFF7A4793).withValues(alpha: .14),
          borderRadius: BorderRadius.circular(11),
        ),
        child: Icon(icon, color: scheme.primary, size: 20),
      ),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
      subtitle: Text(subtitle),
      trailing: const Icon(Icons.chevron_right_rounded),
      onTap: onTap,
    );
    return _TabPage(
      title: 'More',
      child: ListView(
        padding: const EdgeInsets.only(top: 4, bottom: 24),
        children: [
          tile(
            Icons.outbox_rounded,
            'Outbox',
            'Emails waiting for your approval',
            () => open(
              (_) =>
                  const _TabPage(title: 'Outbox', child: UnlimitedOutboxView()),
            ),
          ),
          if (appearancePageBuilder != null)
            tile(
              Icons.palette_outlined,
              'Appearance',
              'Theme, light or dark, accent color',
              () => open(appearancePageBuilder!),
            ),
          if (invitePageBuilder != null)
            tile(
              Icons.person_add_alt_1_rounded,
              'Invite',
              'Add a person to this workspace',
              () => open(invitePageBuilder!),
            ),
          tile(
            Icons.settings_outlined,
            'Settings',
            'Profile, notifications, security',
            () => open(settingsPageBuilder),
          ),
        ],
      ),
    );
  }
}
