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

// ============================================================================
// CLEANUP FUNCTION - Delete all training module data
// ============================================================================

async function cleanupTrainingData() {
  console.log('--- Cleaning up existing training data ---');

  // Delete in order respecting foreign key constraints
  const certificatesDeleted = await prisma.trainingCertificate.deleteMany({});
  console.log(`  Deleted ${certificatesDeleted.count} certificates`);

  const feedbackResponsesDeleted = await prisma.feedbackResponse.deleteMany({
    where: { trainingId: { not: null } },
  });
  console.log(`  Deleted ${feedbackResponsesDeleted.count} feedback responses`);

  const lessonPlansDeleted = await prisma.lessonPlan.deleteMany({});
  console.log(`  Deleted ${lessonPlansDeleted.count} lesson plans`);

  const attendanceDeleted = await prisma.trainingAttendance.deleteMany({});
  console.log(`  Deleted ${attendanceDeleted.count} attendance records`);

  const applicationsDeleted = await prisma.trainingApplication.deleteMany({});
  console.log(`  Deleted ${applicationsDeleted.count} applications`);

  const trainingsDeleted = await prisma.training.deleteMany({});
  console.log(`  Deleted ${trainingsDeleted.count} trainings`);

  const feedbackFormsDeleted = await prisma.feedbackForm.deleteMany({
    where: { purpose: FeedbackFormPurpose.TRAINING },
  });
  console.log(`  Deleted ${feedbackFormsDeleted.count} feedback forms`);

  console.log('  Cleanup completed!\n');
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function daysAgo(n: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - n);
  return date;
}

function daysFromNow(n: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + n);
  return date;
}

function getRandomRating(min: number = 3, max: number = 5): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateFeedbackResponse(formTitle: string): Record<string, any> {
  const topicOptions = [
    'Curriculum design',
    'Assessment strategy',
    'Lab integration',
    'Industry linkage',
    'Mentoring practices',
    'Digital tools',
    'Research methodology',
    'Soft skills',
  ];

  const textResponses = [
    'More hands-on sessions would be helpful.',
    'Excellent content, well organized.',
    'Could include more case studies.',
    'The pace was perfect for learning.',
    'Would love more industry examples.',
    'Very practical and applicable.',
    'Great trainer, clear explanations.',
    'More time for Q&A would be appreciated.',
  ];

  if (formTitle.includes('Quick')) {
    return {
      q1: getRandomRating(3, 5),
      q2: getRandomRating(3, 5),
      q3: getRandomElement(['Yes', 'Maybe', 'Definitely']),
      q4: getRandomElement(textResponses),
    };
  } else if (formTitle.includes('Advanced')) {
    return {
      q1: getRandomRating(3, 5),
      q2: getRandomRating(3, 5),
      q3: getRandomRating(3, 5),
      q4: getRandomRating(3, 5),
      q5: topicOptions.slice(0, Math.floor(Math.random() * 3) + 2),
      q6: getRandomElement(['Beginner', 'Intermediate', 'Advanced']),
      q7: getRandomElement(textResponses),
      q8: getRandomElement(textResponses),
    };
  }

  // Standard feedback
  return {
    q1: getRandomRating(3, 5),
    q2: getRandomRating(3, 5),
    q3: getRandomRating(3, 5),
    q4: topicOptions.slice(0, Math.floor(Math.random() * 3) + 2),
    q5: getRandomElement(['Yes', 'No', 'Partially']),
    q6: getRandomRating(3, 5),
    q7: getRandomElement(textResponses),
    q8: getRandomElement(textResponses),
  };
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

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
  category: 'past' | 'ongoing' | 'upcoming' | 'future';
};

type FeedbackFormSeed = {
  title: string;
  description: string;
  purpose: FeedbackFormPurpose;
  questions: Array<{
    id: string;
    type: string;
    question: string;
    required: boolean;
    options?: any;
  }>;
};

// ============================================================================
// FEEDBACK FORMS (3 forms with varied question types)
// ============================================================================

