import {
  PrismaClient,
  Role,
  TrainingApplicationStatus,
  TrainingDeliveryMode,
  TrainingDifficulty,
  FeedbackFormPurpose,
  LessonPlanStatus,
} from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

const TARGET_EMAILS = ['sukeerats@gmail.com'];

type TrainingSeed = {
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
  applicationDeadline: Date;
  duration: number;
  capacity: number;
  deliveryMode: TrainingDeliveryMode;
  difficulty: TrainingDifficulty;
  venue?: string;
  city?: string;
  state?: string;
  meetingLink?: string;
  providedBy?: string;
  trainerName?: string;
  trainerContact?: string;
  learningOutcomes: string[];
  targetBranchCodes: string[];
};

const TRAINING_SEED: TrainingSeed[] = [
  {
    title: 'Outcome Based Education and Curriculum Mapping',
    description:
      'Hands-on workshop on OBE design, mapping CO-PO, and assessment alignment.',
    startDate: new Date('2026-03-10T10:00:00.000Z'),
    endDate: new Date('2026-03-12T17:00:00.000Z'),
    applicationDeadline: new Date('2026-03-01T23:59:59.000Z'),
    duration: 18,
    capacity: 80,
    deliveryMode: TrainingDeliveryMode.OFFLINE,
    difficulty: TrainingDifficulty.INTERMEDIATE,
    venue: 'State Institute Training Hall',
    city: 'Chandigarh',
    state: 'Punjab',
    providedBy: 'Directorate of Technical Education',
    trainerName: 'Dr. Arjun Mehta',
    trainerContact: 'obe-support@placeintern.com',
    learningOutcomes: [
      'Design measurable course outcomes',
      'Map COs to POs and PSOs',
      'Align assessments to outcomes',
    ],
    targetBranchCodes: ['CSE', 'ECE', 'EE', 'ME', 'CE'],
  },
  {
    title: 'Industry 4.0 for Polytechnic Faculty',
    description:
      'Bootcamp on IoT, digital twins, and smart manufacturing use-cases for labs.',
    startDate: new Date('2026-04-05T09:30:00.000Z'),
    endDate: new Date('2026-04-07T16:30:00.000Z'),
    applicationDeadline: new Date('2026-03-25T23:59:59.000Z'),
    duration: 16,
    capacity: 60,
    deliveryMode: TrainingDeliveryMode.HYBRID,
    difficulty: TrainingDifficulty.ADVANCED,
    venue: 'Central Polytechnic Auditorium',
    city: 'Ludhiana',
    state: 'Punjab',
    meetingLink: 'https://meet.placeintern.com/industry4',
    providedBy: 'Punjab Tech Skills Council',
    trainerName: 'Ms. Riya Kapoor',
    trainerContact: 'skills-council@placeintern.com',
    learningOutcomes: [
      'Identify Industry 4.0 lab modules',
      'Build a basic IoT data pipeline',
      'Plan student capstone themes',
    ],
    targetBranchCodes: ['CSE', 'ECE', 'ME', 'EE'],
  },
  {
    title: 'Effective Student Mentoring and Assessment',
    description:
      'Practical strategies for mentoring, feedback, and evidence-based assessment.',
    startDate: new Date('2026-05-12T11:00:00.000Z'),
    endDate: new Date('2026-05-13T15:00:00.000Z'),
    applicationDeadline: new Date('2026-05-01T23:59:59.000Z'),
    duration: 10,
    capacity: 120,
    deliveryMode: TrainingDeliveryMode.ONLINE,
    difficulty: TrainingDifficulty.BEGINNER,
    meetingLink: 'https://meet.placeintern.com/mentoring',
    providedBy: 'Faculty Development Cell',
    trainerName: 'Dr. Neelam Sethi',
    trainerContact: 'fdc@placeintern.com',
    learningOutcomes: [
      'Design mentoring plans',
      'Document evidence for assessment',
      'Deliver constructive feedback',
    ],
    targetBranchCodes: ['CSE', 'ECE', 'EE', 'ME', 'CE', 'LT'],
  },
];

const FEEDBACK_FORM = {
  title: 'Faculty Training Feedback - Standard',
  description: 'Standard feedback form for faculty training programs.',
  purpose: FeedbackFormPurpose.TRAINING,
  questions: [
    {
      id: 'q1',
      type: 'rating',
      question: 'Overall quality of the training',
      required: true,
      options: { min: 1, max: 5 },
    },
    {
      id: 'q2',
      type: 'rating',
      question: 'Trainer effectiveness and clarity',
      required: true,
      options: { min: 1, max: 5 },
    },
    {
      id: 'q3',
      type: 'multi_select',
      question: 'Which topics were most useful?',
      required: true,
      options: [
        'Curriculum design',
        'Assessment strategy',
        'Lab integration',
        'Industry linkage',
        'Mentoring practices',
      ],
    },
    {
      id: 'q4',
      type: 'text',
      question: 'One improvement you would suggest',
      required: false,
    },
  ],
};

