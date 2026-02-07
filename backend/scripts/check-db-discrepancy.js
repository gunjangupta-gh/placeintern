/**
 * Database Discrepancy Checker
 * Compares MongoDB (source) with PostgreSQL (target) to identify data differences
 */

const { MongoClient } = require('mongodb');
const { Pool } = require('pg');

const MONGODB_URL = 'mongodb://admin:Admin1234@127.0.0.1:27018/internship?authSource=admin&directConnection=true';
const POSTGRES_URL = 'postgresql://postgres:postgres123@localhost:5432/cms_db?schema=public';

async function checkDiscrepancies() {
  const mongoClient = new MongoClient(MONGODB_URL);
  const pgPool = new Pool({ connectionString: POSTGRES_URL });

  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoClient.connect();
    console.log('✓ Connected to MongoDB\n');

    const mongoDb = mongoClient.db('internship');

    // Connect to PostgreSQL
    console.log('Connecting to PostgreSQL...');
    const pgClient = await pgPool.connect();
    console.log('✓ Connected to PostgreSQL\n');

    console.log('='.repeat(80));
    console.log('DATABASE DISCREPANCY REPORT');
    console.log('='.repeat(80));
    console.log('');

    // ==========================================
    // 1. Count Comparison
    // ==========================================
    console.log('┌' + '─'.repeat(78) + '┐');
    console.log('│' + ' RECORD COUNT COMPARISON'.padEnd(78) + '│');
    console.log('├' + '─'.repeat(30) + '┬' + '─'.repeat(15) + '┬' + '─'.repeat(15) + '┬' + '─'.repeat(15) + '┤');
    console.log('│' + ' Collection/Table'.padEnd(30) + '│' + ' MongoDB'.padEnd(15) + '│' + ' PostgreSQL'.padEnd(15) + '│' + ' Difference'.padEnd(15) + '│');
    console.log('├' + '─'.repeat(30) + '┼' + '─'.repeat(15) + '┼' + '─'.repeat(15) + '┼' + '─'.repeat(15) + '┤');

    const comparisons = [
      { mongo: 'User', pg: '"User"', label: 'Users' },
      { mongo: 'Student', pg: '"Student"', label: 'Students' },
      { mongo: 'Institution', pg: '"Institution"', label: 'Institutions' },
      { mongo: 'Batch', pg: '"Batch"', label: 'Batches' },
      { mongo: 'branches', pg: 'branches', label: 'Branches' },
      { mongo: 'internship_applications', pg: 'internship_applications', label: 'Internship Apps' },
      { mongo: 'mentor_assignments', pg: 'mentor_assignments', label: 'Mentor Assignments' },
      { mongo: 'Document', pg: '"Document"', label: 'Documents' },
      { mongo: 'monthly_reports', pg: 'monthly_reports', label: 'Monthly Reports' },
      { mongo: 'faculty_visit_logs', pg: 'faculty_visit_logs', label: 'Faculty Visits' },
      { mongo: 'Notification', pg: '"Notification"', label: 'Notifications' },
      { mongo: 'Grievance', pg: '"Grievance"', label: 'Grievances' },
      { mongo: 'AuditLog', pg: '"AuditLog"', label: 'Audit Logs' },
    ];

    const discrepancies = [];

    for (const comp of comparisons) {
      let mongoCount = 0;
      let pgCount = 0;

      try {
        mongoCount = await mongoDb.collection(comp.mongo).countDocuments();
      } catch (e) {
        mongoCount = 0;
      }

      try {
        const result = await pgClient.query(`SELECT COUNT(*) FROM ${comp.pg}`);
        pgCount = parseInt(result.rows[0].count, 10);
      } catch (e) {
        pgCount = 0;
      }

      const diff = mongoCount - pgCount;
      const diffStr = diff === 0 ? '✓ 0' : (diff > 0 ? `+${diff}` : `${diff}`);
      const color = diff === 0 ? '' : (diff > 0 ? '\x1b[33m' : '\x1b[31m');
      const reset = diff === 0 ? '' : '\x1b[0m';

      console.log(`│ ${comp.label.padEnd(28)} │ ${String(mongoCount).padStart(13)} │ ${String(pgCount).padStart(13)} │ ${color}${diffStr.padStart(13)}${reset} │`);

      if (diff !== 0) {
        discrepancies.push({
          table: comp.label,
          mongoCollection: comp.mongo,
          pgTable: comp.pg,
          mongoCount,
          pgCount,
          diff,
        });
      }
    }

    console.log('└' + '─'.repeat(30) + '┴' + '─'.repeat(15) + '┴' + '─'.repeat(15) + '┴' + '─'.repeat(15) + '┘');
    console.log('');

    // ==========================================
    // 2. Detailed Analysis for discrepancies
    // ==========================================
    if (discrepancies.length > 0) {
      console.log('┌' + '─'.repeat(78) + '┐');
      console.log('│' + ' DETAILED DISCREPANCY ANALYSIS'.padEnd(78) + '│');
      console.log('└' + '─'.repeat(78) + '┘');
      console.log('');

      for (const disc of discrepancies) {
        console.log(`\n--- ${disc.table} (MongoDB: ${disc.mongoCount}, PostgreSQL: ${disc.pgCount}, Diff: ${disc.diff > 0 ? '+' : ''}${disc.diff}) ---\n`);

        if (disc.mongoCollection === 'User') {
          await analyzeUsers(mongoDb, pgClient);
        } else if (disc.mongoCollection === 'Student') {
          await analyzeStudents(mongoDb, pgClient);
        } else if (disc.mongoCollection === 'internship_applications') {
          await analyzeInternshipApps(mongoDb, pgClient);
        }
      }
    }

    // ==========================================
    // 3. Data Integrity Checks
    // ==========================================
    console.log('\n' + '='.repeat(80));
    console.log('DATA INTEGRITY CHECKS');
    console.log('='.repeat(80));

    // Check for orphaned students (students without users)
    console.log('\n--- Orphaned Records in PostgreSQL ---');

    const orphanedStudents = await pgClient.query(`
      SELECT s.id, s."userId"
      FROM "Student" s
      LEFT JOIN "User" u ON s."userId" = u.id
      WHERE u.id IS NULL
    `);
    console.log(`  Students without User record: ${orphanedStudents.rows.length}`);

    const orphanedApps = await pgClient.query(`
      SELECT ia.id, ia."studentId"
      FROM internship_applications ia
      LEFT JOIN "Student" s ON ia."studentId" = s.id
      WHERE s.id IS NULL
    `);
    console.log(`  Internship Apps without Student record: ${orphanedApps.rows.length}`);

    // Check for duplicate applications per student
    console.log('\n--- Duplicate Applications Check ---');

    // MongoDB
    const mongoApps = await mongoDb.collection('internship_applications').find({}).toArray();
    const mongoAppsByStudent = {};
    mongoApps.forEach(app => {
      const sid = app.studentId?.toString();
      if (sid) {
        mongoAppsByStudent[sid] = (mongoAppsByStudent[sid] || 0) + 1;
      }
    });
    const mongoDuplicates = Object.entries(mongoAppsByStudent).filter(([_, count]) => count > 1);
    console.log(`  MongoDB - Students with multiple applications: ${mongoDuplicates.length}`);

    // PostgreSQL
    const pgDuplicates = await pgClient.query(`
      SELECT "studentId", COUNT(*) as count
      FROM internship_applications
      GROUP BY "studentId"
      HAVING COUNT(*) > 1
    `);
    console.log(`  PostgreSQL - Students with multiple applications: ${pgDuplicates.rows.length}`);

    // ==========================================
    // 4. User Role Distribution
    // ==========================================
    console.log('\n--- User Role Distribution ---');

    const mongoRoles = await mongoDb.collection('User').aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]).toArray();

    const pgRoles = await pgClient.query(`
      SELECT role, COUNT(*) as count
      FROM "User"
      GROUP BY role
    `);

    console.log('\n  MongoDB:');
    mongoRoles.forEach(r => console.log(`    ${r._id || 'null'}: ${r.count}`));

    console.log('\n  PostgreSQL:');
    pgRoles.rows.forEach(r => console.log(`    ${r.role || 'null'}: ${r.count}`));

    // ==========================================
    // 5. Internship Status Distribution
    // ==========================================
    console.log('\n--- Internship Application Status Distribution ---');

    const mongoStatuses = await mongoDb.collection('internship_applications').aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]).toArray();

    const pgStatuses = await pgClient.query(`
      SELECT status, COUNT(*) as count
      FROM internship_applications
      GROUP BY status
    `);

    console.log('\n  MongoDB:');
    mongoStatuses.forEach(s => console.log(`    ${s._id || 'null'}: ${s.count}`));

    console.log('\n  PostgreSQL:');
    pgStatuses.rows.forEach(s => console.log(`    ${s.status || 'null'}: ${s.count}`));

    // ==========================================
    // 6. Institution Distribution
    // ==========================================
    console.log('\n--- Institution Summary ---');

    const mongoInsts = await mongoDb.collection('Institution').find({}).toArray();
    console.log('\n  MongoDB Institutions:');
    for (const inst of mongoInsts) {
      const userCount = await mongoDb.collection('User').countDocuments({ institutionId: inst._id });
      const studentCount = await mongoDb.collection('Student').countDocuments({ institutionId: inst._id });
      console.log(`    ${inst.name || inst.code}: ${userCount} users, ${studentCount} students`);
    }

    const pgInsts = await pgClient.query(`
      SELECT i.id, i.name, i.code,
             (SELECT COUNT(*) FROM "User" u WHERE u."institutionId" = i.id) as user_count,
             (SELECT COUNT(*) FROM "Student" s WHERE s."institutionId" = i.id) as student_count
      FROM "Institution" i
    `);
    console.log('\n  PostgreSQL Institutions:');
    pgInsts.rows.forEach(i => {
      console.log(`    ${i.name || i.code}: ${i.user_count} users, ${i.student_count} students`);
    });

    // ==========================================
    // Summary
    // ==========================================
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log(`\n  Total discrepancies found: ${discrepancies.length}`);

    if (discrepancies.length > 0) {
      console.log('\n  Tables with differences:');
      discrepancies.forEach(d => {
        const sign = d.diff > 0 ? '+' : '';
        console.log(`    - ${d.table}: ${sign}${d.diff} records`);
      });
    } else {
      console.log('\n  ✓ All tables have matching record counts!');
    }

    console.log('\n' + '='.repeat(80));
    console.log('ANALYSIS COMPLETE');
    console.log('='.repeat(80) + '\n');

    pgClient.release();
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoClient.close();
    await pgPool.end();
  }
}

