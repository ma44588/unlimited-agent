// Unlimited Agent: phone client for the Unlimited server API (the same
// /unlimited-api the desktop uses). Every request is signed with this
// device's workspace key (NIP-98), so no password or token is ever typed.
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../shared/relay/relay_provider.dart';
import '../../shared/relay/relay_session.dart' show buildNip98AuthHeader;

class UnlimitedApiError implements Exception {
  UnlimitedApiError(this.message, this.status);
  final String message;
  final int status;
  @override
  String toString() => message;
}

class UnlimitedApi {
  UnlimitedApi(this.config, {http.Client? client})
    : _client = client ?? debugClient ?? http.Client();

  /// Tests only: serve canned responses instead of the network.
  static http.Client? debugClient;

  final RelayConfig config;
  final http.Client _client;

  String get base {
    final uri = Uri.parse(config.baseUrl);
    final port = uri.hasPort ? ':${uri.port}' : '';
    return '${uri.scheme}://${uri.host}$port/unlimited-api';
  }

  Future<dynamic> get(String path) => _send('GET', path);

  Future<dynamic> post(String path, [Object? body]) =>
      _send('POST', path, body ?? const <String, Object?>{});

  Future<dynamic> _send(String method, String path, [Object? body]) async {
    final url = '$base$path';
    final bytes = body == null ? <int>[] : utf8.encode(jsonEncode(body));
    final headers = {
      'Authorization': buildNip98AuthHeader(
        method: method,
        url: url,
        bodyBytes: bytes,
        nsec: config.nsec,
      ),
      if (body != null) 'Content-Type': 'application/json',
    };
    final res = method == 'GET'
        ? await _client.get(Uri.parse(url), headers: headers)
        : await _client.post(Uri.parse(url), headers: headers, body: bytes);
    Map<String, dynamic> data;
    try {
      data = jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
    } catch (_) {
      data = const {};
    }
    if (res.statusCode >= 400 || data['ok'] != true) {
      final error =
          data['error']?.toString() ?? 'Request failed (${res.statusCode})';
      throw UnlimitedApiError(
        res.statusCode == 401
            ? 'This phone is not signed in as the workspace owner ($error).'
            : error,
        res.statusCode,
      );
    }
    return data['result'];
  }

  // ---------------------------------------------------------------- calls
  Future<List<Employee>> employees() async => [
    for (final e in (await get('/admin/server-agents')) as List)
      Employee.fromJson(e as Map<String, dynamic>),
  ];

  Future<String> employeeLogs(String slug, {int lines = 300}) async {
    final r = await post(
      '/admin/server-agents/${Uri.encodeComponent(slug)}/action',
      {'do': 'logs', 'lines': lines},
    );
    return (r as Map)['log']?.toString() ?? '';
  }

  Future<void> employeeAction(String slug, String action) => post(
    '/admin/server-agents/${Uri.encodeComponent(slug)}/action',
    {'do': action},
  );

  Future<Overview> overview() async =>
      Overview.fromJson((await get('/admin/overview')) as Map<String, dynamic>);

  Future<ProjectStatus> projectStatus(String id) async =>
      ProjectStatus.fromJson(
        (await get('/admin/projects/${Uri.encodeComponent(id)}/status'))
            as Map<String, dynamic>,
      );

  Future<void> decideApproval(String id, bool approve) => post(
    '/admin/approvals/${Uri.encodeComponent(id)}',
    {'decision': approve ? 'approve' : 'reject'},
  );

  Future<List<OutboxItem>> outbox() async => [
    for (final e in (await get('/admin/outbox')) as List)
      OutboxItem.fromJson(e as Map<String, dynamic>),
  ];

  Future<void> decideEmail(String id, bool approve) => post(
    '/admin/outbox/${Uri.encodeComponent(id)}',
    {'decision': approve ? 'approve' : 'reject'},
  );
}

// ------------------------------------------------------------------ models
String _s(Object? v) => v?.toString() ?? '';
List<String> _list(Object? v) =>
    v is List ? [for (final x in v) x.toString()] : const [];

class Employee {
  Employee({
    required this.slug,
    this.pubkey = '',
    this.voiceLabel = '',
    required this.name,
    required this.person,
    required this.title,
    required this.department,
    required this.about,
    required this.avatar,
    required this.status,
    required this.model,
    required this.projects,
    required this.telegramBot,
    required this.telegramPaired,
    required this.telegramPairLink,
    required this.email,
    required this.emailOk,
  });

  factory Employee.fromJson(Map<String, dynamic> j) {
    final tg = j['telegram'] is Map ? j['telegram'] as Map : const {};
    final mail = j['email'] is Map ? j['email'] as Map : const {};
    return Employee(
      slug: _s(j['slug']),
      pubkey: _s(j['pubkey']),
      voiceLabel: _s(j['voice']),
      name: _s(j['name']),
      person: _s(j['person']),
      title: _s(j['title']),
      department: _s(j['department']),
      about: _s(j['about']).isEmpty ? _s(j['role']) : _s(j['about']),
      avatar: _s(j['avatar']),
      status: _s(j['status']),
      model: _s(j['model']),
      projects: _list(j['projects']),
      telegramBot: _s(tg['bot']),
      telegramPaired: tg['paired'] == true || tg['ok'] == true,
      telegramPairLink: _s(tg['pair_link']),
      email: _s(mail['address']),
      emailOk: mail['ok'] == true,
    );
  }

