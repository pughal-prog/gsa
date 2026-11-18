import 'package:flutter/material.dart';
import 'api.dart';
import 'notify.dart';
import 'home.dart';
import 'login.dart';

const brand = Color(0xFF0B4AA2);
const flame = Color(0xFFE31B23);
const leaf = Color(0xFF1E8A3C);

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Api.load();
  await Notify.init();
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
        colorScheme: ColorScheme.fromSeed(seedColor: brand, primary: brand, secondary: flame, surface: Colors.white),
        scaffoldBackgroundColor: const Color(0xFFF3F6FB),
        appBarTheme: const AppBarTheme(backgroundColor: Colors.white, foregroundColor: Color(0xFF0F1B33), elevation: 0, scrolledUnderElevation: 1),
        cardTheme: CardTheme(color: Colors.white, elevation: 0, margin: EdgeInsets.zero, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: const BorderSide(color: Color(0xFFDDE4F0)))),
        inputDecorationTheme: InputDecorationTheme(filled: true, fillColor: const Color(0xFFEEF2F9), border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none)),
        filledButtonTheme: FilledButtonThemeData(style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(50), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)))),
      ),
      home: signedIn ? Home(onSignOut: () => _set(false)) : Welcome(onSignedIn: () => _set(true)),
    );
  }
}
