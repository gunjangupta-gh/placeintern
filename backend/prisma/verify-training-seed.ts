import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log('=== Verifying Training Seed Data ===\n');

  // Get total count
  const total = await prisma.training.count();
  console.log(`✓ Total trainings in database: ${total}\n`);

  // Get count by month
  const trainings = await prisma.training.findMany({
    select: {
      id: true,
      title: true,
      startDate: true,
      endDate: true,
      duration: true,
      capacity: true,
      venue: true,
      providedBy: true,
      cost: true,
      deliveryMode: true,
      difficulty: true,
      designation: true,
      learningOutcomes: true,
    },
    orderBy: { startDate: 'asc' },
  });

  console.log('=== Sample Trainings (First 5) ===\n');
  trainings.slice(0, 5).forEach((t, i) => {
    console.log(`${i + 1}. ${t.title}`);
    console.log(`   📅 Date: ${t.startDate.toLocaleDateString()} - ${t.endDate.toLocaleDateString()}`);
    console.log(`   ⏱️  Duration: ${t.duration} hours`);
    console.log(`   👥 Capacity: ${t.capacity}`);
    console.log(`   📍 Venue: ${t.venue || 'N/A'}`);
    console.log(`   🏢 Provider: ${t.providedBy || 'N/A'}`);
    console.log(`   💰 Cost: ${t.cost === 0 ? 'Free' : t.cost ? `₹${t.cost}` : 'N/A'}`);
    console.log(`   📡 Mode: ${t.deliveryMode}`);
    console.log(`   📊 Difficulty: ${t.difficulty}`);
    console.log(`   🎯 For: ${t.designation || 'All Faculty'}`);
    if (t.learningOutcomes) {
      console.log(`   📝 Outcomes: ${JSON.stringify(t.learningOutcomes)}`);
    }
    console.log();
  });

  // Group by month
  const byMonth: { [key: string]: number } = {};
  trainings.forEach(t => {
    const monthKey = `${t.startDate.getFullYear()}-${String(t.startDate.getMonth() + 1).padStart(2, '0')}`;
    byMonth[monthKey] = (byMonth[monthKey] || 0) + 1;
  });

  console.log('=== Trainings by Month ===\n');
  Object.entries(byMonth).sort().forEach(([month, count]) => {
    const [year, monthNum] = month.split('-');
    const monthName = new Date(parseInt(year), parseInt(monthNum) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
    console.log(`  ${monthName}: ${count} trainings`);
  });

  console.log('\n=== Trainings by Provider ===\n');
  const byProvider: { [key: string]: number } = {};
  trainings.forEach(t => {
    const provider = t.providedBy || 'Unknown';
    byProvider[provider] = (byProvider[provider] || 0) + 1;
  });
  Object.entries(byProvider)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([provider, count]) => {
      console.log(`  ${provider}: ${count} trainings`);
    });

  console.log('\n=== Trainings by Delivery Mode ===\n');
  const byMode: { [key: string]: number } = {};
  trainings.forEach(t => {
    byMode[t.deliveryMode] = (byMode[t.deliveryMode] || 0) + 1;
  });
  Object.entries(byMode).forEach(([mode, count]) => {
    console.log(`  ${mode}: ${count} trainings`);
  });

  console.log('\n=== Total Capacity ===\n');
  const totalCapacity = trainings.reduce((sum, t) => sum + t.capacity, 0);
  console.log(`  Total seats available: ${totalCapacity} faculty members`);

  console.log('\n=== Free vs Paid ===\n');
  const free = trainings.filter(t => t.cost === 0).length;
  const paid = trainings.filter(t => t.cost && t.cost > 0).length;
  const unknown = trainings.filter(t => !t.cost && t.cost !== 0).length;
  console.log(`  Free: ${free} trainings`);
  console.log(`  Paid: ${paid} trainings`);
  console.log(`  Unknown: ${unknown} trainings`);

  console.log('\n=== Verification Complete ===\n');
}

main()
  .catch((error) => {
    console.error('Verification error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
