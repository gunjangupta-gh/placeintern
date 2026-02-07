/**
 * Execute mentor assignment in both PostgreSQL and MongoDB
 */

const { MongoClient, ObjectId } = require('mongodb');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const MONGODB_URL = 'mongodb://admin:Admin1234@127.0.0.1:27018/internship?authSource=admin&directConnection=true';
const POSTGRES_URL = 'postgresql://postgres:postgres123@localhost:5432/cms_db?schema=public';

// Target data
const MENTOR_EMAIL = 'navdeepcivilian@gmail.com';
const STUDENT_ROLL_NUMBERS = ['231535182938', '231535106865'];

async function executeAssignment() {
  const mongoClient = new MongoClient(MONGODB_URL);
  const pgPool = new Pool({ connectionString: POSTGRES_URL });

  try {
    await mongoClient.connect();
    const mongoDb = mongoClient.db('internship');
    const pgClient = await pgPool.connect();

    console.log('\n' + '='.repeat(70));
    console.log('EXECUTING MENTOR ASSIGNMENT');
    console.log('='.repeat(70));

    // ============================================
    // 1. Get Mentor Info
    // ============================================
    console.log('\n━━━ 1. GETTING MENTOR INFO ━━━\n');

    // PostgreSQL Mentor
    const pgMentor = await pgClient.query(`
      SELECT id, name, email FROM "User" WHERE email = $1
    `, [MENTOR_EMAIL]);

    if (pgMentor.rows.length === 0) {
      console.log('ERROR: Mentor not found in PostgreSQL!');
      return;
    }
    const pgMentorId = pgMentor.rows[0].id;
    console.log(`PostgreSQL Mentor: ${pgMentor.rows[0].name} (ID: ${pgMentorId})`);

    // MongoDB Mentor
    const mongoMentor = await mongoDb.collection('User').findOne({ email: MENTOR_EMAIL });
    if (!mongoMentor) {
      console.log('ERROR: Mentor not found in MongoDB!');
      return;
    }
    console.log(`MongoDB Mentor: ${mongoMentor.name} (ID: ${mongoMentor._id})`);

    // ============================================
    // 2. Get Students
    // ============================================
    console.log('\n━━━ 2. GETTING STUDENTS ━━━\n');

    // PostgreSQL Students
    const pgStudents = await pgClient.query(`
      SELECT u.id as user_id, u.name, u."rollNumber", s.id as student_id
      FROM "User" u
      JOIN "Student" s ON s."userId" = u.id
      WHERE u."rollNumber" = ANY($1)
    `, [STUDENT_ROLL_NUMBERS]);

    console.log(`Found ${pgStudents.rows.length} students in PostgreSQL:`);
    pgStudents.rows.forEach(s => {
      console.log(`  - ${s.rollNumber} | ${s.name} | Student ID: ${s.student_id}`);
    });

    // MongoDB Students
    const mongoUsers = await mongoDb.collection('User').find({
      rollNumber: { $in: STUDENT_ROLL_NUMBERS }
    }).toArray();

    const mongoStudents = await mongoDb.collection('Student').find({
      userId: { $in: mongoUsers.map(u => u._id) }
    }).toArray();

    console.log(`\nFound ${mongoStudents.length} students in MongoDB`);

    // ============================================
    // 3. Get Principal (for assignedBy)
    // ============================================
    console.log('\n━━━ 3. GETTING PRINCIPAL ━━━\n');

    // Get institution ID from one of the students
    const instResult = await pgClient.query(`
      SELECT "institutionId" FROM "Student" WHERE id = $1
    `, [pgStudents.rows[0].student_id]);
    const institutionId = instResult.rows[0]?.institutionId;

    // PostgreSQL Principal
    const pgPrincipal = await pgClient.query(`
      SELECT id, name FROM "User"
      WHERE "institutionId" = $1 AND role = 'PRINCIPAL'
      LIMIT 1
    `, [institutionId]);

    let pgAssignerId = pgMentorId;
    if (pgPrincipal.rows.length > 0) {
      pgAssignerId = pgPrincipal.rows[0].id;
      console.log(`PostgreSQL Assigner: ${pgPrincipal.rows[0].name} (Principal)`);
    } else {
      console.log(`PostgreSQL Assigner: Using mentor as assigner`);
    }

    // MongoDB Principal
    const mongoInst = await mongoDb.collection('Institution').findOne({ name: /SBAS.*Badbar/i });
    const mongoPrincipal = await mongoDb.collection('User').findOne({
      institutionId: mongoInst?._id,
      role: 'PRINCIPAL'
    });
    let mongoAssignerId = mongoMentor._id;
    if (mongoPrincipal) {
      mongoAssignerId = mongoPrincipal._id;
      console.log(`MongoDB Assigner: ${mongoPrincipal.name} (Principal)`);
    }

    // ============================================
    // 4. Create Assignments in PostgreSQL
    // ============================================
    console.log('\n━━━ 4. CREATING POSTGRESQL ASSIGNMENTS ━━━\n');

    for (const student of pgStudents.rows) {
      // Check existing
      const existing = await pgClient.query(`
        SELECT id FROM mentor_assignments
        WHERE "studentId" = $1 AND "mentorId" = $2 AND "isActive" = true
      `, [student.student_id, pgMentorId]);

      if (existing.rows.length > 0) {
        console.log(`  ⚠ Already assigned: ${student.name}`);
        continue;
      }

      // Deactivate old assignments
      const deactivated = await pgClient.query(`
        UPDATE mentor_assignments
        SET "isActive" = false, "deactivatedAt" = NOW(), "deactivationReason" = 'New mentor assigned'
        WHERE "studentId" = $1 AND "isActive" = true
        RETURNING id
      `, [student.student_id]);

      if (deactivated.rowCount > 0) {
        console.log(`  ℹ Deactivated ${deactivated.rowCount} old assignment(s) for ${student.name}`);
      }

      // Create new assignment
      const assignmentId = uuidv4();
      await pgClient.query(`
        INSERT INTO mentor_assignments (
          id, "studentId", "mentorId", "assignedBy",
          "assignmentDate", "isActive", "academicYear",
          "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, NOW(), true, '2024-25', NOW(), NOW())
      `, [assignmentId, student.student_id, pgMentorId, pgAssignerId]);

      console.log(`  ✓ PostgreSQL: Assigned ${student.name} to Navdeep Singh`);
    }

    // ============================================
    // 5. Create Assignments in MongoDB
    // ============================================
    console.log('\n━━━ 5. CREATING MONGODB ASSIGNMENTS ━━━\n');

    for (const mongoStudent of mongoStudents) {
      const mongoUser = mongoUsers.find(u => u._id.toString() === mongoStudent.userId?.toString());

      // Check existing
      const existing = await mongoDb.collection('mentor_assignments').findOne({
        studentId: mongoStudent._id,
        mentorId: mongoMentor._id,
        isActive: true
      });

      if (existing) {
        console.log(`  ⚠ Already assigned: ${mongoUser?.name}`);
        continue;
      }

      // Deactivate old assignments
      const deactivateResult = await mongoDb.collection('mentor_assignments').updateMany(
        { studentId: mongoStudent._id, isActive: true },
        {
          $set: {
            isActive: false,
            deactivatedAt: new Date(),
            deactivationReason: 'New mentor assigned'
          }
        }
      );

      if (deactivateResult.modifiedCount > 0) {
        console.log(`  ℹ Deactivated ${deactivateResult.modifiedCount} old assignment(s) for ${mongoUser?.name}`);
      }

      // Create new assignment
      await mongoDb.collection('mentor_assignments').insertOne({
        studentId: mongoStudent._id,
        mentorId: mongoMentor._id,
        assignedBy: mongoAssignerId,
        assignmentDate: new Date(),
        isActive: true,
        academicYear: '2024-25',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      console.log(`  ✓ MongoDB: Assigned ${mongoUser?.name} to Navdeep Singh`);
    }

    // ============================================
    // 6. Verification
    // ============================================
    console.log('\n━━━ 6. VERIFICATION ━━━\n');

    // PostgreSQL verification
    const pgVerify = await pgClient.query(`
      SELECT u.name, u."rollNumber"
      FROM mentor_assignments ma
      JOIN "Student" s ON ma."studentId" = s.id
      JOIN "User" u ON s."userId" = u.id
      WHERE ma."mentorId" = $1 AND ma."isActive" = true
      ORDER BY ma."createdAt" DESC
    `, [pgMentorId]);

    console.log(`PostgreSQL - Students now assigned to Navdeep Singh (${pgVerify.rows.length} total):`);
    pgVerify.rows.forEach(r => {
      console.log(`  - ${r.rollNumber} | ${r.name}`);
    });

    // MongoDB verification
    const mongoVerify = await mongoDb.collection('mentor_assignments').find({
      mentorId: mongoMentor._id,
      isActive: true
    }).toArray();

    const mongoStudentIds = mongoVerify.map(a => a.studentId);
    const mongoStudentRecords = await mongoDb.collection('Student').find({
      _id: { $in: mongoStudentIds }
    }).toArray();

    const mongoUserIds = mongoStudentRecords.map(s => s.userId);
    const mongoUserRecords = await mongoDb.collection('User').find({
      _id: { $in: mongoUserIds }
    }).toArray();

    console.log(`\nMongoDB - Students now assigned to Navdeep Singh (${mongoVerify.length} total):`);
    mongoVerify.forEach(a => {
      const student = mongoStudentRecords.find(s => s._id.toString() === a.studentId?.toString());
      const user = student ? mongoUserRecords.find(u => u._id.toString() === student.userId?.toString()) : null;
      console.log(`  - ${user?.rollNumber || 'N/A'} | ${user?.name || 'Unknown'}`);
    });

    console.log('\n' + '='.repeat(70));
    console.log('ASSIGNMENT COMPLETE - BOTH DATABASES UPDATED');
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

executeAssignment();