const FEEDBACK_FORMS: FeedbackFormSeed[] = [
  {
    title: 'Standard Training Feedback',
    description: 'Comprehensive feedback form for faculty training programs.',
    purpose: FeedbackFormPurpose.TRAINING,
    questions: [
      {
        id: 'q1',
        type: 'rating',
        question: 'Overall quality of the training content',
        required: true,
        options: { min: 1, max: 5, labels: ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'] },
      },
      {
        id: 'q2',
        type: 'rating',
        question: 'Trainer effectiveness and communication',
        required: true,
        options: { min: 1, max: 5 },
      },
      {
        id: 'q3',
        type: 'rating',
        question: 'Relevance to your teaching practice',
        required: true,
        options: { min: 1, max: 5 },
      },
      {
        id: 'q4',
        type: 'multi_select',
        question: 'Which topics were most valuable to you?',
        required: true,
        options: [
          'Curriculum design',
          'Assessment strategy',
          'Lab integration',
          'Industry linkage',
          'Mentoring practices',
          'Digital tools',
        ],
      },
      {
        id: 'q5',
        type: 'single_select',
        question: 'Would you recommend this training to colleagues?',
        required: true,
        options: ['Yes', 'No', 'Maybe'],
      },
      {
        id: 'q6',
        type: 'rating',
        question: 'Quality of training materials provided',
        required: true,
        options: { min: 1, max: 5 },
      },
      {
        id: 'q7',
        type: 'text',
        question: 'What was the most valuable takeaway from this training?',
        required: true,
      },
      {
        id: 'q8',
        type: 'text',
        question: 'Any suggestions for improvement?',
        required: false,
      },
    ],
  },
  {
    title: 'Workshop Quick Feedback',
    description: 'Brief feedback form for short workshops and sessions.',
    purpose: FeedbackFormPurpose.TRAINING,
    questions: [
      {
        id: 'q1',
        type: 'rating',
        question: 'How would you rate this workshop overall?',
        required: true,
        options: { min: 1, max: 5 },
      },
      {
        id: 'q2',
        type: 'rating',
        question: 'Was the workshop duration appropriate?',
        required: true,
        options: { min: 1, max: 5 },
      },
      {
        id: 'q3',
        type: 'single_select',
        question: 'Would you attend a follow-up session?',
        required: true,
        options: ['Yes', 'Maybe', 'Definitely'],
      },
      {
        id: 'q4',
        type: 'text',
        question: 'Quick feedback or comments',
        required: false,
      },
    ],
  },
  {
    title: 'Advanced Training Evaluation',
    description: 'Detailed evaluation form for advanced training programs.',
    purpose: FeedbackFormPurpose.TRAINING,
    questions: [
      {
        id: 'q1',
        type: 'rating',
        question: 'Depth of technical content covered',
        required: true,
        options: { min: 1, max: 5 },
      },
      {
        id: 'q2',
        type: 'rating',
        question: 'Hands-on practical exercises quality',
        required: true,
        options: { min: 1, max: 5 },
      },
      {
        id: 'q3',
        type: 'rating',
        question: 'Applicability to research work',
        required: true,
        options: { min: 1, max: 5 },
      },
      {
        id: 'q4',
        type: 'rating',
        question: 'Industry relevance of the content',
        required: true,
        options: { min: 1, max: 5 },
      },
      {
        id: 'q5',
        type: 'multi_select',
        question: 'Areas you gained expertise in',
        required: true,
        options: [
          'Research methodology',
          'Data analysis',
          'Technical writing',
          'Project management',
          'Innovation practices',
          'Industry collaboration',
        ],
      },
      {
        id: 'q6',
        type: 'single_select',
        question: 'Your prior experience level with the topic',
        required: true,
        options: ['Beginner', 'Intermediate', 'Advanced'],
      },
      {
        id: 'q7',
        type: 'text',
        question: 'How do you plan to apply this training in your work?',
        required: true,
      },
      {
        id: 'q8',
        type: 'text',
        question: 'Topics you would like covered in future trainings',
        required: false,
      },
    ],
  },
];

// ============================================================================
// TRAINING SEED DATA (10 trainings across 4 categories)
// ============================================================================

const TRAINING_SEED: TrainingSeed[] = [
  // -------------------------------------------------------------------------
  // PAST TRAININGS (3) - Completed with full data
  // -------------------------------------------------------------------------
  {
    title: 'Outcome Based Education and Curriculum Mapping',
    description:
      'Comprehensive workshop on OBE principles, designing measurable course outcomes, mapping CO-PO-PSO, and aligning assessments with learning outcomes. Includes hands-on exercises with Bloom\'s taxonomy and rubric development.',
    startDate: daysAgo(45),
    endDate: daysAgo(42),
    applicationDeadline: daysAgo(60),
    duration: 24,
    capacity: 80,
    deliveryMode: TrainingDeliveryMode.OFFLINE,
    difficulty: TrainingDifficulty.INTERMEDIATE,
    venue: 'State Institute Training Hall',
    city: 'Chandigarh',
    state: 'Punjab',
    providedBy: 'Directorate of Technical Education',
    trainerName: 'Dr. Arjun Mehta',
    trainerContact: 'obe-support@dte.punjab.gov.in',
    learningOutcomes: [
      'Design measurable course outcomes using Bloom\'s taxonomy',
      'Map COs to POs and PSOs effectively',
      'Develop assessment rubrics aligned with outcomes',
      'Create attainment calculation frameworks',
    ],
    targetBranchCodes: ['CSE', 'ECE', 'EE', 'ME', 'CE'],
    category: 'past',
  },
  {
    title: 'Python for Data Science and Machine Learning',
    description:
      'Intensive bootcamp covering Python programming, NumPy, Pandas, Matplotlib, Scikit-learn, and introduction to deep learning with TensorFlow. Faculty will build real-world ML projects applicable to engineering education.',
    startDate: daysAgo(30),
    endDate: daysAgo(25),
    applicationDeadline: daysAgo(45),
    duration: 40,
    capacity: 60,
    deliveryMode: TrainingDeliveryMode.HYBRID,
    difficulty: TrainingDifficulty.ADVANCED,
    venue: 'Central Polytechnic Computer Lab',
    city: 'Ludhiana',
    state: 'Punjab',
    meetingLink: 'https://meet.placeintern.com/python-ds',
    providedBy: 'Punjab Tech Skills Council',
    trainerName: 'Dr. Priya Sharma',
    trainerContact: 'python-training@ptsc.gov.in',
    learningOutcomes: [
      'Write efficient Python code for data analysis',
      'Apply machine learning algorithms to engineering problems',
      'Develop student projects using real datasets',
      'Integrate ML concepts into existing curriculum',
    ],
    targetBranchCodes: ['CSE', 'ECE', 'IT'],
    category: 'past',
  },
  {
    title: 'Laboratory Safety and Best Practices',
    description:
      'Essential training on laboratory safety protocols, hazard identification, emergency procedures, and compliance with safety standards. Covers electrical, chemical, and mechanical lab environments.',
    startDate: daysAgo(20),
    endDate: daysAgo(18),
    applicationDeadline: daysAgo(35),
    duration: 16,
    capacity: 100,
    deliveryMode: TrainingDeliveryMode.OFFLINE,
    difficulty: TrainingDifficulty.BEGINNER,
    venue: 'Government Polytechnic Auditorium',
    city: 'Jalandhar',
    state: 'Punjab',
    providedBy: 'Industrial Safety Council',
    trainerName: 'Er. Rajesh Kumar',
    trainerContact: 'safety@isc.punjab.gov.in',
    learningOutcomes: [
      'Identify and mitigate laboratory hazards',
      'Implement standard safety protocols',
      'Conduct safety audits and inspections',
      'Train students on emergency procedures',
    ],
    targetBranchCodes: ['CSE', 'ECE', 'EE', 'ME', 'CE', 'CH'],
    category: 'past',
  },

  // -------------------------------------------------------------------------
  // ONGOING TRAININGS (2) - In progress with partial attendance
  // -------------------------------------------------------------------------
  {
    title: 'Digital Pedagogy and E-Learning Tools',
    description:
      'Hands-on training on modern digital teaching tools including LMS platforms, video creation, interactive assessments, and virtual labs. Learn to create engaging online content and manage hybrid classrooms effectively.',
    startDate: daysAgo(3),
    endDate: daysFromNow(4),
    applicationDeadline: daysAgo(15),
    duration: 32,
    capacity: 70,
    deliveryMode: TrainingDeliveryMode.ONLINE,
    difficulty: TrainingDifficulty.INTERMEDIATE,
    meetingLink: 'https://meet.placeintern.com/digital-pedagogy',
    providedBy: 'Faculty Development Cell',
    trainerName: 'Dr. Neelam Sethi',
    trainerContact: 'fdc@dte.punjab.gov.in',
    learningOutcomes: [
      'Design interactive e-learning modules',
      'Use LMS effectively for course management',
      'Create engaging video content for lectures',
      'Implement online assessment strategies',
    ],
    targetBranchCodes: ['CSE', 'ECE', 'EE', 'ME', 'CE', 'LT'],
    category: 'ongoing',
  },
  {
    title: 'Curriculum Design for Industry 4.0',
    description:
      'Strategic workshop on integrating Industry 4.0 concepts into polytechnic curriculum. Covers IoT, automation, digital twins, smart manufacturing, and designing industry-relevant lab experiments.',
    startDate: daysAgo(5),
    endDate: daysFromNow(2),
    applicationDeadline: daysAgo(20),
    duration: 28,
    capacity: 50,
    deliveryMode: TrainingDeliveryMode.HYBRID,
    difficulty: TrainingDifficulty.ADVANCED,
    venue: 'Industry Collaboration Center',
    city: 'Mohali',
    state: 'Punjab',
    meetingLink: 'https://meet.placeintern.com/industry40',
    providedBy: 'CII Punjab Chapter',
    trainerName: 'Mr. Vikram Singh',
    trainerContact: 'industry40@cii.in',
    learningOutcomes: [
      'Design curriculum aligned with Industry 4.0 requirements',
      'Develop IoT-based lab experiments',
      'Create industry collaboration frameworks',
      'Implement project-based learning modules',
    ],
    targetBranchCodes: ['CSE', 'ECE', 'ME', 'EE'],
    category: 'ongoing',
  },

  // -------------------------------------------------------------------------
  // UPCOMING TRAININGS (3) - Applications open with mixed statuses
  // -------------------------------------------------------------------------
  {
    title: 'Research Methodology and Technical Writing',
    description:
      'Comprehensive program on research methods, literature review, paper writing, and publication strategies. Includes hands-on sessions on using research tools, citation management, and preparing manuscripts for peer-reviewed journals.',
    startDate: daysFromNow(15),
    endDate: daysFromNow(20),
    applicationDeadline: daysFromNow(7),
    duration: 30,
    capacity: 60,
    deliveryMode: TrainingDeliveryMode.OFFLINE,
    difficulty: TrainingDifficulty.ADVANCED,
    venue: 'Research and Development Center',
    city: 'Patiala',
    state: 'Punjab',
    providedBy: 'Punjab State Council for Science & Technology',
    trainerName: 'Dr. Amandeep Kaur',
    trainerContact: 'research@pscst.gov.in',
    learningOutcomes: [
      'Design research methodology for engineering projects',
      'Write effective research papers',
      'Navigate publication process successfully',
      'Guide student research projects',
    ],
    targetBranchCodes: ['CSE', 'ECE', 'EE', 'ME', 'CE', 'CH'],
    category: 'upcoming',
  },
  {
    title: 'Soft Skills and Communication for Faculty',
    description:
      'Interactive workshop on enhancing communication skills, presentation techniques, student engagement strategies, and professional development. Includes mock sessions and peer feedback.',
    startDate: daysFromNow(25),
    endDate: daysFromNow(27),
    applicationDeadline: daysFromNow(15),
    duration: 18,
    capacity: 80,
    deliveryMode: TrainingDeliveryMode.OFFLINE,
    difficulty: TrainingDifficulty.BEGINNER,
    venue: 'State Training Institute',
    city: 'Amritsar',
    state: 'Punjab',
    providedBy: 'Human Resource Development Cell',
    trainerName: 'Ms. Simran Kaur',
    trainerContact: 'hrdc@dte.punjab.gov.in',
    learningOutcomes: [
      'Enhance classroom communication skills',
      'Develop effective presentation techniques',
      'Implement student engagement strategies',
      'Build professional development habits',
    ],
    targetBranchCodes: ['CSE', 'ECE', 'EE', 'ME', 'CE', 'LT', 'CH'],
    category: 'upcoming',
  },
  {
    title: 'AI in Education: Practical Applications',
    description:
      'Explore how artificial intelligence can transform teaching and assessment. Learn to use AI tools for personalized learning, automated grading, intelligent tutoring systems, and creating AI-enhanced educational content.',
    startDate: daysFromNow(30),
    endDate: daysFromNow(35),
    applicationDeadline: daysFromNow(20),
    duration: 36,
    capacity: 50,
    deliveryMode: TrainingDeliveryMode.HYBRID,
    difficulty: TrainingDifficulty.INTERMEDIATE,
    venue: 'AI Research Lab',
    city: 'Chandigarh',
    state: 'Punjab',
    meetingLink: 'https://meet.placeintern.com/ai-education',
    providedBy: 'IIT Ropar Outreach',
    trainerName: 'Dr. Harpreet Singh',
    trainerContact: 'ai-edu@iitrpr.ac.in',
    learningOutcomes: [
      'Implement AI tools in classroom teaching',
      'Design AI-enhanced assessments',
      'Create personalized learning experiences',
      'Evaluate AI tools for educational purposes',
    ],
    targetBranchCodes: ['CSE', 'ECE', 'IT'],
    category: 'upcoming',
  },

  // -------------------------------------------------------------------------
  // FUTURE TRAININGS (2) - Not yet open for applications
  // -------------------------------------------------------------------------
  {
    title: 'NBA Accreditation Preparation Workshop',
    description:
      'Intensive workshop on preparing for NBA accreditation. Covers self-assessment report preparation, documentation requirements, outcome-based framework implementation, and best practices from successfully accredited institutions.',
    startDate: daysFromNow(60),
    endDate: daysFromNow(65),
    applicationDeadline: daysFromNow(45),
    duration: 40,
    capacity: 40,
    deliveryMode: TrainingDeliveryMode.OFFLINE,
    difficulty: TrainingDifficulty.ADVANCED,
    venue: 'Accreditation Resource Center',
    city: 'Chandigarh',
    state: 'Punjab',
    providedBy: 'NBA Expert Panel',
    trainerName: 'Dr. Sukhwinder Singh',
    trainerContact: 'nba-prep@aicte.gov.in',
    learningOutcomes: [
      'Prepare comprehensive SAR documents',
      'Implement NBA criteria in curriculum',
      'Design continuous improvement processes',
      'Handle accreditation team visits effectively',
    ],
    targetBranchCodes: ['CSE', 'ECE', 'EE', 'ME', 'CE'],
    category: 'future',
  },
  {
    title: 'Advanced Lab Equipment Operation and Maintenance',
    description:
      'Technical training on operating and maintaining advanced laboratory equipment. Covers CNC machines, 3D printers, IoT kits, robotics equipment, and preventive maintenance schedules for optimal lab performance.',
    startDate: daysFromNow(75),
    endDate: daysFromNow(80),
    applicationDeadline: daysFromNow(60),
    duration: 32,
    capacity: 45,
    deliveryMode: TrainingDeliveryMode.OFFLINE,
    difficulty: TrainingDifficulty.INTERMEDIATE,
    venue: 'Advanced Manufacturing Lab',
    city: 'Bathinda',
    state: 'Punjab',
    providedBy: 'Equipment Manufacturers Consortium',
    trainerName: 'Er. Gurpreet Singh',
    trainerContact: 'lab-training@emc.org.in',
    learningOutcomes: [
      'Operate advanced lab equipment safely',
      'Perform routine maintenance procedures',
      'Troubleshoot common equipment issues',
      'Develop maintenance schedules and protocols',
    ],
    targetBranchCodes: ['ME', 'EE', 'ECE', 'CSE'],
    category: 'future',
  },
];

// ============================================================================
// HELPER FUNCTIONS FOR DATABASE OPERATIONS
// ============================================================================

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

async function ensureFeedbackForms(createdById: string): Promise<Map<string, string>> {
  const formIdMap = new Map<string, string>();

  for (const form of FEEDBACK_FORMS) {
    const existing = await prisma.feedbackForm.findFirst({
      where: {
        title: form.title,
        purpose: form.purpose,
      },
      select: { id: true },
    });

    if (existing) {
      formIdMap.set(form.title, existing.id);
      console.log(`  Feedback form exists: ${form.title}`);
    } else {
      const created = await prisma.feedbackForm.create({
        data: {
          title: form.title,
          description: form.description,
          purpose: form.purpose,
          questions: form.questions,
          isActive: true,
          isPublished: true,
          createdById,
        },
        select: { id: true },
      });
      formIdMap.set(form.title, created.id);
      console.log(`  Created feedback form: ${form.title}`);
    }
  }

  return formIdMap;
}

async function getEligibleUsers() {
  const targetUsers = await prisma.user.findMany({
    where: { email: { in: TARGET_EMAILS } },
    select: { id: true, name: true, email: true },
  });

  const teachers = await prisma.user.findMany({
    where: { active: true, role: Role.TEACHER },
    select: { id: true, name: true, email: true },
    take: 25,
  });

  const allActive = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true, email: true },
    take: 15,
  });

  return {
    targetUsers,
    teachers,
    fallbackUsers: targetUsers.length ? targetUsers : teachers.length ? teachers : allActive,
  };
}

