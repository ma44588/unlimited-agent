// Unlimited Agent: live voice call with a server employee from the phone.
//
// Same path as the desktop: WebRTC to OpenAI Realtime, with the offer sent
// through the Unlimited server (it adds the employee's persona and tools and
// uses the owner's key, which never reaches the phone). Real work is handed to
// the employee on the server; the transcript is filed in its calls channel.
import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../shared/relay/relay_provider.dart';
import 'ud.dart';
import 'unlimited_api.dart';

class UCallScreen extends ConsumerStatefulWidget {
  const UCallScreen({super.key, required this.employee});
  final Employee employee;

  @override
  ConsumerState<UCallScreen> createState() => _UCallScreenState();
}

enum _Phase { connecting, listening, speaking, working, failed }

class _UCallScreenState extends ConsumerState<UCallScreen> {
  RTCPeerConnection? _pc;
  RTCDataChannel? _dc;
  MediaStream? _mic;
  _Phase _phase = _Phase.connecting;
  String _error = '';
  String _caption = '';
  bool _muted = false;
  bool _speaker = true;
  int _seconds = 0;
  int _handoffs = 0;
  Timer? _timer;
  final _lines = <Map<String, String>>[];
  bool _finished = false;
  late final UnlimitedApi _api = UnlimitedApi(ref.read(relayConfigProvider));

  String get _name => widget.employee.displayName;
  String get _path =>
      '/admin/calls/${Uri.encodeComponent(widget.employee.slug)}';

  @override
  void initState() {
    super.initState();
    unawaited(_start());
  }

  Future<void> _start() async {
    try {
      final pc = await createPeerConnection({'sdpSemantics': 'unified-plan'});
      _pc = pc;
      final mic = await navigator.mediaDevices.getUserMedia({
        'audio': {
          'echoCancellation': true,
          'noiseSuppression': true,
          'autoGainControl': true,
        },
        'video': false,
      });
      _mic = mic;
      for (final t in mic.getAudioTracks()) {
        await pc.addTrack(t, mic);
      }
      await Helper.setSpeakerphoneOn(_speaker);
      final dc = await pc.createDataChannel('oai-events', RTCDataChannelInit());
      _dc = dc;
      dc.onDataChannelState = (s) {
        if (s != RTCDataChannelState.RTCDataChannelOpen) return;
        _setPhase(_Phase.listening);
        _timer ??= Timer.periodic(const Duration(seconds: 1), (_) {
          if (mounted) setState(() => _seconds++);
        });
        _send({
          'type': 'response.create',
          'response': {
            'instructions':
                'Answer the call: greet Mostafa in one short Egyptian Arabic '
                'sentence as $_name.',
          },
        });
      };
      dc.onMessage = (m) => unawaited(_onEvent(m.text));
      pc.onConnectionState = (s) {
        if (s == RTCPeerConnectionState.RTCPeerConnectionStateFailed) {
          _fail('The connection dropped.');
        }
      };
      final offer = await pc.createOffer({'offerToReceiveAudio': true});
      await pc.setLocalDescription(offer);
      final answer =
          await _api.post('$_path/connect', {'sdp': offer.sdp}) as Map;
      if (!mounted) return;
      await pc.setRemoteDescription(
        RTCSessionDescription(answer['sdp'] as String, 'answer'),
      );
    } catch (e) {
      final msg = e.toString();
      _fail(
        msg.contains('Permission') || msg.contains('NotAllowed')
            ? 'Allow the microphone for Unlimited Agent in Settings.'
            : msg,
      );
    }
  }

  void _send(Map<String, Object?> ev) {
    final dc = _dc;
    if (dc != null && dc.state == RTCDataChannelState.RTCDataChannelOpen) {
      unawaited(dc.send(RTCDataChannelMessage(jsonEncode(ev))));
    }
  }

  void _setPhase(_Phase p) {
    if (mounted && _phase != p && _phase != _Phase.failed) {
      setState(() => _phase = p);
    }
  }

  void _addLine(String who, String text) {
    if (text.trim().isEmpty) return;
    _lines.add({'who': who, 'text': text.trim()});
    if (mounted) setState(() {});
  }

