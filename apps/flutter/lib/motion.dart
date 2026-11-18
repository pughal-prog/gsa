import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Small motion toolkit used across the app. Keep durations short and curves natural.
const _ease = Curves.easeOutCubic;

/// Fades and lifts a child into place. Use [index] to stagger items in a list.
class Reveal extends StatelessWidget {
  final Widget child;
  final int index;
  final Duration delay;
  const Reveal({super.key, required this.child, this.index = 0, this.delay = Duration.zero});
  @override
  Widget build(BuildContext context) {
    final wait = Duration(milliseconds: (index.clamp(0, 10)) * 45) + delay;
    final total = const Duration(milliseconds: 420) + wait;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: total,
      curve: Interval(wait.inMilliseconds / total.inMilliseconds, 1, curve: _ease),
      builder: (c, v, w) => Opacity(opacity: v, child: Transform.translate(offset: Offset(0, (1 - v) * 18), child: w)),
      child: child,
    );
  }
}

/// Counts a number up from zero. [format] turns the animated value into text.
class CountUp extends StatelessWidget {
  final num value;
  final String Function(num) format;
  final TextStyle? style;
  const CountUp(this.value, {super.key, this.format = _plain, this.style});
  static String _plain(num n) => n.round().toString();
  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: value.toDouble()),
        duration: const Duration(milliseconds: 900),
        curve: _ease,
        builder: (c, v, _) => Text(format(v), style: style),
      );
}

/// Presses in slightly with a light haptic tick. Wrap any tappable card or button.
class Pressable extends StatefulWidget {
  final Widget child;
  final VoidCallback? onTap;
  const Pressable({super.key, required this.child, this.onTap});
  @override
  State<Pressable> createState() => _PressableState();
}

class _PressableState extends State<Pressable> {
  bool down = false;
  @override
  Widget build(BuildContext context) => GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) => setState(() => down = true),
        onTapCancel: () => setState(() => down = false),
        onTapUp: (_) => setState(() => down = false),
        onTap: widget.onTap == null ? null : () { HapticFeedback.selectionClick(); widget.onTap!(); },
        child: AnimatedScale(scale: down ? .97 : 1, duration: const Duration(milliseconds: 120), curve: Curves.easeOut, child: widget.child),
      );
}

/// Moving shine used by skeleton placeholders.
class Shimmer extends StatefulWidget {
  final Widget child;
  const Shimmer({super.key, required this.child});
  @override
  State<Shimmer> createState() => _ShimmerState();
}

class _ShimmerState extends State<Shimmer> with SingleTickerProviderStateMixin {
  late final AnimationController c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1300))..repeat();
  @override
  void dispose() { c.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: c,
        child: widget.child,
        builder: (context, child) => ShaderMask(
          blendMode: BlendMode.srcATop,
          shaderCallback: (r) => LinearGradient(
            begin: Alignment(-1.5 + c.value * 3, 0), end: Alignment(-0.5 + c.value * 3, 0),
            colors: const [Color(0xFFD9DDEA), Color(0xFFF3F4F8), Color(0xFFD9DDEA)],
          ).createShader(r),
          child: child,
        ),
      );
}

/// A skeleton list shown while data loads, instead of a spinner.
class SkeletonList extends StatelessWidget {
  final int rows;
  const SkeletonList({super.key, this.rows = 6});
  Widget _bar(double w, double h) => Container(width: w, height: h, decoration: BoxDecoration(color: const Color(0xFFD9DDEA), borderRadius: BorderRadius.circular(4)));
  @override
  Widget build(BuildContext context) => Shimmer(
        child: ListView(
          physics: const NeverScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          children: [
            for (var i = 0; i < rows; i++)
              Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(6), border: Border.all(color: const Color(0xFFD9DDEA))),
                child: Row(children: [
                  Container(width: 40, height: 40, decoration: const BoxDecoration(color: Color(0xFFD9DDEA), shape: BoxShape.circle)),
                  const SizedBox(width: 12),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [_bar(150 + (i % 3) * 30, 12), const SizedBox(height: 8), _bar(90, 10)])),
                ]),
              ),
          ],
        ),
      );
}

/// Page transition: the new page slides up a little while fading in; the old one drifts back.
class SlideFadeTransitions extends PageTransitionsBuilder {
  const SlideFadeTransitions();
  @override
  Widget buildTransitions<T>(PageRoute<T> route, BuildContext context, Animation<double> a, Animation<double> sec, Widget child) {
    final curved = CurvedAnimation(parent: a, curve: Curves.easeOutCubic, reverseCurve: Curves.easeInCubic);
    return FadeTransition(
      opacity: curved,
      child: SlideTransition(position: Tween(begin: const Offset(0.06, 0), end: Offset.zero).animate(curved), child: child),
    );
  }
}
