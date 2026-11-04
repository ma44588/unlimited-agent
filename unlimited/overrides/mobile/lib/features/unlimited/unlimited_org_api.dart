// Unlimited Agent: the org (who reports to whom, who approves what), the
// daily plan from the company Odoo, and Today. Same signed server API as the
// rest of the app (/unlimited-api/admin/org, /today, /plans).
import 'unlimited_api.dart';

String _s(Object? v) => v?.toString() ?? '';
int _i(Object? v) => v is num ? v.toInt() : int.tryParse(_s(v)) ?? 0;
double _d(Object? v) => v is num ? v.toDouble() : double.tryParse(_s(v)) ?? 0;
Map<String, dynamic> _m(Object? v) =>
    v is Map ? v.cast<String, dynamic>() : const <String, dynamic>{};
List<Map<String, dynamic>> _ms(Object? v) =>
    v is List ? [for (final x in v) _m(x)] : const [];

/// A person in the org: an AI employee, a human teammate, or the owner.
class OrgPerson {
  OrgPerson(this.j);
  final Map<String, dynamic> j;

  String get id => _s(j['id']);
  String get name => _s(j['name']).isEmpty ? id : _s(j['name']);
  String get title => _s(j['title']);
  String get department => _s(j['department']);
  String get avatar => _s(j['avatar']);
  String get pubkey => _s(j['pubkey']);
  String get slug => _s(j['slug']);
  bool get isAi => j['kind'] == 'ai';
  bool get isOwner => id == 'owner';
  bool get isLead => j['lead'] == true;
  String? get reportsTo => j['reports_to'] == null ? null : _s(j['reports_to']);
  List<String> get approves =>
      [for (final a in (j['approves'] as List? ?? const [])) _s(a)];
  List<String> get reports =>
      [for (final a in (j['reports'] as List? ?? const [])) _s(a)];
  int get capacity => _i(j['capacity']) == 0 ? 3 : _i(j['capacity']);
  String get odooUser => _s(j['odoo_user']);
  bool get odooConnected => j['odoo_connected'] == true;
  bool get running => j['status'] == 'running' || j['status'] == 'up';
  String get dept => _s(j['dept']);

  /// Approvers chosen for this person per action (missing = up the line).
  Map<String, String> get approverSet => {
    for (final e in _m(j['approver_set']).entries) e.key: _s(e.value),
  };
  String get first => name.split(RegExp(r'\s+')).first;
}

class Dept {
  Dept(this.j);
  final Map<String, dynamic> j;
  String get id => _s(j['id']);
  String get name => _s(j['name']);
  String get head => _s(j['head']);
  String get parent => _s(j['parent']);
}

class OrgData {
  OrgData(Map<String, dynamic> j)
    : people = [for (final m in _ms(j['members'])) OrgPerson(m)],
      depts = [for (final d in _ms(j['departments'])) Dept(d)],
      settings = _m(j['settings']),
      odoo = _m(j['odoo']);
  final List<OrgPerson> people;
  final List<Dept> depts;
  Dept? dept(String id) => depts.where((d) => d.id == id).firstOrNull;
  List<Dept> get topDepts => [
    for (final d in depts)
      if (d.parent.isEmpty || dept(d.parent) == null) d,
  ];
  List<Dept> childDepts(String id) => [
    for (final d in depts)
      if (d.parent == id) d,
  ];
  List<OrgPerson> inDept(String id) => [
    for (final p in people)
      if (p.dept == id && !p.isOwner) p,
  ];
  int countIn(String id) =>
      inDept(id).length + childDepts(id).fold(0, (n, k) => n + countIn(k.id));
  final Map<String, dynamic> settings;
  final Map<String, dynamic> odoo;

  bool get odooConnected => odoo['state'] == 'connected';
  OrgPerson? byId(String? id) {
    for (final p in people) {
      if (p.id == id) return p;
    }
    return null;
  }

  OrgPerson get owner => byId('owner') ?? people.first;
  List<OrgPerson> reportsOf(String id) => [
    for (final p in people)
      if (p.reportsTo == id) p,
  ];
  List<OrgPerson> below(String id) {
    final out = <OrgPerson>[];
    for (final p in reportsOf(id)) {
      out
        ..add(p)
        ..addAll(below(p.id));
    }
    return out;
  }