  Future<void> _onEvent(String raw) async {
    Map<String, dynamic> ev;
    try {
      ev = jsonDecode(raw) as Map<String, dynamic>;
    } catch (_) {
      return;
    }
    final type = '${ev['type'] ?? ''}';
    if (type == 'input_audio_buffer.speech_started') {
      _setPhase(_Phase.listening);
      if (mounted) setState(() => _caption = '');
    } else if (type == 'response.created') {
      _setPhase(_Phase.speaking);
    } else if (type == 'response.done' ||
        type == 'output_audio_buffer.stopped') {
      if (_phase != _Phase.working) _setPhase(_Phase.listening);
    } else if (type == 'response.output_audio_transcript.delta' ||
        type == 'response.audio_transcript.delta') {
      if (mounted) setState(() => _caption += '${ev['delta'] ?? ''}');
    } else if (type == 'response.output_audio_transcript.done' ||
        type == 'response.audio_transcript.done') {
      _addLine('them', '${ev['transcript'] ?? ''}');
      if (mounted) setState(() => _caption = '');
    } else if (type ==
        'conversation.item.input_audio_transcription.completed') {
      _addLine('you', '${ev['transcript'] ?? ''}');
    } else if (type == 'response.function_call_arguments.done' &&
        ev['name'] == 'hand_off_task') {
      _setPhase(_Phase.working);
      var output =
          'Sent to the team channel. Tell Mostafa in one sentence that you '
          'started.';
      try {
        final args =
            jsonDecode('${ev['arguments'] ?? '{}'}') as Map<String, dynamic>;
        await _api.post('$_path/handoff', {
          'brief': args['brief'] ?? '',
          'project': args['project'] ?? '',
        });
        if (mounted) setState(() => _handoffs++);
      } catch (e) {
        output = 'Could not hand it off: $e. Tell Mostafa briefly.';
      }
      _send({
        'type': 'conversation.item.create',
        'item': {
          'type': 'function_call_output',
          'call_id': ev['call_id'],
          'output': output,
        },
      });
      _send({'type': 'response.create'});
      _setPhase(_Phase.speaking);
    } else if (type == 'error') {
      final err = ev['error'];
      if (mounted) {
        setState(
          () => _error = err is Map
              ? '${err['message'] ?? 'Voice service error'}'
              : 'Voice service error',
        );
      }
    }
  }

  void _fail(String msg) {
    if (!mounted) return;
    setState(() {
      _error = msg;
      _phase = _Phase.failed;
    });
    unawaited(_teardown());
  }

  Future<void> _teardown() async {
    if (_finished) return;
    _finished = true;
    _timer?.cancel();
    try {
      for (final t in _mic?.getTracks() ?? const <MediaStreamTrack>[]) {
        await t.stop();
      }
      await _mic?.dispose();
      await _dc?.close();
      await _pc?.close();
    } catch (_) {}
    if (_lines.isNotEmpty) {
      try {
        await _api.post('$_path/notes', {'lines': _lines});
      } catch (_) {}
    }
  }

  Future<void> _end() async {
    unawaited(HapticFeedback.mediumImpact());
    await _teardown();
    if (mounted) Navigator.of(context).pop();
  }

  @override
  void dispose() {
    unawaited(_teardown());
    super.dispose();
  }

  String get _status => switch (_phase) {
    _Phase.connecting => 'Calling…',
    _Phase.listening => 'Listening',
    _Phase.speaking => 'Speaking',
    _Phase.working => 'Working on it',
    _Phase.failed => 'Call failed',
  };

  void _toggleMute() {
    setState(() => _muted = !_muted);
    for (final t in _mic?.getAudioTracks() ?? const <MediaStreamTrack>[]) {
      t.enabled = !_muted;
    }
  }

  void _toggleSpeaker() {
    setState(() => _speaker = !_speaker);
    unawaited(Helper.setSpeakerphoneOn(_speaker));
  }

