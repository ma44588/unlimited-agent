// Unlimited Agent: More > AI provider. The Claude accounts the server
// employees run on, how much is left, which account is active, switching when
// one runs out, and the model per employee. Same /admin/ai* API as the desktop.
// A token is pasted once and goes to the server only; it never comes back.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import 'ud.dart';
import 'unlimited_api.dart';
import 'unlimited_screens.dart';

String _s(Object? v) => v?.toString() ?? '';
int _i(Object? v) => v is num ? v.toInt() : int.tryParse(_s(v)) ?? 0;
double? _dn(Object? v) => v is num ? v.toDouble() : null;
Map<String, dynamic> _m(Object? v) =>
    v is Map ? v.cast<String, dynamic>() : const <String, dynamic>{};
List<Map<String, dynamic>> _ms(Object? v) =>
    v is List ? [for (final x in v) _m(x)] : const [];

class AiAccount {
  AiAccount(this.j);
  final Map<String, dynamic> j;
  String get id => _s(j['id']);
  int get order => _i(j['order']);
  String get label => _s(j['label']);
  String get plan => _s(j['plan']);
  String get state => _s(j['state']);
  double? get util5 => _dn(j['util5']);
  double? get util7 => _dn(j['util7']);
  int get reset5 => _i(j['reset5']);
  int get reset7 => _i(j['reset7']);
  int get restingUntil => _i(j['resting_until']);
  int get checkedAt => _i(j['checked_at']);
  String get error => _s(j['error']);
}

class AiEmployee {
  AiEmployee(this.j);
  final Map<String, dynamic> j;
  String get slug => _s(j['slug']);
  String get name => _s(j['name']);
  String get title => _s(j['title']);
  String get model => _s(j['model']).isEmpty ? 'sonnet' : _s(j['model']);
  String get account => _s(j['account']);
  bool get pinned => j['pinned'] == true;
}

class AiView {
  AiView(this.j);
  final Map<String, dynamic> j;
  List<AiAccount> get accounts =>
      [for (final a in _ms(j['accounts'])) AiAccount(a)]
        ..sort((a, b) => a.order.compareTo(b.order));
  List<AiEmployee> get employees =>
      [for (final e in _ms(j['employees'])) AiEmployee(e)];
  String get active => _s(j['active']);
  Map<String, dynamic> get settings => _m(j['settings']);
  bool get assign => settings['mode'] == 'assign';
  bool get returnFirst => settings['return_first'] != false;
  bool get alert => settings['alert'] != false;
  List<Map<String, dynamic>> get events => _ms(j['events']);
  List<(String, String)> get models {
    final l = [for (final m in _ms(j['models'])) (_s(m['id']), _s(m['name']))];
    return l.isEmpty ? const [('opus', 'Opus'), ('sonnet', 'Sonnet'), ('haiku', 'Haiku')] : l;
  }
  String get codexWhy => _s(_m(j['codex'])['why']);
}

extension UnlimitedAiApi on UnlimitedApi {
  Future<AiView> aiView() async => AiView(_m(await get('/admin/ai')));
  Future<AiView> aiCheck() async =>
      AiView(_m(await post('/admin/ai/check', <String, Object?>{})));
  Future<AiView> aiAdd(String label, String plan, String token) async =>
      AiView(_m(await post('/admin/ai/accounts',
          {'label': label, 'plan': plan, 'token': token})));
  Future<AiView> aiAccount(String id, Map<String, Object?> body) async =>
      AiView(_m(await post('/admin/ai/accounts/${Uri.encodeComponent(id)}', body)));
  Future<AiView> aiSettings(Map<String, Object?> body) async =>
      AiView(_m(await post('/admin/ai/settings', body)));
  Future<AiView> aiEmployee(String slug, Map<String, Object?> body) async =>
      AiView(_m(await post('/admin/ai/employees/${Uri.encodeComponent(slug)}', body)));
}

String _modelName(String id, List<(String, String)> models) {
  for (final m in models) {
    if (m.$1 == id) return m.$2.replaceFirst(' · latest', '');
  }
  return id;
}

