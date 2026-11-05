// Unlimited Agent: the phone's first screen when nobody is signed in.
// Page 1 shows what the app is (the AI team at work) with "Join with your
// invite" and a swipe-up arrow. The sheet that slides up signs in with the
// email the invite was sent to (6-digit code) or with the invite link, then
// shows who invited you and Join. The sign-in key is made on this phone, kept
// in the Keychain and never shown; only its public key reaches the server.
import 'dart:async';
import 'dart:convert';
import 'dart:io' show Platform;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:http/http.dart' as http;
import 'package:nostr/nostr.dart' as nostr;

import '../../onboarding_app_entry.dart';
import '../../shared/auth/auth.dart';
import '../../shared/relay/relay_session.dart' show buildNip98AuthHeader;

const _api = 'https://app.unlimitedsolutions.technology/unlimited-api';
const _pendingKey = 'unlimited-join';

class JoinInfo {
  JoinInfo(this.j);
  final Map<String, dynamic> j;
  String _s(String k) => (j[k] ?? '').toString();
  String get workspace => _s('workspace');
  String get relayUrl => _s('relay_url');
  String get invitedBy => _s('invited_by').isEmpty ? 'your manager' : _s('invited_by');
  String get role => _s('role');
  String get department => _s('department');
  String get name => _s('name');
  bool get confirm => j['confirm'] == true;
  String get status => _s('status');
  String get pair => _s('pair');
  String get code => _s('code');
}

class JoinFailed implements Exception {
  JoinFailed(this.message);
  final String message;
  @override
  String toString() => message;
}

/// Tests only: serve canned responses instead of the network.
http.Client? debugJoinClient;

Future<Map<String, dynamic>> _post(String path, Map<String, Object?> body, {String? nsec}) async {
  final url = '$_api$path';
  final bytes = utf8.encode(jsonEncode(body));
  final headers = {
    'Content-Type': 'application/json',
    if (nsec != null) 'Authorization': buildNip98AuthHeader(method: 'POST', url: url, bodyBytes: bytes, nsec: nsec),
  };
  http.Response res;
  try {
    res = await (debugJoinClient ?? http.Client()).post(Uri.parse(url), headers: headers, body: bytes);
  } catch (_) {
    throw JoinFailed("Can't reach Unlimited Agent. Check your internet connection.");
  }
  Map<String, dynamic> data;
  try {
    data = jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
  } catch (_) {
    data = const {};
  }
  if (res.statusCode >= 300 || data['ok'] != true) {
    throw JoinFailed((data['error'] ?? 'Something went wrong (${res.statusCode}).').toString());
  }
  final r = data['result'];
  return r is Map ? r.cast<String, dynamic>() : <String, dynamic>{};
}

class _C {
  _C(this.dark);
  final bool dark;
  Color get bg => dark ? const Color(0xFF0C0814) : const Color(0xFFF7F3FB);
  Color get sheet => dark ? const Color(0xFF1B1229) : Colors.white;
  Color get text => dark ? const Color(0xFFF4F0FA) : const Color(0xFF1A1024);
  Color get sub => dark ? const Color(0xFFB4A9C7) : const Color(0xFF5D5170);
  Color get faint => dark ? const Color(0xFF7D7290) : const Color(0xFF8B809B);
  Color get line => dark ? const Color(0x24FFFFFF) : const Color(0x2428103C);
  Color get field => dark ? const Color(0x0DFFFFFF) : Colors.white;
  Color get win => dark ? const Color(0xF01D1430) : Colors.white;
  Color get link => dark ? const Color(0xFFC58BE6) : const Color(0xFF7A4793);
  static const brand = LinearGradient(colors: [Color(0xFF7A4793), Color(0xFF9A3367)]);
  List<Color> get headline => dark
      ? const [Color(0xFFD9B8FF), Color(0xFFF08CC0), Color(0xFFFFC6E0)]
      : const [Color(0xFF7A4793), Color(0xFF9A3367), Color(0xFF9A3367)];
}

class _Mark extends StatelessWidget {
  const _Mark({this.size = 28});
  final double size;
  @override
  Widget build(BuildContext context) => Container(
    width: size,
    height: size,
    alignment: Alignment.center,
    decoration: BoxDecoration(gradient: _C.brand, borderRadius: BorderRadius.circular(size * .28)),
    child: Text('∞', style: TextStyle(color: Colors.white, fontSize: size * .62, fontWeight: FontWeight.w800, height: 1)),
  );
}

