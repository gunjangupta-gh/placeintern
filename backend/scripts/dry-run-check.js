/**
 * DRY RUN - Check students and mentor without making changes
 */

const { MongoClient } = require('mongodb');
const { Pool } = require('pg');

const MONGODB_URL = 'mongodb://admin:Admin1234@127.0.0.1:27018/internship?authSource=admin&directConnection=true';
const POSTGRES_URL = 'postgresql://postgres:postgres123@localhost:5432/cms_db?schema=public';

// Target data
const INSTITUTION_NAME = 'SBAS GPC Badbar';
const INSTITUTION_ID_PG = 'cc03fc86-687f-4e12-9f4b-7d1bbf5dbbb6';
const MENTOR_EMAIL = 'navdeepcivilian@gmail.com';
const STUDENT_ROLL_NUMBERS = ['231535182938', '231535106865'];

async function dryRun() {
  const mongoClient = new MongoClient(MONGODB_URL);
  const pgPool = new Pool({ connectionString: POSTGRES_URL });

  try {
    await mongoClient.connect();
    const mongoDb = mongoClient.db('internship');
    const pgClient = await pgPool.connect();

    console.log('\n' + '='.repeat(70));
    console.log('DRY RUN - CHECKING DATA (NO CHANGES WILL BE MADE)');
    console.log('='.repeat(70));

    // ============================================
    // 1. Check Institution in both databases
    // ============================================
    console.log('\n━━━ 1. INSTITUTION CHECK ━━━\n');

    // MongoDB
    const mongoInst = await mongoDb.collection('Institution').findOne({
      name: { $regex: /SBAS.*Badbar/i }
    });
    console.log('MongoDB Institution:');
    if (mongoInst) {
      console.log(`  ✓ Found: ${mongoInst.name}`);
      console.log(`    ID: ${mongoInst._id}`);
      console.log(`    Code: ${mongoInst.code}`);
    } else {
      console.log('  ✗ NOT FOUND');
    }

    // PostgreSQL
    const pgInst = await pgClient.query(`
      SELECT * FROM "Institution" WHERE id = $1
    `, [INSTITUTION_ID_PG]);
    console.log('\nPostgreSQL Institution:');
    if (pgInst.rows.length > 0) {
      console.log(`  ✓ Found: ${pgInst.rows[0].name}`);
      console.log(`    ID: ${pgInst.rows[0].id}`);
      console.log(`    Code: ${pgInst.rows[0].code}`);
    } else {
      console.log('  ✗ NOT FOUND');
    }

    // ============================================
    // 2. Check Students
    // ============================================
    console.log('\n━━━ 2. STUDENTS CHECK ━━━\n');
    console.log(`Looking for roll numbers: ${STUDENT_ROLL_NUMBERS.join(', ')}`);

    // MongoDB - search by roll number
    console.log('\nMongoDB Users with these roll numbers:');
    const mongoUsers = await mongoDb.collection('User').find({
      rollNumber: { $in: STUDENT_ROLL_NUMBERS }
    }).toArray();

    if (mongoUsers.length > 0) {
      for (const u of mongoUsers) {
        console.log(`\n  ✓ ${u.name}`);
        console.log(`    Roll Number: ${u.rollNumber}`);
        console.log(`    Email: ${u.email || 'N/A'}`);
        console.log(`    Branch: ${u.branchName || 'N/A'}`);
        console.log(`    MongoDB User ID: ${u._id}`);

        // Find student record
        const mongoStudent = await mongoDb.collection('Student').findOne({
          userId: u._id
        });
        if (mongoStudent) {
          console.log(`    Student Record: ✓ Found (ID: ${mongoStudent._id})`);
          console.log(`    Institution ID: ${mongoStudent.institutionId}`);
        } else {
          console.log(`    Student Record: ✗ NOT FOUND`);
        }
      }
    } else {
      console.log('  ✗ No users found with these roll numbers');

      // Try name search
      console.log('\n  Trying name search (JASHANDEEP, ATINDER)...');
      const byName = await mongoDb.collection('User').find({
        $or: [
          { name: /JASHANDEEP/i },
          { name: /ATINDER/i }
        ],
        role: 'STUDENT'
      }).toArray();

      if (byName.length > 0) {
        console.log(`\n  Found ${byName.length} potential matches by name:`);
        for (const u of byName) {
          console.log(`  - ${u.rollNumber || 'No Roll'} | ${u.name} | ${u.branchName || 'N/A'}`);
        }
      }
    }

    // PostgreSQL
    console.log('\nPostgreSQL Users with these roll numbers:');
    const pgUsers = await pgClient.query(`
      SELECT u.*, s.id as student_id, s."institutionId" as student_inst
      FROM "User" u
      LEFT JOIN "Student" s ON s."userId" = u.id
      WHERE u."rollNumber" = ANY($1)
    `, [STUDENT_ROLL_NUMBERS]);

    if (pgUsers.rows.length > 0) {
      for (const u of pgUsers.rows) {
        console.log(`\n  ✓ ${u.name}`);
        console.log(`    Roll Number: ${u.rollNumber}`);
        console.log(`    User ID: ${u.id}`);
        console.log(`    Student ID: ${u.student_id || 'N/A'}`);
      }
    } else {
      console.log('  ✗ No users found - WILL NEED TO SYNC FROM MONGODB');
    }

    // ============================================
    // 3. Check Mentor
    // ============================================
    console.log('\n━━━ 3. MENTOR CHECK ━━━\n');
    console.log(`Looking for: ${MENTOR_EMAIL}`);

    // MongoDB
    const mongoMentor = await mongoDb.collection('User').findOne({
      email: MENTOR_EMAIL
    });
    console.log('\nMongoDB:');
    if (mongoMentor) {
      console.log(`  ✓ Found: ${mongoMentor.name}`);
      console.log(`    Email: ${mongoMentor.email}`);
      console.log(`    Role: ${mongoMentor.role}`);
      console.log(`    MongoDB ID: ${mongoMentor._id}`);
    } else {
      console.log('  ✗ NOT FOUND');
    }

    // PostgreSQL
    const pgMentor = await pgClient.query(`
      SELECT * FROM "User" WHERE email = $1
    `, [MENTOR_EMAIL]);
    console.log('\nPostgreSQL:');
    if (pgMentor.rows.length > 0) {
      console.log(`  ✓ Found: ${pgMentor.rows[0].name}`);
      console.log(`    Email: ${pgMentor.rows[0].email}`);
      console.log(`    Role: ${pgMentor.rows[0].role}`);
      console.log(`    PostgreSQL ID: ${pgMentor.rows[0].id}`);
    } else {
      console.log('  ✗ NOT FOUND - WILL NEED TO SYNC FROM MONGODB');
    }

    // ============================================
    // 4. Check Existing Assignments
    // ============================================
    console.log('\n━━━ 4. EXISTING MENTOR ASSIGNMENTS ━━━\n');

    // MongoDB
    if (mongoMentor) {
      const mongoAssignments = await mongoDb.collection('mentor_assignments').find({
        mentorId: mongoMentor._id,
        isActive: true
      }).toArray();
      console.log(`MongoDB: ${mongoAssignments.length} active assignments for this mentor`);
    }

    // PostgreSQL
    if (pgMentor.rows.length > 0) {
      const pgAssignments = await pgClient.query(`
        SELECT ma.*, u.name as student_name, u."rollNumber"
        FROM mentor_assignments ma
        JOIN "Student" s ON ma."studentId" = s.id
        JOIN "User" u ON s."userId" = u.id
        WHERE ma."mentorId" = $1 AND ma."isActive" = true
      `, [pgMentor.rows[0].id]);
      console.log(`PostgreSQL: ${pgAssignments.rows.length} active assignments for this mentor`);

      if (pgAssignments.rows.length > 0) {
        console.log('\n  Current students assigned to this mentor:');
        pgAssignments.rows.forEach(a => {
          console.log(`  - ${a.rollNumber || 'N/A'} | ${a.student_name}`);
        });
      }
    }

    // ============================================
    // 5. Summary - What needs to be done
    // ============================================
    console.log('\n' + '='.repeat(70));
    console.log('SUMMARY - ACTIONS NEEDED');
    console.log('='.repeat(70));

    const actions = [];

    if (mongoUsers.length > 0 && pgUsers.rows.length === 0) {
      actions.push(`1. SYNC ${mongoUsers.length} student(s) from MongoDB to PostgreSQL`);
      mongoUsers.forEach(u => {
        actions.push(`   - ${u.rollNumber} | ${u.name}`);
      });
    }

    if (mongoMentor && pgMentor.rows.length === 0) {
      actions.push(`2. SYNC mentor from MongoDB to PostgreSQL`);
      actions.push(`   - ${mongoMentor.email} | ${mongoMentor.name}`);
    }

    if (mongoUsers.length > 0 || pgUsers.rows.length > 0) {
      actions.push(`3. CREATE mentor assignments in PostgreSQL`);
    }

    actions.push(`4. UPDATE MongoDB with mentor assignments`);

    if (actions.length > 0) {
      actions.forEach(a => console.log(a));
    } else {
      console.log('No actions needed - data appears to be in sync.');
    }

    console.log('\n' + '='.repeat(70));
    console.log('DRY RUN COMPLETE - Run actual sync to make changes');
    console.log('='.repeat(70) + '\n');

    pgClient.release();
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoClient.close();
    await pgPool.end();
  }
}

dryRun();