  final String slug;
  final String pubkey;
  final String voiceLabel;
  final String name;
  final String person;
  final String title;
  final String department;
  final String about;
  final String avatar;
  final String status;
  final String model;
  final List<String> projects;
  final String telegramBot;
  final String telegramPairLink;
  final String email;
  final bool telegramPaired;
  final bool emailOk;

  String get displayName => person.isNotEmpty ? person : name;
  String get role => title.isNotEmpty ? title : name;

  String get group => department.isNotEmpty ? department : 'Team';
  bool get running => status == 'running' || status == 'up';
  String get initials {
    final parts = displayName
        .trim()
        .split(RegExp(r'\s+'))
        .where((p) => p.isNotEmpty)
        .toList();
    if (parts.isEmpty) return '?';
    return parts.take(2).map((p) => p[0].toUpperCase()).join();
  }
}

class Project {
  Project({
    required this.id,
    required this.name,
    required this.branch,
    required this.version,
    required this.provider,
    required this.agents,
  });
  factory Project.fromJson(Map<String, dynamic> j) => Project(
    id: _s(j['id']),
    name: _s(j['name']),
    branch: _s(j['branch']),
    version: _s(j['odoo_version']),
    provider: _s(j['provider']).isEmpty ? 'Odoo.sh' : _s(j['provider']),
    agents: _list(j['agents']),
  );
  final String id;
  final String name;
  final String branch;
  final String version;
  final String provider;
  final List<String> agents;
}

class Overview {
  Overview({required this.projects, required this.approvals});
  factory Overview.fromJson(Map<String, dynamic> j) => Overview(
    projects: [
      for (final p in (j['projects'] as List? ?? const []))
        Project.fromJson(p as Map<String, dynamic>),
    ],
    approvals: (j['approvals'] as num?)?.toInt() ?? 0,
  );
  final List<Project> projects;
  final int approvals;
}

class Approval {
  Approval({
    required this.id,
    required this.agent,
    required this.tool,
    required this.reason,
    required this.args,
  });
  factory Approval.fromJson(Map<String, dynamic> j) => Approval(
    id: _s(j['id']),
    agent: _s(j['agent']),
    tool: _s(j['tool']),
    reason: _s(j['reason']),
    args: _s(j['args']),
  );
  final String id;
  final String agent;
  final String tool;
  final String reason;
  final String args;
}

class ActivityItem {
  ActivityItem({
    required this.ts,
    required this.agent,
    required this.tool,
    required this.outcome,
    required this.detail,
  });
  factory ActivityItem.fromJson(Map<String, dynamic> j) => ActivityItem(
    ts: _s(j['ts']),
    agent: _s(j['agent']),
    tool: _s(j['tool']),
    outcome: _s(j['outcome']),
    detail: _s(j['detail']),
  );
  final String ts;
  final String agent;
  final String tool;
  final String outcome;
  final String detail;
}

class ProjectStatus {
  ProjectStatus({
    required this.buildOk,
    required this.buildState,
    required this.buildUrl,
    required this.approvals,
    required this.activity,
  });
  factory ProjectStatus.fromJson(Map<String, dynamic> j) {
    final build = j['build'] is Map ? j['build'] as Map : const {};
    final detail = build['detail'] is Map ? build['detail'] as Map : const {};
    return ProjectStatus(
      buildOk: build['ok'] == true,
      buildState: detail.isNotEmpty ? _s(detail['state']) : _s(build['detail']),
      buildUrl: _s(detail['url']),
      approvals: [
        for (final a in (j['approvals'] as List? ?? const []))
          Approval.fromJson(a as Map<String, dynamic>),
      ],
      activity: [
        for (final a in (j['activity'] as List? ?? const []))
          ActivityItem.fromJson(a as Map<String, dynamic>),
      ],
    );
  }
  final bool buildOk;
  final String buildState;
  final String buildUrl;
  final List<Approval> approvals;
  final List<ActivityItem> activity;
}

class OutboxItem {
  OutboxItem({
    required this.id,
    required this.ts,
    required this.agent,
    required this.from,
    required this.to,
    required this.subject,
    required this.body,
  });
  factory OutboxItem.fromJson(Map<String, dynamic> j) => OutboxItem(
    id: _s(j['id']),
    ts: _s(j['ts']),
    agent: _s(j['agent']),
    from: _s(j['from']),
    to: _list(j['to']),
    subject: _s(j['subject']),
    body: _s(j['body']),
  );
  final String id;
  final String ts;
  final String agent;
  final String from;
  final String subject;
  final String body;
  final List<String> to;
}
