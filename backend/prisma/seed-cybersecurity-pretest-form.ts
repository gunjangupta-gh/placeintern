import { PrismaClient, TestFormPurpose, Role } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

const FORM_TITLE = 'Pre-Test: Foundations of Cybersecurity - A Hands-on Approach for Secure Systems';

const FORM_DESCRIPTION =
  'C-DAC Cybersecurity Training (March 16 - March 20)\n\n' +
  'This pre-test is designed to assess your foundational knowledge of cybersecurity concepts before the training begins.\n\n' +
  '* All questions are required\n' +
  '* Attempt all questions\n' +
  '* Select the most appropriate answer for each question';

// Training to link: Cyber Security by C-DAC (March 16-20)
const TRAINING_ID = 'b568070e-f399-4ee7-82e4-e03e163cfdde';

const QUESTIONS = [
  {
    id: 'q1',
    type: 'multiChoice',
    question: 'What does the CIA triad stand for in cybersecurity?',
    required: true,
    options: {
      choices: [
        'Confidentiality, Integrity, and Availability',
        'Control, Internet, Access',
        'Confidentiality, Integrity, Availability',
        'Cyber, Information, Access',
      ],
    },
  },
  {
    id: 'q2',
    type: 'multiChoice',
    question: 'Which of the following is a type of malware?',
    required: true,
    options: {
      choices: ['Antivirus', 'Firewall', 'VPN', 'Ransomware'],
    },
  },
  {
    id: 'q3',
    type: 'multiChoice',
    question: 'Which protocol is used for secure communication on the web?',
    required: true,
    options: {
      choices: ['HTTP', 'FTP', 'HTTPS', 'SMTP'],
    },
  },
  {
    id: 'q4',
    type: 'multiChoice',
    question: 'Which command checks connectivity between two devices on a network?',
    required: true,
    options: {
      choices: ['ping', 'mkdir', 'ls', 'chmod'],
    },
  },
  {
    id: 'q5',
    type: 'multiChoice',
    question: 'What is the main function of a firewall?',
    required: true,
    options: {
      choices: [
        'Increase network speed',
        'Monitor and control incoming and outgoing network traffic',
        'Store user passwords',
        'Backup files',
      ],
    },
  },
  {
    id: 'q6',
    type: 'multiChoice',
    question: 'Which tool is commonly used for packet capture and analysis?',
    required: true,
    options: {
      choices: ['Nmap', 'Wireshark', 'Metasploit', 'John the Ripper'],
    },
  },
  {
    id: 'q7',
    type: 'multiChoice',
    question: 'In Linux, which command is used to change file permissions?',
    required: true,
    options: {
      choices: ['chown', 'chmod', 'passwd', 'sudo'],
    },
  },
  {
    id: 'q8',
    type: 'multiChoice',
    question: 'Which of the following is a social engineering attack?',
    required: true,
    options: {
      choices: ['SQL Injection', 'Phishing', 'Port Scanning', 'Brute Force'],
    },
  },
  {
    id: 'q9',
    type: 'multiChoice',
    question: 'What is the main purpose of encryption?',
    required: true,
    options: {
      choices: [
        'Compress data',
        'Protect data confidentiality',
        'Increase internet speed',
        'Improve network coverage',
      ],
    },
  },
  {
    id: 'q10',
    type: 'multiChoice',
    question: 'What is the primary use of Nmap?',
    required: true,
    options: {
      choices: ['Password cracking', 'Network scanning and discovery', 'File compression', 'Email encryption'],
    },
  },
  {
    id: 'q11',
    type: 'multiChoice',
    question: 'Which of the following attacks tries many password combinations to gain access?',
    required: true,
    options: {
      choices: ['Phishing attack', 'Brute force attack', 'Man-in-the-middle attack', 'DDoS attack'],
    },
  },
  {
    id: 'q12',
    type: 'multiChoice',
    question: 'What does VPN stand for?',
    required: true,
    options: {
      choices: [
        'Virtual Private Network',
        'Verified Public Network',
        'Virtual Protected Node',
        'Variable Private Network',
      ],
    },
  },
  {
    id: 'q13',
    type: 'multiChoice',
    question: 'Which type of malware locks files and demands payment to restore access?',
    required: true,
    options: {
      choices: ['Worm', 'Trojan', 'Ransomware', 'Spyware'],
    },
  },
  {
    id: 'q14',
    type: 'multiChoice',
    question: 'What is the purpose of antivirus software?',
    required: true,
    options: {
      choices: [
        'Increase internet speed',
        'Detect and remove malicious software',
        'Encrypt files',
        'Monitor CPU usage',
      ],
    },
  },
  {
    id: 'q15',
    type: 'multiChoice',
    question: 'What does a strong password usually include?',
    required: true,
    options: {
      choices: [
        'Only numbers',
        'Only letters',
        'Letters, numbers, and special characters',
        'Only lowercase letters',
      ],
    },
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
  console.log('=== Seeding Cybersecurity Pre-Test Form ===');

  const createdById = await getSeedOwnerId();
  if (!createdById) {
    throw new Error('No active user found to assign as createdById.');
  }

  // Check if training exists
  const training = await prisma.training.findUnique({
    where: { id: TRAINING_ID },
    select: { id: true, title: true, providedBy: true },
  });

  if (!training) {
    throw new Error(`Training with ID ${TRAINING_ID} not found.`);
  }

  console.log(`Found training: ${training.title} (${training.providedBy})`);

  // Check for existing form
  const existing = await prisma.preTestForm.findFirst({
    where: { title: FORM_TITLE },
    select: { id: true },
  });

  let formId: string;

  if (existing) {
    await prisma.preTestForm.update({
      where: { id: existing.id },
      data: {
        description: FORM_DESCRIPTION,
        purpose: TestFormPurpose.PRE_TEST,
        questions: QUESTIONS,
        isActive: true,
        isPublished: true,
      },
    });

    formId = existing.id;
    console.log(`Updated existing form: ${FORM_TITLE}`);
  } else {
    const newForm = await prisma.preTestForm.create({
      data: {
        title: FORM_TITLE,
        description: FORM_DESCRIPTION,
        purpose: TestFormPurpose.PRE_TEST,
        questions: QUESTIONS,
        isActive: true,
        isPublished: true,
        createdById,
      },
    });

    formId = newForm.id;
    console.log(`Created new form: ${FORM_TITLE}`);
  }

  // Link the form to the training
  await prisma.training.update({
    where: { id: TRAINING_ID },
    data: {
      preTestFormId: formId,
    },
  });

  console.log(`Linked pre-test form to training: ${training.title}`);
  console.log(`Total questions: ${QUESTIONS.length}`);
  console.log('=== Cybersecurity Pre-Test Form seed completed ===');
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