  @override
  Widget build(BuildContext context) {
    final e = widget.employee;
    final live =
        _phase == _Phase.listening ||
        _phase == _Phase.speaking ||
        _phase == _Phase.working;
    final time =
        '${_seconds ~/ 60}:${(_seconds % 60).toString().padLeft(2, '0')}';
    const sub = Color(0xFFA79FB2);
    const ink = Color(0xFFEFEAF4);
    final last = _caption.isNotEmpty
        ? _caption
        : (_lines.isEmpty ? '' : _lines.last['text']!);
    final rtl = RegExp(r'[؀-ۿ]').hasMatch(last);
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) unawaited(_end());
      },
      child: Scaffold(
        body: DecoratedBox(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Color(0xFF26113A), Color(0xFF3A1430)],
            ),
          ),
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 30, 24, 36),
              child: Column(
                children: [
                  Text(
                    [
                      if (e.department.isNotEmpty) e.department,
                      live ? 'live' : _status.toLowerCase(),
                    ].join(' · '),
                    style: const TextStyle(color: sub, fontSize: 12.5),
                  ),
                  const SizedBox(height: 18),
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 250),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(48),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFFC79FDB).withValues(
                            alpha: _phase == _Phase.speaking ? .45 : .22,
                          ),
                          spreadRadius: _phase == _Phase.speaking ? 14 : 10,
                        ),
                      ],
                    ),
                    child: UdAvatar(
                      name: _name,
                      colorKey: e.slug,
                      url: e.avatar,
                      size: 120,
                    ),
                  ),
                  const SizedBox(height: 14),
                  Text(
                    _name,
                    style: const TextStyle(
                      color: ink,
                      fontSize: 24,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    live ? '$_status… $time' : _status,
                    style: const TextStyle(color: sub, fontSize: 13),
                  ),
                  const Spacer(),
                  if (_error.isNotEmpty) _Note(text: _error, color: Ud.danger),
                  if (_handoffs > 0)
                    _Note(
                      text:
                          '${_handoffs == 1 ? '1 task' : '$_handoffs tasks'} '
                          'sent to ${_name.split(' ').first} on the server.',
                      color: Ud.ok,
                    ),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1F1A26),
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: const Color(0xFF322A3C)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Live',
                          style: TextStyle(color: sub, fontSize: 12.5),
                        ),
                        const SizedBox(height: 4),
                        SizedBox(
                          width: double.infinity,
                          child: Text(
                            last.isEmpty
                                ? 'Speak naturally. You can interrupt any time.'
                                : last,
                            textDirection: rtl
                                ? TextDirection.rtl
                                : TextDirection.ltr,
                            maxLines: 5,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: ink,
                              fontSize: 14,
                              height: 1.5,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 28),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      _Control(
                        icon: _muted
                            ? Icons.mic_off_rounded
                            : Icons.mic_none_rounded,
                        label: _muted ? 'Unmute' : 'Mute',
                        onTap: live ? _toggleMute : null,
                        on: _muted,
                      ),
                      _Control(
                        icon: Icons.volume_up_rounded,
                        label: 'Speaker',
                        onTap: _toggleSpeaker,
                        on: _speaker,
                      ),
                      _Control(
                        icon: Icons.call_end_rounded,
                        label: 'End',
                        onTap: _end,
                        red: true,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Note extends StatelessWidget {
  const _Note({required this.text, required this.color});
  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    margin: const EdgeInsets.only(bottom: 12),
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: color.withValues(alpha: .15),
      borderRadius: BorderRadius.circular(16),
    ),
    child: Text(
      text,
      style: TextStyle(
        color: Color.lerp(color, Colors.white, .55),
        fontSize: 13,
      ),
    ),
  );
}

class _Control extends StatelessWidget {
  const _Control({
    required this.icon,
    required this.label,
    this.onTap,
    this.on = false,
    this.red = false,
  });
  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final bool on;
  final bool red;

  @override
  Widget build(BuildContext context) => Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      Opacity(
        opacity: onTap == null ? .4 : 1,
        child: Material(
          color: red
              ? Ud.danger
              : (on ? Colors.white : Colors.white.withValues(alpha: .08)),
          shape: const CircleBorder(),
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: onTap,
            child: SizedBox.square(
              dimension: 58,
              child: Icon(
                icon,
                size: 24,
                color: red
                    ? Colors.white
                    : (on ? const Color(0xFF26113A) : Colors.white),
              ),
            ),
          ),
        ),
      ),
      const SizedBox(height: 5),
      Text(
        label,
        style: const TextStyle(color: Color(0xFFA79FB2), fontSize: 12.5),
      ),
    ],
  );
}
