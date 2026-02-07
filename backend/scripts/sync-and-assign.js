/**
 * Sync students from MongoDB and assign mentor
 */

const { MongoClient } = require('mongodb');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const MONGODB_URL = 'mongodb://admin:Admin1234@127.0.0.1:27018/internship?authSource=admin&directConnection=true';
const POSTGRES_URL = 'postgresql://postgres:postgres123@localhost:5432/cms_db?schema=public';

// Target institution
const INSTITUTION_ID = 'cc03fc86-687f-4e12-9f4b-7d1bbf5dbbb6';
const MENTOR_EMAIL = 'navdeepcivilian@gmail.com';
const STUDENT_ROLL_NUMBERS = ['231535182938', '231535106865'];

async function syncAndAssign() {
  const mongoClient = new MongoClient(MONGODB_URL);
  const pgPool = new Pool({ connectionString: POSTGRES_URL });

  try {
    await mongoClient.connect();
    const mongoDb = mongoClient.db('internship');
    const pgClient = await pgPool.connect();

    console.log('='.repeat(70));
    console.log('SYNC STUDENTS FROM MONGODB AND ASSIGN MENTOR');
    console.log('='.repeat(70));

    // 1. Find students in MongoDB
    console.log('\n1. Searching for students in MongoDB...');

    const mongoUsers = await mongoDb.collection('User').find({
      rollNumber: { $in: STUDENT_ROLL_NUMBERS }
    }).toArray();

    console.log(`   Found ${mongoUsers.length} users with matching roll numbers in MongoDB`);

    if (mongoUsers.length === 0) {
      // Try broader search
      console.log('   Trying broader search...');
      const allMongoUsers = await mongoDb.collection('User').find({
        $or: [
          { name: /JASHANDEEP/i },
          { name: /ATINDER/i }
        ]
      }).toArray();
      console.log(`   Found ${allMongoUsers.length} users by name search:`);
      allMongoUsers.forEach(u => {
        console.log(`   - ${u.rollNumber || 'No Roll'} | ${u.name} | ${u.email || 'No email'}`);
      });
    } else {
      mongoUsers.forEach(u => {
        console.log(`   - ${u.rollNumber} | ${u.name} | ${u.email || 'No email'}`);
      });
    }

    // 2. Get corresponding students from MongoDB
    console.log('\n2. Finding student records in MongoDB...');

    const mongoStudents = await mongoDb.collection('Student').find({
      userId: { $in: mongoUsers.map(u => u._id) }
    }).toArray();

    console.log(`   Found ${mongoStudents.length} student records`);

    // 3. Find/Create mentor in PostgreSQL
    console.log('\n3. Finding mentor in PostgreSQL...');

    let mentorResult = await pgClient.query(`
      SELECT id, name, email, role, "institutionId"
      FROM "User"
      WHERE email = $1
    `, [MENTOR_EMAIL]);

    let mentorId;
    if (mentorResult.rows.length === 0) {
      console.log('   Mentor not found in PostgreSQL. Checking MongoDB...');

      const mongoMentor = await mongoDb.collection('User').findOne({
        email: MENTOR_EMAIL
      });

      if (mongoMentor) {
        console.log(`   Found mentor in MongoDB: ${mongoMentor.name}`);

        // Create mentor in PostgreSQL
        mentorId = uuidv4();
        await pgClient.query(`
          INSERT INTO "User" (
            id, email, password, name, role, active, "institutionId", "createdAt"
          ) VALUES ($1, $2, $3, $4, $5, true, $6, NOW())
        `, [
          mentorId,
          mongoMentor.email,
          mongoMentor.password || await bcrypt.hash('TempPassword123!', 10),
          mongoMentor.name,
          mongoMentor.role || 'TEACHER',
          INSTITUTION_ID
        ]);
        console.log(`   ✓ Created mentor in PostgreSQL: ${mongoMentor.name}`);
      } else {
        console.log('   ERROR: Mentor not found in either database!');
        pgClient.release();
        return;
      }
    } else {
      mentorId = mentorResult.rows[0].id;
      console.log(`   ✓ Found mentor: ${mentorResult.rows[0].name} (ID: ${mentorId})`);
    }

    // 4. Sync students from MongoDB to PostgreSQL
    console.log('\n4. Syncing students to PostgreSQL...');

    const syncedStudentIds = [];

    for (const mongoUser of mongoUsers) {
      const mongoStudent = mongoStudents.find(s =>
        s.userId?.toString() === mongoUser._id.toString()
      );

      if (!mongoStudent) {
        console.log(`   ⚠ No student record found for user: ${mongoUser.name}`);
        continue;
      }

      // Check if user already exists in PostgreSQL
      let pgUserResult = await pgClient.query(`
        SELECT id FROM "User" WHERE "rollNumber" = $1
      `, [mongoUser.rollNumber]);

      let pgUserId;

      if (pgUserResult.rows.length === 0) {
        // Create user
        pgUserId = uuidv4();
        await pgClient.query(`
          INSERT INTO "User" (
            id, email, password, name, "rollNumber", role, active,
            "institutionId", "branchName", "createdAt"
          ) VALUES ($1, $2, $3, $4, $5, 'STUDENT', true, $6, $7, NOW())
        `, [
          pgUserId,
          mongoUser.email || `student_${mongoUser.rollNumber}@placeholder.local`,
          mongoUser.password || await bcrypt.hash('Student123!', 10),
          mongoUser.name,
          mongoUser.rollNumber,
          INSTITUTION_ID,
          mongoUser.branchName || mongoStudent.branchName || 'CE'
        ]);
        console.log(`   ✓ Created user: ${mongoUser.name}`);
      } else {
        pgUserId = pgUserResult.rows[0].id;
        console.log(`   ℹ User already exists: ${mongoUser.name}`);
      }

      // Check if student record exists
      let pgStudentResult = await pgClient.query(`
        SELECT id FROM "Student" WHERE "userId" = $1
      `, [pgUserId]);

      let pgStudentId;

      if (pgStudentResult.rows.length === 0) {
        // Create student
        pgStudentId = uuidv4();

        // Get branch ID if available
        let branchId = null;
        const branchResult = await pgClient.query(`
          SELECT id FROM branches WHERE code = 'CE' OR name ILIKE '%civil%' LIMIT 1
        `);
        if (branchResult.rows.length > 0) {
          branchId = branchResult.rows[0].id;
        }

        // Get batch ID if available
        let batchId = null;
        const batchResult = await pgClient.query(`
          SELECT id FROM "Batch" WHERE name = '2023-26' OR name = '2023-2026' LIMIT 1
        `);
        if (batchResult.rows.length > 0) {
          batchId = batchResult.rows[0].id;
        }

        await pgClient.query(`
          INSERT INTO "Student" (
            id, "userId", "institutionId", "branchId", "batchId",
            "admissionNumber", "createdAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `, [
          pgStudentId,
          pgUserId,
          INSTITUTION_ID,
          branchId,
          batchId,
          mongoStudent.admissionNumber || mongoUser.rollNumber
        ]);
        console.log(`   ✓ Created student record for: ${mongoUser.name}`);
      } else {
        pgStudentId = pgStudentResult.rows[0].id;
        console.log(`   ℹ Student record already exists for: ${mongoUser.name}`);
      }

      syncedStudentIds.push({ studentId: pgStudentId, name: mongoUser.name });
    }

    // 5. Create mentor assignments
    console.log('\n5. Creating mentor assignments...');

    // Get assigner (principal or use mentor)
    const principalResult = await pgClient.query(`
      SELECT id FROM "User"
      WHERE "institutionId" = $1 AND role = 'PRINCIPAL'
      LIMIT 1
    `, [INSTITUTION_ID]);

    const assignerId = principalResult.rows.length > 0 ?
      principalResult.rows[0].id : mentorId;

    for (const student of syncedStudentIds) {
      // Deactivate existing assignments
      await pgClient.query(`
        UPDATE mentor_assignments
        SET "isActive" = false, "deactivatedAt" = NOW()
        WHERE "studentId" = $1 AND "isActive" = true
      `, [student.studentId]);

      // Create new assignment
      const assignmentId = uuidv4();
      await pgClient.query(`
        INSERT INTO mentor_assignments (
          id, "studentId", "mentorId", "assignedBy",
          "assignmentDate", "isActive", "academicYear", "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, NOW(), true, '2024-25', NOW(), NOW())
      `, [assignmentId, student.studentId, mentorId, assignerId]);

      console.log(`   ✓ Assigned ${student.name} to mentor Navdeep Singh`);
    }

    // 6. Verify assignments
    console.log('\n6. Verification...');

    const verifyResult = await pgClient.query(`
      SELECT
        u.name as student_name,
        u."rollNumber",
        m.name as mentor_name,
        ma."createdAt" as assigned_at
      FROM mentor_assignments ma
      JOIN "Student" s ON ma."studentId" = s.id
      JOIN "User" u ON s."userId" = u.id
      JOIN "User" m ON ma."mentorId" = m.id
      WHERE ma."mentorId" = $1 AND ma."isActive" = true
      ORDER BY ma."createdAt" DESC
      LIMIT 10
    `, [mentorId]);

    console.log(`\n   Students currently assigned to Navdeep Singh:`);
    verifyResult.rows.forEach(r => {
      console.log(`   - ${r.rollnumber || 'N/A'} | ${r.student_name} | Assigned: ${r.assigned_at}`);
    });

    console.log('\n' + '='.repeat(70));
    console.log('SYNC AND ASSIGNMENT COMPLETE');
    console.log('='.repeat(70));

    pgClient.release();
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoClient.close();
    await pgPool.end();
  }
}

syncAndAssign();