  List<OrgPerson> get leads => [
    for (final p in people)
      if (p.isLead) p,
  ];
}

class PlanTask {
  PlanTask(this.j);
  final Map<String, dynamic> j;
  int get id => _i(j['id']);
  String get name => _s(j['name']);
  String get ref => _s(j['ref']);
  String get project => _s(j['project']);
  String get stage => _s(j['stage']);
  String get status => _s(j['status']);
  bool get done => status == 'done';
  bool get blocked => status == 'blocked';
  double get hours => _d(j['hours']);
  double get spent => _d(j['spent']);
  String get url => _s(j['url']);
}

/// One person's day inside a plan.
class PlanRow {
  PlanRow(this.j)
    : member = OrgPerson(_m(j['member'])),
      tasks = [for (final t in _ms(j['tasks'])) PlanTask(t)];
  final Map<String, dynamic> j;
  final OrgPerson member;
  final List<PlanTask> tasks;
  int get done => _i(j['done']);
  int get total => _i(j['total']);
  int get blocked => _i(j['blocked']);
  String get now => _s(j['now']);
  double get hours => _d(j['hours']);

  /// Publishing to the staging branch, or null.
  Deploy? get deploy => j['deploy'] is Map ? Deploy(_m(j['deploy'])) : null;
}

/// One employee's publish state: building (Odoo.sh rebuilding his push), waiting, live, failed.
class Deploy {
  Deploy(this.j);
  final Map<String, dynamic> j;
  String get state => _s(j['state']);
  String get task => _s(j['task']);
  String get since => _s(j['since']);
  String get branch => _s(j['branch']);
  String get project => _s(j['project']);
}

/// A staging branch with publish activity.
class DeployLine {
  DeployLine(this.j);
  final Map<String, dynamic> j;
  String get project => _s(j['project']);
  String get branch => _s(j['branch']);
  bool get building => j['building'] == true;
  String get by => _s(j['by']);
  int get waiting => _i(j['waiting']);
}

class TeamDay {
  TeamDay(this.j)
    : lead = j['lead'] == null ? null : OrgPerson(_m(j['lead'])),
      approver = j['approver'] == null ? null : OrgPerson(_m(j['approver'])),
      decidedBy = j['decided_by'] == null
          ? null
          : OrgPerson(_m(j['decided_by'])),
      rows = [for (final r in _ms(j['members'])) PlanRow(r)];
  final Map<String, dynamic> j;
  final OrgPerson? lead;
  final OrgPerson? approver;
  final OrgPerson? decidedBy;
  final List<PlanRow> rows;
  String get plan => _s(j['plan']);
  String get status => _s(j['status']);
  String get decidedAt => _s(j['decided_at']);
  /// Set for the "Project tasks" block (tasks from the projects, not a lead's plan).
  String get title => _s(j['title']);
  List<String> get notes => [
    for (final n in (j['notes'] as List? ?? const [])) _s(n),
  ];
}

class PlanAsk {
  PlanAsk(this.j) : lead = OrgPerson(_m(j['lead']));
  final Map<String, dynamic> j;
  final OrgPerson lead;
  String get id => _s(j['id']);
  int get tasks => _i(j['tasks']);
  int get people => _i(j['people']);
  String get since => _s(j['since']);
}

class TodayData {
  TodayData(Map<String, dynamic> j)
    : me = OrgPerson(_m(j['me'])),
      summary = _m(j['summary']),
      settings = _m(j['settings']),
      odoo = j['odoo'] == true,
      hasTeams = j['has_teams'] == true,
      date = _s(j['date']),
      needs = [for (final n in _ms(j['needs_you'])) PlanAsk(n)],
      teams = [for (final t in _ms(j['teams'])) TeamDay(t)],
      deploys = [for (final d in _ms(j['deploys'])) DeployLine(d)];
  final List<DeployLine> deploys;
  final OrgPerson me;
  final Map<String, dynamic> summary;
  final Map<String, dynamic> settings;
  final bool odoo;
  final bool hasTeams;
  final String date;
  final List<PlanAsk> needs;
  final List<TeamDay> teams;

