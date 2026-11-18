import 'dart:async';
import 'package:flutter/material.dart';
import 'api.dart';
import 'main.dart';
import 'notify.dart';
import 'pdfshare.dart';

// ---------- helpers ----------
String inr(num? n) => '₹${(n ?? 0).round().toString().replaceAllMapped(RegExp(r'(\d)(?=(\d\d)+\d$)'), (m) => '${m[1]},')}';
String s(dynamic v) => (v == null || v.toString().isEmpty) ? '-' : v.toString();

/// Loads JSON, shows spinner/error with retry, rebuilds with data.
class Load extends StatefulWidget {
  final Future<dynamic> Function() fetch;
  final Widget Function(BuildContext, dynamic, VoidCallback reload) builder;
  const Load({super.key, required this.fetch, required this.builder});
  @override
  State<Load> createState() => _LoadState();
}

class _LoadState extends State<Load> {
  late Future<dynamic> f = widget.fetch();
  void reload() => setState(() => f = widget.fetch());
  @override
  Widget build(BuildContext context) => FutureBuilder(
        future: f,
        builder: (c, snap) {
          if (snap.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
          if (snap.hasError) return Center(child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [
            Text('${snap.error}', textAlign: TextAlign.center), const SizedBox(height: 12), OutlinedButton(onPressed: reload, child: const Text('Retry'))])));
          return widget.builder(c, snap.data, reload);
        },
      );
}

Widget pill(String text, Color color) => Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2), decoration: BoxDecoration(color: color.withOpacity(.12), borderRadius: BorderRadius.circular(20)),
    child: Text(text, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w700)));
Color statusColor(String st) => switch (st) { 'present' || 'paid' || 'active' => leaf, 'late' || 'pending' => const Color(0xFFC77700), 'absent' => flame, _ => Colors.blueGrey };
void toast(BuildContext c, String m) => ScaffoldMessenger.of(c).showSnackBar(SnackBar(content: Text(m)));

// ---------- overview (owner) ----------
class OverviewPage extends StatelessWidget {
  const OverviewPage({super.key});
  @override
  Widget build(BuildContext context) => Load(
        fetch: () => Api.get('/api/reports/overview'),
        builder: (c, d, reload) {
          final k = d['counts'], m = d['thisMonth'], a = d['attendance'] ?? {};
          Widget tile(String t, String v, IconData i, Color col) => Expanded(child: Card(child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Icon(i, color: col), const SizedBox(height: 8), Text(v, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)), Text(t, style: const TextStyle(color: Colors.black54, fontSize: 12))]))));
          return RefreshIndicator(onRefresh: () async => reload(), child: ListView(padding: const EdgeInsets.all(16), children: [
            Row(children: [tile('Active students', '${k['students']}', Icons.groups, brand), const SizedBox(width: 12), tile('Staff', '${k['staff']}', Icons.sports, leaf)]),
            const SizedBox(height: 12),
            Row(children: [tile('Income this month', inr(m['income']), Icons.trending_up, leaf), const SizedBox(width: 12), tile('Expenses', inr(m['expense']), Icons.trending_down, flame)]),
            const SizedBox(height: 12),
            Row(children: [tile('Pending fees', inr(d['pendingFees']['total']), Icons.receipt_long, const Color(0xFFC77700)), const SizedBox(width: 12), tile('Overdue', inr(d['pendingFees']['overdue']), Icons.warning_amber, flame)]),
            const SizedBox(height: 16),
            Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Attendance this month', style: TextStyle(fontWeight: FontWeight.w700)), const SizedBox(height: 8),
              Wrap(spacing: 8, children: [pill('${a['present'] ?? 0} present', leaf), pill('${a['late'] ?? 0} late', const Color(0xFFC77700)), pill('${a['absent'] ?? 0} absent', flame)])]))),
            const SizedBox(height: 12),
            Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Students by sport', style: TextStyle(fontWeight: FontWeight.w700)), const SizedBox(height: 8),
              for (final r in d['bySport']) Padding(padding: const EdgeInsets.symmetric(vertical: 3), child: Row(children: [Expanded(child: Text(r['sport'])), Text('${r['students']}', style: const TextStyle(fontWeight: FontWeight.w700))]))]))),
          ]));
        },
      );
}

