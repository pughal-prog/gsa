import 'package:flutter/material.dart';

class C {
  static const ink = Color(0xFF0A0F24);
  static const brand = Color(0xFF2540F2);
  static const flame = Color(0xFFFF5A1F);
  static const volt = Color(0xFFD9F24C);
  static const page = Color(0xFFF3F4F8);
  static const ok = Color(0xFF12A150);
  static const bad = Color(0xFFD92D20);
}

ThemeData buildTheme() => ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(seedColor: C.brand, primary: C.brand, secondary: C.flame, surface: Colors.white),
      scaffoldBackgroundColor: C.page,
      appBarTheme: const AppBarTheme(backgroundColor: C.ink, foregroundColor: Colors.white),
      filledButtonTheme: FilledButtonThemeData(style: FilledButton.styleFrom(minimumSize: const Size(0, 52), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)))),
      inputDecorationTheme: InputDecorationTheme(filled: true, fillColor: Colors.white, border: OutlineInputBorder(borderRadius: BorderRadius.circular(12))),
    );
