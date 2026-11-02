// Unlimited Agent: Chats, built to the approved design. Search, filters
// (All, Channels, Direct, Unread) and cards. Old huddle rooms and on-phone
// agent "Solo" chats are hidden; the full classic list stays one tap away.
import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../shared/profile/user_cache_provider.dart';
import '../../shared/read_state/read_state_provider.dart';
import '../../shared/relay/relay_provider.dart';
import '../channels/channel.dart';
import '../channels/channel_detail_page.dart';
import '../channels/channel_unread.dart';
import '../channels/channels_provider.dart';
import '../search/search_page.dart';
import 'ud.dart';

String _when(DateTime? t) {
  if (t == null) return '';
  final now = DateTime.now();
  final local = t.toLocal();
  final d = now.difference(local);
  if (d.inHours < 24 && now.day == local.day) {
    return '${local.hour.toString().padLeft(2, '0')}:'
        '${local.minute.toString().padLeft(2, '0')}';
  }
  if (d.inDays < 2) return 'Yesterday';
  if (d.inDays < 7) {
    return const [
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat',
      'Sun',
    ][local.weekday - 1];
  }
  return '${local.day}/${local.month}';
}

bool _hidden(Channel c) {
  final n = c.name.toLowerCase();
  return !c.isMember ||
      c.isArchived ||
      c.isSolo ||
      c.isEphemeral ||
      n.startsWith('huddle-') ||
      n.endsWith(' huddle');
}

class UChatsScreen extends ConsumerStatefulWidget {
  const UChatsScreen({super.key, required this.classic});

  /// The full classic messages home (new channel, new DM, workspaces).
  final Widget classic;

  @override
  ConsumerState<UChatsScreen> createState() => _UChatsScreenState();
}

class _UChatsScreenState extends ConsumerState<UChatsScreen> {
  int _seg = 0;

  void _open(Channel c) => Navigator.of(context).push(
    MaterialPageRoute<void>(builder: (_) => ChannelDetailPage(channel: c)),
  );

  @override
  Widget build(BuildContext context) {
    final u = Ud.of(context);
    final channelsAsync = ref.watch(channelsProvider);
    final reads = ref.watch(readStateProvider);
    final me = ref.watch(myPubkeyProvider);
    final people = ref.watch(userCacheProvider);
    final all =
        (channelsAsync.value ?? const <Channel>[])
            .where((c) => !_hidden(c))
            .toList()
          ..sort(
            (a, b) => (b.lastMessageAt ?? b.createdAt).compareTo(
              a.lastMessageAt ?? a.createdAt,
            ),
          );
    final unread = computeUnreadChannelIds(
      channels: all,
      readState: reads,
      channelsNotifier: ref.read(channelsProvider.notifier),
    );
    String other(Channel c) =>
        c.participantPubkeys.firstWhere((p) => p != me, orElse: () => '');
    String dmName(Channel c) {
      final others = c.participantPubkeys.where((p) => p != me).toList();
      if (others.isEmpty) return 'Notes to self';
      return others
          .map((p) => people[p]?.label ?? '${p.substring(0, 8)}…')
          .join(', ');
    }

    final channels = all.where((c) => !c.isDm).toList();
    final dms = all.where((c) => c.isDm).toList();

    Widget row(Channel c, {required bool last}) {
      final isUnread = unread.contains(c.id);
      final name = c.isDm ? dmName(c) : c.name;
      final sub = c.isDm
          ? 'Direct message'
          : (c.description.isNotEmpty
                ? c.description
                : '${c.memberCount} member${c.memberCount == 1 ? '' : 's'}');
      final leading = c.isDm
          ? UdAvatar(
              name: name,
              colorKey: other(c).isEmpty ? c.id : other(c),
              url: people[other(c)]?.avatarUrl,
            )
          : Container(
              width: 40,
              height: 40,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: u.accentSoft,
                borderRadius: BorderRadius.circular(13),
              ),
              child: Icon(
                c.isPrivate ? Icons.lock_outline_rounded : Icons.tag_rounded,
                color: u.accent,
                size: 19,
              ),
            );
      return UdItem(
        leading: leading,
        title: Text(
          name,
          style: isUnread ? const TextStyle(fontWeight: FontWeight.w800) : null,
        ),
        subtitle: sub,
        trailing: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(_when(c.lastMessageAt), style: u.sub),
            if (isUnread) ...[
              const SizedBox(height: 4),
              Container(
                width: 9,
                height: 9,
                decoration: BoxDecoration(
                  color: u.accent,
                  shape: BoxShape.circle,
                ),
              ),
            ],
          ],
        ),
        onTap: () => _open(c),
        last: last,
      );
    }

    Widget card(List<Channel> list) => UdCard(
      padding: const EdgeInsets.fromLTRB(14, 4, 14, 4),
      child: Column(
        children: [
          for (final (i, c) in list.indexed) row(c, last: i == list.length - 1),
        ],
      ),
    );

    final body = <Widget>[];
    if (channelsAsync.isLoading && all.isEmpty) {
      body.add(
        const Padding(
          padding: EdgeInsets.only(top: 80),
          child: Center(child: CircularProgressIndicator.adaptive()),
        ),
      );
    } else if (_seg == 0) {
      if (channels.isNotEmpty) body.add(card(channels));
      if (dms.isNotEmpty) body.addAll([const UdSection('Direct'), card(dms)]);
    } else {
      final list = switch (_seg) {
        1 => channels,
        2 => dms,
        _ => all.where((c) => unread.contains(c.id)).toList(),
      };
      body.add(
        list.isEmpty
            ? Padding(
                padding: const EdgeInsets.only(top: 60),
                child: Center(
                  child: Text(
                    _seg == 3 ? 'You are all caught up.' : 'Nothing here yet.',
                    style: u.sub,
                  ),
                ),
              )
            : card(list),
      );
    }

    final labels = [
      'All',
      'Channels',
      'Direct',
      unread.isEmpty ? 'Unread' : 'Unread ${unread.length}',
    ];
    return UdPage(
      title: 'Chats',
      actions: [
        UdIconButton(
          icon: Icons.search_rounded,
          tooltip: 'Search',
          onTap: () => Navigator.of(
            context,
          ).push(MaterialPageRoute<void>(builder: (_) => const SearchPage())),
        ),
        UdIconButton(
          icon: Icons.edit_outlined,
          tooltip: 'New chat or channel',
          onTap: () => Navigator.of(context)
              .push(MaterialPageRoute<void>(builder: (_) => widget.classic)),
        ),
      ],
      body: ListView(
        padding: const EdgeInsets.fromLTRB(14, 0, 14, 24),
        children: [
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                for (final (i, l) in labels.indexed) ...[
                  if (i > 0) const SizedBox(width: 6),
                  _Seg(
                    label: l,
                    on: _seg == i,
                    onTap: () => setState(() => _seg = i),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 10),
          ...body,
        ],
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
