const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URL = 'mongodb://admin:Admin1234@127.0.0.1:27018/internship?authSource=admin&directConnection=true';

async function checkDuplicateApplications() {
  const client = new MongoClient(MONGODB_URL);

  try {
    await client.connect();
    console.log('Connected to MongoDB\n');

    const db = client.db('internship');

    const usersCollection = db.collection('User');
    const studentsCollection = db.collection('Student');
    const internshipAppsCollection = db.collection('internship_applications');
    const institutionsCollection = db.collection('Institution');

    // Get all data
    const institutions = await institutionsCollection.find({}).toArray();
    const instMap = new Map(institutions.map(i => [i._id.toString(), i.name || i.code || 'Unknown']));

    const allStudents = await studentsCollection.find({}).toArray();
    const studentMap = new Map(allStudents.map(s => [s._id.toString(), s]));

    const allUsers = await usersCollection.find({}).toArray();
    const userMap = new Map(allUsers.map(u => [u._id.toString(), u]));

    const allApps = await internshipAppsCollection.find({}).toArray();

    console.log('='.repeat(70));
    console.log('DUPLICATE INTERNSHIP APPLICATIONS CHECK');
    console.log('='.repeat(70));

    // ============================================
    // CHECK 1: Multiple applications per student
    // ============================================
    console.log('\n--- CHECK 1: Students with Multiple Applications ---\n');

    const appsByStudent = {};
    allApps.forEach(app => {
      const studentId = app.studentId?.toString();
      if (!appsByStudent[studentId]) {
        appsByStudent[studentId] = [];
      }
      appsByStudent[studentId].push(app);
    });

    const studentsWithMultipleApps = Object.entries(appsByStudent)
      .filter(([_, apps]) => apps.length > 1)
      .sort((a, b) => b[1].length - a[1].length);

    console.log(`Students with multiple applications: ${studentsWithMultipleApps.length}`);

    if (studentsWithMultipleApps.length > 0) {
      console.log('\nDetails:');
      for (const [studentId, apps] of studentsWithMultipleApps) {
        const student = studentMap.get(studentId);
        const user = student ? userMap.get(student.userId?.toString()) : null;
        const instName = student ? instMap.get(student.institutionId?.toString()) : 'Unknown';

        console.log(`\n  📍 ${user?.name || 'N/A'} | Roll: ${user?.rollNumber || 'N/A'} | ${apps.length} applications`);
        console.log(`     Institution: ${instName}`);

        apps.forEach((app, idx) => {
          console.log(`     [${idx + 1}] ID: ${app._id}`);
          console.log(`         Status: ${app.status} | Phase: ${app.internshipPhase}`);
          console.log(`         Company: ${app.companyName || 'N/A'}`);
          console.log(`         isActive: ${app.isActive} | isSelfIdentified: ${app.isSelfIdentified}`);
          console.log(`         Created: ${app.createdAt}`);
        });
      }
    }

    // ============================================
    // CHECK 2: Exact duplicate records
    // ============================================
    console.log('\n' + '-'.repeat(70));
    console.log('--- CHECK 2: Exact Duplicate Records (same student + company) ---\n');

    const duplicateKeys = {};
    allApps.forEach(app => {
      // Create a key based on studentId + companyName (normalized)
      const companyName = (app.companyName || '').toLowerCase().trim();
      const key = `${app.studentId?.toString()}_${companyName}`;

      if (!duplicateKeys[key]) {
        duplicateKeys[key] = [];
      }
      duplicateKeys[key].push(app);
    });

    const exactDuplicates = Object.entries(duplicateKeys)
      .filter(([key, apps]) => apps.length > 1 && key.includes('_') && !key.endsWith('_'))
      .sort((a, b) => b[1].length - a[1].length);

    console.log(`Duplicate student+company combinations: ${exactDuplicates.length}`);

    if (exactDuplicates.length > 0) {
      console.log('\nDetails:');
      for (const [key, apps] of exactDuplicates) {
        const studentId = key.split('_')[0];
        const student = studentMap.get(studentId);
        const user = student ? userMap.get(student.userId?.toString()) : null;
        const instName = student ? instMap.get(student.institutionId?.toString()) : 'Unknown';

        console.log(`\n  📍 ${user?.name || 'N/A'} | Roll: ${user?.rollNumber || 'N/A'}`);
        console.log(`     Institution: ${instName}`);
        console.log(`     Company: ${apps[0].companyName || 'N/A'}`);
        console.log(`     Duplicate count: ${apps.length}`);

        apps.forEach((app, idx) => {
          console.log(`     [${idx + 1}] ID: ${app._id} | Status: ${app.status} | Created: ${app.createdAt}`);
        });
      }
    }

    // ============================================
    // CHECK 3: Same student with both active applications
    // ============================================
    console.log('\n' + '-'.repeat(70));
    console.log('--- CHECK 3: Students with Multiple ACTIVE Applications ---\n');

    const studentsWithMultipleActiveApps = studentsWithMultipleApps.filter(([_, apps]) => {
      const activeApps = apps.filter(a =>
        a.isActive !== false &&
        ['APPROVED', 'APPLIED', 'UNDER_REVIEW', 'SHORTLISTED', 'SELECTED', 'JOINED'].includes(a.status)
      );
      return activeApps.length > 1;
    });

    console.log(`Students with multiple ACTIVE applications: ${studentsWithMultipleActiveApps.length}`);

    if (studentsWithMultipleActiveApps.length > 0) {
      console.log('\nDetails:');
      for (const [studentId, apps] of studentsWithMultipleActiveApps) {
        const activeApps = apps.filter(a =>
          a.isActive !== false &&
          ['APPROVED', 'APPLIED', 'UNDER_REVIEW', 'SHORTLISTED', 'SELECTED', 'JOINED'].includes(a.status)
        );

        const student = studentMap.get(studentId);
        const user = student ? userMap.get(student.userId?.toString()) : null;
        const instName = student ? instMap.get(student.institutionId?.toString()) : 'Unknown';

        console.log(`\n  📍 ${user?.name || 'N/A'} | Roll: ${user?.rollNumber || 'N/A'}`);
        console.log(`     Institution: ${instName}`);
        console.log(`     Active applications: ${activeApps.length}`);

        activeApps.forEach((app, idx) => {
          console.log(`     [${idx + 1}] ID: ${app._id}`);
          console.log(`         Status: ${app.status} | Phase: ${app.internshipPhase}`);
          console.log(`         Company: ${app.companyName || 'N/A'}`);
          console.log(`         Created: ${app.createdAt}`);
        });
      }
    }

    // ============================================
    // SUMMARY
    // ============================================
    console.log('\n' + '='.repeat(70));
    console.log('SUMMARY');
    console.log('='.repeat(70));

    console.log(`\nTotal applications: ${allApps.length}`);
    console.log(`Unique students with applications: ${Object.keys(appsByStudent).length}`);
    console.log(`Students with multiple applications: ${studentsWithMultipleApps.length}`);
    console.log(`Exact duplicates (same student + company): ${exactDuplicates.length}`);
    console.log(`Students with multiple ACTIVE apps: ${studentsWithMultipleActiveApps.length}`);

    // Distribution of applications per student
    console.log('\n--- Distribution of applications per student ---');
    const distribution = {};
    Object.values(appsByStudent).forEach(apps => {
      const count = apps.length;
      distribution[count] = (distribution[count] || 0) + 1;
    });
    Object.entries(distribution).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).forEach(([count, students]) => {
      console.log(`   ${count} application(s): ${students} student(s)`);
    });

    console.log('\n=== ANALYSIS COMPLETE ===');

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await client.close();
  }
}

checkDuplicateApplications();
