import 'package:flutter/material.dart';
import 'api.dart';
import 'notify.dart';
import 'home.dart';
import 'login.dart';

const ink = Color(0xFF0B1220);
const brand = ink;
const flame = Color(0xFFE31B23);
const leaf = Color(0xFF1E8A3C);
const paper = Color(0xFFF6F4EF);

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Api.load();
  await Notify.init();
  await Notify.initBackground();
  final ok = await Api.restore();
  runApp(GsaApp(signedIn: ok));
}

class GsaApp extends StatefulWidget {
  final bool signedIn;
  const GsaApp({super.key, required this.signedIn});
  @override
  State<GsaApp> createState() => _GsaAppState();
}

class _GsaAppState extends State<GsaApp> {
  late bool signedIn = widget.signedIn;
  void _set(bool v) { setState(() => signedIn = v); if (v) { Notify.start(); } else { Notify.stop(); } }

  @override
  void initState() { super.initState(); if (signedIn) Notify.start(); }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Global Sports Academy',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(seedColor: flame, primary: ink, secondary: flame, surface: Colors.white),
        scaffoldBackgroundColor: paper,
        appBarTheme: const AppBarTheme(backgroundColor: ink, foregroundColor: Colors.white, elevation: 0, scrolledUnderElevation: 0, titleTextStyle: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Colors.white)),
        navigationBarTheme: NavigationBarThemeData(backgroundColor: ink, indicatorColor: flame, iconTheme: WidgetStateProperty.resolveWith((st) => IconThemeData(color: st.contains(WidgetState.selected) ? Colors.white : Colors.white60)), labelTextStyle: WidgetStateProperty.resolveWith((st) => TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: st.contains(WidgetState.selected) ? Colors.white : Colors.white60))),
        cardTheme: CardTheme(color: Colors.white, elevation: 0, margin: EdgeInsets.zero, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6), side: const BorderSide(color: Color(0xFFE2DED4)))),
        inputDecorationTheme: InputDecorationTheme(filled: true, fillColor: Colors.white, border: OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: const BorderSide(color: Color(0xFFD8D3C7)))),
        filledButtonTheme: FilledButtonThemeData(style: FilledButton.styleFrom(backgroundColor: ink, foregroundColor: Colors.white, minimumSize: const Size.fromHeight(50), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)))),
        floatingActionButtonTheme: const FloatingActionButtonThemeData(backgroundColor: flame, foregroundColor: Colors.white),
        chipTheme: ChipThemeData(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6))),
      ),
      home: signedIn ? Home(onSignOut: () => _set(false)) : Welcome(onSignedIn: () => _set(true)),
    );
  }
}
