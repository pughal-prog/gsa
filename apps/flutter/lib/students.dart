import 'package:flutter/material.dart';
import 'api.dart';
import 'common.dart';
import 'export.dart';
import 'main.dart';

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
            final rows = L(d['students']);
            return RefreshIndicator(onRefresh: () async => reload(), child: ListView.separated(
              padding: const EdgeInsets.all(16), itemCount: rows.length + 1, separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (c, i) {
                if (i == 0) {
                  return Row(children: [
                    Text('${rows.length} students', style: const TextStyle(color: Colors.black54)), const Spacer(),
                    TextButton.icon(icon: const Icon(Icons.ios_share, size: 18), label: const Text('PDF / Excel'), onPressed: () => exportData(c, title: 'Student list', filename: 'students',
                        head: ['Admission', 'Name', 'Sports', 'Parent', 'Phone', 'Pending fees'],
                        rows: [for (final r in rows) [s(r['admission_no']), s(r['name']), s(r['sports']), s(r['parent_name']), s(r['parent_phone']), inr(r['pending_fees'])]])),
                  ]);
                }
                final r = rows[i - 1];
                return Card(child: ListTile(
                  leading: CircleAvatar(backgroundColor: brand, child: Text('${r['name']}'.isEmpty ? '?' : '${r['name']}'.substring(0, 1), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800))),
                  title: Text('${r['name']}', style: const TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: Text('${r['admission_no']} · ${s(r['sports'])}'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () async { await Navigator.push(c, MaterialPageRoute(builder: (_) => StudentScreen(id: r['id'] as int, name: '${r['name']}'))); reload(); },
                ));
              },
            ));
          },
        )),
      ]);
}

class StudentScreen extends StatelessWidget {
  final int id;
  final String name;
  const StudentScreen({super.key, required this.id, required this.name});
  @override
  Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: Text(name)), body: StudentView(fetch: () => Api.get('/api/students/$id')));
}

class PassportPage extends StatelessWidget {
  const PassportPage({super.key});
  @override
  Widget build(BuildContext context) => StudentView(fetch: () => Api.get('/api/me/student'));
}

class StudentView extends StatefulWidget {
  final Future<dynamic> Function() fetch;
  const StudentView({super.key, required this.fetch});
  @override
  State<StudentView> createState() => _StudentViewState();
}

class _StudentViewState extends State<StudentView> {
  int tab = 0;
  static const tabNames = ['Profile', 'Sports', 'Achievements', 'Attendance', 'Fees', 'Medical'];

