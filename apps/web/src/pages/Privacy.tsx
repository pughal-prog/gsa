import { Link } from 'react-router-dom'

export default function Privacy() {
  return (
    <div className="min-h-screen bg-page px-5 py-12">
      <div className="mx-auto max-w-2xl">
        <Link to="/" className="text-sm font-semibold text-flame">← Global Sports Academy</Link>
        <h1 className="mt-4 font-display text-3xl font-bold text-ink">Privacy policy and terms</h1>
        <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-ink/80">
          <p>Global Sports Academy uses this website and app to manage students, coaches, attendance, fees and announcements.</p>
          <p><b>What we collect.</b> Details you or the academy enter: name, contact details, parent details, sport enrolment, attendance, fees and (optionally) health information given for safety. When you sign in with Google we receive only your name and email address, to match you to your academy account.</p>
          <p><b>How we use it.</b> Only to run the academy: sign-in, attendance, fee bills, notifications to parents, and safety. We do not sell data or show ads.</p>
          <p><b>Who can see it.</b> The academy owner, the coaches you are assigned to (limited to what the owner allows), and the student or parent for their own record. Health details are visible only to the owner and the student.</p>
          <p><b>Your choices.</b> Ask the academy owner to correct or delete your record at any time.</p>
          <p><b>Terms.</b> Use the service only for the academy's purposes and keep your password private.</p>
        </div>
      </div>
    </div>
  )
}