String _pct(double? v) => v == null ? '—' : '${(v * 100).round()}%';
String _until(int ts) {
  if (ts <= 0) return '—';
  final s = ts - DateTime.now().millisecondsSinceEpoch ~/ 1000;
  if (s <= 0) return 'now';
  if (s < 3600) return '${(s / 60).ceil()} min';
  if (s < 86400) return '${s ~/ 3600} h ${(s % 3600) ~/ 60} m';
  return '${(s / 86400).round()} days';
}

String _clock(BuildContext context, int ts) => ts <= 0
    ? ''
    : TimeOfDay.fromDateTime(DateTime.fromMillisecondsSinceEpoch(ts * 1000))
        .format(context);

String _ago(int ts) {
  if (ts <= 0) return '';
  final s = DateTime.now().millisecondsSinceEpoch ~/ 1000 - ts;
  if (s < 60) return 'just now';
  if (s < 3600) return '${s ~/ 60} min ago';
  if (s < 86400) return '${s ~/ 3600} h ago';
  return '${s ~/ 86400} d ago';
}

const _red = Color(0xFFDC2626);
Color _barColor(double? v) => v == null
    ? Colors.transparent
    : v >= .9
        ? _red
        : v >= .7
            ? const Color(0xFFF59E0B)
            : const Color(0xFF22C55E);

class _Bar extends StatelessWidget {
  const _Bar(this.v);
  final double? v;
  @override
  Widget build(BuildContext context) {
    final u = Ud.of(context);
    return ClipRRect(
      borderRadius: BorderRadius.circular(99),
      child: LinearProgressIndicator(
        value: (v ?? 0).clamp(0, 1).toDouble(),
        minHeight: 6,
        backgroundColor: u.chip,
        valueColor: AlwaysStoppedAnimation(_barColor(v)),
      ),
    );
  }
}

(String, UdTone) _state(BuildContext context, AiAccount a) => switch (a.state) {
      'active' => ('Active now', UdTone.ok),
      'standby' => ('Standby', UdTone.accent),
      'resting' => (
          a.restingUntil > 0 ? 'Back ${_clock(context, a.restingUntil)}' : 'Resting',
          UdTone.warn
        ),
      'invalid' => ('Signed out', UdTone.warn),
      _ => ("Can't check", UdTone.neutral),
    };

class UAiProviderScreen extends ConsumerStatefulWidget {
  const UAiProviderScreen({super.key, this.initial});
  final AiView? initial;
  @override
  ConsumerState<UAiProviderScreen> createState() => _UAiProviderScreenState();
}