class _Btn extends StatelessWidget {
  const _Btn(this.label, {this.onTap, this.busy = false});
  final String label;
  final VoidCallback? onTap;
  final bool busy;
  @override
  Widget build(BuildContext context) => Opacity(
    opacity: onTap == null ? .6 : 1,
    child: Material(
      borderRadius: BorderRadius.circular(14),
      clipBehavior: Clip.antiAlias,
      child: Ink(
        height: 52,
        decoration: const BoxDecoration(gradient: _C.brand),
        child: InkWell(
          onTap: busy ? null : onTap,
          child: Center(
            child: busy
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : Text(label, style: const TextStyle(color: Colors.white, fontSize: 15.5, fontWeight: FontWeight.w600)),
          ),
        ),
      ),
    ),
  );
}

class UnlimitedJoinScreen extends ConsumerStatefulWidget {
  const UnlimitedJoinScreen({super.key});
  @override
  ConsumerState<UnlimitedJoinScreen> createState() => _UnlimitedJoinScreenState();
}

class _UnlimitedJoinScreenState extends ConsumerState<UnlimitedJoinScreen> {
  void _openSheet() {
    unawaited(HapticFeedback.selectionClick());
    final c = _C(Theme.of(context).brightness == Brightness.dark);
    unawaited(showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: c.sheet,
      barrierColor: Colors.black54,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      builder: (_) => const _JoinSheet(),
    ));
  }

  void _existing() => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const OnboardingAppEntry()));

  @override
  Widget build(BuildContext context) {
    final c = _C(Theme.of(context).brightness == Brightness.dark);
    return Scaffold(
      backgroundColor: c.bg,
      body: Stack(
        children: [
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: const Alignment(-.6, -.8),
                  radius: 1.2,
                  colors: [
                    c.dark ? const Color(0x737A4793) : const Color(0x33B06AD9),
                    c.dark ? const Color(0x339A3367) : const Color(0x14E06AA4),
                    c.bg,
                  ],
                  stops: const [0, .45, 1],
                ),
              ),
            ),
          ),
          SafeArea(
            child: GestureDetector(
              behavior: HitTestBehavior.translucent,
              onVerticalDragEnd: (d) {
                if ((d.primaryVelocity ?? 0) < -250) _openSheet();
              },
              child: ListView(
                padding: const EdgeInsets.fromLTRB(22, 14, 22, 24),
                children: [
                  Row(children: [
                    const _Mark(size: 26),
                    const SizedBox(width: 8),
                    Text('Unlimited Agent', style: TextStyle(color: c.text, fontWeight: FontWeight.w700, fontSize: 14)),
                  ]),
                  const SizedBox(height: 22),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Container(
                      padding: const EdgeInsets.fromLTRB(8, 4, 11, 4),
                      decoration: BoxDecoration(border: Border.all(color: c.line), borderRadius: BorderRadius.circular(99)),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        Container(width: 7, height: 7, decoration: const BoxDecoration(color: Color(0xFF3DDC97), shape: BoxShape.circle)),
                        const SizedBox(width: 6),
                        Text('AI employees online now', style: TextStyle(color: c.sub, fontSize: 11.5)),
                      ]),
                    ),
                  ),
                  const SizedBox(height: 14),
                  Text.rich(
                    TextSpan(children: [
                      const TextSpan(text: 'Your AI team that ships '),
                      WidgetSpan(
                        alignment: PlaceholderAlignment.baseline,
                        baseline: TextBaseline.alphabetic,
                        child: ShaderMask(
                          shaderCallback: (r) => LinearGradient(colors: c.headline).createShader(r),
                          child: const Text('Odoo work',
                              style: TextStyle(fontSize: 33, height: 1.06, fontWeight: FontWeight.w800, letterSpacing: -1.1, color: Colors.white)),
                        ),
                      ),
                      const TextSpan(text: '.'),
                    ]),
                    style: TextStyle(fontSize: 33, height: 1.06, fontWeight: FontWeight.w800, letterSpacing: -1.1, color: c.text),
                  ),
                  const SizedBox(height: 10),
                  Text('Ask in plain words. They plan, wait for your OK, build on staging and report back.',
                      style: TextStyle(color: c.sub, fontSize: 14, height: 1.5)),
                  const SizedBox(height: 18),
                  _MiniChat(c: c),
                  const SizedBox(height: 26),
                  _Btn('Join with your invite', onTap: _openSheet),
                  const SizedBox(height: 6),
                  Center(
                    child: TextButton(
                      onPressed: _existing,
                      child: Text('I already have an account', style: TextStyle(color: c.sub, fontWeight: FontWeight.w600)),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Center(
                    child: GestureDetector(
                      onTap: _openSheet,
                      child: Column(children: [
                        Container(
                          width: 34,
                          height: 34,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: c.line)),
                          child: Icon(Icons.keyboard_arrow_up_rounded, color: c.sub, size: 20),
                        ),
                        const SizedBox(height: 4),
                        Text('Swipe up to sign in', style: TextStyle(color: c.sub, fontSize: 11.5)),
                      ]),
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

class _MiniChat extends StatelessWidget {
  const _MiniChat({required this.c});
  final _C c;
  Widget _m(String av, List<Color> g, String who, String when, String text, {List<Widget> extra = const []}) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Container(
        width: 24,
        height: 24,
        alignment: Alignment.center,
        decoration: BoxDecoration(gradient: LinearGradient(colors: g), borderRadius: BorderRadius.circular(7)),
        child: Text(av, style: const TextStyle(color: Colors.white, fontSize: 9.5, fontWeight: FontWeight.w700)),
      ),
      const SizedBox(width: 8),
      Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text.rich(TextSpan(children: [
            TextSpan(text: who, style: TextStyle(color: c.text, fontWeight: FontWeight.w600, fontSize: 11.5)),
            TextSpan(text: '  $when', style: TextStyle(color: c.faint, fontSize: 10.5)),
          ])),
          Text(text, style: TextStyle(color: c.dark ? const Color(0xFFDDD4EA) : const Color(0xFF2A2036), fontSize: 12.5)),
          ...extra,
        ]),
      ),
    ]),
  );
  Widget _chip(String t, Color fg) => Container(
    margin: const EdgeInsets.only(top: 4, right: 4),
    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 1),
    decoration: BoxDecoration(color: fg.withValues(alpha: .14), borderRadius: BorderRadius.circular(99)),
    child: Text(t, style: TextStyle(color: fg, fontSize: 10, fontWeight: FontWeight.w600)),
  );
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.fromLTRB(12, 12, 12, 2),
    decoration: BoxDecoration(color: c.win, border: Border.all(color: c.line), borderRadius: BorderRadius.circular(16)),
    child: Column(children: [
      _m('MG', const [Color(0xFF4C5A7A), Color(0xFF2E3850)], 'Mostafa', 'now', 'Dark mode for the POS screen 🌙'),
      _m('Y', const [Color(0xFFE2457A), Color(0xFFA3245A)], 'Youssef', '1 min', 'Plan ready · 3 steps',
          extra: [Wrap(children: [_chip('Staging only', const Color(0xFF22B47A)), _chip('Waiting for you', const Color(0xFFC88A1C))])]),
      _m('F', const [Color(0xFF4F7DFF), Color(0xFF2C4FC9)], 'Fahd', 'typing…', '● ● ●'),
    ]),
  );
}