// ---------- students ----------
class StudentsPage extends StatefulWidget {
  const StudentsPage({super.key});
  @override
  State<StudentsPage> createState() => _StudentsPageState();
}

class _StudentsPageState extends State<StudentsPage> {
  String q = '';
  @override
  Widget build(BuildContext context) => Column(children: [
        Padding(padding: const EdgeInsets.fromLTRB(16, 12, 16, 4), child: TextField(decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Search name or admission no.'), onChanged: (v) => setState(() => q = v))),
        Expanded(child: Load(
          key: ValueKey(q),
          fetch: () => Api.get('/api/students?q=${Uri.encodeQueryComponent(q)}'),
          builder: (c, d, reload) {
            final rows = d['students'] as List;
            if (rows.isEmpty) return const Center(child: Text('No students found'));
            return RefreshIndicator(onRefresh: () async => reload(), child: ListView.separated(
              padding: const EdgeInsets.all(16), itemCount: rows.length + 1, separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (c, i) {
                if (i == 0) return Align(alignment: Alignment.centerRight, child: TextButton.icon(icon: const Icon(Icons.picture_as_pdf), label: const Text('Share PDF'),
                    onPressed: () => sharePdf(title: 'Student list', head: ['Admission', 'Name', 'Sports', 'Parent', 'Phone'], filename: 'students.pdf',
                        rows: [for (final r in rows) [s(r['admission_no']), s(r['name']), s(r['sports']), s(r['parent_name']), s(r['parent_phone'])]])));
                final r = rows[i - 1];
                return Card(child: ListTile(
                  leading: CircleAvatar(backgroundColor: brand.withOpacity(.1), child: Text('${r['name']}'.substring(0, 1), style: const TextStyle(color: brand, fontWeight: FontWeight.w800))),
                  title: Text(r['name'], style: const TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: Text('${r['admission_no']} · ${s(r['sports'])}'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => Navigator.push(c, MaterialPageRoute(builder: (_) => Scaffold(appBar: AppBar(title: Text(r['name'])), body: StudentView(fetch: () => Api.get('/api/students/${r['id']}'))))),
                ));
              },
            ));
          },
        )),
      ]);
}

class PassportPage extends StatelessWidget {
  const PassportPage({super.key});
  @override
  Widget build(BuildContext context) => StudentView(fetch: () => Api.get('/api/me/student'));
}

class StudentView extends StatelessWidget {
  final Future<dynamic> Function() fetch;
  const StudentView({super.key, required this.fetch});
  @override
  Widget build(BuildContext context) => Load(fetch: fetch, builder: (c, d, reload) {
        final st = d['student'];
        if (st == null) return const Center(child: Text('Not found'));
        final sum = d['attendanceSummary'];
        Widget row(String k, dynamic v) => Padding(padding: const EdgeInsets.symmetric(vertical: 5), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              SizedBox(width: 130, child: Text(k, style: const TextStyle(color: Colors.black54))), Expanded(child: Text(s(v)))]));
        Widget section(String t, List<Widget> kids) => Padding(padding: const EdgeInsets.only(bottom: 12), child: Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(t, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)), const SizedBox(height: 6), ...kids]))));
        return RefreshIndicator(onRefresh: () async => reload(), child: ListView(padding: const EdgeInsets.all(16), children: [
          Container(padding: const EdgeInsets.all(20), decoration: BoxDecoration(color: brand, borderRadius: BorderRadius.circular(20)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(st['name'], style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800)),
            Text('${st['admission_no']}', style: const TextStyle(color: Colors.white70)), const SizedBox(height: 12),
            Wrap(spacing: 8, children: [pill('${sum['present']} present', Colors.white), pill('${sum['late']} late', Colors.white), pill('${sum['absent']} absent', Colors.white)])])),
          const SizedBox(height: 12),
          section('Personal', [row('Date of birth', st['dob']), row('Birthplace', st['birthplace']), row('Address', st['address']), row('School', st['school']), row('Studying', st['studying'])]),
          section('Parent / guardian', [row('Name', st['parent_name']), row('Phone', st['parent_phone']), row('Email', st['parent_email'])]),
          section('Sports', [for (final e in d['enrollments']) row(e['sport'], 'Coach: ${s(e['staff_name'])}'), if ((d['enrollments'] as List).isEmpty) const Text('Not enrolled yet')]),
          if (d['canSeeMedical'] == true) MedicalCard(studentId: st['id'], data: d['medical'], onSaved: reload),
          section('Recent attendance', [for (final a in (d['attendance'] as List).take(10)) Padding(padding: const EdgeInsets.symmetric(vertical: 3), child: Row(children: [Expanded(child: Text(a['att_date'])), pill(a['status'], statusColor(a['status']))]))]),
          if ((d['achievements'] as List).isNotEmpty) section('Achievements', [for (final a in d['achievements']) row(s(a['event_date']), '${a['title']} ${s(a['position'])}')]),
        ]));
      });
}

