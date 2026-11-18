import 'package:flutter/material.dart';
import 'api.dart';
import 'common.dart';
import 'main.dart';

class _Msg {
  final bool me;
  final String text;
  final List<String> items;
  _Msg(this.me, this.text, [this.items = const []]);
}

/// Owner-only assistant. Answers from live academy data through fixed read-only queries on the server.
class AssistantPage extends StatefulWidget {
  const AssistantPage({super.key});
  @override
  State<AssistantPage> createState() => _AssistantPageState();
}

class _AssistantPageState extends State<AssistantPage> {
  static const startChips = ['Today attendance', 'Who is absent today?', 'Pending fees', 'This month income', 'Low stock', 'Pending approvals', 'New enquiries', 'Academy summary'];
  // kept in memory so the conversation survives switching tabs
  static final List<_Msg> msgs = [_Msg(false, 'Hello! Ask me about attendance, fees, students, staff, stock, income, enquiries or approvals. I read your live academy data.')];
  static List<String> chips = startChips;
  final ctl = TextEditingController();
  final scroll = ScrollController();
  bool busy = false;

  void _toEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (scroll.hasClients) scroll.animateTo(scroll.position.maxScrollExtent + 120, duration: const Duration(milliseconds: 250), curve: Curves.easeOut);
    });
  }

  Future<void> send(String t) async {
    final m = t.trim();
    if (m.isEmpty || busy) return;
    setState(() { msgs.add(_Msg(true, m)); busy = true; chips = const []; });
    ctl.clear();
    _toEnd();
    try {
      final d = M(await Api.post('/api/owner-chat', {'message': m}));
      final items = [for (final i in L(d['items'])) '$i'];
      final next = [for (final c in L(d['chips'])) '$c'];
      if (!mounted) return;
      setState(() { msgs.add(_Msg(false, '${d['reply'] ?? ''}', items)); chips = next.isEmpty ? startChips : next; });
    } catch (e) {
      if (!mounted) return;
      setState(() { msgs.add(_Msg(false, 'Sorry, I could not get that. $e')); chips = startChips; });
    } finally {
      if (mounted) setState(() => busy = false);
      _toEnd();
    }
  }

  Widget _bubble(_Msg m) => Align(
        alignment: m.me ? Alignment.centerRight : Alignment.centerLeft,
        child: Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.86),
          decoration: BoxDecoration(
            color: m.me ? ink : Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: m.me ? null : Border.all(color: const Color(0xFFE2DED4)),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            SelectableText(m.text, style: TextStyle(color: m.me ? Colors.white : ink, fontWeight: m.items.isNotEmpty ? FontWeight.w700 : FontWeight.w400, height: 1.35)),
            for (final i in m.items) Padding(padding: const EdgeInsets.only(top: 5), child: SelectableText('• $i', style: const TextStyle(color: Colors.black87, fontSize: 13.5, height: 1.3))),
          ]),
        ),
      );

  @override
  void dispose() { ctl.dispose(); scroll.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) => Column(children: [
        Expanded(
          child: ListView(controller: scroll, padding: const EdgeInsets.fromLTRB(16, 14, 16, 8), children: [
            for (final m in msgs) _bubble(m),
            if (busy) _bubble(_Msg(false, 'Looking that up...')),
            if (!busy && chips.isNotEmpty) Wrap(spacing: 8, runSpacing: 8, children: [for (final c in chips) ActionChip(label: Text(c), onPressed: () => send(c), backgroundColor: Colors.white, side: const BorderSide(color: Color(0xFFD8D3C7)))]),
          ]),
        ),
        SafeArea(
          top: false,
          child: Container(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 10),
            decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: Color(0xFFE2DED4)))),
            child: Row(children: [
              Expanded(child: TextField(controller: ctl, textInputAction: TextInputAction.send, onSubmitted: send, maxLength: 300, decoration: const InputDecoration(hintText: 'Ask about your academy...', counterText: '', isDense: true))),
              const SizedBox(width: 8),
              IconButton.filled(onPressed: busy ? null : () => send(ctl.text), style: IconButton.styleFrom(backgroundColor: flame, foregroundColor: Colors.white, minimumSize: const Size(48, 48)), icon: const Icon(Icons.send)),
            ]),
          ),
        ),
      ]);
}