function getApplicationStatus(
  category: string,
  index: number,
): TrainingApplicationStatus {
  // Create varied statuses for all categories to allow testing all features

  if (category === 'past') {
    // Past trainings: mostly approved, but some rejected/waitlisted for variety
    const statuses: TrainingApplicationStatus[] = [
      TrainingApplicationStatus.APPROVED,
      TrainingApplicationStatus.APPROVED,
      TrainingApplicationStatus.APPROVED,
      TrainingApplicationStatus.REJECTED,
      TrainingApplicationStatus.WAITLISTED,
    ];
    return statuses[index % statuses.length];
  }

  if (category === 'ongoing') {
    // Ongoing trainings: mix of approved and pending/submitted for review testing
    const statuses: TrainingApplicationStatus[] = [
      TrainingApplicationStatus.APPROVED,
      TrainingApplicationStatus.APPROVED,
      TrainingApplicationStatus.SUBMITTED,
      TrainingApplicationStatus.PENDING,
      TrainingApplicationStatus.WAITLISTED,
    ];
    return statuses[index % statuses.length];
  }

  // For upcoming trainings: full variety of statuses
  const statuses: TrainingApplicationStatus[] = [
    TrainingApplicationStatus.PENDING,
    TrainingApplicationStatus.SUBMITTED,
    TrainingApplicationStatus.APPROVED,
    TrainingApplicationStatus.REJECTED,
    TrainingApplicationStatus.WAITLISTED,
  ];

  return statuses[index % statuses.length];
}