class MedicalCard extends StatefulWidget {
  final int studentId;
  final Map? data;
  final VoidCallback onSaved;
  const MedicalCard({super.key, required this.studentId, required this.data, required this.onSaved});
  @override
  State<MedicalCard> createState() => _MedicalCardState();
}

class _MedicalCardState extends State<MedicalCard> {
  late Map<String, dynamic> v = Map<String, dynamic>.from(widget.data ?? {});
  final ctl = <String, TextEditingController>{};
  bool busy = false;
  static const flags = [
    ['takes_medicine', 'medicine_details', 'Takes regular medicine'], ['has_allergy', 'allergy_details', 'Has any allergy'],
    ['had_surgery', 'surgery_details', 'Has undergone surgery'], ['bone_damage', 'bone_details', 'Has any bone damage'],
  ];
  TextEditingController t(String k) => ctl.putIfAbsent(k, () => TextEditingController(text: v[k]?.toString() ?? ''));
  bool on(String k) => v[k] == 1 || v[k] == true;

  Future<void> save() async {
    setState(() => busy = true);
    final body = <String, dynamic>{for (final f in flags) f[0]: on(f[0]) ? 1 : 0};
    for (final k in ['medicine_details', 'allergy_details', 'surgery_details', 'bone_details', 'other_issues', 'blood_group', 'emergency_contact']) { body[k] = t(k).text; }
    try { await Api.put('/api/students/${widget.studentId}/medical', body); if (mounted) toast(context, 'Medical info saved'); widget.onSaved(); } catch (e) { if (mounted) toast(context, '$e'); }
    if (mounted) setState(() => busy = false);
  }

  @override
  Widget build(BuildContext context) => Padding(padding: const EdgeInsets.only(bottom: 12), child: Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: const [Icon(Icons.medical_services_outlined, size: 20), SizedBox(width: 8), Text('Medical information', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15))]),
        const Text('Private to the owner and the student.', style: TextStyle(color: Colors.black54, fontSize: 12)),
        for (final f in flags) ...[
          SwitchListTile(contentPadding: EdgeInsets.zero, title: Text(f[2]), value: on(f[0]), onChanged: (x) => setState(() => v[f[0]] = x ? 1 : 0)),
          if (on(f[0])) TextField(controller: t(f[1]), maxLines: 2, decoration: const InputDecoration(hintText: 'Details')),
        ],
        const SizedBox(height: 8),
        TextField(controller: t('other_issues'), maxLines: 2, decoration: const InputDecoration(labelText: 'Other health issues')),
        const SizedBox(height: 8),
        Row(children: [Expanded(child: TextField(controller: t('blood_group'), decoration: const InputDecoration(labelText: 'Blood group'))), const SizedBox(width: 8), Expanded(child: TextField(controller: t('emergency_contact'), decoration: const InputDecoration(labelText: 'Emergency contact')))]),
        const SizedBox(height: 12),
        FilledButton(onPressed: busy ? null : save, child: const Text('Save medical info')),
      ]))));
}

// ---------- attendance ----------
class AttendancePage extends StatefulWidget {
  const AttendancePage({super.key});
  @override
  State<AttendancePage> createState() => _AttendancePageState();
}

