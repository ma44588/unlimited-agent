// Unlimited Agent: all project tasks on one phone screen (same hub as the
// desktop Tasks page). Needs you first; open a task to read the plan or the
// result, approve it, ask for changes, or close it Done. Replies are signed
// with this phone's key and land on the task itself, like on the desktop.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:gpt_markdown/gpt_markdown.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../shared/relay/relay_provider.dart';
import '../../shared/relay/relay_session.dart';
import '../../shared/relay/signed_event_relay.dart';
import 'ud.dart';
import 'unlimited_org_api.dart';
import 'unlimited_screens.dart';

final _rtl = RegExp(r'[؀-ۿ]');
TextDirection _dir(String s) =>
    _rtl.hasMatch(s) ? TextDirection.rtl : TextDirection.ltr;

String _agoSec(int at) {
  if (at <= 0) return '';
  final d = DateTime.now().difference(
    DateTime.fromMillisecondsSinceEpoch(at * 1000),
  );
  if (d.inMinutes < 1) return 'now';
  if (d.inMinutes < 60) return '${d.inMinutes} min';
  if (d.inHours < 24) return '${d.inHours} h';
  return '${d.inDays} d';
}

/// What the stage means for the owner, in a few words, and its tone.
(String, UdTone) stageLabel(String stage) => switch (stage) {
  'awaiting_approval' => ('Plan to approve', UdTone.warn),
  'in_review' => ('Ready to try', UdTone.warn),
  'planning' => ('Planning', UdTone.accent),
  'executing' => ('Building', UdTone.accent),
  'documenting' => ('Writing the summary', UdTone.accent),
  'documented' || 'done' => ('Done', UdTone.ok),
  'cancelled' => ('Cancelled', UdTone.neutral),
  _ => ('Not started', UdTone.neutral),
};

const _steps = [
  'planning',
  'awaiting_approval',
  'executing',
  'in_review',
  'documenting',
];

int _stepOf(String stage) => switch (stage) {
  'documented' || 'done' => _steps.length,
  'new' || 'cancelled' => -1,
  _ => _steps.indexOf(stage),
};

class UTasksScreen extends StatelessWidget {
  const UTasksScreen({super.key, this.back = true});
  final bool back;

  @override
  Widget build(BuildContext context) => UdPage(
    title: 'Tasks',
    back: back,
    body: ULoad<List<TaskItem>>(
      load: (api) => api.tasks(),
      builder: (context, tasks, reload) {
        final u = Ud.of(context);
        if (tasks.isEmpty) {
          return const UdMessage(
            icon: Icons.checklist_rounded,
            title: 'No tasks yet',
            text:
                'Create a task in a project on your computer. Youssef plans it, you approve, he builds it on staging.',
          );
        }
        final need = tasks.where((t) => t.needsYou).toList();
        final work = tasks
            .where((t) => !t.needsYou && !t.finished && !t.notStarted)
            .toList();
        final fresh = tasks.where((t) => t.notStarted).toList();
        final done = tasks.where((t) => t.finished).toList();
        Future<void> open(TaskItem t) async {
          await Navigator.of(context).push(
            MaterialPageRoute<void>(builder: (_) => UTaskScreen(task: t)),
          );
          await reload();
        }

        Widget group(String label, List<TaskItem> items, {bool hot = false}) =>
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(4, 14, 4, 8),
                  child: Row(
                    children: [
                      if (hot) ...[
                        const UdDot(color: Ud.warn),
                        const SizedBox(width: 6),
                      ],
                      Expanded(child: Text(label, style: u.sub)),
                      Text('${items.length}', style: u.sub),
                    ],
                  ),
                ),
                for (final t in items)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: _TaskCard(t, onTap: () => open(t)),
                  ),
              ],
            );

        return RefreshIndicator.adaptive(
          onRefresh: reload,
          child: ListView(
            physics: udScroll,
            padding: const EdgeInsets.fromLTRB(14, 0, 14, 24),
            children: [
              _Stats(need: need.length, work: work.length, done: done.length),
              if (need.isNotEmpty) group('Needs you', need, hot: true),
              if (work.isNotEmpty) group('In progress', work),
              if (fresh.isNotEmpty) group('Not started', fresh),
              if (done.isNotEmpty) group('Done this week', done),
            ],
          ),
        );
      },
    ),
  );
}

