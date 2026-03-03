import { PrismaClient, FeedbackFormPurpose, Role } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

const FORM_TITLE = 'Faculty Training Feedback';

const FORM_DESCRIPTION =
  '⚠ We request you to provide authentic, thoughtful, and honest responses. Your feedback will be used only for improving the training process and will remain confidential.\n\n' +
  'This form is designed to collect inputs from faculty members participating in the training program. It serves two purposes:\n' +
  '1. To record your expectations before the training.\n' +
  '2. To gather your feedback after the training.';

const QUESTIONS = [
  {
    id: 'q1',
    type: 'rating',
    question: 'Relevance of the training content to your teaching needs',
    required: true,
    options: {
      min: 1,
      max: 5,
      labels: ['Poor', 'Fair', 'Satisfactory', 'Good', 'Excellent'],
    },
  },
  {
    id: 'q2',
    type: 'rating',
    question: 'Quality of training materials provided',
    required: true,
    options: {
      min: 1,
      max: 5,
      labels: ['Poor', 'Fair', 'Satisfactory', 'Good', 'Excellent'],
    },
  },
  {
    id: 'q3',
    type: 'rating',
    question: 'Knowledge and expertise of the trainer(s)',
    required: true,
    options: {
      min: 1,
      max: 5,
      labels: ['Poor', 'Fair', 'Satisfactory', 'Good', 'Excellent'],
    },
  },
  {
    id: 'q4',
    type: 'rating',
    question: 'Clarity of explanation / communication skills',
    required: true,
    options: {
      min: 1,
      max: 5,
      labels: ['Poor', 'Fair', 'Satisfactory', 'Good', 'Excellent'],
    },
  },
  {
    id: 'q5',
    type: 'rating',
    question: 'Balance between theory and practical examples',
    required: true,
    options: {
      min: 1,
      max: 5,
      labels: ['Poor', 'Fair', 'Satisfactory', 'Good', 'Excellent'],
    },
  },
  {
    id: 'q6',
    type: 'rating',
    question: 'Engagement and interaction during sessions',
    required: true,
    options: {
      min: 1,
      max: 5,
      labels: ['Poor', 'Fair', 'Satisfactory', 'Good', 'Excellent'],
    },
  },
  {
    id: 'q7',
    type: 'rating',
    question: 'Time management of sessions',
    required: true,
    options: {
      min: 1,
      max: 5,
      labels: ['Poor', 'Fair', 'Satisfactory', 'Good', 'Excellent'],
    },
  },
  {
    id: 'q8',
    type: 'rating',
    question: 'Usefulness of hands-on / practical exercises (if any)',
    required: true,
    options: {
      min: 1,
      max: 5,
      labels: ['Poor', 'Fair', 'Satisfactory', 'Good', 'Excellent'],
    },
  },
  {
    id: 'q9',
    type: 'text',
    question: 'What were your key learnings from this training?',
    required: true,
  },
  {
    id: 'q10',
    type: 'text',
    question: 'How do you plan to apply this knowledge in your teaching?',
    required: true,
  },
  {
    id: 'q11',
    type: 'single_select',
    question: 'Did the training meet your initial expectations?',
    required: true,
    options: ['Partially', 'Fully', 'Not Really'],
  },
  {
    id: 'q12',
    type: 'text',
    question: 'What can be improved in future trainings?',
    required: false,
  },
  {
    id: 'q13',
    type: 'text',
    question: 'Any specific topics you would like covered in future?',
    required: false,
  },
  {
    id: 'q14',
    type: 'text',
    question:
      'Details of the equipment/machinery required for implementation of the training module (in case equipment/machinery/tools are not available in the college)',
    required: false,
  },
];

async function getSeedOwnerId(): Promise<string | null> {
  const preferred = await prisma.user.findFirst({
    where: {
      active: true,
      role: { in: [Role.SYSTEM_ADMIN, Role.STATE_DIRECTORATE, Role.PRINCIPAL] },
    },
    select: { id: true },
  });

  if (preferred) {
    return preferred.id;
  }

  const anyActive = await prisma.user.findFirst({
    where: { active: true },
    select: { id: true },
  });

  return anyActive?.id ?? null;
}

async function main() {
  console.log('=== Seeding Faculty Training Feedback Form ===');

  const createdById = await getSeedOwnerId();
  if (!createdById) {
    throw new Error('No active user found to assign as createdById.');
  }

  const existing = await prisma.feedbackForm.findFirst({
    where: { title: FORM_TITLE },
    select: { id: true },
  });

  if (existing) {
    await prisma.feedbackForm.update({
      where: { id: existing.id },
      data: {
        description: FORM_DESCRIPTION,
        purpose: FeedbackFormPurpose.TRAINING,
        questions: QUESTIONS,
        isActive: true,
        isPublished: true,
      },
    });

    console.log(`Updated existing form: ${FORM_TITLE}`);
  } else {
    await prisma.feedbackForm.create({
      data: {
        title: FORM_TITLE,
        description: FORM_DESCRIPTION,
        purpose: FeedbackFormPurpose.TRAINING,
        questions: QUESTIONS,
        isActive: true,
        isPublished: true,
        createdById,
      },
    });

    console.log(`Created new form: ${FORM_TITLE}`);
  }

  console.log(`Total questions: ${QUESTIONS.length}`);
  console.log('=== Faculty Training Feedback Form seed completed ===');
}

main()
  .catch((error) => {
    console.error('Seed error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