class _AttendancePageState extends State<AttendancePage> {
  DateTime day = DateTime.now();
  String get ds => '${day.year}-${day.month.toString().padLeft(2, '0')}-${day.day.toString().padLeft(2, '0')}';
  @override
  Widget build(BuildContext context) => Load(
        key: ValueKey(ds),
        fetch: () => Api.get('/api/attendance?date=$ds'),
        builder: (c, d, reload) {
          final rows = d['attendance'] as List;
          int n(String x) => rows.where((r) => r['status'] == x).length;
          return Column(children: [
            Padding(padding: const EdgeInsets.fromLTRB(16, 12, 16, 4), child: Row(children: [
              OutlinedButton.icon(icon: const Icon(Icons.calendar_today, size: 16), label: Text(ds), onPressed: () async {
                final p = await showDatePicker(context: c, initialDate: day, firstDate: DateTime(2024), lastDate: DateTime.now());
                if (p != null) setState(() => day = p);
              }),
              const Spacer(),
              IconButton(tooltip: 'Share PDF', icon: const Icon(Icons.share), onPressed: () => sharePdf(title: 'Attendance $ds', subtitle: '${n('present')} present, ${n('late')} late, ${n('absent')} absent',
                  head: ['Admission', 'Student', 'Batch', 'Check-in', 'Status'], filename: 'attendance-$ds.pdf',
                  rows: [for (final r in rows) [s(r['admission_no']), s(r['name']), s(r['batch_time']), s(r['check_in']), s(r['status'])]])),
            ])),
            Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: Wrap(spacing: 8, children: [pill('${n('present')} present', leaf), pill('${n('late')} late', const Color(0xFFC77700)), pill('${n('absent')} absent', flame), pill('${n('pending')} not in', Colors.blueGrey)])),
            Expanded(child: RefreshIndicator(onRefresh: () async => reload(), child: ListView.builder(padding: const EdgeInsets.all(16), itemCount: rows.length, itemBuilder: (c, i) {
              final r = rows[i];
              final today = ds == '${DateTime.now().year}-${DateTime.now().month.toString().padLeft(2, '0')}-${DateTime.now().day.toString().padLeft(2, '0')}';
              return Card(child: ListTile(
                title: Text(r['name'], style: const TextStyle(fontWeight: FontWeight.w600)), subtitle: Text('${r['admission_no']} · ${s(r['batch_time'])} · in ${s(r['check_in'])}'),
                trailing: (today && r['status'] == 'pending')
                    ? Row(mainAxisSize: MainAxisSize.min, children: [
                        IconButton(icon: const Icon(Icons.check_circle, color: leaf), onPressed: () async { await Api.post('/api/attendance/manual', {'student_id': r['student_id'], 'status': 'present'}); reload(); }),
                        IconButton(icon: const Icon(Icons.cancel, color: flame), onPressed: () async { await Api.post('/api/attendance/manual', {'student_id': r['student_id'], 'status': 'absent'}); reload(); }),
                      ])
                    : pill(r['status'], statusColor(r['status'])),
              ));
            }))),
          ]);
        },
      );
}

// ---------- fees ----------
class FeesPage extends StatelessWidget {
  const FeesPage({super.key});
  @override
  Widget build(BuildContext context) => Load(
        fetch: () => Api.get(Api.role == 'student' ? '/api/me/student' : '/api/fees'),
        builder: (c, d, reload) {
          final fees = (d['fees'] as List);
          if (fees.isEmpty) return const Center(child: Text('No bills yet'));
          return RefreshIndicator(onRefresh: () async => reload(), child: ListView.builder(padding: const EdgeInsets.all(16), itemCount: fees.length + 1, itemBuilder: (c, i) {
            if (i == 0) return Align(alignment: Alignment.centerRight, child: TextButton.icon(icon: const Icon(Icons.picture_as_pdf), label: const Text('Share PDF'),
                onPressed: () => sharePdf(title: 'Fees', head: ['Student', 'Description', 'Due', 'Amount', 'Status'], filename: 'fees.pdf',
                    rows: [for (final f in fees) [s(f['student'] ?? st(d)), s(f['description']), s(f['due_date']), inr(f['amount']), s(f['status'])]])));
            final f = fees[i - 1];
            return Padding(padding: const EdgeInsets.only(bottom: 8), child: Card(child: ListTile(
              title: Text(s(f['description']), style: const TextStyle(fontWeight: FontWeight.w600)),
              subtitle: Text('${f['student'] != null ? '${f['student']} · ' : ''}Due ${f['due_date']}'),
              trailing: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [Text(inr(f['amount']), style: const TextStyle(fontWeight: FontWeight.w800)), pill(f['status'], statusColor(f['status']))]),
            )));
          }));
        },
      );
  String st(dynamic d) => d['student'] is Map ? '${d['student']['name']}' : '';
}

