import 'package:flutter/material.dart';
import 'api.dart';
import 'common.dart';
import 'export.dart';
import 'main.dart';

class EquipmentPage extends StatelessWidget {
  const EquipmentPage({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: const Text('Equipment shop')), body: const EquipmentBody());
}

class EquipmentBody extends StatefulWidget {
  const EquipmentBody({super.key});
  @override
  State<EquipmentBody> createState() => _EquipmentBodyState();
}

class _EquipmentBodyState extends State<EquipmentBody> {
  String section = 'All';
  int refresh = 0;
  bool get owner => Api.role == 'owner';

  @override
  Widget build(BuildContext context) => Load(
        key: ValueKey(refresh),
        fetch: () async => {'eq': await Api.get('/api/equipment'), 'sports': await Api.get('/api/sports')},
        builder: (c, d, reload) {
          final items = L(d['eq']['equipment']);
          final sportNames = [for (final x in L(d['sports']['sports'])) '${x['name']}'];
          final names = <String>{...sportNames.where((n) => owner || items.any((e) => (e['sport'] ?? 'General') == n)), ...items.map((e) => '${e['sport'] ?? 'General'}')}.toList()..sort();
          final low = items.where((e) => (e['qty'] as num) <= (e['reorder_level'] as num)).length;
          void again() => setState(() => refresh++);
          final shown = names.where((n) => section == 'All' || n == section);
          return Scaffold(
            backgroundColor: Colors.transparent,
            floatingActionButton: owner ? FloatingActionButton.extended(onPressed: () => _menu(c, again), icon: const Icon(Icons.add), label: const Text('Add')) : null,
            body: RefreshIndicator(onRefresh: () async => again(), child: ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 90), children: [
              Row(children: [
                Expanded(child: Text('${items.length} items · $low need reorder', style: const TextStyle(color: Colors.black54))),
                TextButton.icon(icon: const Icon(Icons.ios_share, size: 18), label: const Text('PDF / Excel'), onPressed: () => exportData(c, title: 'Equipment stock', filename: 'equipment',
                    head: ['Section', 'Category', 'Item', 'In stock', 'Reorder at'], rows: [for (final e in items) [s(e['sport'] ?? 'General'), s(e['category']), s(e['name']), '${e['qty']}', '${e['reorder_level']}']])),
              ]),
              SingleChildScrollView(scrollDirection: Axis.horizontal, child: Row(children: [
                for (final n in ['All', ...names]) Padding(padding: const EdgeInsets.only(right: 8), child: ChoiceChip(label: Text(n), selected: section == n, showCheckmark: false, selectedColor: brand,
                    labelStyle: TextStyle(color: section == n ? Colors.white : null, fontWeight: FontWeight.w600), onSelected: (_) => setState(() => section = n))),
              ])),
              const SizedBox(height: 12),
              for (final n in shown) ...[
                Padding(padding: const EdgeInsets.only(bottom: 6, top: 4), child: Text(n.toUpperCase(), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12, letterSpacing: 1.2, color: Colors.black54))),
                if (!items.any((e) => (e['sport'] ?? 'General') == n)) const Padding(padding: EdgeInsets.only(bottom: 12), child: Text('No items in this section yet', style: TextStyle(color: Colors.black45))),
                for (final e in items.where((e) => (e['sport'] ?? 'General') == n)) Padding(padding: const EdgeInsets.only(bottom: 8), child: Card(child: ListTile(
                  title: Text('${e['name']}', style: const TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: Text([if (e['category'] != null) '${e['category']}', if (owner) 'Cost ${inr(e['cost_price'])} · Sale ${inr(e['sale_price'])}' else 'Reorder at ${e['reorder_level']}'].join(' · ')),
                  trailing: pill('${e['qty']} in stock', (e['qty'] as num) <= (e['reorder_level'] as num) ? flame : leaf),
                  onTap: owner ? () => _itemMenu(c, e, again) : null,
                ))),
              ],
            ])),
          );
        },
      );

  Future<void> _menu(BuildContext c, VoidCallback again) async {
    final pick = await showModalBottomSheet<String>(context: c, showDragHandle: true, builder: (x) => SafeArea(child: Column(mainAxisSize: MainAxisSize.min, children: [
      ListTile(leading: const Icon(Icons.add_box_outlined), title: const Text('New equipment item'), onTap: () => Navigator.pop(x, 'item')),
      ListTile(leading: const Icon(Icons.layers_outlined), title: const Text('New section (e.g. Badminton)'), onTap: () => Navigator.pop(x, 'section')),
      const SizedBox(height: 8),
    ])));
    if (pick == null || !c.mounted) return;
    if (pick == 'section') {
      final v = await formDialog(c, 'New equipment section', const [F('name', 'Section name', required: true)], submit: 'Create');
      if (v != null && c.mounted && await attempt(c, () => Api.post('/api/sports', v), ok: 'Section created')) again();
    } else {
      final sports = await sportOptions();
      if (!c.mounted) return;
      final v = await formDialog(c, 'New equipment item', [F('name', 'Name', required: true), F('sport_id', 'Section / sport', type: 'select', options: sports), const F('category', 'Category (Rackets, Balls, Wear...)'),
        const F('qty', 'Opening quantity', type: 'number'), const F('reorder_level', 'Reorder level', type: 'number'), const F('cost_price', 'Cost price', type: 'number'), const F('sale_price', 'Sale price', type: 'number')], submit: 'Add');
      if (v == null || !c.mounted) return;
      final b = clean(v);
      b['sport_id'] = int.tryParse(v['sport_id'] ?? '');
      for (final k in ['qty', 'reorder_level', 'cost_price', 'sale_price']) { b[k] = double.tryParse(v[k] ?? '') ?? (k == 'reorder_level' ? 2 : 0); }
      if (await attempt(c, () => Api.post('/api/equipment', b), ok: 'Item added')) again();
    }
  }

  Future<void> _itemMenu(BuildContext c, Map e, VoidCallback again) async {
    final pick = await showModalBottomSheet<String>(context: c, showDragHandle: true, builder: (x) => SafeArea(child: Column(mainAxisSize: MainAxisSize.min, children: [
      Padding(padding: const EdgeInsets.all(8), child: Text('${e['name']}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16))),
      ListTile(leading: const Icon(Icons.inventory), title: const Text('Add stock'), onTap: () => Navigator.pop(x, 'stock')),
      ListTile(leading: const Icon(Icons.sell_outlined), title: const Text('Sell / issue / damage'), onTap: () => Navigator.pop(x, 'record')),
      ListTile(leading: const Icon(Icons.edit_outlined), title: const Text('Edit item'), onTap: () => Navigator.pop(x, 'edit')),
      ListTile(leading: const Icon(Icons.delete_outline, color: flame), title: const Text('Delete item'), onTap: () => Navigator.pop(x, 'delete')),
    ])));
    if (pick == null || !c.mounted) return;
    final id = e['id'];
    switch (pick) {
      case 'stock':
        final v = await formDialog(c, 'Add stock: ${e['name']}', const [F('qty', 'Quantity received', type: 'number', required: true), F('amount', 'Total cost (blank = from cost price)', type: 'number'), F('party', 'Supplier')], submit: 'Add');
        if (v == null || !c.mounted) return;
        if (await attempt(c, () => Api.post('/api/equipment/$id/txn', {'type': 'purchase', 'qty': double.tryParse(v['qty']!) ?? 0, 'amount': double.tryParse(v['amount'] ?? ''), 'party': v['party']!.isEmpty ? null : v['party']}), ok: 'Stock added')) again();
      case 'record':
        final v = await formDialog(c, 'Record: ${e['name']}', const [F('type', 'Type', type: 'select', required: true, options: {'sale': 'Sale', 'issue': 'Issue to student', 'return': 'Return', 'damage': 'Damaged / lost'}),
          F('qty', 'Quantity', type: 'number', required: true), F('party', 'Buyer name'), F('amount', 'Amount (blank = auto)', type: 'number'), F('note', 'Note')]);
        if (v == null || !c.mounted) return;
        if (await attempt(c, () => Api.post('/api/equipment/$id/txn', {'type': v['type'], 'qty': double.tryParse(v['qty']!) ?? 0, 'amount': double.tryParse(v['amount'] ?? ''), 'party': v['party']!.isEmpty ? null : v['party'], 'note': v['note']!.isEmpty ? null : v['note']}), ok: 'Recorded')) again();
      case 'edit':
        final sports = await sportOptions();
        if (!c.mounted) return;
        final v = await formDialog(c, 'Edit item', [const F('name', 'Name', required: true), F('sport_id', 'Section / sport', type: 'select', options: sports), const F('category', 'Category'),
          const F('reorder_level', 'Reorder level', type: 'number'), const F('cost_price', 'Cost price', type: 'number'), const F('sale_price', 'Sale price', type: 'number')], initial: {...e, 'sport_id': '${e['sport_id'] ?? ''}'});
        if (v == null || !c.mounted) return;
        final b = clean(v);
        b['sport_id'] = int.tryParse(v['sport_id'] ?? '');
        for (final k in ['reorder_level', 'cost_price', 'sale_price']) { b[k] = double.tryParse(v[k] ?? ''); }
        if (await attempt(c, () => Api.send('PATCH', '/api/equipment/$id', b), ok: 'Item updated')) again();
      case 'delete':
        if (await confirm(c, 'Delete ${e['name']} and its history?') && c.mounted && await attempt(c, () => Api.delete('/api/equipment/$id'), ok: 'Deleted')) again();
    }
  }
}
