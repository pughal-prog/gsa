# Global Sports Academy: Phase 1

Web and mobile platform for an indoor sports academy (fencing, table tennis, carrom, chess, physical fitness) at **globalsportsacademy.in**.

## Stack

| Part | Tech | Hosting |
|---|---|---|
| Web (`apps/web`) | React 18, Vite, TypeScript, Tailwind v4, Recharts | Cloudflare Pages |
| API (`apps/api`) | Hono on Cloudflare Workers, D1 (SQLite), R2 (photos), Cron Triggers | Cloudflare Workers |
| Mobile (`apps/mobile`) | Expo (React Native), Expo Router, SecureStore | App Store / Play Store via EAS |

Everything runs on Cloudflare's edge, so there are no servers to manage and the free tier is enough to start.

## What Phase 1 includes

**Sign in and sign up:** owner, staff and student logins with IDs and passwords issued by the academy (PBKDF2 hashed), plus self sign-up (student/parent or coach) by email or **Google**. New sign-ups wait on the owner's **Approvals** page and cannot sign in until approved. Google sign-in works for approved accounts. Accounts created by the owner must change their temporary password at first sign-in.

**Delete student (owner only):** a separate danger zone on each student page and a trash icon in the student list. Removes the student, login, attendance, fees, photos and notifications; income and equipment history is kept but unlinked. The admission number must be typed to confirm.

**Owner:** academy overview (income, expenses, net, pending fees, monthly report, academic growth, attendance, sport mix), students (full profile: parents, school/college, sports, coach, category, achievements, matches, remarks, fees, equipment bought or damaged, photos), staff (profile, experience, training, achievements, students trained, per-person permissions), fees and billing, income by source (student fees, entry fees, cash prizes, equipment sales, other, with pending amounts), expenses, equipment stock (purchases, sales to students, issues, damages, low-stock alerts), notifications, queries and suggestions inbox.

**Staff:** sees only what the owner grants. Default: their own students, attendance, achievements, fee status. The owner is also a staff member and has every permission.

**Student / parent:** Athlete Passport (profile, sports, achievements, remarks, photos, academics, attendance, fees with online payment, notifications), help and feedback.

**Automation:** biometric scan sends a parent alert; late arrival (after batch time plus grace) and absence alerts; fee due and overdue reminders; payment receipts. Razorpay checkout for fees, verified by signature and webhook.

**What is different from typical Indian academy sites:** each student has an *Athlete Passport* (a lasting career record across sports, levels and categories from sub-junior to national), sport-specific fields (fencing weapon, chess rating), a full equipment ledger tied to students, and a parent alert centre. Most academy sites in India are brochure pages with an enquiry form, and most management tools only cover fees and attendance.

## Run locally

Requirements: Node 20+.

```bash
npm install
cp apps/api/.dev.vars.example apps/api/.dev.vars   # then edit the secrets
npm run db:migrate:local       # run again after updates, it only applies new migrations
npm run db:seed:local          # DEMO data only
npm run dev:api                # http://localhost:8787
npm run dev:web                # http://localhost:5173
```

Demo logins (password `Demo@1234`): `owner`, `staff1` to `staff4`, `GSA-S-0001` to `GSA-S-0012`. Never seed production.

Test the biometric flow:

```bash
curl -X POST http://localhost:8787/device/biometric -H "x-device-key: <BIOMETRIC_DEVICE_KEY>" -H "content-type: application/json" -d '{"biometric_id":"1003"}'
```

Mobile (separate install, not part of the root workspace):

```bash
cd apps/mobile && npm install && cp .env.example .env
npx expo start     # scan with Expo Go; set EXPO_PUBLIC_API_URL to your PC's LAN IP
```

## Deploy to Cloudflare

1. `npx wrangler login`
2. API:
   - `cd apps/api && npx wrangler d1 create gsa-db` and paste the `database_id` into `wrangler.toml`
   - `npx wrangler r2 bucket create gsa-media`
   - `npm run db:migrate:remote`
   - Secrets: `npx wrangler secret put JWT_SECRET` (long random), `BIOMETRIC_DEVICE_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, and later `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_TEMPLATE`
   - Set `GOOGLE_CLIENT_ID` in `wrangler.toml`, uncomment the `routes` line, then `npm run deploy`
3. Create the owner account in production (no demo data):
   `npx wrangler d1 execute gsa-db --remote --command "INSERT INTO users (username,email,password_hash,role,name) VALUES ('owner','you@gmail.com','<hash>','owner','Owner')"`. Generate `<hash>` with the helper in `apps/api/scripts/seed.mjs` (`hash()` function), then change the password after first login.
4. Web: set `VITE_API_URL=https://api.globalsportsacademy.in` and `VITE_GOOGLE_CLIENT_ID` in the Pages project settings, then `cd apps/web && npm run deploy` (or connect the Git repo with build command `npm run build -w apps/web`, output `apps/web/dist`). Add `globalsportsacademy.in` as the custom domain.
5. Razorpay: add webhook `https://api.globalsportsacademy.in/webhooks/razorpay` for `payment.captured`.
6. Google: create an OAuth Web client, add `https://globalsportsacademy.in` as an authorised origin.

## Biometric device

The API takes `POST /device/biometric` with header `X-Device-Key` and body `{ "biometric_id": "..." }`. Most fingerprint terminals can push scans to an HTTP endpoint, or a small Raspberry Pi / PC gateway next to the device can forward them. Only the device-side ID is stored. Fingerprint templates stay on the device, which keeps the academy on the right side of India's DPDP Act for children's data.

## Security notes

- Passwords: PBKDF2-SHA256, constant-time comparison. Tokens expire after 12 hours.
- Every query is parameterised. Access is checked on the server per role, per permission and per student.
- Photos live in a private R2 bucket and are served only to people allowed to see that student.
- Audit log table records sensitive changes.
- Before going live: add Cloudflare rate limiting on `/auth/login`, take explicit parental consent for photos and biometrics, and register the WhatsApp message templates.

## Phase 2 ideas (when you share the academy details)

Real branding and photos, public admission enquiry form, batch timetable and coach scheduling, tournament and rating tracking, native Razorpay and push notifications in the mobile app, receipts as PDF, staff payroll, Hindi/Tamil language switch, CSV and PDF report exports.

## Google sign-in setup (one time)

1. Google Cloud Console, create a project, then APIs and Services, OAuth consent screen (External), add the app name and your email.
2. Credentials, Create credentials, OAuth client ID, type **Web application**. Add authorised JavaScript origins: `http://localhost:5173` and `https://globalsportsacademy.in`.
3. Copy the client ID into `apps/web/.env.local` as `VITE_GOOGLE_CLIENT_ID=...` and into `apps/api/wrangler.toml` as `GOOGLE_CLIENT_ID`. For production also set it in the Cloudflare Pages project variables.
4. Mobile: create Android and iOS client IDs the same way and put them in `apps/mobile/.env`.

## Academy details

Phone, address and the PIN code live in `apps/web/src/site.ts` (the PIN code is still empty, add it there). Logo files are in `apps/web/public` and `apps/mobile/assets`.
