/**
 * Assign mentor to students
 */

const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const POSTGRES_URL = 'postgresql://postgres:postgres123@localhost:5432/cms_db?schema=public';

async function assignMentors() {
  const pgPool = new Pool({ connectionString: POSTGRES_URL });

  try {
    const pgClient = await pgPool.connect();

    console.log('='.repeat(60));
    console.log('MENTOR ASSIGNMENT');
    console.log('='.repeat(60));

    // 1. Find the mentor (Navdeep Singh)
    console.log('\n1. Finding mentor...');
    const mentorResult = await pgClient.query(`
      SELECT id, name, email, role, "institutionId"
      FROM "User"
      WHERE email = 'navdeepcivilian@gmail.com'
    `);

    if (mentorResult.rows.length === 0) {
      console.log('   ERROR: Mentor not found with email navdeepcivilian@gmail.com');
      pgClient.release();
      return;
    }

    const mentor = mentorResult.rows[0];
    console.log(`   Found mentor: ${mentor.name} (${mentor.email})`);
    console.log(`   Mentor ID: ${mentor.id}`);
    console.log(`   Role: ${mentor.role}`);

    // 2. Find students by roll numbers
    console.log('\n2. Finding students...');
    const studentsResult = await pgClient.query(`
      SELECT u.id as user_id, u.name, u."rollNumber", u."branchName",
             s.id as student_id, s."institutionId"
      FROM "User" u
      JOIN "Student" s ON s."userId" = u.id
      WHERE u."rollNumber" IN ('231535182938', '231535106865')
    `);

    if (studentsResult.rows.length === 0) {
      console.log('   ERROR: No students found with the given roll numbers');

      // Let's search more broadly
      console.log('\n   Searching for students in SBAS GPC Badbar...');
      const allStudents = await pgClient.query(`
        SELECT u.id as user_id, u.name, u."rollNumber", u."branchName",
               s.id as student_id
        FROM "User" u
        JOIN "Student" s ON s."userId" = u.id
        WHERE s."institutionId" = 'cc03fc86-687f-4e12-9f4b-7d1bbf5dbbb6'
        AND u.name ILIKE '%JASHANDEEP%' OR u.name ILIKE '%ATINDER%'
        LIMIT 10
      `);

      console.log(`   Found ${allStudents.rows.length} potential matches:`);
      allStudents.rows.forEach(s => {
        console.log(`   - ${s.rollNumber || 'No Roll'} | ${s.name} | ${s.branchName}`);
      });

      pgClient.release();
      return;
    }

    console.log(`   Found ${studentsResult.rows.length} students:`);
    studentsResult.rows.forEach(s => {
      console.log(`   - ${s.rollNumber} | ${s.name} | Student ID: ${s.student_id}`);
    });

    // 3. Get the principal/admin who will be the assigner
    console.log('\n3. Finding principal for assignment...');
    const principalResult = await pgClient.query(`
      SELECT id, name, email, role
      FROM "User"
      WHERE "institutionId" = 'cc03fc86-687f-4e12-9f4b-7d1bbf5dbbb6'
      AND role = 'PRINCIPAL'
      LIMIT 1
    `);

    let assignerId = mentor.id; // Default to mentor if no principal found
    if (principalResult.rows.length > 0) {
      assignerId = principalResult.rows[0].id;
      console.log(`   Using principal: ${principalResult.rows[0].name}`);
    } else {
      console.log(`   No principal found, using mentor as assigner`);
    }

    // 4. Create mentor assignments
    console.log('\n4. Creating mentor assignments...');

    for (const student of studentsResult.rows) {
      // Check if assignment already exists
      const existingAssignment = await pgClient.query(`
        SELECT id FROM mentor_assignments
        WHERE "studentId" = $1 AND "mentorId" = $2 AND "isActive" = true
      `, [student.student_id, mentor.id]);

      if (existingAssignment.rows.length > 0) {
        console.log(`   ⚠ Assignment already exists for ${student.name}`);
        continue;
      }

      // Deactivate any existing active assignments for this student
      await pgClient.query(`
        UPDATE mentor_assignments
        SET "isActive" = false, "deactivatedAt" = NOW()
        WHERE "studentId" = $1 AND "isActive" = true
      `, [student.student_id]);

      // Create new assignment
      const assignmentId = uuidv4();
      await pgClient.query(`
        INSERT INTO mentor_assignments (
          id, "studentId", "mentorId", "assignedBy",
          "assignmentDate", "isActive", "academicYear", "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, NOW(), true, '2024-25', NOW(), NOW())
      `, [assignmentId, student.student_id, mentor.id, assignerId]);

      console.log(`   ✓ Assigned ${student.name} to ${mentor.name}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('ASSIGNMENT COMPLETE');
    console.log('='.repeat(60));

    pgClient.release();
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await pgPool.end();
  }
}

assignMentors();