async function getSeedOwnerId(): Promise<string | null> {
  const preferred = await prisma.user.findFirst({
    where: {
      active: true,
      role: { in: [Role.SYSTEM_ADMIN, Role.STATE_DIRECTORATE, Role.PRINCIPAL] },
    },
    select: { id: true },
  });

  if (preferred) return preferred.id;

  const anyUser = await prisma.user.findFirst({
    where: { active: true },
    select: { id: true },
  });

  return anyUser?.id ?? null;
}

async function getTargetBranches(codes: string[]) {
  if (codes.length === 0) return [];

  const branches = await prisma.branch.findMany({
    where: { code: { in: codes } },
    select: { id: true },
  });

  return branches.map((branch) => ({ id: branch.id }));
}

async function ensureFeedbackForm(createdById: string) {
  const existing = await prisma.feedbackForm.findFirst({
    where: {
      title: FEEDBACK_FORM.title,
      purpose: FEEDBACK_FORM.purpose,
    },
    select: { id: true },
  });

  if (existing) return existing.id;

  const created = await prisma.feedbackForm.create({
    data: {
      title: FEEDBACK_FORM.title,
      description: FEEDBACK_FORM.description,
      purpose: FEEDBACK_FORM.purpose,
      questions: FEEDBACK_FORM.questions,
      isActive: true,
      isPublished: true,
      createdById,
    },
    select: { id: true },
  });

  return created.id;
}