async function analyzeUsers(mongoDb, pgClient) {
  // Get sample of MongoDB users not in PostgreSQL
  const mongoUsers = await mongoDb.collection('User').find({}).toArray();
  const pgUsers = await pgClient.query('SELECT email FROM "User"');

  const pgEmails = new Set(pgUsers.rows.map(u => u.email?.toLowerCase()).filter(Boolean));

  const missingUsers = mongoUsers.filter(u => {
    const email = u.email?.toLowerCase();
    return email && !pgEmails.has(email);
  });

  console.log(`  Users in MongoDB but not in PostgreSQL (by email): ${missingUsers.length}`);
  if (missingUsers.length > 0 && missingUsers.length <= 10) {
    console.log('  Sample missing users:');
    missingUsers.slice(0, 5).forEach(u => {
      console.log(`    - ${u.email} (${u.role || 'no role'}) - ${u.name || 'no name'}`);
    });
  }

  // Check for duplicate emails in MongoDB
  const emailCounts = {};
  mongoUsers.forEach(u => {
    const email = u.email?.toLowerCase();
    if (email) {
      emailCounts[email] = (emailCounts[email] || 0) + 1;
    }
  });
  const duplicates = Object.entries(emailCounts).filter(([_, count]) => count > 1);
  console.log(`  Duplicate emails in MongoDB: ${duplicates.length}`);
  if (duplicates.length > 0 && duplicates.length <= 10) {
    duplicates.slice(0, 5).forEach(([email, count]) => {
      console.log(`    - ${email}: ${count} occurrences`);
    });
  }
}

