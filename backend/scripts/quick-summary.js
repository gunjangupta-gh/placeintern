/**
 * Quick summary of database state
 */

const { MongoClient } = require('mongodb');
const { Pool } = require('pg');

const MONGODB_URL = 'mongodb://admin:Admin1234@127.0.0.1:27018/internship?authSource=admin&directConnection=true';
const POSTGRES_URL = 'postgresql://postgres:postgres123@localhost:5432/cms_db?schema=public';

async function summary() {
  const mongoClient = new MongoClient(MONGODB_URL);
  const pgPool = new Pool({ connectionString: POSTGRES_URL });

  try {
    await mongoClient.connect();
    const mongoDb = mongoClient.db('internship');
    const pgClient = await pgPool.connect();

    console.log('\n' + '='.repeat(80));
    console.log('DATABASE SYNC STATUS SUMMARY');
    console.log('='.repeat(80));

    // Get counts
    const mongoUsers = await mongoDb.collection('User').countDocuments();
    const mongoStudents = await mongoDb.collection('Student').countDocuments();
    const mongoApps = await mongoDb.collection('internship_applications').countDocuments();

    const pgUsers = (await pgClient.query('SELECT COUNT(*) FROM "User"')).rows[0].count;
    const pgStudents = (await pgClient.query('SELECT COUNT(*) FROM "Student"')).rows[0].count;
    const pgApps = (await pgClient.query('SELECT COUNT(*) FROM internship_applications')).rows[0].count;

    console.log('\n CURRENT COUNTS:');
    console.log(' ┌─────────────────────┬─────────────┬─────────────┬─────────────┐');
    console.log(' │ Entity              │   MongoDB   │  PostgreSQL │  Difference │');
    console.log(' ├─────────────────────┼─────────────┼─────────────┼─────────────┤');
    console.log(` │ Users               │ ${String(mongoUsers).padStart(11)} │ ${String(pgUsers).padStart(11)} │ ${String(mongoUsers - pgUsers).padStart(11)} │`);
    console.log(` │ Students            │ ${String(mongoStudents).padStart(11)} │ ${String(pgStudents).padStart(11)} │ ${String(mongoStudents - pgStudents).padStart(11)} │`);
    console.log(` │ Internship Apps     │ ${String(mongoApps).padStart(11)} │ ${String(pgApps).padStart(11)} │ ${String(mongoApps - pgApps).padStart(11)} │`);
    console.log(' └─────────────────────┴─────────────┴─────────────┴─────────────┘');

    // Check for new data in MongoDB (after migration)
    // Get the latest createdAt from PostgreSQL
    const latestPgUser = await pgClient.query('SELECT MAX("createdAt") as latest FROM "User"');
    const latestPgStudent = await pgClient.query('SELECT MAX("createdAt") as latest FROM "Student"');
    const latestPgApp = await pgClient.query('SELECT MAX("createdAt") as latest FROM internship_applications');

    console.log('\n LATEST RECORDS IN POSTGRESQL:');
    console.log(` - Latest User: ${latestPgUser.rows[0].latest}`);
    console.log(` - Latest Student: ${latestPgStudent.rows[0].latest}`);
    console.log(` - Latest Application: ${latestPgApp.rows[0].latest}`);

    // Count new records in MongoDB after migration
    const latestDate = latestPgApp.rows[0].latest;
    if (latestDate) {
      const newMongoApps = await mongoDb.collection('internship_applications').countDocuments({
        createdAt: { $gt: new Date(latestDate) }
      });
      const newMongoStudents = await mongoDb.collection('Student').countDocuments({
        createdAt: { $gt: new Date(latestDate) }
      });
      const newMongoUsers = await mongoDb.collection('User').countDocuments({
        createdAt: { $gt: new Date(latestDate) }
      });

      console.log(`\n NEW RECORDS IN MONGODB (after ${new Date(latestDate).toISOString().split('T')[0]}):`);
      console.log(` - New Users: ${newMongoUsers}`);
      console.log(` - New Students: ${newMongoStudents}`);
      console.log(` - New Applications: ${newMongoApps}`);

      if (newMongoApps > 0 || newMongoStudents > 0 || newMongoUsers > 0) {
        console.log('\n ⚠️  WARNING: MongoDB has new data that needs to be synced to PostgreSQL!');
        console.log('    This explains the discrepancy - new records were added to MongoDB');
        console.log('    after the last migration was performed.');
      }
    }

    // Check recent activity
    console.log('\n RECENT MONGODB ACTIVITY (last 5 applications):');
    const recentApps = await mongoDb.collection('internship_applications')
      .find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();

    const studentIds = recentApps.map(a => a.studentId);
    const students = await mongoDb.collection('Student').find({ _id: { $in: studentIds } }).toArray();
    const studentMap = new Map(students.map(s => [s._id.toString(), s]));

    const userIds = students.map(s => s.userId);
    const users = await mongoDb.collection('User').find({ _id: { $in: userIds } }).toArray();
    const userMap = new Map(users.map(u => [u._id.toString(), u]));

    for (const app of recentApps) {
      const student = studentMap.get(app.studentId?.toString());
      const user = student ? userMap.get(student.userId?.toString()) : null;
      console.log(` - ${app.createdAt?.toISOString()?.split('T')[0] || 'N/A'} | ${user?.name || 'Unknown'} | ${app.companyName || 'N/A'}`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('RECOMMENDATIONS');
    console.log('='.repeat(80));
    console.log(`
1. RUN INCREMENTAL SYNC: New records were added to MongoDB after migration.
   You need to sync these new records to PostgreSQL.

2. OPTION A - Re-run full migration:
   cd backend && npx ts-node prisma/server-migrate-mongo-to-postgres.ts \\
     --mongodb-url "mongodb://admin:Admin1234@127.0.0.1:27018/internship?authSource=admin&directConnection=true" \\
     --postgres-url "postgresql://postgres:postgres123@localhost:5432/cms_db" \\
     --verbose

3. OPTION B - Create an incremental sync script (recommended for production)
   This would only sync records created after the last migration date.

4. KEEP SSH TUNNEL ACTIVE:
   The tunnel is currently running. Keep it active while syncing.
`);

    pgClient.release();
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoClient.close();
    await pgPool.end();
  }
}

summary();