// ---------- notifications ----------
class NotificationsPage extends StatelessWidget {
  const NotificationsPage({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Notifications')),
        floatingActionButton: Api.role == 'owner' ? FloatingActionButton.extended(onPressed: () => _announce(context), icon: const Icon(Icons.campaign), label: const Text('Announce')) : null,
        body: Load(
          fetch: () async { final r = await Api.get('/api/notifications'); await Notify.markSeen(); return r; },
          builder: (c, d, reload) {
            final rows = d['notifications'] as List;
            if (rows.isEmpty) return const Center(child: Text('No notifications yet'));
            return ListView.separated(padding: const EdgeInsets.all(16), itemCount: rows.length, separatorBuilder: (_, __) => const SizedBox(height: 8), itemBuilder: (c, i) {
              final n = rows[i];
              return Card(child: ListTile(leading: const CircleAvatar(child: Icon(Icons.notifications)), title: Text(s(n['title']), style: const TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: Text('${s(n['body'])}\n${s(n['created_at'])}${n['student'] != null ? ' · ${n['student']}' : ''}'), isThreeLine: true));
            });
          },
        ),
      );

  void _announce(BuildContext context) {
    final t = TextEditingController(), b = TextEditingController();
    showDialog(context: context, builder: (c) => AlertDialog(
      title: const Text('Announce to all parents'),
      content: Column(mainAxisSize: MainAxisSize.min, children: [TextField(controller: t, decoration: const InputDecoration(labelText: 'Title')), const SizedBox(height: 8), TextField(controller: b, maxLines: 3, decoration: const InputDecoration(labelText: 'Message'))]),
      actions: [TextButton(onPressed: () => Navigator.pop(c), child: const Text('Cancel')), FilledButton(onPressed: () async {
        try { final r = await Api.post('/api/notifications/broadcast', {'title': t.text, 'body': b.text}); if (c.mounted) Navigator.pop(c); if (context.mounted) toast(context, 'Sent to ${r['sent']} parents'); } catch (e) { if (c.mounted) toast(c, '$e'); }
      }, child: const Text('Send'))],
    ));
  }
}

// ---------- more (owner) ----------
class MorePage extends StatelessWidget {
  final VoidCallback onSignOut;
  const MorePage({super.key, required this.onSignOut});
  @override
  Widget build(BuildContext context) {
    Widget item(IconData i, String t, String sub, Widget page) => Card(child: ListTile(leading: Icon(i, color: brand), title: Text(t, style: const TextStyle(fontWeight: FontWeight.w600)), subtitle: Text(sub), trailing: const Icon(Icons.chevron_right),
        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => page))));
    return ListView(padding: const EdgeInsets.all(16), children: [
      item(Icons.how_to_reg_outlined, 'Approvals', 'New students and coaches waiting', const ApprovalsPage()), const SizedBox(height: 8),
      item(Icons.inventory_2_outlined, 'Equipment shop', 'Stock by sport', const EquipmentPage()), const SizedBox(height: 8),
      item(Icons.lock_outline, 'Account', 'Password and sign out', Scaffold(appBar: AppBar(title: const Text('Account')), body: AccountPage(onSignOut: onSignOut))),
    ]);
  }
}

class ApprovalsPage extends StatelessWidget {
  const ApprovalsPage({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: const Text('Approvals')), body: Load(
        fetch: () => Api.get('/api/signups'),
        builder: (c, d, reload) {
          final rows = d['signups'] as List;
          if (rows.isEmpty) return const Center(child: Text('Nothing waiting for approval'));
          return ListView.separated(padding: const EdgeInsets.all(16), itemCount: rows.length, separatorBuilder: (_, __) => const SizedBox(height: 8), itemBuilder: (c, i) {
            final r = rows[i];
            return Card(child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [Expanded(child: Text(r['name'], style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16))), pill(r['role'], brand)]),
              Text('${s(r['email'])} · ${s(r['phone'])}', style: const TextStyle(color: Colors.black54)),
              const SizedBox(height: 8),
              Row(children: [
                Expanded(child: FilledButton(style: FilledButton.styleFrom(backgroundColor: leaf, minimumSize: const Size.fromHeight(42)), onPressed: () async { await Api.post('/api/signups/${r['user_id']}/approve'); reload(); }, child: const Text('Approve'))),
                const SizedBox(width: 8),
                Expanded(child: OutlinedButton(onPressed: () async { await Api.delete('/api/signups/${r['user_id']}'); reload(); }, child: const Text('Reject'))),
              ]),
            ])));
          });
        },
      ));
}