async function analyzeStudents(mongoDb, pgClient) {
  // Get student counts by institution
  const mongoStudents = await mongoDb.collection('Student').find({}).toArray();
  const mongoUsers = await mongoDb.collection('User').find({}).toArray();
  const userMap = new Map(mongoUsers.map(u => [u._id.toString(), u]));

  // Check for orphaned students in MongoDB
  const orphanedMongo = mongoStudents.filter(s => {
    const userId = s.userId?.toString();
    return !userId || !userMap.has(userId);
  });
  console.log(`  Orphaned students in MongoDB (no User): ${orphanedMongo.length}`);

  // Check for students with invalid data
  const noName = mongoStudents.filter(s => !s.name && !userMap.get(s.userId?.toString())?.name);
  console.log(`  Students without name (in Student or User): ${noName.length}`);
}

async function analyzeInternshipApps(mongoDb, pgClient) {
  const mongoApps = await mongoDb.collection('internship_applications').find({}).toArray();
  const mongoStudents = await mongoDb.collection('Student').find({}).toArray();
  const studentIds = new Set(mongoStudents.map(s => s._id.toString()));

  // Apps with invalid student references
  const orphanedApps = mongoApps.filter(a => {
    const studentId = a.studentId?.toString();
    return !studentId || !studentIds.has(studentId);
  });
  console.log(`  Applications with invalid studentId in MongoDB: ${orphanedApps.length}`);

  // Self-identified vs regular
  const selfIdentified = mongoApps.filter(a => a.isSelfIdentified);
  console.log(`  Self-identified internships: ${selfIdentified.length}`);
  console.log(`  Regular internships: ${mongoApps.length - selfIdentified.length}`);

  // Active vs inactive
  const activeApps = mongoApps.filter(a => a.isActive !== false);
  console.log(`  Active applications: ${activeApps.length}`);
  console.log(`  Inactive applications: ${mongoApps.length - activeApps.length}`);
}

checkDiscrepancies();