class _UAiProviderScreenState extends ConsumerState<UAiProviderScreen> {
  AiView? _v;
  String _err = '';
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _v = widget.initial;
    if (_v == null) unawaited(_run(() => uApi(ref).aiView()));
  }

  Future<void> _run(Future<AiView> Function() fn, {String? done}) async {
    setState(() => _busy = true);
    try {
      final v = await fn();
      if (!mounted) return;
      setState(() {
        _v = v;
        _err = '';
      });
      if (done != null) {
        unawaited(HapticFeedback.lightImpact());
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(done)));
      }
    } catch (e) {
      if (mounted) setState(() => _err = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _section(String t) {
    final u = Ud.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 16, 4, 8),
      child: Text(t, style: u.title.copyWith(fontSize: 14)),
    );
  }

  Widget _stat(String label, String value, {double? v, bool bar = false}) {
    final u = Ud.of(context);
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          border: Border.all(color: u.line),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: u.sub.copyWith(fontSize: 11)),
            const SizedBox(height: 2),
            Text(value,
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: u.fg)),
            if (bar) ...[const SizedBox(height: 6), _Bar(v)],
          ],
        ),
      ),
    );
  }

  Widget _logo(IconData icon, Color bg, Color fg) => Container(
        width: 38,
        height: 38,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(11)),
        child: Icon(icon, size: 21, color: fg),
      );

  Widget _claudeLogo() =>
      _logo(Icons.flare_rounded, const Color(0xFFF6E9E2), const Color(0xFFC2410C));

  Future<T?> _sheet<T>(String title, List<Widget> Function(BuildContext) items) {
    final u = Ud.of(context);
    return showModalBottomSheet<T>(
      context: context,
      backgroundColor: u.card,
      builder: (c) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [ListTile(title: Text(title, style: u.title)), ...items(c)],
        ),
      ),
    );
  }

  Future<void> _accountMenu(AiAccount a, int i, int n) async {
    final pick = await _sheet<String>(
      a.label,
      (c) => [
        if (a.state != 'active' && a.state != 'invalid')
          ListTile(
              leading: const Icon(Icons.check_rounded),
              title: const Text('Use this one now'),
              onTap: () => Navigator.pop(c, 'activate')),
        if (i > 0)
          ListTile(
              leading: const Icon(Icons.arrow_upward_rounded),
              title: const Text('Move up'),
              onTap: () => Navigator.pop(c, 'up')),
        if (i < n - 1)
          ListTile(
              leading: const Icon(Icons.arrow_downward_rounded),
              title: const Text('Move down'),
              onTap: () => Navigator.pop(c, 'down')),
        ListTile(
            leading: const Icon(Icons.edit_outlined),
            title: const Text('Rename'),
            onTap: () => Navigator.pop(c, 'rename')),
        ListTile(
            leading: const Icon(Icons.key_rounded),
            title: const Text('Reconnect'),
            onTap: () => Navigator.pop(c, 'token')),
        if (a.state != 'active')
          ListTile(
            leading: const Icon(Icons.delete_outline_rounded, color: _red),
            title: const Text('Remove', style: TextStyle(color: _red)),
            onTap: () => Navigator.pop(c, 'remove'),
          ),
      ],
    );
    if (pick == null || !mounted) return;
    if (pick == 'token') return _tokenSheet(account: a);
    if (pick == 'rename') return _rename(a);
    await _run(() => uApi(ref).aiAccount(a.id, {'action': pick}),
        done: pick == 'remove' ? 'Removed' : 'Saved');
  }

  Future<void> _rename(AiAccount a) async {
    final c = TextEditingController(text: a.label);
    final name = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Rename account'),
        content: TextField(controller: c, autofocus: true, decoration: const InputDecoration(labelText: 'Name')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(ctx, c.text.trim()), child: const Text('Save')),
        ],
      ),
    );
    c.dispose();
    if (name == null || name.isEmpty || name == a.label || !mounted) return;
    await _run(() => uApi(ref).aiAccount(a.id, {'label': name}), done: 'Renamed');
  }

  Future<void> _tokenSheet({AiAccount? account}) async {
    final label = TextEditingController(text: account?.label ?? '');
    final token = TextEditingController();
    var plan = account?.plan.isNotEmpty == true ? account!.plan : 'Max';
    final u = Ud.of(context);
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: u.card,
      builder: (c) => StatefulBuilder(
        builder: (c, set) => Padding(
          padding: EdgeInsets.fromLTRB(
              18, 18, 18, 18 + MediaQuery.of(c).viewInsets.bottom),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(account == null ? 'Add a Claude account' : 'Reconnect ${account.label}',
                  style: u.title),
              const SizedBox(height: 8),
              Text(
                '1. On a computer signed in to that Claude account, open Terminal.\n'
                '2. Run  claude setup-token  and approve in the browser.\n'
                '3. Paste the token below. It goes to the server only and is never shown again.',
                style: u.sub,
              ),
              const SizedBox(height: 12),
              if (account == null) ...[
                TextField(
                    controller: label,
                    decoration:
                        const InputDecoration(labelText: 'Name, e.g. ops@unlimited')),
                const SizedBox(height: 10),
                SegmentedButton<String>(
                  segments: const [
                    ButtonSegment(value: 'Max', label: Text('Max')),
                    ButtonSegment(value: 'Pro', label: Text('Pro')),
                    ButtonSegment(value: 'Team', label: Text('Team')),
                  ],
                  selected: {plan},
                  onSelectionChanged: (s) => set(() => plan = s.first),
                ),
                const SizedBox(height: 8),
              ],
              TextField(
                controller: token,
                obscureText: true,
                autocorrect: false,
                enableSuggestions: false,
                decoration: const InputDecoration(labelText: 'Token (sk-ant-oat…)'),
              ),
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                child: UdButton(
                    label: account == null ? 'Check and add' : 'Check and save',
                    onTap: () => Navigator.pop(c, true)),
              ),
            ],
          ),
        ),
      ),
    );
    final t = token.text.trim();
    final l = label.text.trim();
    token.dispose();
    label.dispose();
    if (ok != true || t.isEmpty || !mounted) return;
    await _run(
      () => account == null
          ? uApi(ref).aiAdd(l.isEmpty ? 'Claude account' : l, plan, t)
          : uApi(ref).aiAccount(account.id, {'action': 'token', 'token': t}),
      done: account == null ? 'Account added' : 'Reconnected',
    );
  }

  Future<void> _pickModel(AiEmployee e, List<(String, String)> models) async {
    final u = Ud.of(context);
    final m = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: u.card,
      isScrollControlled: true,
      builder: (c) => SafeArea(
        child: ConstrainedBox(
          constraints: BoxConstraints(maxHeight: MediaQuery.of(c).size.height * .75),
          child: ListView(
            shrinkWrap: true,
            children: [
              ListTile(title: Text('${e.name} · model', style: u.title)),
              for (final o in models)
                ListTile(
                  dense: true,
                  title: Text(o.$2),
                  subtitle: o.$1.startsWith('claude-') ? null : const Text('Always the newest'),
                  trailing: e.model == o.$1 ? Icon(Icons.check_rounded, color: u.accent) : null,
                  onTap: () => Navigator.pop(c, o.$1),
                ),
            ],
          ),
        ),
      ),
    );
    if (m == null || m == e.model || !mounted) return;
    await _run(() => uApi(ref).aiEmployee(e.slug, {'model': m}), done: '${e.name}: ${_modelName(m, models)}');
  }

  Future<void> _pickAccount(AiEmployee e, List<AiAccount> accounts, bool assign) async {
    final u = Ud.of(context);
    final id = await _sheet<String>(
      '${e.name} · account',
      (c) => [
        if (!assign)
          ListTile(
            title: const Text('Auto'),
            subtitle: const Text('Follows the active account'),
            trailing: !e.pinned ? Icon(Icons.check_rounded, color: u.accent) : null,
            onTap: () => Navigator.pop(c, ''),
          ),
        for (final a in accounts)
          ListTile(
            title: Text(a.label),
            subtitle: Text('${a.plan} · ${_pct(a.util5)} of 5 hours'),
            trailing: (assign || e.pinned) && e.account == a.id ? Icon(Icons.check_rounded, color: u.accent) : null,
            onTap: () => Navigator.pop(c, a.id),
          ),
      ],
    );
    if (id == null || !mounted) return;
    if (id == (assign || e.pinned ? e.account : '')) return;
    await _run(() => uApi(ref).aiEmployee(e.slug, {'account': id}), done: 'Saved');
  }

  Future<void> _pickMode(AiView v) async {
    final u = Ud.of(context);
    final cur = v.assign ? 'assign' : v.returnFirst ? 'first' : 'stay';
    final m = await _sheet<String>(
      'When an account runs out',
      (c) => [
        for (final o in const [
          ('first', 'Switch, then go back to #1', 'Back to the first account when it resets'),
          ('stay', 'Switch and stay', 'Keep using the next account'),
          ('assign', 'I pick per employee', 'No switching; each employee keeps its account'),
        ])
          ListTile(
            title: Text(o.$2),
            subtitle: Text(o.$3),
            trailing: cur == o.$1 ? Icon(Icons.check_rounded, color: u.accent) : null,
            onTap: () => Navigator.pop(c, o.$1),
          ),
      ],
    );
    if (m == null || m == cur || !mounted) return;
    await _run(
      () => uApi(ref).aiSettings(m == 'assign'
          ? {'mode': 'assign'}
          : {'mode': 'switch', 'return_first': m == 'first'}),
      done: 'Saved',
    );
  }

  Future<void> _employeeTap(AiView v, AiEmployee e) async {
    final what = await _sheet<String>(
      e.name,
      (c) => [
        ListTile(title: const Text('Change model'), onTap: () => Navigator.pop(c, 'model')),
        ListTile(title: const Text('Change account'), onTap: () => Navigator.pop(c, 'account')),
      ],
    );
    if (what == 'model') await _pickModel(e, v.models);
    if (what == 'account') await _pickAccount(e, v.accounts, v.assign);
  }

  @override
  Widget build(BuildContext context) {
    final u = Ud.of(context);
    final v = _v;
    return UdPage(
      back: true,
      title: 'AI provider',
      actions: [
        UdIconButton(
          icon: Icons.refresh_rounded,
          tooltip: 'Check now',
          onTap: _busy ? null : () => _run(() => uApi(ref).aiCheck(), done: 'Checked'),
        ),
      ],
      body: v == null
          ? Center(
              child: _err.isEmpty
                  ? const CircularProgressIndicator()
                  : Padding(
                      padding: const EdgeInsets.all(24), child: Text(_err, style: u.sub)))
          : RefreshIndicator(
              onRefresh: () => _run(() => uApi(ref).aiView()),
              child: _body(v),
            ),
    );
  }

  Widget _body(AiView v) {
    final u = Ud.of(context);
    final accounts = v.accounts;
    final active =
        accounts.where((a) => a.id == v.active).firstOrNull ?? accounts.firstOrNull;
    final allResting = accounts.isNotEmpty &&
        accounts.every((a) => a.state != 'active' && a.state != 'standby');
    final modeLabel = v.assign
        ? 'I pick per employee'
        : v.returnFirst
            ? 'Switch, then go back to #1'
            : 'Switch and stay';
    String accountName(String id) =>
        accounts.where((a) => a.id == id).firstOrNull?.label ?? '—';
    return ListView(
      physics: udScroll,
      padding: const EdgeInsets.fromLTRB(14, 0, 14, 28),
      children: [
        if (_err.isNotEmpty)
          Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(_err, style: const TextStyle(color: _red, fontSize: 12.5))),
        UdCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  _claudeLogo(),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Claude · ${active?.plan ?? '—'}', style: u.title),
                        Text(
                          active == null
                              ? 'No account yet'
                              : '${active.label}${active.checkedAt > 0 ? ' · ${_ago(active.checkedAt)}' : ''}',
                          style: u.sub,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  UdPill(
                    allResting
                        ? 'Limit reached'
                        : active?.state == 'invalid'
                            ? 'Signed out'
                            : 'Working',
                    tone: allResting || active?.state == 'invalid' ? UdTone.warn : UdTone.ok,
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(children: [
                _stat('5-hour window', _pct(active?.util5), v: active?.util5, bar: true),
                const SizedBox(width: 8),
                _stat('This week', _pct(active?.util7), v: active?.util7, bar: true),
              ]),
              const SizedBox(height: 8),
              Row(children: [
                _stat('5-hour resets in', _until(active?.reset5 ?? 0)),
                const SizedBox(width: 8),
                _stat('Week resets in', _until(active?.reset7 ?? 0)),
              ]),
              if (allResting) ...[
                const SizedBox(height: 10),
                const Text(
                    'Every account is at its limit. Employees wait and continue by themselves.',
                    style: TextStyle(fontSize: 12.5, color: Ud.warn)),
              ],
            ],
          ),
        ),
        _section('Accounts · used in this order'),
        UdCard(
          padding: const EdgeInsets.fromLTRB(14, 4, 14, 4),
          child: Column(
            children: [
              for (var i = 0; i < accounts.length; i++)
                InkWell(
                  onTap: _busy ? null : () => _accountMenu(accounts[i], i, accounts.length),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    child: Row(
                      children: [
                        SizedBox(width: 20, child: Text('${i + 1}', style: u.sub)),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(children: [
                                Expanded(
                                    child: Text(accounts[i].label,
                                        style: TextStyle(
                                            fontWeight: FontWeight.w600, color: u.fg),
                                        overflow: TextOverflow.ellipsis)),
                                UdPill(_state(context, accounts[i]).$1,
                                    tone: _state(context, accounts[i]).$2),
                              ]),
                              const SizedBox(height: 6),
                              Row(children: [
                                Expanded(child: _Bar(accounts[i].util5)),
                                const SizedBox(width: 8),
                                Text(
                                    '${_pct(accounts[i].util5)} · week ${_pct(accounts[i].util7)} · ${accounts[i].plan}',
                                    style: u.sub.copyWith(fontSize: 11.5)),
                              ]),
                              if (accounts[i].error.isNotEmpty)
                                Text(accounts[i].error,
                                    style: const TextStyle(fontSize: 11.5, color: _red)),
                            ],
                          ),
                        ),
                        const SizedBox(width: 6),
                        Icon(Icons.more_horiz_rounded, color: u.muted),
                      ],
                    ),
                  ),
                ),
              UdItem(
                leading: Icon(Icons.add_rounded, color: u.accent),
                title: Text('Add account',
                    style: TextStyle(color: u.accent, fontWeight: FontWeight.w600)),
                onTap: _busy ? null : () => _tokenSheet(),
                last: true,
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        UdCard(
          padding: const EdgeInsets.fromLTRB(14, 4, 14, 4),
          child: Column(
            children: [
              UdItem(
                leading: Icon(Icons.swap_horiz_rounded, color: u.accent),
                title: const Text('When an account runs out'),
                subtitle: modeLabel,
                trailing: Icon(Icons.chevron_right_rounded, color: u.muted),
                onTap: _busy ? null : () => _pickMode(v),
              ),
              UdItem(
                leading: Icon(Icons.notifications_none_rounded, color: u.accent),
                title: const Text('Alert at 80% and on switch'),
                trailing: Switch.adaptive(
                  value: v.alert,
                  onChanged: _busy
                      ? null
                      : (on) => _run(() => uApi(ref).aiSettings({'alert': on})),
                ),
                last: true,
              ),
            ],
          ),
        ),
        _section('Employees'),
        UdCard(
          padding: const EdgeInsets.fromLTRB(14, 4, 14, 4),
          child: Column(
            children: [
              for (var i = 0; i < v.employees.length; i++)
                UdItem(
                  leading: UdAvatar(name: v.employees[i].name, size: 30),
                  title: Text(v.employees[i].name),
                  subtitle:
                      '${v.employees[i].title} · ${v.assign || v.employees[i].pinned ? accountName(v.employees[i].account) : 'Auto'}',
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      UdPill(_modelName(v.employees[i].model, v.models).replaceFirst('Claude ', ''),
                          tone: UdTone.accent),
                      Icon(Icons.chevron_right_rounded, color: u.muted),
                    ],
                  ),
                  onTap: _busy ? null : () => _employeeTap(v, v.employees[i]),
                  last: i == v.employees.length - 1,
                ),
            ],
          ),
        ),
        _section('Providers'),
        UdCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                _claudeLogo(),
                const SizedBox(width: 10),
                Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Claude', style: u.title),
                  Text('Anthropic · runs every employee today', style: u.sub),
                ])),
                UdPill('${accounts.length} account${accounts.length == 1 ? '' : 's'}',
                    tone: UdTone.ok),
              ]),
              const SizedBox(height: 8),
              Text(
                'Checked every 5 minutes. Switching restarts the employees (about a minute). '
                "Using several subscriptions to go past one account's limit may conflict with Anthropic's terms.",
                style: u.sub.copyWith(fontSize: 11.5),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        UdCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                _logo(Icons.blur_circular_rounded, const Color(0xFFE8F3EE), const Color(0xFF0F766E)),
                const SizedBox(width: 10),
                Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Codex', style: u.title),
                  Text('OpenAI · ChatGPT plan or API key', style: u.sub),
                ])),
                const UdPill('Not available yet'),
              ]),
              const SizedBox(height: 10),
              Text(v.codexWhy, style: u.sub),
            ],
          ),
        ),
        if (v.events.isNotEmpty) ...[
          _section('Recent'),
          for (final e in v.events.take(5))
            Padding(
              padding: const EdgeInsets.fromLTRB(4, 0, 4, 6),
              child: Text('${_ago(_i(e['at']))} · ${_s(e['text'])}', style: u.sub),
            ),
        ],
      ],
    );
  }
}
