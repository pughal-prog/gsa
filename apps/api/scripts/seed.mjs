// Generates scripts/seed.sql with DEMO data. Demo password for every account: Demo@1234
// Never run this against production.
import { pbkdf2Sync, randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'

const hash = (pw) => {
  const salt = randomBytes(16)
  return `pbkdf2$100000$${salt.toString('base64')}$${pbkdf2Sync(pw, salt, 100000, 32, 'sha256').toString('base64')}`
}
const q = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`)
const out = []
const ins = (t, o) => out.push(`INSERT INTO ${t} (${Object.keys(o).join(',')}) VALUES (${Object.values(o).map(q).join(',')});`)
const PW = 'Demo@1234'
const day = (offset) => new Date(Date.now() - offset * 864e5).toISOString().slice(0, 10)
const month = (m) => { const d = new Date(); d.setMonth(d.getMonth() - m); return d.toISOString().slice(0, 7) }

out.push('DELETE FROM audit_log; DELETE FROM queries; DELETE FROM notifications; DELETE FROM attendance; DELETE FROM equipment_txns; DELETE FROM equipment; DELETE FROM expenses; DELETE FROM incomes; DELETE FROM fees; DELETE FROM fee_plans; DELETE FROM academic_records; DELETE FROM matches; DELETE FROM achievements; DELETE FROM enrollments; DELETE FROM students; DELETE FROM staff; DELETE FROM users;')

ins('users', { id: 1, username: 'owner', email: 'owner@example.com', password_hash: hash(PW), role: 'owner', name: 'Academy Owner', must_change_password: 0 })
const staffRows = [
  ['Arjun Menon', 1, 8, 'National referee', 'Epee and foil coach', 'Senior National medallist (Epee)', 'Fencing'],
  ['Divya Raman', 2, 6, 'State coach', 'Table tennis coaching, level 2', 'State doubles champion', 'Table Tennis'],
  ['Karthik Subbu', 4, 10, 'FIDE instructor', 'FIDE trainers course', 'FIDE rated 2050', 'Chess'],
  ['Meena Iyer', 5, 5, 'Certified trainer', 'Strength and conditioning', 'Sports science diploma', 'Physical Fitness'],
]
staffRows.forEach(([name, sport, exp, cat, train, ach, domain], i) => {
  const uid = 10 + i
  ins('users', { id: uid, username: `staff${i + 1}`, email: `staff${i + 1}@example.com`, password_hash: hash(PW), role: 'staff', name, must_change_password: 0 })
  ins('staff', { id: i + 1, user_id: uid, name, dob: `198${i}-0${i + 3}-1${i}`, phone: `98400000${i}${i}`, primary_sport_id: sport, experience_years: exp, category: cat, training: train, achievements: ach, major_domain: domain, joined_on: '2023-06-01' })
})
// coach 4 can also view all students (demo of granular permissions)
out.push(`UPDATE staff SET permissions = '["students.view","students.viewAll","attendance.mark","achievements.edit","fees.view","equipment.view"]' WHERE id = 4;`)

const names = ['Aarav Kumar', 'Diya Sharma', 'Rohan Iyer', 'Ananya Reddy', 'Vihaan Nair', 'Ishita Das', 'Kabir Singh', 'Meera Pillai', 'Aditya Rao', 'Sneha Joseph', 'Arnav Gupta', 'Tara Krishnan']
const schools = ['DAV Matriculation', 'Velammal School', 'PSBB', 'Chettinad Vidyashram']
const cats = ['Sub-Junior', 'Junior', 'Cadet', 'Senior']
const parentNames = ['Suresh Kumar', 'Priya Sharma', 'Venkat Iyer', 'Lakshmi Reddy', 'Gopal Nair', 'Anil Das', 'Harpreet Singh', 'Radha Pillai', 'Mohan Rao', 'Thomas Joseph', 'Rajesh Gupta', 'Uma Krishnan']
names.forEach((name, i) => {
  const id = i + 1, uid = 100 + i
  ins('users', { id: uid, username: `GSA-S-${String(id).padStart(4, '0')}`, email: i === 0 ? 'student1@example.com' : null, password_hash: hash(PW), role: 'student', name, must_change_password: 0 })
  ins('students', {
    id, user_id: uid, admission_no: `GSA-S-${String(id).padStart(4, '0')}`, name,
    dob: `${2008 + (i % 6)}-0${(i % 9) + 1}-1${i % 9}`, birthplace: 'Chennai', identification_mark: 'Mole on left forearm', address: `${12 + i}, Anna Nagar, Chennai 600040`,
    parent_name: parentNames[i], parent_phone: `+91 90000 000${String(i).padStart(2, '0')}`, parent_email: `parent${id}@example.com`, parent_occupation: ['Engineer', 'Teacher', 'Doctor', 'Business'][i % 4],
    joined_on: `2024-0${(i % 9) + 1}-05`, school: schools[i % 4], academic_year: `Class ${5 + (i % 6)}`, studying: `Grade ${5 + (i % 6)}`, remarks: i % 3 === 0 ? 'Disciplined and punctual' : 'Needs focus on footwork',
    biometric_id: String(1000 + id), batch_time: i % 2 ? '17:00' : '16:00', status: 'active',
  })
  const sport = [1, 2, 4, 3, 5][i % 5]
  ins('enrollments', { student_id: id, sport_id: sport, staff_id: sport === 3 ? 2 : sport === 5 ? 4 : staffRows.findIndex((s) => s[1] === sport) + 1, level: ['Beginner', 'Intermediate', 'Advanced'][i % 3], category: cats[i % 4], joined_on: `2024-0${(i % 9) + 1}-05`, sport_meta: sport === 1 ? JSON.stringify({ weapon: ['Epee', 'Foil', 'Sabre'][i % 3] }) : sport === 4 ? JSON.stringify({ rating: 900 + i * 60 }) : null })
  if (i % 3 === 0 && sport !== 5) ins('enrollments', { student_id: id, sport_id: 5, staff_id: 4, level: 'Beginner', category: 'Fitness', joined_on: '2025-01-10' })
  for (const [t, y, p] of [['Term 1', '2025-26', 70 + ((i * 7) % 20)], ['Term 2', '2025-26', 73 + ((i * 5) % 20)]]) ins('academic_records', { student_id: id, term: t, year: y, percentage: p })
  // fees
  for (let m = 3; m >= 0; m--) {
    const paid = m > 0 || i % 4 !== 0
    ins('fees', { student_id: id, description: `Monthly fee ${month(m)}`, amount: 1500 + (sport === 1 ? 500 : 0), due_date: `${month(m)}-10`, status: paid ? 'paid' : 'pending', paid_on: paid ? `${month(m)}-08` : null, method: paid ? ['upi', 'cash', 'razorpay'][i % 3] : null })
    if (paid) ins('incomes', { type: 'student_fee', amount: 1500 + (sport === 1 ? 500 : 0), student_id: id, note: `Monthly fee ${month(m)}`, income_date: `${month(m)}-08` })
  }
  // attendance (last 6 days)
  for (let d = 1; d <= 6; d++) {
    const st = (i + d) % 7 === 0 ? 'absent' : (i + d) % 5 === 0 ? 'late' : 'present'
    ins('attendance', { student_id: id, att_date: day(d), check_in: st === 'absent' ? null : st === 'late' ? '17:22' : '16:52', status: st, source: 'biometric' })
  }
})
// achievements & matches
const ach = [
  [1, 1, 'Tamil Nadu State Fencing Championship', 'State', 'Gold', 5000], [3, 4, 'District Chess Open U-13', 'District', 'Runner-up', 2000],
  [2, 2, 'Chennai District TT Championship', 'District', 'Winner', 3000], [5, 5, 'Inter-school Fitness Challenge', 'District', 'Third', 0],
  [6, 1, 'South Zone Fencing', 'Zonal', 'Silver', 4000], [4, 3, 'State Carrom Meet', 'State', 'Semi-finalist', 0],
]
ach.forEach(([sid, sp, title, level, pos, prize], i) => {
  ins('achievements', { student_id: sid, sport_id: sp, title, level, position: pos, event_date: day(20 + i * 25), cash_prize: prize })
  ins('matches', { student_id: sid, sport_id: sp, event: title, category: level, event_date: day(20 + i * 25), result: pos })
  if (prize) ins('incomes', { type: 'cash_prize', amount: prize, student_id: sid, note: `Prize: ${title}`, income_date: day(20 + i * 25) })
})
for (let m = 5; m >= 0; m--) ins('incomes', { type: 'entry_fee', amount: 2000 + m * 300, note: 'Annual entry/admission fees', income_date: `${month(m)}-03` })
ins('incomes', { type: 'other', amount: 8000, note: 'Tournament sponsorship (pending)', income_date: day(2), status: 'pending' })
for (let m = 5; m >= 0; m--) {
  ins('expenses', { category: 'Staff salaries', amount: 42000, note: 'Monthly payroll', expense_date: `${month(m)}-01` })
  ins('expenses', { category: 'Rent and utilities', amount: 18000, expense_date: `${month(m)}-02` })
}
// plans
for (const [sp, amt] of [[1, 2000], [2, 1500], [3, 1200], [4, 1500], [5, 1000]]) ins('fee_plans', { sport_id: sp, name: 'Monthly coaching', amount: amt, period: 'monthly' })
// equipment
const eq = [['Epee blade', 1, 9, 3, 1800, 2400], ['Fencing mask', 1, 2, 3, 3500, 4500], ['Fencing jacket', 1, 6, 3, 2800, 3600], ['TT bat (pro)', 2, 14, 4, 1200, 1700], ['TT balls (box of 6)', 2, 40, 10, 150, 220], ['Chess clock (digital)', 4, 5, 2, 1400, 1900], ['Carrom striker set', 3, 12, 4, 250, 350], ['Resistance bands', 5, 1, 3, 400, 600]]
eq.forEach(([name, sp, qty, rl, cost, sale], i) => ins('equipment', { id: i + 1, name, sport_id: sp, qty, reorder_level: rl, cost_price: cost, sale_price: sale }))
ins('equipment_txns', { equipment_id: 4, type: 'sale', qty: 1, amount: 1700, student_id: 2, party: 'Parent of Diya Sharma', txn_date: day(9) })
ins('equipment_txns', { equipment_id: 2, type: 'damage', qty: 1, amount: 0, student_id: 1, txn_date: day(12), note: 'Mesh torn during practice' })
ins('equipment_txns', { equipment_id: 6, type: 'purchase', qty: 5, amount: 7000, party: 'Chess India Supplies', txn_date: day(30) })
ins('queries', { user_id: 100, kind: 'suggestion', subject: 'Weekend batch', message: 'Could we have a Saturday morning fencing batch?' })
writeFileSync(new URL('./seed.sql', import.meta.url), out.join('\n'))
console.log('seed.sql written. Demo logins (password Demo@1234): owner, staff1..staff4, GSA-S-0001..GSA-S-0012')