async function main() {
  console.log('=== Seeding Training Module Data (non-destructive) ===');

  const createdById = await getSeedOwnerId();
  if (!createdById) {
    console.log('No active users found. Skipping training seed.');
    return;
  }

  const feedbackFormId = await ensureFeedbackForm(createdById);
  const targetUsers = await prisma.user.findMany({
    where: { email: { in: TARGET_EMAILS } },
    select: { id: true, name: true, email: true },
  });

  if (TARGET_EMAILS.length > 0 && targetUsers.length === 0) {
    console.log('Target user emails not found. Skipping training seed.');
    return;
  }

  const teachers = await prisma.user.findMany({
    where: { active: true, role: Role.TEACHER },
    select: { id: true, name: true, email: true },
    take: 20,
  });

  const fallbackUsers = targetUsers.length
    ? targetUsers
    : teachers.length
      ? teachers
      : await prisma.user.findMany({
          where: { active: true },
          select: { id: true, name: true, email: true },
          take: 10,
        });

  if (fallbackUsers.length === 0) {
    console.log('No eligible users found for training applications.');
  }

  for (const seed of TRAINING_SEED) {
    const existingTraining = await prisma.training.findFirst({
      where: { title: seed.title, startDate: seed.startDate },
      select: { id: true, targetBranches: { select: { id: true } } },
    });

    const targetBranches = await getTargetBranches(seed.targetBranchCodes);
    const existingBranchIds = new Set(
      (existingTraining?.targetBranches ?? []).map((branch) => branch.id),
    );
    const missingBranchConnections = targetBranches.filter(
      (branch) => !existingBranchIds.has(branch.id),
    );

    const training = existingTraining
      ? await prisma.training.update({
          where: { id: existingTraining.id },
          data: {
            isActive: true,
            isPublished: true,
            publishedAt: new Date(),
            feedbackFormId,
            targetBranches: missingBranchConnections.length
              ? { connect: missingBranchConnections }
              : undefined,
          },
          select: { id: true, title: true, startDate: true, endDate: true },
        })
      : await prisma.training.create({
          data: {
            title: seed.title,
            description: seed.description,
            providedBy: seed.providedBy,
            trainerName: seed.trainerName,
            trainerContact: seed.trainerContact,
            startDate: seed.startDate,
            endDate: seed.endDate,
            duration: seed.duration,
            applicationDeadline: seed.applicationDeadline,
            deliveryMode: seed.deliveryMode,
            venue: seed.venue,
            city: seed.city,
            state: seed.state,
            meetingLink: seed.meetingLink,
            capacity: seed.capacity,
            prerequisites: 'Basic teaching experience',
            difficulty: seed.difficulty,
            learningOutcomes: seed.learningOutcomes,
            isActive: true,
            isPublished: true,
            publishedAt: new Date(),
            createdById,
            feedbackFormId,
            targetBranches: targetBranches.length ? { connect: targetBranches } : undefined,
          },
          select: { id: true, title: true, startDate: true, endDate: true },
        });

    console.log(`Training ready: ${training.title}`);

    for (const user of fallbackUsers) {
      const existingApplication = await prisma.trainingApplication.findUnique({
        where: { userId_trainingId: { userId: user.id, trainingId: training.id } },
        select: { id: true, status: true },
      });

      const shouldApprove = targetUsers.length > 0 ? true : Math.random() > 0.4;
      const nextStatus = shouldApprove
        ? TrainingApplicationStatus.APPROVED
        : TrainingApplicationStatus.SUBMITTED;

      if (!existingApplication) {
        await prisma.trainingApplication.create({
          data: {
            userId: user.id,
            trainingId: training.id,
            relevanceToTeaching: 'Aligns with my course outcomes and lab delivery.',
            expectedApplication: 'Will update lesson plans and lab rubrics.',
            status: nextStatus,
            appliedAt: new Date('2026-02-15T09:00:00.000Z'),
            reviewedAt: shouldApprove ? new Date('2026-02-20T12:00:00.000Z') : null,
            reviewedById: shouldApprove ? createdById : null,
            reviewComments: shouldApprove
              ? 'Approved for upcoming training.'
              : 'Awaiting review.',
          },
        });
      } else if (nextStatus === TrainingApplicationStatus.APPROVED) {
        await prisma.trainingApplication.update({
          where: { id: existingApplication.id },
          data: {
            status: TrainingApplicationStatus.APPROVED,
            reviewedAt: new Date('2026-02-20T12:00:00.000Z'),
            reviewedById: createdById,
            reviewComments: 'Approved for upcoming training.',
          },
        });
      }

      if (nextStatus === TrainingApplicationStatus.APPROVED) {
        const attendanceDate = new Date(seed.startDate);
        const existingAttendance = await prisma.trainingAttendance.findUnique({
          where: {
            userId_trainingId_attendanceDate: {
              userId: user.id,
              trainingId: training.id,
              attendanceDate,
            },
          },
          select: { id: true },
        });

        if (!existingAttendance) {
          await prisma.trainingAttendance.create({
            data: {
              userId: user.id,
              trainingId: training.id,
              markedAt: new Date('2026-03-10T10:05:00.000Z'),
              markedById: createdById,
              attendanceDate,
              ipAddress: '203.0.113.42',
              userAgent: 'SeedScript/1.0',
              location: seed.city ?? 'Virtual',
            },
          });
        }

        const existingLessonPlan = await prisma.lessonPlan.findUnique({
          where: { userId_trainingId: { userId: user.id, trainingId: training.id } },
          select: { id: true },
        });

        if (!existingLessonPlan) {
          await prisma.lessonPlan.create({
            data: {
              userId: user.id,
              trainingId: training.id,
              title: `Lesson Plan - ${seed.title}`,
              courseOrSemester: 'Semester 4',
              connectionToTraining:
                'Integrating training learnings into core lab sessions and assessments.',
              learningObjectives: [
                'Apply outcomes to assessments',
                'Introduce real-world lab case studies',
              ],
              newSkillsTechnologies: 'Outcome mapping, assessment rubric design',
              deliveryMethods: 'Lectures, labs, peer review',
              handsOnActivities: 'Design a rubric for a lab experiment',
              assessmentMethods: 'Rubric-based evaluation and reflection logs',
              industryConnections: 'Invite industry mentor for guest lecture',
              resourceRequirements: 'Projector, lab tools, rubrics',
              implementationTimeline: '4 weeks after training',
              expectedOutcomes: 'Improved student engagement and assessment quality',
              status: LessonPlanStatus.SUBMITTED,
              submittedAt: new Date('2026-03-18T11:00:00.000Z'),
              dueDate: new Date('2026-04-01T23:59:59.000Z'),
              reviewedById: createdById,
              reviewedAt: new Date('2026-03-22T14:00:00.000Z'),
              reviewComments: 'Good alignment with training goals.',
            },
          });
        }

        const existingFeedback = await prisma.feedbackResponse.findUnique({
          where: {
            userId_feedbackFormId_trainingId: {
              userId: user.id,
              feedbackFormId,
              trainingId: training.id,
            },
          },
          select: { id: true },
        });

        if (!existingFeedback) {
          await prisma.feedbackResponse.create({
            data: {
              userId: user.id,
              feedbackFormId,
              trainingId: training.id,
              responses: {
                q1: 5,
                q2: 5,
                q3: ['Curriculum design', 'Mentoring practices'],
                q4: 'Extend hands-on lab sessions.',
              },
              submittedAt: new Date('2026-03-12T16:00:00.000Z'),
            },
          });
        }

        const existingCertificate = await prisma.trainingCertificate.findUnique({
          where: { userId_trainingId: { userId: user.id, trainingId: training.id } },
          select: { id: true },
        });

        if (!existingCertificate) {
          await prisma.trainingCertificate.create({
            data: {
              userId: user.id,
              trainingId: training.id,
              certificateNumber: `TRN-${training.id.slice(0, 8)}-${user.id.slice(0, 8)}`,
              issuedAt: new Date('2026-03-20T10:00:00.000Z'),
              issuedById: createdById,
              certificateUrl: 'https://storage.example.com/certificates/sample.pdf',
            },
          });
        }
      }
    }
  }

  console.log('=== Training module seed completed ===');
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
