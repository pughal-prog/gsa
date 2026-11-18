import 'dart:async';
import 'package:flutter/material.dart';
import 'api.dart';
import 'main.dart';
import 'google.dart';
import 'motion.dart';

/// Home page shown before sign in: auto-running academy photos plus Sign in and Sign up.
class Welcome extends StatefulWidget {
  final VoidCallback onSignedIn;
  const Welcome({super.key, required this.onSignedIn});
  @override
  State<Welcome> createState() => _WelcomeState();
}

class _WelcomeState extends State<Welcome> {
  List<String> photos = [];
  int i = 0;
  Timer? t;

  @override
  void initState() {
    super.initState();
    Api.get('/public/gallery').then((r) {
      if (!mounted) return;
      setState(() => photos = (r['photos'] as List).map((p) => '$apiUrl/public/gallery/file/${Uri.encodeComponent(p['key'])}').toList());
    }).catchError((_) {});
    t = Timer.periodic(const Duration(seconds: 4), (_) { if (mounted && photos.length > 1) setState(() => i = (i + 1) % photos.length); });
  }

  @override
  void dispose() { t?.cancel(); super.dispose(); }

  void _open(Widget w) => Navigator.push(context, MaterialPageRoute(builder: (_) => w));

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(fit: StackFit.expand, children: [
        Container(color: const Color(0xFF0A0F24)),
        if (photos.isNotEmpty)
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 1200),
            child: TweenAnimationBuilder<double>(
              key: ValueKey(i), tween: Tween(begin: 1.0, end: 1.1), duration: const Duration(seconds: 6),
              builder: (c, s, _) => Transform.scale(scale: s, child: Image.network(photos[i], fit: BoxFit.cover, width: double.infinity, height: double.infinity, errorBuilder: (_, __, ___) => const SizedBox())),
            ),
          ),
        TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: 1), duration: const Duration(seconds: 7), curve: Curves.easeInOut,
          builder: (c, v, _) => Container(decoration: BoxDecoration(gradient: LinearGradient(
            begin: Alignment(-1 + v * .6, -1), end: Alignment(1, 1),
            colors: [const Color(0xFF2540F2).withOpacity(.55), Colors.black.withOpacity(.35), Colors.black.withOpacity(.88)],
            stops: const [0, .45, 1]))),
        ),
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Spacer(),
              Reveal(delay: const Duration(milliseconds: 100), child: Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4), decoration: BoxDecoration(color: volt, borderRadius: BorderRadius.circular(20)),
                  child: const Text('Indoor sports academy · Namakkal', style: TextStyle(color: ink, fontSize: 12, fontWeight: FontWeight.w700)))),
              const SizedBox(height: 14),
              const Reveal(delay: Duration(milliseconds: 220), child: Text('Global Sports\nAcademy', style: TextStyle(color: Colors.white, fontSize: 46, fontWeight: FontWeight.w900, height: 1.0, letterSpacing: -1.2))),
              const SizedBox(height: 8),
              const Reveal(delay: Duration(milliseconds: 340), child: Text('Fencing · Table tennis · Carrom · Chess · Fitness', style: TextStyle(color: Colors.white70))),
              const SizedBox(height: 28),
              Reveal(delay: const Duration(milliseconds: 460), child: FilledButton(onPressed: () => _open(SignIn(onSignedIn: widget.onSignedIn)), child: const Text('Sign in'))),
              const SizedBox(height: 10),
              Reveal(delay: const Duration(milliseconds: 540), child: OutlinedButton(
                onPressed: () => _open(const SignUp()),
                style: OutlinedButton.styleFrom(foregroundColor: Colors.white, side: const BorderSide(color: Colors.white70), minimumSize: const Size.fromHeight(50), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                child: const Text('Create an account'),
              )),
              const SizedBox(height: 8),
            ]),
          ),
        ),
      ]),
    );
  }
}

class SignIn extends StatefulWidget {
  final VoidCallback onSignedIn;
  const SignIn({super.key, required this.onSignedIn});
  @override
  State<SignIn> createState() => _SignInState();
}

class _SignInState extends State<SignIn> {
  final u = TextEditingController(), p = TextEditingController();
  bool busy = false, show = false;
  String err = '';

