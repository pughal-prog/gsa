import 'package:flutter/material.dart';
import 'screens/home.dart';
import 'screens/pair.dart';
import 'state.dart';
import 'theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const FaceApp());
}

class FaceApp extends StatefulWidget {
  const FaceApp({super.key});
  @override
  State<FaceApp> createState() => _FaceAppState();
}

class _FaceAppState extends State<FaceApp> {
  final s = AppState();
  @override
  void initState() { super.initState(); s.load(); }

  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'GSA Face Attendance',
        debugShowCheckedModeBanner: false,
        theme: buildTheme(),
        home: ListenableBuilder(
          listenable: s,
          builder: (_, __) => !s.loaded
              ? const Scaffold(body: Center(child: CircularProgressIndicator()))
              : s.paired ? HomeScreen(s: s) : PairScreen(s: s),
        ),
      );
}