// ---------- equipment grouped by sport ----------
class EquipmentPage extends StatelessWidget {
  const EquipmentPage({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: const Text('Equipment shop')), body: Load(
        fetch: () => Api.get('/api/equipment'),
        builder: (c, d, reload) {
          final items = (d['equipment'] as List);
          final groups = <String, List>{};
          for (final e in items) { (groups[e['sport'] ?? 'General'] ??= []).add(e); }
          if (groups.isEmpty) return const Center(child: Text('No equipment yet'));
          return DefaultTabController(length: groups.length, child: Column(children: [
            TabBar(isScrollable: true, tabs: [for (final g in groups.keys) Tab(text: g)]),
            Expanded(child: TabBarView(children: [
              for (final g in groups.keys) ListView(padding: const EdgeInsets.all(16), children: [
                for (final e in groups[g]!) Padding(padding: const EdgeInsets.only(bottom: 8), child: Card(child: ListTile(
                  title: Text(e['name'], style: const TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: Text(Api.role == 'owner' ? 'Cost ${inr(e['cost_price'])} · Sale ${inr(e['sale_price'])}' : 'Reorder at ${e['reorder_level']}'),
                  trailing: pill('${e['qty']} in stock', e['qty'] <= e['reorder_level'] ? flame : leaf)))),
              ]),
            ])),
          ]));
        },
      ));
}

// ---------- account ----------
class AccountPage extends StatelessWidget {
  final VoidCallback onSignOut;
  const AccountPage({super.key, required this.onSignOut});
  @override
  Widget build(BuildContext context) => ListView(padding: const EdgeInsets.all(16), children: [
        Card(child: ListTile(leading: CircleAvatar(backgroundColor: brand, child: Text('${Api.me?['name'] ?? '?'}'.substring(0, 1), style: const TextStyle(color: Colors.white))), title: Text('${Api.me?['name']}', style: const TextStyle(fontWeight: FontWeight.w700)), subtitle: Text('${Api.role}'.toUpperCase()))),
        const SizedBox(height: 8),
        Card(child: ListTile(leading: const Icon(Icons.key), title: const Text('Change password'), onTap: () => _pw(context))),
        const SizedBox(height: 8),
        Card(child: ListTile(leading: const Icon(Icons.notifications_active_outlined), title: const Text('Notification permission'), subtitle: const Text('Allow alerts on this phone'), onTap: () async { await SharedPrefsReset.reset(); if (context.mounted) await Notify.askPermission(context); })),
        const SizedBox(height: 8),
        Card(child: ListTile(leading: const Icon(Icons.logout, color: flame), title: const Text('Sign out'), onTap: onSignOut)),
        const SizedBox(height: 16),
        const Center(child: Text('Global Sports Academy · 9042999507', style: TextStyle(color: Colors.black45, fontSize: 12))),
      ]);

  void _pw(BuildContext context) {
    final a = TextEditingController(), b = TextEditingController();
    showDialog(context: context, builder: (c) => AlertDialog(
      title: const Text('Change password'),
      content: Column(mainAxisSize: MainAxisSize.min, children: [TextField(controller: a, obscureText: true, decoration: const InputDecoration(labelText: 'Current password')), const SizedBox(height: 8), TextField(controller: b, obscureText: true, decoration: const InputDecoration(labelText: 'New password (8+)'))]),
      actions: [TextButton(onPressed: () => Navigator.pop(c), child: const Text('Cancel')), FilledButton(onPressed: () async {
        try { await Api.post('/auth/change-password', {'current': a.text, 'next': b.text}); if (c.mounted) Navigator.pop(c); if (context.mounted) toast(context, 'Password changed'); } catch (e) { if (c.mounted) toast(c, '$e'); }
      }, child: const Text('Save'))],
    ));
  }
}

class SharedPrefsReset {
  static Future<void> reset() async => Notify.resetAsked();
}