  int get tasks => _i(summary['tasks']);
  int get done => _i(summary['done']);
  int get blocked => _i(summary['blocked']);
  int get open => _i(summary['open']);
  int get percent => _i(summary['percent']);
  int get escalateMinutes => _i(settings['escalate_minutes']);

  /// Today's status for one person, from any plan.
  PlanRow? rowFor(String id) {
    for (final t in teams) {
      for (final r in t.rows) {
        if (r.member.id == id) return r;
      }
    }
    return null;
  }
}

class MemberDay {
  MemberDay(Map<String, dynamic> j)
    : member = OrgPerson(_m(j['member'])),
      manager = j['manager'] == null ? null : OrgPerson(_m(j['manager'])),
      approvers = {
        for (final e in _m(j['approvers']).entries)
          if (e.value != null) e.key: OrgPerson(_m(e.value)),
      },
      tasks = [for (final t in _ms(j['tasks'])) PlanTask(t)],
      planStatus = j['plan_status'] == null ? null : _s(j['plan_status']),
      hours = _d(j['hours']),
      spent = _d(j['spent']);
  final OrgPerson member;
  final OrgPerson? manager;
  final Map<String, OrgPerson> approvers;
  final List<PlanTask> tasks;
  final String? planStatus;
  final double hours;
  final double spent;
  int get done => tasks.where((t) => t.done).length;
}

class PlanDetail {
  PlanDetail(this.j)
    : lead = OrgPerson(_m(j['lead_member'])),
      approver = OrgPerson(_m(j['approver_member'])),
      team = [for (final m in _ms(j['team'])) OrgPerson(m)],
      rows = [for (final r in _ms(j['rows'])) PlanRow(r)];
  final Map<String, dynamic> j;
  final OrgPerson lead;
  final OrgPerson approver;
  final List<OrgPerson> team;
  final List<PlanRow> rows;
  String get id => _s(j['id']);
  String get date => _s(j['date']);
  String get status => _s(j['status']);
  String get createdAt => _s(j['created_at']);
  List<String> get notes => [
    for (final n in (j['notes'] as List? ?? const [])) _s(n),
  ];
}

/// A project task from the Task Desk (Youssef plans and builds it, Rami documents it).
class TaskItem {
  TaskItem(this.j);
  final Map<String, dynamic> j;
  String get id => _s(j['id']);
  String get title => _s(j['title']);
  String get body => _s(j['body']);
  String get stage => _s(j['stage']);
  int get since => _i(j['since']);
  int get createdAt => _i(j['created_at']);
  int get round => _i(j['round']);
  String get project => _s(j['project']);
  String get buzzId => _s(j['buzz_id']);
  String get repoAddress => _s(j['repo_address']);
  String get developer => _s(j['developer']);
  String get workerName => _s(j['worker_name']);
  String get plan => _s(j['plan']);
  String get result => _s(j['result']);
  int get comments => _i(j['comments']);

  /// build_failed (its staging build failed) or stuck (a step ran far too long); empty when fine.
  String get problem => _s(j['problem']);

  /// The task waits for the owner: a plan to approve or a result to try.
  bool get needsYou =>
      stage == 'awaiting_approval' || stage == 'in_review' || asks.isNotEmpty;

  /// Sensitive steps the plan lists (🔐); approving the plan allows exactly these.
  List<TaskPerm> get perms => [for (final p in _ms(j['perms'])) TaskPerm(p)];

  /// Requests outside the plan that wait for the owner.
  List<TaskAsk> get asks => [for (final a in _ms(j['asks'])) TaskAsk(a)];

  /// Sensitive steps run on staging without asking (the owner's setting).
  bool get autoApprove => j['auto_approve'] == true;

  /// code | setup | both — how the employee does it (from the plan); empty before the plan.
  String get kind => _s(j['kind']);

