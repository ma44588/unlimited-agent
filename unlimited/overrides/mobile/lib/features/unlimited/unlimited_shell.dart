// Unlimited Agent: the phone layout from the approved design. Five bottom
// tabs (Inbox, Chats, Projects, Team, More), brand purple, badges for what
// waits for the owner. Chats is the existing messaging home, unchanged.
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../shared/push/push_bridge.dart' show apnsDeviceToken;
import '../../shared/relay/relay_provider.dart';
import 'unlimited_api.dart';
import 'ud.dart';
import 'unlimited_hub_page.dart' show unlimitedPendingCount;
import 'unlimited_chats.dart';
import 'unlimited_org.dart';
import 'unlimited_org_api.dart';
import 'unlimited_screens.dart';

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
    this.initialTab = 0,
  });

  /// Today first: the day's plan and what needs the owner.
  final int initialTab;

  final Widget chats;
  final WidgetBuilder settingsPageBuilder;
  final WidgetBuilder? appearancePageBuilder;
  final WidgetBuilder? invitePageBuilder;

  @override
  ConsumerState<UnlimitedShell> createState() => _UnlimitedShellState();
}

class _UnlimitedShellState extends ConsumerState<UnlimitedShell> {
  late int _tab = widget.initialTab;
  int _pending = 0;
  Timer? _timer;
  late final _visited = <int>{widget.initialTab};

  @override
  void initState() {
    super.initState();
    unawaited(_startPush());
    unawaited(_refresh());
    _timer = Timer.periodic(const Duration(seconds: 90), (_) => _refresh());
  }

  /// Phone notifications from Unlimited Agent: ask iOS for a device token and give it to the server, signed
  /// with this phone's key, so approvals and plans reach this person.
  Future<void> _startPush() async {
    if (defaultTargetPlatform != TargetPlatform.iOS) return;
    apnsDeviceToken.addListener(_sendPushToken);
    _sendPushToken();
    try {
      await const MethodChannel('buzz/push').invokeMethod<void>('startRegistration');
    } catch (_) {}
  }

  String? _sentToken;

  void _sendPushToken() {
    final token = apnsDeviceToken.value;
    if (token == null || token.isEmpty || token == _sentToken) return;
    _sentToken = token;
    unawaited(
      UnlimitedApi(ref.read(relayConfigProvider))
          .post('/admin/push/register', {
            'token': token,
            'env': kReleaseMode ? 'production' : 'sandbox',
          })
          .catchError((Object _) {
            _sentToken = null;
            return null;
          }),
    );
  }

  @override
  void dispose() {
    apnsDeviceToken.removeListener(_sendPushToken);
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _refresh() async {
    try {
      final api = UnlimitedApi(ref.read(relayConfigProvider));
      final plansF = api
          .today()
          .then((t) => t.needs.length)
          .catchError((Object _) => 0);
      final n =
          await unlimitedPendingCount(api).catchError((Object _) => 0) +
          await plansF;
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
    0 => UTodayScreen(onOpenTeam: () => _select(3)),
    1 => UChatsScreen(classic: widget.chats),
    2 => const UProjectsScreen(),
    3 => const UTeamHome(),
    _ => UMoreScreen(
      pending: _pending,
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
                indicatorColor: Ud.of(context).accent.withValues(alpha: .18),
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
      bottomNavigationBar: _UdTabBar(
        selected: _tab,
        pending: _pending,
        onSelect: _select,
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
      icon: badge(const Icon(Icons.wb_sunny_outlined), pending),
      selectedIcon: badge(const Icon(Icons.wb_sunny_rounded), pending),
      label: 'Today',
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

class _UdTabBar extends StatelessWidget {
  const _UdTabBar({
    required this.selected,
    required this.pending,
    required this.onSelect,
  });
  final int selected;
  final int pending;
  final ValueChanged<int> onSelect;

  static const _items = [
    (Icons.wb_sunny_outlined, Icons.wb_sunny_rounded, 'Today'),
    (Icons.chat_bubble_outline_rounded, Icons.chat_bubble_rounded, 'Chats'),
    (Icons.folder_outlined, Icons.folder_rounded, 'Projects'),
    (Icons.groups_outlined, Icons.groups_rounded, 'Team'),
    (Icons.menu_rounded, Icons.menu_open_rounded, 'More'),
  ];

  @override
  Widget build(BuildContext context) {
    final u = Ud.of(context);
    return Container(
      decoration: BoxDecoration(
        color: u.card.withValues(alpha: .92),
        border: Border(top: BorderSide(color: u.line)),
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 56,
          child: Row(
            children: [
              for (final (i, it) in _items.indexed)
                Expanded(
                  child: Semantics(
                    selected: i == selected,
                    button: true,
                    label: it.$3,
                    child: InkWell(
                      onTap: () => onSelect(i),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Badge(
                            isLabelVisible: i == 0 && pending > 0,
                            backgroundColor: u.accent,
                            textColor: u.onAccent,
                            label: Text('$pending'),
                            child: Icon(
                              i == selected ? it.$2 : it.$1,
                              size: 22,
                              color: i == selected ? u.accent : u.muted,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            it.$3,
                            style: TextStyle(
                              fontSize: 10.5,
                              fontWeight: FontWeight.w600,
                              color: i == selected ? u.accent : u.muted,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