class _Stats extends StatelessWidget {
  const _Stats({required this.need, required this.work, required this.done});
  final int need;
  final int work;
  final int done;

  @override
  Widget build(BuildContext context) {
    final u = Ud.of(context);
    Widget cell(String n, String label, Color c) => Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            n,
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w700,
              color: c,
            ),
          ),
          Text(label, style: u.sub),
        ],
      ),
    );
    return UdCard(
      child: Row(
        children: [
          cell('$need', 'Need you', need > 0 ? Ud.warn : u.fg),
          cell('$work', 'In progress', u.accent),
          cell('$done', 'Done', Ud.ok),
        ],
      ),
    );
  }
}

class _TaskCard extends StatelessWidget {
  const _TaskCard(this.t, {required this.onTap});
  final TaskItem t;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final u = Ud.of(context);
    final (label, tone) = stageLabel(t.stage);
    final step = _stepOf(t.stage);
    final color = udColorFor(t.project);
    return UdCard(
      onTap: onTap,
      highlight: t.needsYou,
      padding: EdgeInsets.zero,
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(width: 4, color: t.needsYou ? Ud.warn : color),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 11, 12, 11),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        UdDot(color: color),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            t.project,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: u.sub.copyWith(fontSize: 11.5),
                          ),
                        ),
                        Text(
                          _agoSec(t.since),
                          style: u.sub.copyWith(fontSize: 11.5),
                        ),
                      ],
                    ),
                    const SizedBox(height: 5),
                    Text(
                      t.title,
                      textDirection: _dir(t.title),
                      textAlign: TextAlign.start,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: u.title,
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        UdPill(label, tone: tone),
                        const SizedBox(width: 8),
                        if (t.workerName.isNotEmpty && !t.finished)
                          Expanded(
                            child: Text(
                              t.workerName,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: u.sub.copyWith(fontSize: 11.5),
                            ),
                          )
                        else
                          const Spacer(),
                        if (step >= 0)
                          for (var i = 0; i < _steps.length; i++)
                            Container(
                              width: 6,
                              height: 6,
                              margin: const EdgeInsets.only(left: 3),
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: i < step
                                    ? Ud.ok
                                    : i == step
                                    ? u.accent
                                    : u.line,
                              ),
                            ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class UTaskScreen extends ConsumerStatefulWidget {
  const UTaskScreen({super.key, required this.task});
  final TaskItem task;

  @override
  ConsumerState<UTaskScreen> createState() => _UTaskScreenState();
}

class _UTaskScreenState extends ConsumerState<UTaskScreen> {
  bool _busy = false;
  String? _sent;

  TaskItem get t => widget.task;

  SignedEventRelay get _relay => SignedEventRelay(
    session: ref.read(relaySessionProvider.notifier),
    nsec: ref.read(relayConfigProvider).nsec,
  );

  List<List<String>> get _tags => [
    ['e', t.id, '', 'root'],
    ['a', t.repoAddress],
    if (t.developer.isNotEmpty) ['p', t.developer],
  ];

  Future<void> _run(String done, Future<Object?> Function() f) async {
    setState(() => _busy = true);
    try {
      await f();
      unawaited(HapticFeedback.mediumImpact());
      if (mounted) setState(() => _sent = done);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text("Couldn't send: $e")));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _comment(String text, String done) =>
      _run(done, () => _relay.submit(kind: 1, content: text, tags: _tags));

  Future<void> _markDone() => _run(
    'Closed as Done. Rami writes the summary for the team.',
    () => _relay.submit(
      kind: 1631,
      content: '',
      tags: [
        ['e', t.id, '', 'root'],
        ['a', t.repoAddress],
      ],
    ),
  );

  Future<void> _askChanges() async {
    final text = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _ChangesSheet(),
    );
    if (text == null || text.trim().isEmpty) return;
    await _comment(
      text.trim(),
      t.stage == 'awaiting_approval'
          ? 'Sent. Youssef writes a new version of the plan.'
          : 'Sent back to Youssef with your notes.',
    );
  }

  @override
  Widget build(BuildContext context) {
    final u = Ud.of(context);
    final (label, tone) = stageLabel(t.stage);
    final approving = t.stage == 'awaiting_approval';
    final reviewing = t.stage == 'in_review';
    Widget block(String title, String text) => Padding(
      padding: const EdgeInsets.only(top: 12),
      child: UdCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(title, style: u.sub),
            const SizedBox(height: 6),
            Directionality(
              textDirection: _dir(text),
              child: GptMarkdown(
                text,
                style: TextStyle(fontSize: 14, height: 1.45, color: u.fg),
              ),
            ),
          ],
        ),
      ),
    );
    return UdPage(
      title: t.project,
      back: true,
      bottom: _sent != null || !(approving || reviewing)
          ? null
          : UdComposer(
              children: [
                Expanded(
                  child: UdButton(
                    label: approving ? 'Request changes' : 'Send notes',
                    ghost: true,
                    onTap: _busy ? null : _askChanges,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: UdButton(
                    label: approving ? 'Approve plan' : 'Mark done',
                    onTap: _busy
                        ? null
                        : approving
                        ? () => _comment(
                            'موافق',
                            'Approved. Youssef starts building on staging.',
                          )
                        : _markDone,
                  ),
                ),
              ],
            ),
      body: ListView(
        physics: udScroll,
        padding: const EdgeInsets.fromLTRB(14, 0, 14, 24),
        children: [
          Text(
            t.title,
            textDirection: _dir(t.title),
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: u.fg,
              height: 1.3,
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              UdPill(label, tone: tone),
              if (t.round > 1) ...[
                const SizedBox(width: 6),
                UdPill('Version ${t.round}'),
              ],
              const Spacer(),
              if (t.workerName.isNotEmpty) Text(t.workerName, style: u.sub),
            ],
          ),
          if (_sent != null)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: UdCard(
                highlight: true,
                child: Row(
                  children: [
                    const Icon(
                      Icons.check_circle_rounded,
                      color: Ud.ok,
                      size: 20,
                    ),
                    const SizedBox(width: 8),
                    Expanded(child: Text(_sent!, style: u.title)),
                  ],
                ),
              ),
            ),
          if (reviewing && t.result.isNotEmpty) block('Result', t.result),
          if (t.plan.isNotEmpty)
            block(approving ? 'Plan' : 'Approved plan', t.plan),
          if (!reviewing && t.result.isNotEmpty) block('Result', t.result),
          if (t.body.trim().isNotEmpty) block('Description', t.body),
        ],
      ),
    );
  }
}

class _ChangesSheet extends StatefulWidget {
  const _ChangesSheet();

  @override
  State<_ChangesSheet> createState() => _ChangesSheetState();
}

class _ChangesSheetState extends State<_ChangesSheet> {
  final _c = TextEditingController();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final u = Ud.of(context);
    return Padding(
      padding: EdgeInsets.fromLTRB(
        16,
        16,
        16,
        16 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('What should change?', style: u.title),
          const SizedBox(height: 10),
          TextField(
            controller: _c,
            autofocus: true,
            minLines: 3,
            maxLines: 8,
            decoration: const InputDecoration(
              hintText: 'Write it the way you would tell Youssef',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          ValueListenableBuilder(
            valueListenable: _c,
            builder: (context, v, _) => UdButton(
              label: 'Send',
              onTap: v.text.trim().isEmpty
                  ? null
                  : () => Navigator.of(context).pop(_c.text),
            ),
          ),
        ],
      ),
    );
  }
}
