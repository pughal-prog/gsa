# Deployment (needs your explicit approval; nothing here was applied to production)

1. Backup D1, then apply migrations `0006` (if not yet applied) and `0007_face_attendance.sql`. 0007 is additive: one new nullable column `attendance.check_out` and four new tables. Existing rows and endpoints are untouched.
   `cd apps/api && npx wrangler d1 migrations apply <db> --remote`
2. Deploy the API: `npx wrangler deploy`. Deploy the website (`apps/web`, Cloudflare Pages build).
3. In Staff, give face managers the "Face attendance" permission (owner always has it).
4. Add the GitHub secret `ANDROID_KEYSTORE_B64` (base64 of a keystore you keep safe), push, download the APK.
Rollback: the old API ignores the new tables and column. Revoke devices from the website to cut phone access immediately.
