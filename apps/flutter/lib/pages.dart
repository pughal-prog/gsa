import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'motion.dart';
import 'api.dart';
import 'common.dart';
import 'equipment.dart';
import 'export.dart';
import 'fees.dart';
import 'main.dart';
import 'notify.dart';
import 'staff.dart';

// ---------- overview (owner) ----------
class OverviewPage extends StatelessWidget {
  const OverviewPage({super.key});
  @override
  Widget build(BuildContext context) => Load(
        fetch: () => Api.get('/api/reports/overview'),
        builder: (c, d, reload) {
          final k = d['counts'], m = d['thisMonth'], a = d['attendance'] ?? {};
          num nv(dynamic x) => x is num ? x : num.tryParse('$x') ?? 0;
          var n = 1;
          Widget tile(String t, num v, IconData i, Color col, {bool money = false}) => Expanded(child: Reveal(index: n++, child: Card(child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Icon(i, color: col), const SizedBox(height: 8), CountUp(v, format: money ? inr : (x) => x.round().toString(), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)), Text(t, style: const TextStyle(color: Colors.black54, fontSize: 12))])))));
          return RefreshIndicator(onRefresh: () async => reload(), child: ListView(padding: const EdgeInsets.all(16), children: [
            Reveal(child: Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(borderRadius: BorderRadius.circular(22), gradient: const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFF04152B), Color(0xFF0A3D7A)])),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('Income this month', style: TextStyle(color: Colors.white70, fontSize: 13)),
                const SizedBox(height: 6),
                CountUp(nv(m['income']), format: inr, style: const TextStyle(color: Colors.white, fontSize: 34, fontWeight: FontWeight.w800, letterSpacing: -.5)),
                const SizedBox(height: 14),
                Row(children: [
                  Expanded(child: Text('Expenses ${inr(nv(m['expense']))}', style: const TextStyle(color: Colors.white70, fontSize: 13))),
                  Container(width: 8, height: 8, decoration: const BoxDecoration(color: Color(0xFFF5B82E), shape: BoxShape.circle)),
                  const SizedBox(width: 6),
                  Text('${nv(k['students']).round()} active students', style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600)),
                ]),
              ]),
            )),
            const SizedBox(height: 12),
            Row(children: [tile('Active students', nv(k['students']), Icons.groups, brand), const SizedBox(width: 12), tile('Staff', nv(k['staff']), Icons.sports, leaf)]),
            const SizedBox(height: 12),
            Row(children: [tile('Income this month', nv(m['income']), Icons.trending_up, leaf, money: true), const SizedBox(width: 12), tile('Expenses', nv(m['expense']), Icons.trending_down, flame, money: true)]),
            const SizedBox(height: 12),
            Row(children: [tile('Pending fees', nv(d['pendingFees']['total']), Icons.receipt_long, const Color(0xFFC77700), money: true), const SizedBox(width: 12), tile('Overdue', nv(d['pendingFees']['overdue']), Icons.warning_amber, flame, money: true)]),
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
              IconButton(tooltip: 'PDF / Excel', icon: const Icon(Icons.ios_share), onPressed: () => exportData(c, title: 'Attendance $ds', subtitle: '${n('present')} present, ${n('late')} late, ${n('absent')} absent',
                  head: ['Admission', 'Student', 'Batch', 'Check-in', 'Status'], filename: 'attendance-$ds',
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

// ---------- notifications ----------
class NotificationsPage extends StatefulWidget {
  const NotificationsPage({super.key});
  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> {
  int refresh = 0;
  bool get owner => Api.role == 'owner';

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Notifications')),
        floatingActionButton: owner ? FloatingActionButton.extended(onPressed: _announce, icon: const Icon(Icons.campaign), label: const Text('Announce')) : null,
        body: Load(
          key: ValueKey(refresh),
          fetch: () async { final r = await Api.get('/api/notifications'); await Notify.markSeen(); return r; },
          builder: (c, d, reload) {
            final rows = L(d['notifications']);
            if (rows.isEmpty) return const Center(child: Text('No notifications yet'));
            return ListView.separated(padding: const EdgeInsets.fromLTRB(16, 8, 16, 90), itemCount: rows.length + 1, separatorBuilder: (_, __) => const SizedBox(height: 8), itemBuilder: (c, i) {
              if (i == 0) {
                return Align(alignment: Alignment.centerRight, child: TextButton.icon(icon: const Icon(Icons.ios_share, size: 18), label: const Text('PDF / Excel'), onPressed: () => exportData(c, title: 'Notifications', filename: 'notifications',
                    head: ['When', 'To', 'Title', 'Message'], rows: [for (final n in rows) [s(n['created_at']), n['recipients'] != null && n['recipients'] > 1 ? 'All parents (${n['recipients']})' : s(n['student']), s(n['title']), s(n['body'])]])));
              }
              final n = rows[i - 1];
              final group = n['recipients'] != null && n['recipients'] > 1;
              return Card(child: ListTile(
                leading: CircleAvatar(backgroundColor: brand, child: Icon(group ? Icons.campaign : Icons.notifications, color: Colors.white, size: 20)),
                title: Text(s(n['title']), style: const TextStyle(fontWeight: FontWeight.w600)),
                subtitle: Text('${s(n['body'])}\n${s(n['created_at'])}${group ? ' · to ${n['recipients']} parents' : n['student'] != null ? ' · ${n['student']}' : ''}'),
                isThreeLine: true,
                trailing: owner ? IconButton(tooltip: 'Delete', icon: const Icon(Icons.delete_outline, color: flame), onPressed: () async {
                  if (await confirm(c, group ? 'Delete this announcement for all ${n['recipients']} recipients?' : 'Delete this notification?') && c.mounted && await attempt(c, () => Api.delete('/api/notifications/${n['batch'] ?? n['id']}'), ok: 'Deleted')) setState(() => refresh++);
                }) : null,
              ));
            });
          },
        ),
      );

  Future<void> _announce() async {
    final v = await formDialog(context, 'Announce to all parents', const [F('title', 'Title', required: true), F('body', 'Message', type: 'multiline', required: true)], submit: 'Send');
    if (v == null || !mounted) return;
    if (await attempt(context, () async { final r = await Api.post('/api/notifications/broadcast', v); if (mounted) toast(context, 'Sent to ${r['sent']} parents'); })) setState(() => refresh++);
  }
}

// ---------- more (owner) ----------
class MorePage extends StatelessWidget {
  final VoidCallback onSignOut;
  const MorePage({super.key, required this.onSignOut});
  @override
  Widget build(BuildContext context) {
    Widget item(IconData i, String t, String sub, Widget page) => Padding(padding: const EdgeInsets.only(bottom: 8), child: Card(child: ListTile(leading: Icon(i, color: flame), title: Text(t, style: const TextStyle(fontWeight: FontWeight.w600)), subtitle: Text(sub), trailing: const Icon(Icons.chevron_right),
        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => page)))));
    return ListView(padding: const EdgeInsets.all(16), children: [
      item(Icons.how_to_reg_outlined, 'Approvals', 'New students and coaches waiting', const ApprovalsPage()),
      item(Icons.inbox_outlined, 'Trial enquiries', 'Requests from the website, call or WhatsApp them', const EnquiriesPage()),
      item(Icons.sports_outlined, 'Staff', 'Coaches, their students and permissions', const StaffPage()),
      item(Icons.inventory_2_outlined, 'Equipment shop', 'Stock by section, add items and stock', const EquipmentPage()),
      item(Icons.receipt_long_outlined, 'Fees and fee structure', 'Plans, bills and payments', Scaffold(appBar: AppBar(title: const Text('Fees')), body: const FeesPage())),
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

// ---------- trial enquiries from the website (owner) ----------
class EnquiriesPage extends StatefulWidget {
  const EnquiriesPage({super.key});
  @override
  State<EnquiriesPage> createState() => _EnquiriesPageState();
}

class _EnquiriesPageState extends State<EnquiriesPage> {
  int refresh = 0;
  static const statuses = ['new', 'contacted', 'joined', 'closed'];

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Trial enquiries')),
        body: Load(
          key: ValueKey(refresh),
          fetch: () => Api.get('/api/site/enquiries'),
          builder: (c, d, reload) {
            final rows = L(d['enquiries']);
            if (rows.isEmpty) return const Center(child: Padding(padding: EdgeInsets.all(24), child: Text('No trial requests yet. Requests from the website form appear here.', textAlign: TextAlign.center)));
            return RefreshIndicator(onRefresh: () async => setState(() => refresh++), child: ListView.separated(
              padding: const EdgeInsets.all(16), itemCount: rows.length, separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (c, i) {
                final e = rows[i];
                final st = '${e['status']}';
                Widget swipeBg(Color c, IconData i, String t, Alignment al) => Container(
                    alignment: al, padding: const EdgeInsets.symmetric(horizontal: 22),
                    decoration: BoxDecoration(color: c, borderRadius: BorderRadius.circular(16)),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [Icon(i, color: Colors.white), const SizedBox(width: 8), Text(t, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700))]));
                return Reveal(index: i, child: Dismissible(
                  key: ValueKey('enq-${e['id']}-$st'),
                  background: swipeBg(leaf, Icons.phone_in_talk, 'Contacted', Alignment.centerLeft),
                  secondaryBackground: swipeBg(const Color(0xFF5D6B86), Icons.check, 'Close', Alignment.centerRight),
                  confirmDismiss: (dir) async {
                    final to = dir == DismissDirection.startToEnd ? 'contacted' : 'closed';
                    HapticFeedback.mediumImpact();
                    if (to != st && c.mounted && await attempt(c, () => Api.send('PATCH', '/api/site/enquiries/${e['id']}', {'status': to}), ok: 'Marked as $to')) setState(() => refresh++);
                    return false;
                  },
                  child: Card(child: ListTile(
                  title: Row(children: [Expanded(child: Text('${e['name']}', style: const TextStyle(fontWeight: FontWeight.w700))), pill(st, st == 'new' ? flame : statusColor(st == 'joined' ? 'paid' : 'pending'))]),
                  subtitle: Padding(padding: const EdgeInsets.only(top: 4), child: SelectableText([ '${e['phone']}', if (e['sport'] != null) '${e['sport']}', if (e['child_age'] != null) 'age ${e['child_age']}', '${e['created_at']}'.substring(0, 10), if (e['message'] != null) '${e['message']}' ].join('  |  '))),
                  isThreeLine: e['message'] != null,
                  trailing: const Icon(Icons.edit_outlined, size: 20),
                  onTap: () async {
                    final pick = await showModalBottomSheet<String>(context: c, showDragHandle: true, builder: (x) => SafeArea(child: Column(mainAxisSize: MainAxisSize.min, children: [
                      Padding(padding: const EdgeInsets.all(8), child: Text('Mark ${e['name']} as', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16))),
                      for (final s2 in statuses) ListTile(title: Text(s2[0].toUpperCase() + s2.substring(1)), trailing: s2 == st ? const Icon(Icons.check) : null, onTap: () => Navigator.pop(x, s2)),
                    ])));
                    if (pick == null || pick == st || !c.mounted) return;
                    if (await attempt(c, () => Api.send('PATCH', '/api/site/enquiries/${e['id']}', {'status': pick}), ok: 'Updated')) setState(() => refresh++);
                  },
                ))));
              },
            ));
          },
        ),
      );
}