  /// Sensitive steps that ran on staging without approval.
  List<Map<String, dynamic>> get auto => _ms(j['auto']);
  bool get finished =>
      stage == 'done' || stage == 'documented' || stage == 'cancelled';
  bool get notStarted => stage == 'new';
}

class TaskPerm {
  TaskPerm(this.j);
  final Map<String, dynamic> j;
  String get model => _s(j['model']);
  String get method => _s(j['method']);
  String get label => _s(j['label']);
  List<int> get ids => [for (final x in (j['ids'] as List? ?? const [])) _i(x)];
  int get usedAt => _i(j['used_at']);
}

class TaskAsk {
  TaskAsk(this.j);
  final Map<String, dynamic> j;
  String get id => _s(j['id']);
  int get at => _i(j['at']);
  String get title => _s(j['title']);
  String get kind => _s(j['kind']);
  String get why => _s(j['why']);
  String get oldCode => _s(j['old']);
  String get newCode => _s(j['new']);
}

extension UnlimitedOrgApi on UnlimitedApi {
  Future<List<TaskItem>> tasks() async => [
    for (final t in _ms(_m(await get('/admin/tasks/list'))['tasks']))
      TaskItem(t),
  ];

  Future<int> tasksWaiting() async =>
      _i(_m(await get('/admin/tasks/waiting'))['count']);

  Future<OrgData> org() async => OrgData(_m(await get('/admin/org')));

  Future<TodayData> today() async => TodayData(_m(await get('/admin/today')));

  Future<MemberDay> memberDay(String id) async => MemberDay(
    _m(await get('/admin/org/members/${Uri.encodeComponent(id)}/day')),
  );

  Future<PlanDetail> plan(String id) async =>
      PlanDetail(_m(await get('/admin/plans/${Uri.encodeComponent(id)}')));

  Future<void> decidePlan(
    String id, {
    required bool approve,
    String note = '',
    List<Map<String, Object>> moves = const [],
  }) => post('/admin/plans/${Uri.encodeComponent(id)}/decide', {
    'decision': approve ? 'approve' : 'reject',
    'note': note,
    'moves': moves,
  });

  Future<void> draftPlan(String lead, {bool again = false}) =>
      post('/admin/plans', {'lead': lead, 'again': again});

  Future<OrgData> updateMember(String id, Map<String, Object?> fields) async =>
      OrgData(
        _m(await post('/admin/org/members/${Uri.encodeComponent(id)}', fields)),
      );

  Future<OrgData> removeMember(String id) =>
      updateMember(id, {'action': 'remove'});

  /// The employee's own Odoo user; the password or API key is never returned.
  Future<Map<String, dynamic>> memberOdoo(
    String id, {
    String? login,
    String? key,
    bool remove = false,
  }) async => _m(
    await post('/admin/org/members/${Uri.encodeComponent(id)}/odoo', {
      if (remove) 'action': 'remove',
      'login': ?login,
      'key': ?key,
    }),
  );

  /// Create or change a department; apply=true redraws the reporting lines.
  Future<OrgData> department(Map<String, Object?> body) async =>
      OrgData(_m(await post('/admin/org/departments', body)));

  /// Upload a photo (JPG, PNG or WebP under 2 MB) as a data URL.
  Future<OrgData> photo(String id, String dataUrl) async => OrgData(
    _m(
      await post('/admin/org/members/${Uri.encodeComponent(id)}/photo', {
        'data': dataUrl,
      }),
    ),
  );

  Future<OrgData> addPerson(Map<String, Object?> fields) async =>
      OrgData(_m(await post('/admin/org/humans', fields)));

  Future<OrgData> orgSettings(Map<String, Object?> fields) async =>
      OrgData(_m(await post('/admin/org/settings', fields)));

  Future<List<Map<String, dynamic>>> odooProjects() async =>
      _ms(await get('/admin/org/odoo-projects'));

  Future<void> connectCompanyOdoo(Map<String, Object?> fields) =>
      post('/admin/connections/company_odoo', {...fields, 'action': 'save'});

  Future<void> disconnectCompanyOdoo() =>
      post('/admin/connections/company_odoo', {'action': 'disconnect'});
}