enum _Step { signin, code, invited, waiting }

class _JoinSheet extends ConsumerStatefulWidget {
  const _JoinSheet();
  @override
  ConsumerState<_JoinSheet> createState() => _JoinSheetState();
}

class _JoinSheetState extends ConsumerState<_JoinSheet> {
  _Step step = _Step.signin;
  bool emailTab = true;
  bool busy = false;
  String error = '';
  final email = TextEditingController();
  final link = TextEditingController();
  final digits = TextEditingController();
  final name = TextEditingController();
  JoinInfo? info;
  String code = '';
  Timer? _poll;

  @override
  void dispose() {
    _poll?.cancel();
    for (final c in [email, link, digits, name]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _run(Future<void> Function() fn) async {
    setState(() {
      busy = true;
      error = '';
    });
    try {
      await fn();
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<String> _nsec(String relayUrl) => ref
      .read(communityStorageProvider)
      .pendingInviteIdentity(relayUrl, _pendingKey, () => nostr.Keys.generate().nsec);

  Future<void> _enter(JoinInfo joined, String nsec) async {
    final keys = nostr.Keys(nostr.Nip19.decode(payload: nsec).data);
    final community = Community.create(name: joined.workspace, relayUrl: joined.relayUrl, pubkey: keys.public, nsec: nsec);
    await ref.read(authProvider.notifier).authenticateWithCommunity(community);
    try {
      await ref.read(communityStorageProvider).completePendingInvite(joined.relayUrl, _pendingKey, community);
    } catch (_) {
      // The saved community is what matters.
    }
    if (mounted) await Navigator.of(context).maybePop();
  }

  Future<void> _sendCode() => _run(() async {
    await _post('/join/email/start', {'email': email.text.trim()});
    digits.clear();
    setState(() => step = _Step.code);
  });

  Future<void> _verify() => _run(() async {
    final r = JoinInfo(await _post('/join/email/verify', {'email': email.text.trim(), 'code': digits.text.trim()}));
    info = r;
    code = r.code;
    name.text = r.name;
    setState(() => step = _Step.invited);
  });

  Future<void> _openLink() => _run(() async {
    final r = JoinInfo(await _post('/join/lookup', {'code': link.text.trim()}));
    info = r;
    code = link.text.trim();
    name.text = r.name;
    setState(() => step = _Step.invited);
  });

  Future<void> _join() => _run(() async {
    final relay = info!.relayUrl;
    final nsec = await _nsec(relay);
    final r = JoinInfo(await _post('/join/claim',
        {'code': code, 'name': name.text.trim(), 'device': Platform.isIOS ? 'iPhone' : 'Phone'}, nsec: nsec));
    info = r;
    if (r.status == 'joined') {
      await _enter(r, nsec);
      return;
    }
    setState(() => step = _Step.waiting);
    _poll?.cancel();
    _poll = Timer.periodic(const Duration(seconds: 4), (_) async {
      try {
        final s = JoinInfo(await _post('/join/status', {}, nsec: nsec));
        if (!mounted) return;
        if (s.status == 'joined') {
          _poll?.cancel();
          await _enter(s, nsec);
        } else if (s.status == 'rejected') {
          _poll?.cancel();
          setState(() {
            error = 'Your request was declined. Ask your manager for a new invite.';
            step = _Step.signin;
          });
        }
      } catch (_) {
        // Keep waiting; the network may come back.
      }
    });
  });

  InputDecoration _dec(_C c, String hint) => InputDecoration(
    hintText: hint,
    hintStyle: TextStyle(color: c.faint),
    filled: true,
    fillColor: c.field,
    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: c.line)),
    focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFB06AD9), width: 1.6)),
  );

  Widget _label(_C c, String t) => Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text(t, style: TextStyle(color: c.sub, fontSize: 12, fontWeight: FontWeight.w600)));

  Widget _tabs(_C c) => Container(
    padding: const EdgeInsets.all(3),
    margin: const EdgeInsets.only(bottom: 14),
    decoration: BoxDecoration(border: Border.all(color: c.line), borderRadius: BorderRadius.circular(12)),
    child: Row(children: [
      for (final (label, on) in [('Email', emailTab), ('Invite link', !emailTab)])
        Expanded(
          child: GestureDetector(
            onTap: () => setState(() {
              emailTab = label == 'Email';
              error = '';
            }),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 8),
              alignment: Alignment.center,
              decoration: BoxDecoration(gradient: on ? _C.brand : null, borderRadius: BorderRadius.circular(9)),
              child: Text(label, style: TextStyle(color: on ? Colors.white : c.faint, fontWeight: FontWeight.w600, fontSize: 13)),
            ),
          ),
        ),
    ]),
  );

  @override
  Widget build(BuildContext context) {
    final c = _C(Theme.of(context).brightness == Brightness.dark);
    final t = TextStyle(color: c.text, fontSize: 23, fontWeight: FontWeight.w800, letterSpacing: -.5);
    final s = TextStyle(color: c.sub, fontSize: 13.5, height: 1.5);
    final field = TextStyle(color: c.text, fontSize: 15);
    final err = error.isEmpty
        ? const SizedBox.shrink()
        : Padding(
            padding: const EdgeInsets.only(top: 10),
            child: Text(error, style: const TextStyle(color: Color(0xFFF08CC0), fontSize: 12.5)));
    final List<Widget> body = switch (step) {
      _Step.signin => [
        Text('Join your company', style: t),
        const SizedBox(height: 4),
        Text('Use the email your invite was sent to, or the invite link.', style: s),
        const SizedBox(height: 16),
        _tabs(c),
        if (emailTab) ...[
          _label(c, 'Work email'),
          TextField(
            controller: email,
            keyboardType: TextInputType.emailAddress,
            autocorrect: false,
            autofillHints: const [AutofillHints.email],
            style: field,
            decoration: _dec(c, 'name@company.com'),
            onSubmitted: (_) => _sendCode(),
          ),
          const SizedBox(height: 12),
          _Btn('Send me a code', busy: busy, onTap: () => _sendCode()),
        ] else ...[
          _label(c, 'Invite link'),
          TextField(
            controller: link,
            autocorrect: false,
            style: field.copyWith(fontSize: 13),
            decoration: _dec(c, 'Paste the link you received').copyWith(
              suffixIcon: IconButton(
                icon: Icon(Icons.content_paste_rounded, color: c.sub, size: 20),
                onPressed: () async {
                  final d = await Clipboard.getData(Clipboard.kTextPlain);
                  if (d?.text != null) link.text = d!.text!.trim();
                },
              ),
            ),
          ),
          const SizedBox(height: 12),
          _Btn('Continue', busy: busy, onTap: () => _openLink()),
        ],
        err,
        Padding(
          padding: const EdgeInsets.only(top: 14),
          child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Text('On another device?', style: TextStyle(color: c.faint, fontSize: 12)),
            GestureDetector(
              onTap: () {
                final nav = Navigator.of(context);
                nav.pop();
                unawaited(nav.push(MaterialPageRoute<void>(builder: (_) => const OnboardingAppEntry())));
              },
              child: Text('Scan QR', style: TextStyle(color: c.link, fontWeight: FontWeight.w700, fontSize: 12.5)),
            ),
          ]),
        ),
      ],
      _Step.code => [
        Text('Check your email', style: t),
        const SizedBox(height: 4),
        Text('Code sent to ${email.text.trim()} · works for 10 minutes', style: s),
        const SizedBox(height: 16),
        TextField(
          controller: digits,
          autofocus: true,
          keyboardType: TextInputType.number,
          autofillHints: const [AutofillHints.oneTimeCode],
          maxLength: 6,
          textAlign: TextAlign.center,
          style: field.copyWith(fontSize: 26, fontWeight: FontWeight.w700, letterSpacing: 14),
          decoration: _dec(c, '······').copyWith(counterText: ''),
          onChanged: (v) {
            if (v.length == 6) unawaited(_verify());
          },
        ),
        const SizedBox(height: 12),
        _Btn('Continue', busy: busy, onTap: () => _verify()),
        err,
        const SizedBox(height: 10),
        Row(children: [
          TextButton(onPressed: busy ? null : () => _sendCode(), child: Text('Send again', style: TextStyle(color: c.link))),
          TextButton(
            onPressed: () => setState(() {
              step = _Step.signin;
              error = '';
            }),
            child: Text('Use a different email', style: TextStyle(color: c.link)),
          ),
        ]),
      ],
      _Step.invited => [
        Text("You're invited", style: t),
        const SizedBox(height: 4),
        Text("Check it's right, then join.", style: s),
        const SizedBox(height: 14),
        Container(
          padding: const EdgeInsets.all(13),
          decoration: BoxDecoration(border: Border.all(color: c.line), borderRadius: BorderRadius.circular(14)),
          child: Row(children: [
            const _Mark(size: 44),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(info?.workspace ?? '', style: TextStyle(color: c.text, fontWeight: FontWeight.w700, fontSize: 15)),
                Text('by ${info?.invitedBy ?? ''}', style: TextStyle(color: c.faint, fontSize: 12)),
                const SizedBox(height: 5),
                Wrap(spacing: 5, children: [
                  for (final x in [info?.role ?? '', info?.department ?? ''])
                    if (x.isNotEmpty)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(color: const Color(0x29B06AD9), borderRadius: BorderRadius.circular(99)),
                        child: Text(x[0].toUpperCase() + x.substring(1),
                            style: const TextStyle(color: Color(0xFFB06AD9), fontSize: 10.5, fontWeight: FontWeight.w600)),
                      ),
                ]),
              ]),
            ),
          ]),
        ),
        const SizedBox(height: 14),
        _label(c, 'Your name'),
        TextField(
            controller: name,
            textCapitalization: TextCapitalization.words,
            style: field,
            decoration: _dec(c, 'First and last name')),
        const SizedBox(height: 12),
        _Btn('Join ${info?.workspace ?? ''}', busy: busy, onTap: () => _join()),
        err,
        if (info?.confirm ?? false)
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: Text('● ${info!.invitedBy} confirms new people first.',
                style: const TextStyle(color: Color(0xFF3DDC97), fontSize: 12)),
          ),
      ],
      _Step.waiting => [
        Text('Waiting for ${info?.invitedBy ?? 'your manager'}', style: t),
        const SizedBox(height: 4),
        Text('They confirm new people before they get in. This moves on by itself.', style: s),
        const SizedBox(height: 18),
        Center(
          child: Text(info?.pair ?? '··',
              style: TextStyle(color: c.link, fontSize: 30, fontWeight: FontWeight.w800, letterSpacing: 4)),
        ),
        const SizedBox(height: 6),
        Center(child: Text('${info?.invitedBy ?? 'They'} sees the same numbers.', style: TextStyle(color: c.faint, fontSize: 12))),
        err,
      ],
    };
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(22, 12, 22, 22),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              Center(
                child: Container(
                  width: 38,
                  height: 5,
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(color: c.line, borderRadius: BorderRadius.circular(9)),
                ),
              ),
              ...body,
            ],
          ),
        ),
      ),
    );
  }
}
