import 'package:flutter/material.dart';
import 'api.dart';
import 'common.dart';
import 'export.dart';
import 'main.dart';
import 'students.dart';

class StaffPage extends StatelessWidget {
  const StaffPage({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Staff')),
        body: Load(
          fetch: () => Api.get('/api/staff'),
          builder: (c, d, reload) {
            final rows = L(d['staff']);
            if (rows.isEmpty) return const Center(child: Text('No staff yet'));
            return RefreshIndicator(onRefresh: () async => reload(), child: ListView.separated(
              padding: const EdgeInsets.all(16), itemCount: rows.length + 1, separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (c, i) {
                if (i == 0) {
                  return Align(alignment: Alignment.centerRight, child: TextButton.icon(icon: const Icon(Icons.ios_share, size: 18), label: const Text('PDF / Excel'), onPressed: () => exportData(c, title: 'Staff list', filename: 'staff',
                      head: ['Name', 'Sport', 'Phone', 'Experience (yrs)', 'Students'], rows: [for (final r in rows) [s(r['name']), s(r['sport']), s(r['phone']), s(r['experience_years']), s(r['students'])]]));
                }
                final r = rows[i - 1];
                return Card(child: ListTile(
                  leading: CircleAvatar(backgroundColor: flame, child: Text('${r['name']}'.isEmpty ? '?' : '${r['name']}'.substring(0, 1), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800))),
                  title: Text('${r['name']}', style: const TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: Text('${s(r['sport'])} · ${r['students'] ?? 0} students'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => Navigator.push(c, MaterialPageRoute(builder: (_) => StaffScreen(id: r['id'] as int, name: '${r['name']}'))),
                ));
              },
            ));
          },
        ),
      );
}

class StaffScreen extends StatelessWidget {
  final int id;
  final String name;
  const StaffScreen({super.key, required this.id, required this.name});
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: Text(name)),
        body: Load(
          fetch: () => Api.get('/api/staff/$id'),
          builder: (c, d, reload) {
            final st = M(d['staff']);
            final perms = L(st['permissions']);
            return RefreshIndicator(onRefresh: () async => reload(), child: ListView(padding: const EdgeInsets.all(16), children: [
              section('Coach details', [kv('Name', st['name']), kv('Sport', st['sport']), kv('Phone', st['phone']), kv('Email', st['email']), kv('Login ID', st['username']), kv('Date of birth', st['dob']), kv('Joined on', st['joined_on']),
                kv('Experience', st['experience_years'] == null ? null : '${st['experience_years']} years'), kv('Category', st['category']), kv('Major domain', st['major_domain']), kv('Training', st['training']), kv('Achievements', st['achievements'])]),
              if (Api.role == 'owner') section('Permissions', [Wrap(spacing: 6, runSpacing: 6, children: [for (final p in perms) pill('$p', brand), if (perms.isEmpty) const Text('None')])]),
              section('Students (${L(d['students']).length})', [
                for (final x in L(d['students'])) ListTile(contentPadding: EdgeInsets.zero, title: Text('${x['name']}'), subtitle: Text('${x['admission_no']} · ${x['sport']} · ${s(x['level'])}'),
                    trailing: const Icon(Icons.chevron_right), onTap: () => Navigator.push(c, MaterialPageRoute(builder: (_) => StudentScreen(id: x['id'] as int, name: '${x['name']}')))),
                if (L(d['students']).isEmpty) const Text('No students assigned'),
              ]),
            ]));
          },
        ),
      );
}
