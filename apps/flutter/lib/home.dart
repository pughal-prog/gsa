import 'package:flutter/material.dart';
import 'api.dart';
import 'common.dart';
import 'main.dart';
import 'notify.dart';
import 'pages.dart';
import 'students.dart';
import 'fees.dart';
import 'equipment.dart';
import 'chat.dart';
import 'motion.dart';
import 'package:flutter/services.dart';

class Home extends StatefulWidget {
  final VoidCallback onSignOut;
  const Home({super.key, required this.onSignOut});
  @override
  State<Home> createState() => _HomeState();
}

class _HomeState extends State<Home> {
  int tab = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (Api.me?['mustChange'] == true && mounted) {
        toast(context, 'Please change your temporary password');
        await Navigator.push(context, MaterialPageRoute(builder: (_) => Scaffold(appBar: AppBar(title: const Text('Set a new password')), body: AccountPage(onSignOut: _out))));
      }
      if (mounted) await Notify.askPermission(context);
    });
  }

  void _out() async { await Api.saveToken(null); widget.onSignOut(); }

  @override
  Widget build(BuildContext context) {
    final role = Api.role;
    final bell = role != 'staff' || Api.can('students.viewAll');
    final pages = <(String, IconData, Widget)>[
      if (role == 'owner') ('Overview', Icons.dashboard_outlined, const OverviewPage()),
      if (role == 'student') ('Passport', Icons.badge_outlined, const PassportPage()),
      if (role != 'student' && Api.can('students.view')) ('Students', Icons.groups_outlined, const StudentsPage()),
      if (role != 'student' && Api.can('attendance.mark')) ('Attendance', Icons.event_available_outlined, const AttendancePage()),
      if (role == 'student' || (role == 'staff' && Api.can('fees.view'))) ('Fees', Icons.receipt_long_outlined, const FeesPage()),
      if (role == 'staff' && Api.can('equipment.view')) ('Equipment', Icons.inventory_2_outlined, const EquipmentBody()),
      if (role == 'owner') ('Assistant', Icons.smart_toy_outlined, const AssistantPage()),
      if (role == 'owner') ('More', Icons.apps, MorePage(onSignOut: _out)) else ('Account', Icons.person_outline, AccountPage(onSignOut: _out)),
    ];
    if (tab >= pages.length) tab = 0;
    return Scaffold(
      appBar: AppBar(
        title: Text(pages[tab].$1, style: const TextStyle(fontWeight: FontWeight.w700)),
        actions: [
          if (bell)
            ValueListenableBuilder<int>(
              valueListenable: Notify.unread,
              builder: (c, n, _) => IconButton(
                tooltip: 'Notifications',
                onPressed: () async { await Navigator.push(c, MaterialPageRoute(builder: (_) => const NotificationsPage())); },
                icon: Badge(isLabelVisible: n > 0, label: Text(n > 99 ? '99+' : '$n'), backgroundColor: flame, child: const Icon(Icons.notifications_outlined)),
              ),
            ),
        ],
      ),
      body: GestureDetector(
        onHorizontalDragEnd: (d) {
          final v = d.primaryVelocity ?? 0;
          if (v < -450 && tab < pages.length - 1) { HapticFeedback.selectionClick(); setState(() => tab++); }
          else if (v > 450 && tab > 0) { HapticFeedback.selectionClick(); setState(() => tab--); }
        },
        child: AnimatedSwitcher(duration: const Duration(milliseconds: 260), switchInCurve: Curves.easeOutCubic, transitionBuilder: (w, a) => FadeTransition(opacity: a, child: SlideTransition(position: Tween(begin: const Offset(0, 0.015), end: Offset.zero).animate(a), child: w)), child: KeyedSubtree(key: ValueKey(tab), child: pages[tab].$3))),
      bottomNavigationBar: FloatNav(
        index: tab,
        items: [for (final p in pages) (p.$1, p.$2)],
        onTap: (i) { HapticFeedback.selectionClick(); setState(() => tab = i); },
      ),
    );
  }
}

/// Floating bottom bar. The selected item grows into a pill that shows its label.
class FloatNav extends StatelessWidget {
  final int index;
  final List<(String, IconData)> items;
  final ValueChanged<int> onTap;
  const FloatNav({super.key, required this.index, required this.items, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final avail = MediaQuery.of(context).size.width - 24 - 12;
    final selW = (avail * 0.34).clamp(96.0, 150.0);
    final otherW = (avail - selW) / (items.length - 1);
    return SafeArea(
      top: false,
      child: Container(
        margin: const EdgeInsets.fromLTRB(12, 0, 12, 10),
        padding: const EdgeInsets.all(6),
        decoration: BoxDecoration(color: ink, borderRadius: BorderRadius.circular(24), boxShadow: const [BoxShadow(color: Color(0x40000000), blurRadius: 20, offset: Offset(0, 8))]),
        child: Row(children: [
          for (var i = 0; i < items.length; i++)
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => onTap(i),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 320),
                curve: Curves.easeOutCubic,
                width: i == index ? selW : otherW,
                height: 48,
                decoration: BoxDecoration(color: i == index ? flame : Colors.transparent, borderRadius: BorderRadius.circular(18)),
                child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  AnimatedScale(scale: i == index ? 1.08 : 1, duration: const Duration(milliseconds: 320), curve: Curves.easeOutBack, child: Icon(items[i].$2, size: 22, color: i == index ? Colors.white : Colors.white60)),
                  if (i == index) ...[
                    const SizedBox(width: 6),
                    Flexible(child: Text(items[i].$1, maxLines: 1, overflow: TextOverflow.clip, softWrap: false, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12.5))),
                  ],
                ]),
              ),
            ),
        ]),
      ),
    );
  }
}
