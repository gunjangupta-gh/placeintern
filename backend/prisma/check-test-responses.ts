import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);

  try {
    console.log('='.repeat(80));
    console.log('CHECKING PRE-TEST FORMS AND RESPONSES');
    console.log('='.repeat(80));

    // Get pre-test forms with responses
    const preTestForms = await prisma.preTestForm.findMany({
      take: 3,
      include: {
        trainings: {
          select: { title: true },
          take: 1,
        },
        responses: {
          take: 2,
          include: {
            user: {
              select: { name: true },
            },
          },
        },
      },
    });

    for (const form of preTestForms) {
      console.log('\n' + '='.repeat(60));
      console.log(`FORM: ${form.title}`);
      console.log(`TRAINING: ${form.trainings[0]?.title || 'N/A'}`);
      console.log(`FORM ID: ${form.id}`);
      console.log('='.repeat(60));

      const questions = form.questions as any[];
      console.log(`\nTotal Questions: ${questions?.length || 0}`);
      console.log('\nQuestion IDs and Types:');

      questions?.forEach((q: any, i: number) => {
        const qId = q?.id || 'NO_ID';
        const qType = q?.type || 'NO_TYPE';
        const qText = (q?.question || '').substring(0, 50);
        console.log(`  Q${i + 1}: id='${qId}', type='${qType}', text='${qText}...'`);
      });

      console.log(`\nSample Responses (showing ${form.responses.length}):`);

      for (const resp of form.responses) {
        console.log(`\n  User: ${resp.user?.name || 'Unknown'}`);

        const respData = resp.responses as Record<string, unknown>;
        const respKeys = Object.keys(respData || {});
        console.log(`  Response Keys (${respKeys.length}): ${JSON.stringify(respKeys)}`);

        console.log(`\n  Matching Analysis:`);
        questions?.forEach((q: any, i: number) => {
          const qId = q?.id || '';
          const hasMatch = respData && qId in respData;
          let value: any = respData?.[qId] ?? 'N/A';
          if (typeof value === 'string' && value.length > 30) {
            value = value.substring(0, 30) + '...';
          }
          console.log(`    Q${i + 1} (id='${qId}'): ${hasMatch ? 'MATCH' : 'NO MATCH'} -> ${value}`);
        });
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('CHECKING POST-TEST FORMS AND RESPONSES');
    console.log('='.repeat(80));

    // Get post-test forms with responses
    const postTestForms = await prisma.postTestForm.findMany({
      take: 3,
      include: {
        trainings: {
          select: { title: true },
          take: 1,
        },
        responses: {
          take: 2,
          include: {
            user: {
              select: { name: true },
            },
          },
        },
      },
    });

    for (const form of postTestForms) {
      console.log('\n' + '='.repeat(60));
      console.log(`FORM: ${form.title}`);
      console.log(`TRAINING: ${form.trainings[0]?.title || 'N/A'}`);
      console.log(`FORM ID: ${form.id}`);
      console.log('='.repeat(60));

      const questions = form.questions as any[];
      console.log(`\nTotal Questions: ${questions?.length || 0}`);
      console.log('\nQuestion IDs and Types:');

      questions?.forEach((q: any, i: number) => {
        const qId = q?.id || 'NO_ID';
        const qType = q?.type || 'NO_TYPE';
        const qText = (q?.question || '').substring(0, 50);
        console.log(`  Q${i + 1}: id='${qId}', type='${qType}', text='${qText}...'`);
      });

      console.log(`\nSample Responses (showing ${form.responses.length}):`);

      for (const resp of form.responses) {
        console.log(`\n  User: ${resp.user?.name || 'Unknown'}`);

        const respData = resp.responses as Record<string, unknown>;
        const respKeys = Object.keys(respData || {});
        console.log(`  Response Keys (${respKeys.length}): ${JSON.stringify(respKeys)}`);

        console.log(`\n  Matching Analysis:`);
        questions?.forEach((q: any, i: number) => {
          const qId = q?.id || '';
          const hasMatch = respData && qId in respData;
          let value: any = respData?.[qId] ?? 'N/A';
          if (typeof value === 'string' && value.length > 30) {
            value = value.substring(0, 30) + '...';
          }
          console.log(`    Q${i + 1} (id='${qId}'): ${hasMatch ? 'MATCH' : 'NO MATCH'} -> ${value}`);
        });
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('ANALYSIS COMPLETE');
    console.log('='.repeat(80));

  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Script failed:', error?.message || error);
  process.exit(1);
});