function getLessonPlanStatus(index: number): LessonPlanStatus {
  const statuses: LessonPlanStatus[] = [
    LessonPlanStatus.APPROVED,
    LessonPlanStatus.SUBMITTED,
    LessonPlanStatus.REVISION_REQUIRED,
  ];
  return statuses[index % statuses.length];
}

function getFeedbackFormForTraining(
  formIdMap: Map<string, string>,
  trainingTitle: string,
): string {
  // Assign different feedback forms based on training type
  if (
    trainingTitle.includes('Workshop') ||
    trainingTitle.includes('Soft Skills') ||
    trainingTitle.includes('Safety')
  ) {
    return formIdMap.get('Workshop Quick Feedback')!;
  }
  if (
    trainingTitle.includes('Advanced') ||
    trainingTitle.includes('Research') ||
    trainingTitle.includes('AI') ||
    trainingTitle.includes('NBA')
  ) {
    return formIdMap.get('Advanced Training Evaluation')!;
  }
  return formIdMap.get('Standard Training Feedback')!;
}

// ============================================================================
// MAIN SEED FUNCTION
// ============================================================================

async function main() {
  console.log('=== Seeding Training Module Data ===\n');

  // Clean up existing data first
  await cleanupTrainingData();

  // Track counts for summary
  const counts = {
    trainings: { created: 0, existing: 0 },
    feedbackForms: { created: 0, existing: 0 },
    applications: { created: 0, existing: 0 },
    attendance: { created: 0, existing: 0 },
    lessonPlans: { created: 0, existing: 0 },
    feedbackResponses: { created: 0, existing: 0 },
    certificates: { created: 0, existing: 0 },
  };

  // Get seed owner
  const createdById = await getSeedOwnerId();
  if (!createdById) {
    console.log('ERROR: No active users found. Cannot seed training data.');
    return;
  }
  console.log(`Using owner ID: ${createdById}\n`);

  // Create feedback forms
  console.log('--- Creating Feedback Forms ---');
  const formIdMap = await ensureFeedbackForms(createdById);
  counts.feedbackForms.created = FEEDBACK_FORMS.length;
  console.log('');

  // Get eligible users
  const { fallbackUsers } = await getEligibleUsers();
  if (fallbackUsers.length === 0) {
    console.log('WARNING: No eligible users found for applications.');
  }
  console.log(`Found ${fallbackUsers.length} eligible users for applications.\n`);

  // Process each training
  console.log('--- Creating Trainings ---');
  for (let trainingIndex = 0; trainingIndex < TRAINING_SEED.length; trainingIndex++) {
    const seed = TRAINING_SEED[trainingIndex];
    console.log(`\nProcessing: ${seed.title} [${seed.category.toUpperCase()}]`);

    // Check for existing training
    const existingTraining = await prisma.training.findFirst({
      where: { title: seed.title },
      select: { id: true, targetBranches: { select: { id: true } } },
    });

    const targetBranches = await getTargetBranches(seed.targetBranchCodes);
    const feedbackFormId = getFeedbackFormForTraining(formIdMap, seed.title);

    let training;
    if (existingTraining) {
      // Update existing training
      const existingBranchIds = new Set(
        existingTraining.targetBranches.map((b) => b.id),
      );
      const missingBranches = targetBranches.filter(
        (b) => !existingBranchIds.has(b.id),
      );

      training = await prisma.training.update({
        where: { id: existingTraining.id },
        data: {
          isActive: true,
          isPublished: seed.category !== 'future',
          publishedAt: seed.category !== 'future' ? new Date() : null,
          feedbackFormId,
          targetBranches: missingBranches.length
            ? { connect: missingBranches }
            : undefined,
        },
        select: { id: true, title: true, startDate: true, endDate: true },
      });
      counts.trainings.existing++;
      console.log(`  Updated existing training`);
    } else {
      // Create new training
      training = await prisma.training.create({
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
          prerequisites: 'Basic teaching experience required',
          difficulty: seed.difficulty,
          learningOutcomes: seed.learningOutcomes,
          isActive: true,
          isPublished: seed.category !== 'future',
          publishedAt: seed.category !== 'future' ? new Date() : null,
          createdById,
          feedbackFormId,
          targetBranches: targetBranches.length
            ? { connect: targetBranches }
            : undefined,
        },
        select: { id: true, title: true, startDate: true, endDate: true },
      });
      counts.trainings.created++;
      console.log(`  Created new training`);
    }

    // Skip applications for future trainings
    if (seed.category === 'future') {
      console.log(`  Skipping applications (future training)`);
      continue;
    }

    // Create applications and related data for each user
    for (let userIndex = 0; userIndex < fallbackUsers.length; userIndex++) {
      const user = fallbackUsers[userIndex];
      const applicationStatus = getApplicationStatus(seed.category, userIndex);

      // Create or update application
      const existingApplication = await prisma.trainingApplication.findUnique({
        where: {
          userId_trainingId: { userId: user.id, trainingId: training.id },
        },
        select: { id: true, status: true },
      });

      if (!existingApplication) {
        await prisma.trainingApplication.create({
          data: {
            userId: user.id,
            trainingId: training.id,
            relevanceToTeaching:
              'This training directly aligns with my course outcomes and will enhance my teaching methodology.',
            expectedApplication:
              'I plan to implement the learnings in my lab sessions and update my lesson plans accordingly.',
            status: applicationStatus,
            appliedAt: new Date(seed.applicationDeadline.getTime() - 5 * 24 * 60 * 60 * 1000),
            reviewedAt:
              applicationStatus !== TrainingApplicationStatus.PENDING &&
              applicationStatus !== TrainingApplicationStatus.SUBMITTED
                ? new Date(seed.applicationDeadline.getTime() - 2 * 24 * 60 * 60 * 1000)
                : null,
            reviewedById:
              applicationStatus !== TrainingApplicationStatus.PENDING &&
              applicationStatus !== TrainingApplicationStatus.SUBMITTED
                ? createdById
                : null,
            reviewComments:
              applicationStatus === TrainingApplicationStatus.APPROVED
                ? 'Application approved. Welcome to the training program.'
                : applicationStatus === TrainingApplicationStatus.REJECTED
                  ? 'Unfortunately, capacity reached. Please apply for the next batch.'
                  : applicationStatus === TrainingApplicationStatus.WAITLISTED
                    ? 'Application withdrawn by applicant.'
                    : 'Application under review.',
          },
        });
        counts.applications.created++;
      } else {
        counts.applications.existing++;
      }

      // Only create attendance, lesson plans, feedback, and certificates for approved applications
      if (applicationStatus !== TrainingApplicationStatus.APPROVED) {
        continue;
      }

      // Create multi-day attendance for past and ongoing trainings
      if (seed.category === 'past' || seed.category === 'ongoing') {
        const startDate = new Date(seed.startDate);
        const endDate = new Date(seed.endDate);
        const daysDiff = Math.ceil(
          (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000),
        );
        const daysToMark =
          seed.category === 'past' ? daysDiff + 1 : Math.ceil((daysDiff + 1) / 2);

        for (let day = 0; day < daysToMark; day++) {
          const attendanceDate = new Date(startDate);
          attendanceDate.setDate(attendanceDate.getDate() + day);

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
                markedAt: new Date(
                  attendanceDate.getTime() + 10 * 60 * 60 * 1000,
                ),
                markedById: createdById,
                attendanceDate,
                ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
                userAgent: 'PlaceIntern/1.0 TrainingSeed',
                locationAddress: seed.city ?? 'Virtual',
              },
            });
            counts.attendance.created++;
          } else {
            counts.attendance.existing++;
          }
        }
      }

      // Create lesson plans for past trainings
      if (seed.category === 'past') {
        const existingLessonPlan = await prisma.lessonPlan.findUnique({
          where: {
            userId_trainingId: { userId: user.id, trainingId: training.id },
          },
          select: { id: true },
        });

        if (!existingLessonPlan) {
          const lessonPlanStatus = getLessonPlanStatus(userIndex);
          await prisma.lessonPlan.create({
            data: {
              userId: user.id,
              trainingId: training.id,
              title: `Implementation Plan: ${seed.title}`,
              courseOrSemester: `Semester ${(userIndex % 6) + 1}`,
              connectionToTraining:
                'This lesson plan integrates key learnings from the training into my regular teaching schedule.',
              learningObjectives: [
                'Apply training concepts to course delivery',
                'Enhance student engagement using new techniques',
                'Improve assessment alignment with outcomes',
                'Incorporate industry-relevant examples',
              ],
              newSkillsTechnologies:
                'Outcome mapping, rubric design, digital tools integration',
              deliveryMethods:
                'Interactive lectures, hands-on labs, peer discussions, case studies',
              handsOnActivities:
                'Design a comprehensive rubric for lab experiments and student projects',
              assessmentMethods:
                'Rubric-based evaluation, peer review, reflection journals, portfolio assessment',
              industryConnections:
                'Invite industry mentors for guest lectures and project reviews',
              resourceRequirements:
                'Projector, lab equipment, digital tools access, rubric templates',
              implementationTimeline: '4-6 weeks after training completion',
              expectedOutcomes:
                'Improved student engagement, better assessment quality, enhanced learning outcomes',
              status: lessonPlanStatus,
              submittedAt: new Date(seed.endDate.getTime() + 7 * 24 * 60 * 60 * 1000),
              dueDate: new Date(seed.endDate.getTime() + 21 * 24 * 60 * 60 * 1000),
              reviewedById:
                lessonPlanStatus !== LessonPlanStatus.SUBMITTED
                  ? createdById
                  : null,
              reviewedAt:
                lessonPlanStatus !== LessonPlanStatus.SUBMITTED
                  ? new Date(seed.endDate.getTime() + 14 * 24 * 60 * 60 * 1000)
                  : null,
              reviewComments:
                lessonPlanStatus === LessonPlanStatus.APPROVED
                  ? 'Excellent plan with clear alignment to training objectives. Approved.'
                  : lessonPlanStatus === LessonPlanStatus.REVISION_REQUIRED
                    ? 'Please add more specific timelines and measurable outcomes.'
                    : null,
            },
          });
          counts.lessonPlans.created++;
        } else {
          counts.lessonPlans.existing++;
        }

        // Create feedback responses for past trainings
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
          const formTitle =
            [...formIdMap.entries()].find(([_, id]) => id === feedbackFormId)?.[0] ||
            'Standard';
          await prisma.feedbackResponse.create({
            data: {
              userId: user.id,
              feedbackFormId,
              trainingId: training.id,
              responses: generateFeedbackResponse(formTitle),
              submittedAt: new Date(seed.endDate.getTime() + 2 * 24 * 60 * 60 * 1000),
            },
          });
          counts.feedbackResponses.created++;
        } else {
          counts.feedbackResponses.existing++;
        }

        // Create certificates for past trainings
        const existingCertificate = await prisma.trainingCertificate.findUnique({
          where: {
            userId_trainingId: { userId: user.id, trainingId: training.id },
          },
          select: { id: true },
        });

        if (!existingCertificate) {
          const certNumber = `TRN-${seed.startDate.getFullYear()}-${training.id.slice(0, 6).toUpperCase()}-${user.id.slice(0, 6).toUpperCase()}`;
          await prisma.trainingCertificate.create({
            data: {
              userId: user.id,
              trainingId: training.id,
              certificateNumber: certNumber,
              issuedAt: new Date(seed.endDate.getTime() + 10 * 24 * 60 * 60 * 1000),
              issuedById: createdById,
              certificateUrl: `https://storage.placeintern.com/certificates/${certNumber}.pdf`,
            },
          });
          counts.certificates.created++;
        } else {
          counts.certificates.existing++;
        }
      }
    }
  }

  // Print summary
  console.log('\n');
  console.log('='.repeat(60));
  console.log('SEED SUMMARY');
  console.log('='.repeat(60));
  console.log('');
  console.log(`Trainings:`);
  console.log(`  - Created: ${counts.trainings.created}`);
  console.log(`  - Already Existed: ${counts.trainings.existing}`);
  console.log(`  - Total: ${counts.trainings.created + counts.trainings.existing}`);
  console.log('');
  console.log(`Feedback Forms:`);
  console.log(`  - Total: ${FEEDBACK_FORMS.length}`);
  console.log('');
  console.log(`Applications:`);
  console.log(`  - Created: ${counts.applications.created}`);
  console.log(`  - Already Existed: ${counts.applications.existing}`);
  console.log(`  - Total: ${counts.applications.created + counts.applications.existing}`);
  console.log('');
  console.log(`Attendance Records:`);
  console.log(`  - Created: ${counts.attendance.created}`);
  console.log(`  - Already Existed: ${counts.attendance.existing}`);
  console.log(`  - Total: ${counts.attendance.created + counts.attendance.existing}`);
  console.log('');
  console.log(`Lesson Plans:`);
  console.log(`  - Created: ${counts.lessonPlans.created}`);
  console.log(`  - Already Existed: ${counts.lessonPlans.existing}`);
  console.log(`  - Total: ${counts.lessonPlans.created + counts.lessonPlans.existing}`);
  console.log('');
  console.log(`Feedback Responses:`);
  console.log(`  - Created: ${counts.feedbackResponses.created}`);
  console.log(`  - Already Existed: ${counts.feedbackResponses.existing}`);
  console.log(`  - Total: ${counts.feedbackResponses.created + counts.feedbackResponses.existing}`);
  console.log('');
  console.log(`Certificates:`);
  console.log(`  - Created: ${counts.certificates.created}`);
  console.log(`  - Already Existed: ${counts.certificates.existing}`);
  console.log(`  - Total: ${counts.certificates.created + counts.certificates.existing}`);
  console.log('');
  console.log('='.repeat(60));
  console.log('=== Training module seed completed successfully ===');
  console.log('='.repeat(60));
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
