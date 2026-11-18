import 'package:flutter/material.dart';
import 'api.dart';
import 'common.dart';
import 'export.dart';
import 'main.dart';

class FeesPage extends StatefulWidget {
  const FeesPage({super.key});
  @override
  State<FeesPage> createState() => _FeesPageState();
}

class _FeesPageState extends State<FeesPage> {
  int tab = 0;
  int refresh = 0;
  bool get owner => Api.role == 'owner';

  @override
  Widget build(BuildContext context) => Column(children: [
        if (owner) Padding(padding: const EdgeInsets.fromLTRB(16, 12, 16, 0), child: SegmentedButton<int>(
            segments: const [ButtonSegment(value: 0, label: Text('Bills')), ButtonSegment(value: 1, label: Text('Fee structure'))], selected: {tab}, onSelectionChanged: (x) => setState(() => tab = x.first))),
        Expanded(child: tab == 0 ? _bills() : _plans()),
      ]);

  Widget _bills() => Load(
        key: ValueKey('b$refresh'),
        fetch: () => Api.get(Api.role == 'student' ? '/api/me/student' : '/api/fees'),
        builder: (c, d, reload) {
          final fees = L(d['fees']);
          final nm = d['student'] is Map ? '${d['student']['name']}' : '';
          return RefreshIndicator(onRefresh: () async => setState(() => refresh++), child: ListView.builder(padding: const EdgeInsets.all(16), itemCount: fees.length + 1, itemBuilder: (c, i) {
            if (i == 0) {
              return Row(children: [
                if (owner) FilledButton.tonalIcon(onPressed: () async { if (await attempt(c, () async { final r = await Api.post('/api/fees/generate-monthly'); if (c.mounted) toast(c, '${r['created']} bills generated'); })) setState(() => refresh++); }, icon: const Icon(Icons.auto_awesome), label: const Text('Generate bills'), style: FilledButton.styleFrom(minimumSize: const Size(0, 40))),
                const Spacer(),
                TextButton.icon(icon: const Icon(Icons.ios_share, size: 18), label: const Text('PDF / Excel'), onPressed: () => exportData(c, title: 'Fees', filename: 'fees', head: ['Student', 'Description', 'Due', 'Amount', 'Status'],
                    rows: [for (final f in fees) [s(f['student'] ?? nm), s(f['description']), s(f['due_date']), inr(f['amount']), s(f['status'])]])),
              ]);
            }
            final f = fees[i - 1];
            return Padding(padding: const EdgeInsets.only(bottom: 8), child: Card(child: ListTile(
              title: Text('${f['description']}', style: const TextStyle(fontWeight: FontWeight.w600)),
              subtitle: Text('${f['student'] != null ? '${f['student']} · ' : ''}Due ${f['due_date']}'),
              trailing: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [Text(inr(f['amount']), style: const TextStyle(fontWeight: FontWeight.w800)), pill('${f['status']}', statusColor('${f['status']}'))]),
              onTap: (Api.can('fees.collect') && f['status'] == 'pending') ? () async { if (await confirm(c, 'Mark ${inr(f['amount'])} as received in cash?') && c.mounted && await attempt(c, () => Api.post('/api/fees/${f['id']}/mark-paid', {'method': 'cash'}), ok: 'Marked paid')) setState(() => refresh++); } : null,
            )));
          }));
        },
      );

  Widget _plans() => Load(
        key: ValueKey('p$refresh'),
        fetch: () => Api.get('/api/fee-plans'),
        builder: (c, d, reload) {
          final plans = L(d['plans']);
          return Scaffold(
            backgroundColor: Colors.transparent,
            floatingActionButton: FloatingActionButton.extended(onPressed: () => _edit(c, null), icon: const Icon(Icons.add), label: const Text('New plan')),
            body: ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 90), children: [
              const Text('Set what each section costs. Assign plans to a student from their Fees tab. Generate bills uses these.', style: TextStyle(color: Colors.black54)),
              const SizedBox(height: 12),
              for (final p in plans) Padding(padding: const EdgeInsets.only(bottom: 8), child: Card(child: ListTile(
                title: Text('${p['sport']}: ${p['name']}', style: const TextStyle(fontWeight: FontWeight.w600)), subtitle: Text('${p['period']} · ${p['active'] == 1 ? 'active' : 'off'}'),
                trailing: Text(inr(p['amount']), style: const TextStyle(fontWeight: FontWeight.w800)), onTap: () => _edit(c, p)))),
              if (plans.isEmpty) const Center(child: Padding(padding: EdgeInsets.all(24), child: Text('No plans yet'))),
            ]),
          );
        },
      );

  Future<void> _edit(BuildContext c, Map? p) async {
    final sports = await sportOptions();
    if (!c.mounted) return;
    final v = await formDialog(c, p == null ? 'New fee plan' : 'Edit fee plan', [
      if (p == null) F('sport_id', 'Section / sport', type: 'select', options: sports, required: true),
      const F('name', 'Plan name', required: true), const F('amount', 'Amount (Rs)', type: 'number', required: true),
      const F('period', 'Billing period', type: 'select', options: {'monthly': 'Monthly', 'quarterly': 'Quarterly', 'yearly': 'Yearly', 'once': 'One time'}),
      if (p != null) const F('active', 'Status', type: 'select', options: {'1': 'Active', '0': 'Off'}),
    ], initial: p == null ? {'name': 'Monthly coaching', 'period': 'monthly'} : {...p, 'active': '${p['active']}'});
    if (v == null || !c.mounted) return;
    final body = <String, dynamic>{'name': v['name'], 'amount': double.tryParse(v['amount']!) ?? 0, 'period': v['period']!.isEmpty ? 'monthly' : v['period']};
    if (p == null) { body['sport_id'] = int.tryParse(v['sport_id']!); } else { body['active'] = v['active'] == '0' ? 0 : 1; }
    final ok = await attempt(c, () => p == null ? Api.post('/api/fee-plans', body) : Api.send('PATCH', '/api/fee-plans/${p['id']}', body), ok: 'Saved');
    if (ok) setState(() => refresh++);
  }
}
