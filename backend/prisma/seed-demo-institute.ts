/**
 * Seeds one demo institute with a login for each role, for local / staging use:
 *
 *   - Institution          (DEMO_INST)
 *   - State Directorate    (the "director" user)
 *   - Principal
 *   - Teacher              (the mentor)
 *   - Student              (assigned to the mentor)
 *   - Branch + Batch       (needed by the student and mentor)
 *
 * Safe to run again: everything is looked up by code / email / roll number and updated in
 * place, never duplicated. Passwords are only set when a user is created, unless --reset-passwords.
 *
 * Usage:
 *   npm run seed:demo-institute
 *   npm run seed:demo-institute -- --dry-run
 *   npm run seed:demo-institute -- --reset-passwords
 *   SEED_PASSWORD='Something@123' npm run seed:demo-institute
 *
 * Safety:
 *   - Refuses to run when NODE_ENV=production (add --force only if you really mean it).
 *   - Writing to a database that is not on this machine needs --yes (a dry run never writes).
 *
 * Cloud databases with their own CA (e.g. Aiven): download the CA certificate from the provider
 * and either set DATABASE_CA_CERT=C:pathca.pem, or start Node with NODE_EXTRA_CA_CERTS=C:pathca.pem.
 * Certificate checking stays ON; it is never disabled here.
 */
import { PrismaClient, Role, Designation, InstitutionType } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import * as fs from 'fs';
import 'dotenv/config';

const BCRYPT_SALT_ROUNDS = 10; // same as the auth service
const PASSWORD = process.env.SEED_PASSWORD || 'Demo@12345';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run') || args.includes('-d');
const RESET_PASSWORDS = args.includes('--reset-passwords');
const FORCE = args.includes('--force');
const YES = args.includes('--yes') || args.includes('-y');

const INSTITUTE = {
  code: 'DEMO_INST',
  name: 'Demo Government Polytechnic',
  shortName: 'DGP',
  type: InstitutionType.GOVT_POLYTECHNIC,
  address: '1 College Road',
  city: 'Chandigarh',
  state: 'Punjab',
  district: 'Chandigarh',
  pinCode: '160001',
  contactEmail: 'demo.institute@example.com',
  contactPhone: '9000000000',
};
const BRANCH = { code: 'DEMO_CSE', name: 'Computer Science Engineering', shortName: 'CSE', duration: 3 };
const BATCH_NAME = 'DEMO 2025-28';

const USERS = {
  director: { email: 'director@demo.test', name: 'Demo Director', phoneNo: '9000000001', role: Role.STATE_DIRECTORATE },
  principal: { email: 'principal@demo.test', name: 'Demo Principal', phoneNo: '9000000002', role: Role.PRINCIPAL },
  mentor: { email: 'mentor@demo.test', name: 'Demo Mentor', phoneNo: '9000000003', role: Role.TEACHER },
  student: { email: 'student@demo.test', name: 'Demo Student', phoneNo: '9000000004', role: Role.STUDENT, rollNumber: 'DEMO001' },
} as const;

if (process.env.NODE_ENV === 'production' && !FORCE) {
  console.error('Refusing to seed demo data while NODE_ENV=production (use --force to override).');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

// Connection: with DATABASE_CA_CERT the CA is trusted explicitly; sslmode is dropped from the URL
// because pg would otherwise override the ssl option with its own sslmode handling.
const dbUrl = new URL(process.env.DATABASE_URL);
const isLocal = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(dbUrl.hostname);
const caPath = process.env.DATABASE_CA_CERT;
let poolConfig: ConstructorParameters<typeof Pool>[0] = { connectionString: process.env.DATABASE_URL };
if (caPath) {
  if (!fs.existsSync(caPath)) {
    console.error(`DATABASE_CA_CERT file not found: ${caPath}`);
    process.exit(1);
  }
  dbUrl.searchParams.delete('sslmode');
  poolConfig = { connectionString: dbUrl.toString(), ssl: { ca: fs.readFileSync(caPath, 'utf8'), rejectUnauthorized: true } };
}
if (!isLocal && !DRY_RUN && !YES) {
  console.error(
    `Target database is remote (${dbUrl.hostname}). This seeds demo logins (including a State Directorate account) there.
` +
      'Re-run with --yes if that is really what you want, or use --dry-run to only look.',
  );
  process.exit(1);
}
console.log(`Database: ${dbUrl.hostname}${isLocal ? ' (local)' : ' (REMOTE)'}`);

const pool = new Pool(poolConfig);
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) } as any);

const log = (msg: string) => console.log(`${DRY_RUN ? '[dry-run] ' : ''}${msg}`);