  Future<void> go() async {
    setState(() { busy = true; err = ''; });
    try {
      await Api.login(u.text.trim(), p.text);
      if (!mounted) return;
      Navigator.popUntil(context, (r) => r.isFirst);
      widget.onSignedIn();
    } catch (e) {
      setState(() => err = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> google() async {
    setState(() { busy = true; err = ''; });
    GoogleLogin? g;
    try {
      g = await pickGoogleAccount();
      if (g == null) return;
      await Api.loginGoogle(g.idToken);
      if (!mounted) return;
      Navigator.popUntil(context, (r) => r.isFirst);
      widget.onSignedIn();
    } on ApiError catch (e) {
      if (!mounted) return;
      if (e.code == 'not_registered') {
        final go = await showDialog<bool>(context: context, builder: (c) => AlertDialog(
          title: const Text('No account yet'),
          content: const Text('This Google email is not registered with the academy. Create an account and the owner will approve it.'),
          actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')), FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('Create account'))],
        ));
        if (go == true && mounted) {
          Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => SignUp(email: g?.email, name: g?.name)));
        }
      } else {
        setState(() => err = e.message);
      }
    } catch (e) {
      if (mounted) setState(() => err = 'Google sign-in did not work. ${e.toString().replaceAll('Exception: ', '')}');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Sign in')),
      body: ListView(padding: const EdgeInsets.all(24), children: [
        const Reveal(child: Text('Welcome back', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800))),
        const SizedBox(height: 4),
        const Text('Use the ID given by the academy, or the email you signed up with.', style: TextStyle(color: Colors.black54)),
        const SizedBox(height: 24),
        Reveal(index: 1, child: TextField(controller: u, decoration: const InputDecoration(labelText: 'ID or email'), autocorrect: false, textInputAction: TextInputAction.next)),
        const SizedBox(height: 12),
        Reveal(index: 2, child: TextField(controller: p, obscureText: !show, onSubmitted: (_) => go(),
            decoration: InputDecoration(labelText: 'Password', suffixIcon: IconButton(icon: Icon(show ? Icons.visibility_off : Icons.visibility), onPressed: () => setState(() => show = !show))))),
        if (err.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 12), child: Text(err, style: const TextStyle(color: Colors.red))),
        const SizedBox(height: 20),
        FilledButton(onPressed: busy ? null : go, child: busy ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Sign in')),
        const SizedBox(height: 14),
        Row(children: const [Expanded(child: Divider()), Padding(padding: EdgeInsets.symmetric(horizontal: 12), child: Text('or', style: TextStyle(color: Colors.black45))), Expanded(child: Divider())]),
        const SizedBox(height: 14),
        Pressable(
          onTap: busy ? null : google,
          child: Container(
            height: 50,
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(6), border: Border.all(color: const Color(0xFFD9DDEA))),
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: const [
              Text('G', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Color(0xFF4285F4))),
              SizedBox(width: 10),
              Text('Continue with Google', style: TextStyle(fontWeight: FontWeight.w600)),
            ]),
          ),
        ),
        TextButton(onPressed: () => Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const SignUp())), child: const Text('New here? Create an account')),
      ]),
    );
  }
}

class SignUp extends StatefulWidget {
  final String? email, name;
  const SignUp({super.key, this.email, this.name});
  @override
  State<SignUp> createState() => _SignUpState();
}

class _SignUpState extends State<SignUp> {
  String role = 'student';
  final c = {for (final k in ['name', 'email', 'phone', 'password', 'parent_name']) k: TextEditingController()};
  bool busy = false, done = false;
  String err = '';

  @override
  void initState() {
    super.initState();
    if (widget.email != null) c['email']!.text = widget.email!;
    if (widget.name != null) c['name']!.text = widget.name!;
  }

  Future<void> go() async {
    setState(() { busy = true; err = ''; });
    try {
      await Api.post('/auth/signup', {
        'role': role, 'name': c['name']!.text.trim(), 'email': c['email']!.text.trim(), 'phone': c['phone']!.text.trim(),
        'password': c['password']!.text, if (role == 'student') 'parent_name': c['parent_name']!.text.trim(),
      });
      setState(() => done = true);
    } catch (e) {
      setState(() => err = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Widget f(String k, String label, {TextInputType? type, bool obscure = false}) => Padding(
      padding: const EdgeInsets.only(bottom: 12), child: TextField(controller: c[k], keyboardType: type, obscureText: obscure, decoration: InputDecoration(labelText: label)));

  @override
  Widget build(BuildContext context) {
    if (done) {
      return Scaffold(appBar: AppBar(), body: Padding(padding: const EdgeInsets.all(28), child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        const Icon(Icons.check_circle, size: 64, color: leaf), const SizedBox(height: 12),
        const Text('Registration received', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)), const SizedBox(height: 8),
        const Text('The academy owner has been notified. You can sign in once your account is approved.', textAlign: TextAlign.center),
        const SizedBox(height: 24), FilledButton(onPressed: () => Navigator.pop(context), child: const Text('Back')),
      ])));
    }
    return Scaffold(
      appBar: AppBar(title: const Text('Create account')),
      body: ListView(padding: const EdgeInsets.all(24), children: [
        SegmentedButton<String>(
          segments: const [ButtonSegment(value: 'student', label: Text('Student / parent')), ButtonSegment(value: 'staff', label: Text('Coach'))],
          selected: {role}, onSelectionChanged: (s) => setState(() => role = s.first)),
        const SizedBox(height: 16),
        f('name', 'Full name'), f('email', 'Email', type: TextInputType.emailAddress), f('phone', 'Phone', type: TextInputType.phone),
        if (role == 'student') f('parent_name', 'Parent / guardian name'),
        f('password', 'Password (8+ characters)', obscure: true),
        if (err.isNotEmpty) Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(err, style: const TextStyle(color: Colors.red))),
        FilledButton(onPressed: busy ? null : go, child: busy ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Submit for approval')),
      ]),
    );
  }
}
