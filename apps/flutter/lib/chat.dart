import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'api.dart';
import 'common.dart';
import 'main.dart';

class _Msg {
  final bool me;
  String text;
  List<String> items;
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
      // type the answer out word by word, then show the detail lines
      final full = '${d['reply'] ?? ''}';
      final reply = _Msg(false, '');
      setState(() { busy = false; msgs.add(reply); });
      final words = full.split(' ');
      for (var w = 0; w < words.length; w++) {
        if (!mounted) return;
        setState(() => reply.text = words.sublist(0, w + 1).join(' '));
        _toEnd();
        await Future.delayed(const Duration(milliseconds: 28));
      }
      HapticFeedback.lightImpact();
      if (!mounted) return;
      setState(() { reply.items = items; chips = next.isEmpty ? startChips : next; });
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
            if (busy) const Align(alignment: Alignment.centerLeft, child: _TypingDots()),
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

/// Three bouncing dots shown while the assistant is working.
class _TypingDots extends StatefulWidget {
  const _TypingDots();
  @override
  State<_TypingDots> createState() => _TypingDotsState();
}

class _TypingDotsState extends State<_TypingDots> with SingleTickerProviderStateMixin {
  late final AnimationController c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1000))..repeat();
  @override
  void dispose() { c.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFFE2DED4))),
        child: AnimatedBuilder(
          animation: c,
          builder: (context, _) {
            double wave(int i) { final t = (c.value + i * 0.2) % 1.0; return t < .5 ? t * 2 : 2 - t * 2; }
            return Row(mainAxisSize: MainAxisSize.min, children: [
              for (var i = 0; i < 3; i++)
                Transform.translate(
                  offset: Offset(0, -5 * wave(i)),
                  child: Container(margin: const EdgeInsets.symmetric(horizontal: 2.5), width: 7, height: 7, decoration: BoxDecoration(color: Colors.black.withOpacity(0.25 + 0.5 * wave(i)), shape: BoxShape.circle)),
                ),
            ]);
          },
        ),
      );
}
