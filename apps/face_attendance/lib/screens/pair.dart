import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../state.dart';
import '../theme.dart';

/// Keeps only letters and digits (max 10), upper-cased, and shows them as ABCDE-FGHIJ like the website does.
/// Typing or pasting the code with or without the hyphen, spaces or lower case all work.
class PairCodeFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    var c = newValue.text.toUpperCase().replaceAll(RegExp(r'[^A-Z0-9]'), '');
    if (c.length > 10) c = c.substring(0, 10);
    final t = c.length > 5 ? '${c.substring(0, 5)}-${c.substring(5)}' : c;
    return TextEditingValue(text: t, selection: TextSelection.collapsed(offset: t.length));
  }
}

String cleanPairCode(String s) => s.toUpperCase().replaceAll(RegExp(r'[^A-Z0-9]'), '');

class PairScreen extends StatefulWidget {
  final AppState s;
  const PairScreen({super.key, required this.s});
  @override
  State<PairScreen> createState() => _PairScreenState();
}

class _PairScreenState extends State<PairScreen> {
  final code = TextEditingController();
  String? error; bool busy = false;

  Future<void> go() async {
    setState(() { busy = true; error = null; });
    try { if (cleanPairCode(code.text).length != 10) throw 'Enter all 10 characters of the code'; await widget.s.pair(cleanPairCode(code.text)); } catch (e) { setState(() => error = e.toString()); }
    if (mounted) setState(() => busy = false);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: C.ink,
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Image.asset('assets/icon.png', height: 84),
              const SizedBox(height: 24),
              const Text('Global Sports Academy', textAlign: TextAlign.center, style: TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.w800)),
              const SizedBox(height: 8),
              const Text('Pair this phone with the academy. In the GSA website open Face attendance, add a device and enter the 10 character code here.',
                  textAlign: TextAlign.center, style: TextStyle(color: Colors.white70)),
              const SizedBox(height: 28),
              TextField(controller: code, textCapitalization: TextCapitalization.characters, inputFormatters: [PairCodeFormatter()], autocorrect: false, enableSuggestions: false, textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 22, letterSpacing: 4), decoration: const InputDecoration(hintText: 'XXXXX-XXXXX')),
              if (error != null) Padding(padding: const EdgeInsets.only(top: 10), child: Text(error!, style: const TextStyle(color: C.volt), textAlign: TextAlign.center)),
              const SizedBox(height: 16),
              FilledButton(onPressed: busy ? null : go, style: FilledButton.styleFrom(backgroundColor: C.flame), child: Text(busy ? 'Pairing...' : 'Pair this phone')),
            ]),
          ),
        ),
      );
}
