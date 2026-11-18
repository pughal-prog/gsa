import 'package:flutter/material.dart';
import 'api.dart';
import 'main.dart';

String inr(num? n) => '₹${(n ?? 0).round().toString().replaceAllMapped(RegExp(r'(\d)(?=(\d\d)+\d$)'), (m) => '${m[1]},')}';
String s(dynamic v) => (v == null || v.toString().isEmpty) ? '-' : v.toString();
List L(dynamic v) => v is List ? v : const [];
Map M(dynamic v) => v is Map ? v : const {};
void toast(BuildContext c, String m) => ScaffoldMessenger.of(c).showSnackBar(SnackBar(content: Text(m)));

Color statusColor(String st) => switch (st) { 'present' || 'paid' || 'active' || 'sent' => leaf, 'late' || 'pending' => const Color(0xFFB36B00), 'absent' || 'failed' || 'overdue' => flame, _ => Colors.blueGrey };

Widget pill(String text, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
    decoration: BoxDecoration(color: color.withOpacity(.12), borderRadius: BorderRadius.circular(6)),
    child: Text(text, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w700)));

Widget kv(String k, dynamic v) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 5),
    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [SizedBox(width: 125, child: Text(k, style: const TextStyle(color: Colors.black54))), Expanded(child: Text(s(v)))]));

Widget section(String title, List<Widget> kids, {Widget? action}) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [Expanded(child: Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15))), if (action != null) action]),
      const SizedBox(height: 6), ...kids]))));

/// Loads JSON, shows spinner or error with retry, rebuilds with data.
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
          if (snap.hasError) {
            return Center(child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [
              Text('${snap.error}', textAlign: TextAlign.center), const SizedBox(height: 12), OutlinedButton(onPressed: reload, child: const Text('Retry'))])));
          }
          try {
            return widget.builder(c, snap.data, reload);
          } catch (e) {
            return Center(child: Padding(padding: const EdgeInsets.all(24), child: Text('Could not show this screen ($e)', textAlign: TextAlign.center)));
          }
        },
      );
}

/// A field in a form dialog. type: text, number, date, multiline, select (options = value -> label).
class F {
  final String key, label;
  final String type;
  final Map<String, String>? options;
  final bool required;
  const F(this.key, this.label, {this.type = 'text', this.options, this.required = false});
}

/// Shows a form and returns the entered values (null if cancelled). Values are strings; numbers stay strings.
Future<Map<String, String>?> formDialog(BuildContext context, String title, List<F> fields, {Map? initial, String submit = 'Save'}) {
  final ctl = {for (final f in fields) f.key: TextEditingController(text: (initial?[f.key] ?? '').toString())};
  final sel = {for (final f in fields.where((f) => f.type == 'select')) f.key: (initial?[f.key] ?? '').toString()};
  String err = '';
  return showDialog<Map<String, String>>(
    context: context,
    builder: (c) => StatefulBuilder(builder: (c, set) => AlertDialog(
      title: Text(title),
      content: SizedBox(width: 420, child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
        for (final f in fields) Padding(padding: const EdgeInsets.only(bottom: 10), child: switch (f.type) {
          'select' => DropdownButtonFormField<String>(
              value: f.options!.containsKey(sel[f.key]) ? sel[f.key] : null, isExpanded: true,
              decoration: InputDecoration(labelText: f.label), items: [for (final e in f.options!.entries) DropdownMenuItem(value: e.key, child: Text(e.value))], onChanged: (v) => set(() => sel[f.key] = v ?? '')),
          'date' => TextField(controller: ctl[f.key], readOnly: true, decoration: InputDecoration(labelText: f.label, suffixIcon: const Icon(Icons.calendar_today, size: 18)), onTap: () async {
              final p = await showDatePicker(context: c, initialDate: DateTime.tryParse(ctl[f.key]!.text) ?? DateTime.now(), firstDate: DateTime(1990), lastDate: DateTime(2100));
              if (p != null) ctl[f.key]!.text = '${p.year}-${p.month.toString().padLeft(2, '0')}-${p.day.toString().padLeft(2, '0')}';
            }),
          'multiline' => TextField(controller: ctl[f.key], maxLines: 3, decoration: InputDecoration(labelText: f.label)),
          'number' => TextField(controller: ctl[f.key], keyboardType: TextInputType.number, decoration: InputDecoration(labelText: f.label)),
          _ => TextField(controller: ctl[f.key], decoration: InputDecoration(labelText: f.label)),
        }),
        if (err.isNotEmpty) Text(err, style: const TextStyle(color: Colors.red)),
      ]))),
      actions: [
        TextButton(onPressed: () => Navigator.pop(c), child: const Text('Cancel')),
        FilledButton(style: FilledButton.styleFrom(minimumSize: const Size(90, 44)), onPressed: () {
          for (final f in fields.where((f) => f.required)) {
            final v = f.type == 'select' ? sel[f.key]! : ctl[f.key]!.text.trim();
            if (v.isEmpty) { set(() => err = '${f.label} is required'); return; }
          }
          Navigator.pop(c, {for (final f in fields) f.key: f.type == 'select' ? sel[f.key]! : ctl[f.key]!.text.trim()});
        }, child: Text(submit)),
      ],
    )),
  );
}

/// Runs an API call, shows an error toast on failure, returns true on success.
Future<bool> attempt(BuildContext context, Future<dynamic> Function() f, {String? ok}) async {
  try { await f(); if (ok != null && context.mounted) toast(context, ok); return true; } catch (e) { if (context.mounted) toast(context, '$e'); return false; }
}

Future<bool> confirm(BuildContext context, String msg) async =>
    await showDialog<bool>(context: context, builder: (c) => AlertDialog(content: Text(msg), actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')), FilledButton(style: FilledButton.styleFrom(backgroundColor: flame, minimumSize: const Size(90, 44)), onPressed: () => Navigator.pop(c, true), child: const Text('Yes'))])) ?? false;

/// Body returned by the API for key -> value, with blanks removed so empty fields do not overwrite data.
Map<String, dynamic> clean(Map<String, String> m) => {for (final e in m.entries) e.key: e.value.isEmpty ? null : e.value};

const levels = {'District': 'District', 'Zonal': 'Zonal', 'State': 'State', 'National': 'National', 'International': 'International'};
const ageCats = {'Sub Junior': 'Sub Junior', 'Cadet': 'Cadet', 'Junior': 'Junior', 'Senior': 'Senior'};

Future<Map<String, String>> sportOptions() async => {for (final x in L((await Api.get('/api/sports'))['sports'])) '${x['id']}': '${x['name']}'};
