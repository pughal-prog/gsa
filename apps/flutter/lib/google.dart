import 'package:google_sign_in/google_sign_in.dart';

/// Web client ID from Google Cloud (same project as the website). Needed so Google returns an ID token the server can verify.
const googleWebClientId = String.fromEnvironment('GOOGLE_WEB_CLIENT_ID', defaultValue: '1096600533188-a3sq311vksegnupn00u450ilhvpgqhd1.apps.googleusercontent.com');

class GoogleLogin {
  final String idToken, email, name;
  GoogleLogin(this.idToken, this.email, this.name);
}

/// Opens the Google account picker. Returns null if the person cancelled.
Future<GoogleLogin?> pickGoogleAccount() async {
  final g = GoogleSignIn(scopes: const ['email', 'profile'], serverClientId: googleWebClientId);
  try { await g.signOut(); } catch (_) {}
  final acc = await g.signIn();
  if (acc == null) return null;
  final auth = await acc.authentication;
  final t = auth.idToken;
  if (t == null) throw Exception('Google did not return a sign-in token. Please try again.');
  return GoogleLogin(t, acc.email, acc.displayName ?? '');
}