async function main() {
  const hash = await bcrypt.hash(PASSWORD, BCRYPT_SALT_ROUNDS);

  const existing = {
    institution: await prisma.institution.findUnique({ where: { code: INSTITUTE.code } }),
    branch: await prisma.branch.findUnique({ where: { code: BRANCH.code } }),
    batch: await prisma.batch.findUnique({ where: { name: BATCH_NAME } }),
  };
  log(`Institution ${INSTITUTE.code}: ${existing.institution ? 'exists, will update' : 'will be created'}`);
  if (DRY_RUN) {
    for (const [k, u] of Object.entries(USERS)) {
      const found = await prisma.user.findUnique({ where: { email: u.email } });
      log(`${k.padEnd(9)} ${u.email}: ${found ? 'exists' : 'will be created'}`);
    }
    return;
  }

  const institution = await prisma.institution.upsert({
    where: { code: INSTITUTE.code },
    update: { ...INSTITUTE, isActive: true },
    create: { ...INSTITUTE, isActive: true },
  });

  const branch = await prisma.branch.upsert({
    where: { code: BRANCH.code },
    update: { institutionId: institution.id, isActive: true },
    create: { ...BRANCH, institutionId: institution.id, isActive: true },
  });

  const batch = await prisma.batch.upsert({
    where: { name: BATCH_NAME },
    update: { institutionId: institution.id, isActive: true },
    create: { name: BATCH_NAME, institutionId: institution.id, isActive: true },
  });

  const now = new Date();
  const common = {
    active: true,
    // dev accounts: skip the forced "change default password" step
    hasChangedDefaultPassword: true,
    passwordChangedAt: now,
    consent: true,
    consentAt: now,
  };
  const upsertUser = async (u: { email: string; name: string; phoneNo: string; role: Role }, extra: Record<string, any> = {}) => {
    const data = { name: u.name, phoneNo: u.phoneNo, role: u.role, ...common, ...extra };
    return prisma.user.upsert({
      where: { email: u.email },
      update: { ...data, ...(RESET_PASSWORDS ? { password: hash } : {}) },
      create: { email: u.email, password: hash, ...data },
    });
  };

  // State director: not tied to one institution
  const director = await upsertUser(USERS.director, { institutionId: null });

  const principal = await upsertUser(USERS.principal, {
    institutionId: institution.id,
    designation: 'Principal',
    designationEnum: Designation.PRINCIPAL,
  });

  const mentor = await upsertUser(USERS.mentor, {
    institutionId: institution.id,
    branchId: branch.id,
    branchName: branch.name,
    designation: 'Lecturer',
    designationEnum: Designation.LECTURER,
  });

  const studentUser = await upsertUser(USERS.student, {
    rollNumber: USERS.student.rollNumber,
    institutionId: institution.id,
    branchId: branch.id,
    branchName: branch.name,
  });

  const student = await prisma.student.upsert({
    where: { userId: studentUser.id },
    update: { institutionId: institution.id, branchId: branch.id, batchId: batch.id },
    create: {
      userId: studentUser.id,
      institutionId: institution.id,
      branchId: branch.id,
      batchId: batch.id,
      admissionNumber: 'DEMO-ADM-001',
      admissionYear: 2025,
      currentYear: 2,
      currentSemester: 3,
      gender: 'Male',
      city: INSTITUTE.city,
      district: INSTITUTE.district,
      state: INSTITUTE.state,
    },
  });

  // Mentor assignment (one active mentor per student)
  const active = await prisma.mentorAssignment.findFirst({ where: { studentId: student.id, isActive: true } });
  if (active && active.mentorId !== mentor.id) {
    await prisma.mentorAssignment.update({
      where: { id: active.id },
      data: { isActive: false, deactivatedAt: now, deactivatedBy: principal.id, deactivationReason: 'Reseeded' },
    });
  }
  if (!active || active.mentorId !== mentor.id) {
    const month = now.getMonth();
    const y = now.getFullYear();
    await prisma.mentorAssignment.create({
      data: {
        studentId: student.id,
        mentorId: mentor.id,
        assignedBy: principal.id,
        academicYear: month >= 6 ? `${y}-${String(y + 1).slice(-2)}` : `${y - 1}-${String(y).slice(-2)}`,
        assignmentReason: 'Demo seed',
        isActive: true,
      },
    });
  }

  console.log('\nDemo institute ready: %s (%s)\n', institution.name, institution.code);
  console.table([
    { Role: 'Director (STATE_DIRECTORATE)', Login: director.email, 'Login with': 'email' },
    { Role: 'Principal', Login: principal.email, 'Login with': 'email' },
    { Role: 'Mentor (TEACHER)', Login: mentor.email, 'Login with': 'email' },
    { Role: 'Student', Login: USERS.student.rollNumber, 'Login with': 'roll number (or email)' },
  ]);
  console.log(
    RESET_PASSWORDS || !existing.institution
      ? `Password for new / reset accounts: ${PASSWORD}`
      : 'Existing accounts keep their password (use --reset-passwords to set it to SEED_PASSWORD / the default).',
  );
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
