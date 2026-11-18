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
      body: AnimatedSwitcher(duration: const Duration(milliseconds: 260), switchInCurve: Curves.easeOutCubic, transitionBuilder: (w, a) => FadeTransition(opacity: a, child: SlideTransition(position: Tween(begin: const Offset(0, 0.015), end: Offset.zero).animate(a), child: w)), child: KeyedSubtree(key: ValueKey(tab), child: pages[tab].$3)),
      bottomNavigationBar: NavigationBar(
        selectedIndex: tab,
        onDestinationSelected: (i) { HapticFeedback.selectionClick(); setState(() => tab = i); },
        destinations: [for (final p in pages) NavigationDestination(icon: Icon(p.$2), label: p.$1)],
      ),
    );
  }
}