  @override
  Widget build(BuildContext context) => Load(
        fetch: widget.fetch,
        builder: (c, d, reload) {
          final st = M(d['student']);
          if (st.isEmpty) return const Center(child: Text('Student not found'));
          final sum = M(d['attendanceSummary']);
          final canEdit = Api.can('students.edit');
          final canAch = Api.can('achievements.edit');
          final showMed = d['canSeeMedical'] == true;
          final tabs = [for (final t in tabNames) if (t != 'Medical' || showMed) t];
          if (tab >= tabs.length) tab = 0;
          final cur = tabs[tab];
          Widget body;
          switch (cur) {
            case 'Profile':
              body = Column(children: [
                section('Personal', [kv('Date of birth', st['dob']), kv('Birthplace', st['birthplace']), kv('Identification mark', st['identification_mark']), kv('Address', st['address']), kv('Joined on', st['joined_on']), kv('Batch time', st['batch_time']), kv('Biometric ID', st['biometric_id'])]),
                section('Parent / guardian', [kv('Name', st['parent_name']), kv('Phone', st['parent_phone']), kv('Email', st['parent_email']), kv('Occupation', st['parent_occupation'])]),
                section('School / college', [kv('School', st['school']), kv('College', st['college']), kv('Class / year', st['academic_year']), kv('Studying', st['studying'])]),
                if (s(st['remarks']) != '-') section('Remarks', [Text(s(st['remarks']))]),
              ]);
            case 'Sports':
              body = Column(children: [
                section('Enrolled sports', [
                  for (final e in L(d['enrollments'])) ListTile(contentPadding: EdgeInsets.zero, title: Text('${e['sport']}', style: const TextStyle(fontWeight: FontWeight.w700)), subtitle: Text('Coach: ${s(e['staff_name'])} · Level: ${s(e['level'])} · ${s(e['category'])}')),
                  if (L(d['enrollments']).isEmpty) const Text('Not enrolled in any sport yet'),
                ], action: canEdit ? TextButton.icon(onPressed: () => _enroll(c, st['id'] as int, reload), icon: const Icon(Icons.add), label: const Text('Enrol')) : null),
                if (L(d['matches']).isNotEmpty) section('Matches', [for (final m in L(d['matches'])) kv(s(m['event_date']), '${m['event']} · ${s(m['category'])} ${s(m['age_category'])} · ${s(m['result'])}')]),
              ]);
            case 'Achievements':
              body = Column(children: [
                section('Achievements', [
                  for (final a in L(d['achievements'])) ListTile(contentPadding: EdgeInsets.zero, leading: const Icon(Icons.emoji_events, color: flame),
                      title: Text('${a['title']}', style: const TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: Text('${s(a['sport'])} · ${s(a['event_date'])}'), trailing: Wrap(spacing: 4, children: [if (a['level'] != null) pill('${a['level']}', brand), if (a['age_category'] != null) pill('${a['age_category']}', leaf)])),
                  if (L(d['achievements']).isEmpty) const Text('No achievements yet'),
                ], action: canAch ? TextButton.icon(onPressed: () => _addAch(c, st['id'] as int, reload), icon: const Icon(Icons.add), label: const Text('Add')) : null),
                section('Matches attended', [
                  for (final m in L(d['matches'])) ListTile(contentPadding: EdgeInsets.zero, title: Text('${m['event']}'), subtitle: Text('${s(m['sport'])} · ${s(m['event_date'])} · ${s(m['result'])}'),
                      trailing: Wrap(spacing: 4, children: [if (m['category'] != null) pill('${m['category']}', brand), if (m['age_category'] != null) pill('${m['age_category']}', leaf)])),
                  if (L(d['matches']).isEmpty) const Text('No matches yet'),
                ], action: canAch ? TextButton.icon(onPressed: () => _addMatch(c, st['id'] as int, reload), icon: const Icon(Icons.add), label: const Text('Add')) : null),
              ]);
            case 'Attendance':
              body = section('Attendance (last 60 days)', [
                if (L(d['attendance']).isEmpty) const Text('No records yet'),
                for (final a in L(d['attendance'])) Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: Row(children: [Expanded(child: Text('${a['att_date']}  ${s(a['check_in'])}')), pill('${a['status']}', statusColor('${a['status']}'))])),
              ], action: IconButton(tooltip: 'PDF / Excel', icon: const Icon(Icons.ios_share, size: 20), onPressed: () => exportData(c, title: 'Attendance ${s(st['name'])}', filename: 'attendance-${st['admission_no']}', head: ['Date', 'Check-in', 'Status'], rows: [for (final a in L(d['attendance'])) [s(a['att_date']), s(a['check_in']), s(a['status'])]])));
            case 'Fees':
              body = Column(children: [
                if (Api.role == 'owner') section('Fee structure', [
                  for (final p in L(d['feePlans'])) kv('${p['sport']}: ${p['name']} (${p['period']})', '${inr(p['custom_amount'] ?? p['amount'])}${p['custom_amount'] != null ? ' custom' : ''}'),
                  if (L(d['feePlans']).isEmpty) const Text('No plan assigned. The sport default applies.'),
                ], action: TextButton.icon(onPressed: () => _assignPlans(c, st['id'] as int, L(d['feePlans']), reload), icon: const Icon(Icons.tune), label: const Text('Assign'))),
                section('Bills', [
                  if (L(d['fees']).isEmpty) const Text('No bills yet'),
                  for (final f in L(d['fees'])) ListTile(contentPadding: EdgeInsets.zero, title: Text('${f['description']}'), subtitle: Text('Due ${f['due_date']}'),
                      trailing: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [Text(inr(f['amount']), style: const TextStyle(fontWeight: FontWeight.w800)), pill('${f['status']}', statusColor('${f['status']}'))])),
                ]),
              ]);
            default:
              body = MedicalCard(studentId: st['id'] as int, data: d['medical'] is Map ? d['medical'] as Map : null, onSaved: reload);
          }
          return RefreshIndicator(onRefresh: () async => reload(), child: ListView(padding: const EdgeInsets.all(16), children: [
            Container(padding: const EdgeInsets.all(18), decoration: BoxDecoration(color: brand, borderRadius: BorderRadius.circular(12)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [Expanded(child: Text('${st['name']}', style: const TextStyle(color: Colors.white, fontSize: 21, fontWeight: FontWeight.w800))),
                if (canEdit) IconButton(tooltip: 'Edit student', icon: const Icon(Icons.edit, color: Colors.white), onPressed: () => _edit(c, st, reload))]),
              Text('${st['admission_no']} · ${s(st['status'])}', style: const TextStyle(color: Colors.white70)), const SizedBox(height: 10),
              Wrap(spacing: 8, children: [pill('${sum['present'] ?? 0} present', Colors.white), pill('${sum['late'] ?? 0} late', Colors.white), pill('${sum['absent'] ?? 0} absent', Colors.white)])])),
            const SizedBox(height: 12),
            SingleChildScrollView(scrollDirection: Axis.horizontal, child: Row(children: [
              for (var i = 0; i < tabs.length; i++) Padding(padding: const EdgeInsets.only(right: 8), child: ChoiceChip(label: Text(tabs[i]), selected: tab == i, onSelected: (_) => setState(() => tab = i), selectedColor: brand, labelStyle: TextStyle(color: tab == i ? Colors.white : null, fontWeight: FontWeight.w600), showCheckmark: false)),
            ])),
            const SizedBox(height: 12),
            body,
          ]));
        },
      );

  Future<void> _edit(BuildContext c, Map st, VoidCallback reload) async {
    final v = await formDialog(c, 'Edit student', const [
      F('name', 'Full name', required: true), F('dob', 'Date of birth', type: 'date'), F('birthplace', 'Birthplace'), F('identification_mark', 'Identification mark'), F('address', 'Address', type: 'multiline'),
      F('parent_name', 'Parent / guardian name'), F('parent_phone', 'Parent phone'), F('parent_email', 'Parent email'), F('parent_occupation', 'Parent occupation'), F('joined_on', 'Joined on', type: 'date'),
      F('school', 'School'), F('college', 'College'), F('academic_year', 'Class / year'), F('studying', 'Currently studying'), F('biometric_id', 'Biometric ID'), F('batch_time', 'Batch start time (HH:MM)'), F('remarks', 'Remarks', type: 'multiline'),
    ], initial: st);
    if (v == null || !c.mounted) return;
    if (await attempt(c, () => Api.send('PATCH', '/api/students/${st['id']}', clean(v)), ok: 'Student updated')) reload();
  }

  Future<void> _enroll(BuildContext c, int id, VoidCallback reload) async {
    final sports = await sportOptions();
    final staff = {for (final x in L((await Api.get('/api/staff'))['staff'])) '${x['id']}': '${x['name']}'};
    if (!c.mounted) return;
    final v = await formDialog(c, 'Enrol in a sport', [F('sport_id', 'Sport', type: 'select', options: sports, required: true), F('staff_id', 'Coach', type: 'select', options: staff),
      F('level', 'Level', type: 'select', options: const {'Beginner': 'Beginner', 'Intermediate': 'Intermediate', 'Advanced': 'Advanced', 'Elite': 'Elite'}), F('category', 'Age category', type: 'select', options: ageCats)]);
    if (v == null || !c.mounted) return;
    final b = clean(v);
    b['sport_id'] = int.tryParse(v['sport_id']!);
    b['staff_id'] = int.tryParse(v['staff_id'] ?? '');
    if (await attempt(c, () => Api.post('/api/students/$id/enrollments', b), ok: 'Enrolled')) reload();
  }

  Future<void> _addAch(BuildContext c, int id, VoidCallback reload) async {
    final sports = await sportOptions();
    if (!c.mounted) return;
    final v = await formDialog(c, 'Add achievement', [F('title', 'Title / event', required: true), F('sport_id', 'Sport', type: 'select', options: sports), F('level', 'Level (District / Zonal / State)', type: 'select', options: levels),
      F('age_category', 'Age category', type: 'select', options: ageCats), F('position', 'Position / medal'), F('event_date', 'Date', type: 'date'), F('cash_prize', 'Cash prize (Rs)', type: 'number')]);
    if (v == null || !c.mounted) return;
    final b = clean(v);
    b['sport_id'] = int.tryParse(v['sport_id'] ?? '');
    b['cash_prize'] = double.tryParse(v['cash_prize'] ?? '') ?? 0;
    if (await attempt(c, () => Api.post('/api/students/$id/achievements', b), ok: 'Achievement added')) reload();
  }

  Future<void> _addMatch(BuildContext c, int id, VoidCallback reload) async {
    final sports = await sportOptions();
    if (!c.mounted) return;
    final v = await formDialog(c, 'Add match', [F('event', 'Event', required: true), F('sport_id', 'Sport', type: 'select', options: sports), F('category', 'Level (District / Zonal / State)', type: 'select', options: levels),
      F('age_category', 'Age category', type: 'select', options: ageCats), F('event_date', 'Date', type: 'date'), F('result', 'Result')]);
    if (v == null || !c.mounted) return;
    final b = clean(v);
    b['sport_id'] = int.tryParse(v['sport_id'] ?? '');
    if (await attempt(c, () => Api.post('/api/students/$id/matches', b), ok: 'Match added')) reload();
  }

  Future<void> _assignPlans(BuildContext c, int id, List assigned, VoidCallback reload) async {
    final plans = L((await Api.get('/api/fee-plans'))['plans']).where((p) => p['active'] == 1).toList();
    if (!c.mounted) return;
    final sel = <int, TextEditingController>{for (final a in assigned) a['plan_id'] as int: TextEditingController(text: a['custom_amount']?.toString() ?? '')};
    final ok = await showDialog<bool>(context: c, builder: (c) => StatefulBuilder(builder: (c, set) => AlertDialog(
      title: const Text('Assign fee structure'),
      content: SizedBox(width: 420, child: plans.isEmpty ? const Text('No fee plans yet. Create them in More > Fees > Fee structure.') : SingleChildScrollView(child: Column(children: [
        for (final p in plans) Column(children: [
          CheckboxListTile(contentPadding: EdgeInsets.zero, value: sel.containsKey(p['id']), title: Text('${p['sport']}: ${p['name']}'), subtitle: Text('${inr(p['amount'])} ${p['period']}'),
              onChanged: (v) => set(() { if (v == true) { sel[p['id'] as int] = TextEditingController(); } else { sel.remove(p['id']); } })),
          if (sel.containsKey(p['id'])) TextField(controller: sel[p['id']], keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Custom amount (optional)')),
        ]),
      ]))),
      actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')), FilledButton(style: FilledButton.styleFrom(minimumSize: const Size(90, 44)), onPressed: () => Navigator.pop(c, true), child: const Text('Save'))],
    )));
    if (ok != true || !c.mounted) return;
    final body = {'plans': [for (final e in sel.entries) {'plan_id': e.key, 'custom_amount': e.value.text.trim().isEmpty ? null : double.tryParse(e.value.text.trim())}]};
    if (await attempt(c, () => Api.put('/api/students/$id/fee-plans', body), ok: 'Fee structure saved')) reload();
  }
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
  late final Map<String, dynamic> v = Map<String, dynamic>.from(widget.data ?? {});
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
    if (await attempt(context, () => Api.put('/api/students/${widget.studentId}/medical', body), ok: 'Medical info saved')) widget.onSaved();
    if (mounted) setState(() => busy = false);
  }

  @override
  Widget build(BuildContext context) => section('Medical information', [
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
      ]);
}
