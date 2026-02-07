import { PrismaClient, SupportCategory, Role } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create Prisma client with pg adapter
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

// Helper function to determine targetRoles based on FAQ title and category
export function determineTargetRoles(title: string, category: SupportCategory): string[] {
  const lowerTitle = title.toLowerCase();

  // STUDENT-specific FAQs - things only students need to know
  if (
    lowerTitle.includes('how do i apply') ||
    lowerTitle.includes('internship application') ||
    lowerTitle.includes('submit monthly report') ||
    lowerTitle.includes('monthly reports due') ||
    lowerTitle.includes('how many monthly reports') ||
    lowerTitle.includes('upload weekly report') ||
    lowerTitle.includes('submit grievance') ||
    lowerTitle.includes('report an issue with my internship') ||
    lowerTitle.includes('track my application') ||
    lowerTitle.includes('application history') ||
    lowerTitle.includes('acceptance letter') ||
    lowerTitle.includes('offer letter') ||
    lowerTitle.includes('joining report') ||
    lowerTitle.includes('student submit') ||
    lowerTitle.includes('my application') ||
    lowerTitle.includes('as a student') ||
    lowerTitle.includes('submit my internship') ||
    lowerTitle.includes('my internship details') ||
    lowerTitle.includes('my internship progress') ||
    lowerTitle.includes('track my internship') ||
    lowerTitle.includes('multiple active internships') ||
    lowerTitle.includes('edit my internship') ||
    lowerTitle.includes('what documents do i need') ||
    lowerTitle.includes('who is my faculty mentor') ||
    lowerTitle.includes('my faculty mentor') ||
    lowerTitle.includes('when my internship ends') ||
    lowerTitle.includes('miss a monthly report') ||
    lowerTitle.includes('(students)') ||
    (lowerTitle.includes('student') && lowerTitle.includes('profile'))
  ) {
    return ['STUDENT'];
  }

  // PRINCIPAL-specific FAQs - institutional management
  if (
    lowerTitle.includes('assign mentor') ||
    lowerTitle.includes('assign students to faculty') ||
    lowerTitle.includes('reassign a student') ||
    lowerTitle.includes('mentor assignment') ||
    lowerTitle.includes('bulk upload') ||
    lowerTitle.includes('add staff') ||
    lowerTitle.includes('add new staff') ||
    lowerTitle.includes('staff list') ||
    lowerTitle.includes('register student') ||
    lowerTitle.includes('student registration') ||
    lowerTitle.includes('student management') ||
    lowerTitle.includes('analytics dashboard') ||
    lowerTitle.includes('institutional performance') ||
    lowerTitle.includes('institution analytics') ||
    lowerTitle.includes('principal dashboard') ||
    lowerTitle.includes('manage students') ||
    lowerTitle.includes('as a principal') ||
    lowerTitle.includes('as principal') ||
    lowerTitle.includes('institution-level') ||
    lowerTitle.includes('create faculty') ||
    lowerTitle.includes('edit faculty') ||
    lowerTitle.includes('reset a faculty') ||
    lowerTitle.includes('view all students in my institution') ||
    lowerTitle.includes('send credentials to newly') ||
    lowerTitle.includes('key metrics should i monitor') ||
    lowerTitle.includes('track individual student progress') ||
    lowerTitle.includes('monitor faculty performance') ||
    lowerTitle.includes('grievances will i see as principal') ||
    lowerTitle.includes('access student grievances') ||
    lowerTitle.includes('grievance resolution') ||
    lowerTitle.includes('manage user roles') ||
    lowerTitle.includes('roles can i create') ||
    lowerTitle.includes('additional permissions') ||
    lowerTitle.includes('how many students should i assign') ||
    lowerTitle.includes('principal account')
  ) {
    return ['PRINCIPAL'];
  }

  // FACULTY/TEACHER-specific FAQs - student supervision
  if (
    lowerTitle.includes('visit log') ||
    lowerTitle.includes('log a visit') ||
    lowerTitle.includes('log visit') ||
    lowerTitle.includes('assigned students') ||
    lowerTitle.includes('view my assigned') ||
    lowerTitle.includes('students assigned to me') ||
    lowerTitle.includes('faculty supervisor') ||
    lowerTitle.includes('mentor view') ||
    lowerTitle.includes('supervise student') ||
    lowerTitle.includes('faculty report') ||
    lowerTitle.includes('as a faculty') ||
    lowerTitle.includes('as faculty') ||
    lowerTitle.includes('as a mentor') ||
    lowerTitle.includes('my role as faculty') ||
    lowerTitle.includes('responsibilities as faculty') ||
    lowerTitle.includes('how often must i visit') ||
    lowerTitle.includes('types of visits') ||
    lowerTitle.includes('include in visit') ||
    lowerTitle.includes('edit a visit log') ||
    lowerTitle.includes('grievances might i receive') ||
    lowerTitle.includes('respond to grievances') ||
    lowerTitle.includes('handle student grievances') ||
    lowerTitle.includes('monitor student document') ||
    lowerTitle.includes('student hasn\'t submitted') ||
    lowerTitle.includes('verify submitted documents') ||
    lowerTitle.includes('faculty register new students') ||
    lowerTitle.includes('send login credentials to students') ||
    lowerTitle.includes('how many students will i supervise') ||
    lowerTitle.includes('(faculty)')
  ) {
    return ['TEACHER', 'FACULTY_SUPERVISOR'];
  }

  // INDUSTRY-specific FAQs - company/posting management
  if (
    lowerTitle.includes('post internship') ||
    lowerTitle.includes('create posting') ||
    lowerTitle.includes('manage applications') ||
    lowerTitle.includes('company profile') ||
    lowerTitle.includes('industry partner') ||
    lowerTitle.includes('industry supervisor') ||
    lowerTitle.includes('intern applications') ||
    lowerTitle.includes('review application') ||
    lowerTitle.includes('as an industry') ||
    lowerTitle.includes('as a company')
  ) {
    return ['INDUSTRY', 'INDUSTRY_SUPERVISOR'];
  }

  // STATE_DIRECTORATE-specific FAQs - state-level administration
  if (
    lowerTitle.includes('state directorate') ||
    lowerTitle.includes('all institutions') ||
    lowerTitle.includes('report builder') ||
    lowerTitle.includes('audit log') ||
    lowerTitle.includes('support dashboard') ||
    lowerTitle.includes('manage institutions') ||
    lowerTitle.includes('add institution') ||
    lowerTitle.includes('reset credentials') ||
    lowerTitle.includes('statewide') ||
    lowerTitle.includes('cross-institution') ||
    lowerTitle.includes('manage faq')
  ) {
    return ['STATE_DIRECTORATE'];
  }

  // SYSTEM_ADMIN-specific FAQs
  if (
    lowerTitle.includes('system admin') ||
    lowerTitle.includes('technical query') ||
    lowerTitle.includes('system setting') ||
    lowerTitle.includes('server') ||
    lowerTitle.includes('database maintenance')
  ) {
    return ['SYSTEM_ADMIN'];
  }

  // General FAQs visible to ALL roles - login, password, browser, general info
  // These return empty array (visible to everyone)
  return [];
}

// Comprehensive FAQ Data - ALL from FAQS.md + Additional System-Specific FAQs
export const faqData = [
  // ==========================================
  // GENERAL QUESTIONS (6 FAQs)
  // ==========================================
  {
    title: 'What is PlaceIntern?',
    content: `PlaceIntern is an Internship Management Portal designed to streamline the entire internship lifecycle for students, faculty supervisors, and institutional administrators. It facilitates:

• **Internship Submission:** Students can submit and track their internship applications
• **Progress Tracking:** Real-time monitoring of internship milestones
• **Mentor Coordination:** Faculty-student assignment and visit management
• **Grievance Management:** Structured complaint handling and resolution
• **Analytics & Reporting:** Comprehensive institutional performance metrics

The system supports multiple user roles including Students, Faculty/Teachers, Principals, Industry Partners, and State Directorate administrators.`,
    summary: 'Overview of the PlaceIntern internship management system',
    category: 'GENERAL_INQUIRIES' as SupportCategory,
    tags: ['overview', 'about', 'introduction', 'placeintern', 'system'],
  },
  {
    title: 'How do I access the portal?',
    content: `To access PlaceIntern:

1. **Open your browser** - Use Chrome, Firefox, Edge, or Safari (latest version)
2. **Navigate to the portal** - Go to https://placeintern.com/login
3. **Enter credentials:**
   • **Username:** Your Registration Number (for students) or assigned username
   • **Password:** Password provided by your administrator
4. **Click Login** - You'll be redirected to your role-specific dashboard

**Note:** Ensure you're using a stable internet connection. If you face issues, try clearing your browser cache or using incognito mode.`,
    summary: 'Instructions for accessing the PlaceIntern portal',
    category: 'ACCOUNT_PROFILE' as SupportCategory,
    tags: ['login', 'access', 'portal', 'url', 'credentials'],
  },
  {
    title: 'What should I do if I forget my password?',
    content: `If you forget your password, contact your immediate supervisor for a password reset:

**Contact Chain:**
• **Students:** Contact your assigned Faculty Mentor
• **Faculty/Teachers:** Contact your Principal
• **Principals:** Contact State Directorate support at dtepunjab.internship@gmail.com

**What to provide when requesting a reset:**
• Your full name
• Registration Number or Username
• Registered email address
• Role in the system

Your supervisor can reset your password through the system's user management module. You'll receive new credentials via email.`,
    summary: 'Password recovery process for different user roles',
    category: 'ACCOUNT_PROFILE' as SupportCategory,
    tags: ['password', 'forgot', 'reset', 'recovery', 'credentials'],
  },
  {
    title: 'Do I need to change my password after first login?',
    content: `**Yes, mandatory password change is required on first login.**

**Password Requirements:**
• Minimum 6 characters long
• Should contain a mix of letters and numbers
• Avoid using easily guessable passwords (e.g., "123456", "password")
• Don't reuse passwords from other accounts

**Why is this required?**
• Ensures account security
• Prevents unauthorized access
• Creates a password only you know
• Complies with data protection policies

**Tip:** Choose a strong, memorable password and store it securely. Do not share your password with anyone.`,
    summary: 'First login password change requirement',
    category: 'ACCOUNT_PROFILE' as SupportCategory,
    tags: ['password', 'first-login', 'security', 'change-password', 'mandatory'],
  },
  {
    title: 'What browsers are supported?',
    content: `PlaceIntern works best on modern, updated browsers:

**Fully Supported Browsers:**
• **Google Chrome** (v90+) - Recommended
• **Mozilla Firefox** (v88+)
• **Microsoft Edge** (v90+)
• **Apple Safari** (v14+)

**Browser Tips:**
• Always use the latest browser version
• Enable JavaScript and cookies
• Disable aggressive ad blockers that may interfere
• Allow pop-ups from placeintern.com for file downloads

**Not Recommended:**
• Internet Explorer (discontinued)
• Outdated browser versions
• Mini/Lite browser variants`,
    summary: 'Browser compatibility information',
    category: 'TECHNICAL_ISSUES' as SupportCategory,
    tags: ['browser', 'chrome', 'firefox', 'edge', 'safari', 'compatibility'],
  },
  {
    title: 'What is the support email?',
    content: `**Primary Support Contact:**
**Email:** dtepunjab.internship@gmail.com

**When contacting support, include:**
• Your full name and role
• Registration Number (if applicable)
• Institution name
• Detailed description of your issue
• Screenshots (if relevant)
• Steps to reproduce the problem

**Response Time:**
• Regular queries: 24-48 business hours
• Urgent issues: Same day (mark subject as "URGENT")

**Alternative Support:**
• Submit a support ticket through Help & Support > Submit Ticket
• Contact your immediate supervisor for role-specific issues`,
    summary: 'Official support contact information',
    category: 'GENERAL_INQUIRIES' as SupportCategory,
    tags: ['support', 'email', 'contact', 'help', 'dtepunjab'],
  },

  // ==========================================
  // STUDENT FAQs - Login & Access (3 FAQs)
  // ==========================================
  {
    title: 'How do I get my login credentials? (Students)',
    content: `**Your Faculty Mentor provides your login credentials.**

**Credential Details:**
• **Username:** Your Registration Number (e.g., 2021-CS-001)
• **Password:** Temporary password set by your mentor

**Steps to get credentials:**
1. Ensure your Faculty Mentor has registered you in the system
2. Check your registered email for credential notification
3. If not received, contact your Faculty Mentor directly

**Common Issues:**
• **No email received:** Check spam/junk folder
• **Invalid credentials:** Verify spelling and case sensitivity
• **Account not found:** Confirm registration with your mentor`,
    summary: 'How students can obtain their login credentials',
    category: 'ACCOUNT_PROFILE' as SupportCategory,
    tags: ['student', 'login', 'credentials', 'registration-number', 'faculty-mentor'],
  },
  {
    title: 'Can I update my profile information?',
    content: `**Yes, students can update their profile information.**

**To update your profile:**
1. Log in to your account
2. Navigate to **Student Profile > Profile** from the sidebar
3. Click **Edit Profile** button
4. Update the following fields:
   • Personal information (name, contact)
   • Email address (important for notifications)
   • Profile photo (recommended)
   • Contact number
5. Click **Save Changes**

**Note:** Some fields like Registration Number and Institution cannot be changed. Contact your Principal for corrections to locked fields.`,
    summary: 'Profile update instructions for students',
    category: 'ACCOUNT_PROFILE' as SupportCategory,
    tags: ['profile', 'update', 'student', 'personal-information', 'edit'],
  },
  {
    title: 'What should I do after my first login?',
    content: `**Complete these steps immediately after your first login:**

**Step 1: Change Password**
• You'll be prompted automatically
• Create a strong, unique password
• Remember this password securely

**Step 2: Complete Your Profile**
• Navigate to Student Profile > Profile
• Add/verify your email address
• Upload a professional profile photo
• Confirm contact information

**Step 3: Review Your Dashboard**
• Understand your internship status
• Check assigned Faculty Mentor details
• Review pending tasks and milestones

**Step 4: Explore the System**
• Familiarize yourself with menu options
• Locate Internship Portal section
• Find Help & Support resources

**Why this matters:** A complete profile ensures you receive important notifications and your supervisors can contact you when needed.`,
    summary: 'First-time login checklist for students',
    category: 'ACCOUNT_PROFILE' as SupportCategory,
    tags: ['first-login', 'student', 'setup', 'profile', 'password', 'checklist'],
  },

  // ==========================================
  // STUDENT FAQs - Internship Submission (5 FAQs)
  // ==========================================
  {
    title: 'How do I submit my internship details?',
    content: `**To submit your internship details:**

**Navigation:** Internship Portal > Submit Internship Details

**Required Information:**
1. **Company Details:**
   • Company name and full address
   • Industry sector/domain
   • Company website (if available)

2. **HR/Supervisor Contact:**
   • Name of HR or Industry Supervisor
   • Email address and phone number

3. **Internship Information:**
   • Start date and end date
   • Duration (minimum 16 weeks)
   • Role/Position title
   • Department/Team

4. **Internship Type:**
   • Self-Identified (you found it yourself)
   • College-Arranged (through placement cell)

5. **Additional Details:**
   • Stipend information (if applicable)
   • Work mode (On-site/Remote/Hybrid)

**After Submission:** Your application will be reviewed by your Faculty Mentor for approval.`,
    summary: 'Steps to submit internship details',
    category: 'INTERNSHIP_QUERIES' as SupportCategory,
    tags: ['internship', 'submit', 'application', 'student', 'company'],
  },
  {
    title: 'Can I have multiple active internships?',
    content: `**No, you can only have ONE active internship at a time.**

**Why this policy exists:**
• Ensures focused learning experience
• Allows proper mentor supervision
• Maintains accurate progress tracking
• Prevents scheduling conflicts

**If you need to change internships:**
1. Contact your Faculty Mentor
2. Request withdrawal from current internship
3. Provide valid reason for change
4. Once previous internship is closed, you can submit a new one

**Exceptions:** Special cases may be considered by the Principal. Contact your Faculty Mentor to discuss.`,
    summary: 'Policy on multiple internships',
    category: 'INTERNSHIP_QUERIES' as SupportCategory,
    tags: ['internship', 'multiple', 'active', 'policy', 'one'],
  },
  {
    title: 'What is the minimum internship duration?',
    content: `**Minimum Required Duration: 16 Weeks (approximately 4 months)**

**Why 16 weeks?**
• Provides adequate practical exposure
• Allows completion of meaningful projects
• Ensures sufficient time for monthly reports
• Enables proper mentor visit schedule

**Duration Calculation:**
• Calculated from Start Date to End Date
• Public holidays don't affect duration
• Leave days may extend the end date

**Monthly Requirements During Internship:**
• 1 monthly report per month
• At least 1 faculty visit per month
• Regular progress updates

**Note:** Some programs may require longer durations. Check with your institution for specific requirements.`,
    summary: 'Minimum internship duration requirement',
    category: 'INTERNSHIP_QUERIES' as SupportCategory,
    tags: ['internship', 'duration', 'minimum', 'weeks', '16-weeks'],
  },
  {
    title: 'What types of internships can I submit?',
    content: `**Two types of internships are supported:**

**1. Self-Identified Internship**
• Internships you found on your own
• Through job portals (LinkedIn, Naukri, Indeed, etc.)
• Through personal referrals or networking
• Direct company applications
• Campus recruitment events

**2. College-Arranged Internship**
• Arranged by your institution's placement cell
• Through industry partnerships
• Campus placement drives
• MoU-based company tie-ups
• Government internship programs

**Both types require:**
• Faculty Mentor approval
• Valid company documentation
• Minimum 16-week duration
• Regular progress monitoring

**Choose the appropriate type** when submitting to ensure proper tracking and reporting.`,
    summary: 'Types of internships that can be submitted',
    category: 'INTERNSHIP_QUERIES' as SupportCategory,
    tags: ['internship', 'types', 'self-identified', 'college-arranged', 'placement'],
  },
  {
    title: 'Can I edit my internship details after submission?',
    content: `**Editing capabilities depend on the approval status:**

**Before Approval:**
• Most fields can be edited
• Navigate to your application and click Edit
• Make necessary changes and resubmit

**After Approval:**
• Certain critical fields are locked:
  - Company name
  - Start/End dates
  - Internship type
• Minor corrections may be possible through your Faculty Mentor

**To Request Changes (After Approval):**
1. Contact your Faculty Mentor
2. Explain the required changes
3. Provide supporting documentation
4. Mentor can request modification or new submission

**Significant Changes** (company change, dates change) may require:
• Withdrawal of current application
• Fresh submission with new details
• Re-approval process`,
    summary: 'Editing internship details after submission',
    category: 'INTERNSHIP_QUERIES' as SupportCategory,
    tags: ['internship', 'edit', 'modify', 'after-submission', 'changes'],
  },

  // ==========================================
  // STUDENT FAQs - Documentation (4 FAQs)
  // ==========================================
  {
    title: 'What documents do I need to upload?',
    content: `**Required Documents Throughout Your Internship:**

**1. Joining Letter / Offer Letter (Required)**
• Upload within first week of joining
• Must show company letterhead
• Should include your name, role, and duration
• Signed by HR or authorized personnel

**2. Monthly Reports (Required)**
• One report per month of internship
• Submit by 5th of following month
• Should cover work done, learnings, challenges
• Follow the provided template format

**3. Completion Certificate (Recommended)**
• Upload at end of internship
• Official company letterhead
• Confirms successful completion
• May include performance remarks

**Document Guidelines:**
• Format: PDF preferred (DOC/DOCX accepted)
• Size: Maximum 5-10 MB per file
• Quality: Clear, readable scans/documents
• Naming: Use descriptive filenames`,
    summary: 'Required documents for internship',
    category: 'DATA_REPORTS' as SupportCategory,
    tags: ['documents', 'upload', 'joining-letter', 'monthly-report', 'certificate'],
  },
  {
    title: 'When are monthly reports due?',
    content: `**Monthly reports are due by the 5th of each month** for the previous month's work.

**Example Timeline:**
• December work → Submit by January 5th
• January work → Submit by February 5th
• February work → Submit by March 5th

**Report Content Should Include:**
• Summary of tasks completed
• Skills learned and applied
• Challenges faced and solutions
• Key achievements and milestones
• Plans for next month

**Late Submission:**
• Reports submitted after deadline are marked as "Late"
• Affects your overall progress metrics
• May require explanation to Faculty Mentor
• Repeated late submissions may have consequences

**Tip:** Set a reminder for the 1st of each month to start preparing your report.`,
    summary: 'Monthly report submission deadline',
    category: 'DATA_REPORTS' as SupportCategory,
    tags: ['monthly-report', 'due-date', 'deadline', 'submission', '5th'],
  },
  {
    title: 'How many monthly reports do I need to submit?',
    content: `**Number of reports = Number of months in your internship**

**Examples:**
• 4-month internship (16 weeks) = 4 monthly reports
• 5-month internship (20 weeks) = 5 monthly reports
• 6-month internship (24 weeks) = 6 monthly reports

**Report Schedule:**
| Month | Due Date |
|-------|----------|
| Month 1 | 5th of Month 2 |
| Month 2 | 5th of Month 3 |
| Month 3 | 5th of Month 4 |
| ... | ... |

**Each Report Should Cover:**
• Work performed during that specific month
• New skills acquired
• Project progress updates
• Industry supervisor feedback
• Self-assessment of learning

**Dashboard Tracking:**
Your dashboard shows progress like "2/6 Reports Submitted" to help you track pending submissions.`,
    summary: 'Number of required monthly reports',
    category: 'DATA_REPORTS' as SupportCategory,
    tags: ['monthly-report', 'count', 'number', 'requirement', 'duration'],
  },
  {
    title: 'What format should my documents be in?',
    content: `**Accepted Document Formats:**

**For All Documents:**
• **PDF** (.pdf) - Highly Recommended
• **Microsoft Word** (.doc, .docx)
• **Rich Text Format** (.rtf)

**For Profile Photos:**
• **JPEG** (.jpg, .jpeg)
• **PNG** (.png)

**File Size Limits:**
• Documents: 5-10 MB maximum
• Images: 2-5 MB maximum

**Document Preparation Tips:**
1. **PDF Conversion:** Use "Save as PDF" or online converters
2. **Compression:** Compress large files before upload
3. **Scanned Documents:** Use at least 200 DPI for clarity
4. **File Naming:** Use clear names (e.g., "JohnDoe_MonthlyReport_Jan2025.pdf")

**Avoid:**
• Password-protected files
• Corrupted or unreadable files
• Files with special characters in names
• Executable files (.exe, .bat, etc.)`,
    summary: 'Acceptable document formats and sizes',
    category: 'DATA_REPORTS' as SupportCategory,
    tags: ['document', 'format', 'pdf', 'size', 'upload', 'file-type'],
  },

  // ==========================================
  // STUDENT FAQs - Tracking & Monitoring (3 FAQs)
  // ==========================================
  {
    title: 'How do I track my internship progress?',
    content: `**Your Student Dashboard displays 4 key progress milestones:**

**1. Internship Data Status**
• ✅ Complete - All details submitted and approved
• ⏳ Incomplete - Missing required information

**2. Joining Letter Status**
• ✅ Submitted - Document uploaded and verified
• ⏳ Pending - Awaiting upload

**3. Grievances**
• Shows count of open grievances (if any)
• Click to view details and status

**4. Monthly Reports**
• Progress indicator: "4/6 Reports Submitted"
• Shows pending vs. completed reports

**Additional Tracking:**
• **My Applications:** View all submitted internships
• **Timeline:** See important dates and deadlines
• **Mentor Info:** Contact details for your Faculty Mentor

**Tip:** Check your dashboard weekly to stay on track with all requirements.`,
    summary: 'Tracking internship progress through dashboard',
    category: 'INTERNSHIP_QUERIES' as SupportCategory,
    tags: ['progress', 'tracking', 'dashboard', 'milestones', 'status'],
  },
  {
    title: 'Who is my Faculty Mentor?',
    content: `**Your Faculty Mentor is the faculty member assigned to supervise your internship.**

**Finding Mentor Information:**
• Displayed prominently on your Student Dashboard
• Shows: Name, Designation, Email, Phone

**Faculty Mentor Responsibilities:**
• Approving your internship application
• Conducting monthly visits (physical/virtual/telephonic)
• Reviewing your document submissions
• Handling your grievances
• Providing academic guidance

**When to Contact Your Mentor:**
• Questions about internship requirements
• Issues at the workplace
• Document submission clarifications
• Progress concerns
• Any emergencies

**Note:** Mentors are assigned by the Principal. If you need a mentor change, submit a formal request through your Principal.`,
    summary: 'Finding faculty mentor information',
    category: 'INTERNSHIP_QUERIES' as SupportCategory,
    tags: ['faculty', 'mentor', 'supervisor', 'contact', 'assigned'],
  },
  {
    title: 'How often will my Faculty Mentor visit?',
    content: `**Minimum: 1 visit per month throughout your internship**

**Visit Types:**
1. **Physical Visit**
   • Faculty visits your internship location
   • Meets with industry supervisor
   • Observes your work environment

2. **Virtual Visit**
   • Video call via Google Meet, Zoom, etc.
   • Screens your work progress
   • Discusses challenges and learnings

3. **Telephonic Visit**
   • Phone call with you
   • May include industry supervisor
   • Quick progress check-in

**What to Expect During Visits:**
• Discussion of your work and learnings
• Review of recent challenges
• Feedback from industry supervisor
• Goal setting for coming weeks
• Document verification

**Your Responsibilities:**
• Be available at scheduled times
• Prepare a brief update on your work
• Have any documents ready for review
• Inform your industry supervisor about visits`,
    summary: 'Faculty mentor visit frequency',
    category: 'INTERNSHIP_QUERIES' as SupportCategory,
    tags: ['mentor', 'visit', 'frequency', 'monthly', 'physical', 'virtual'],
  },

  // ==========================================
  // STUDENT FAQs - Grievances & Support (4 FAQs)
  // ==========================================
  {
    title: 'How do I report an issue with my internship?',
    content: `**To report internship-related issues, submit a grievance:**

**Navigation:** Internship Portal > Submit Grievance

**Grievance Categories:**
• **Workplace Environment** - Unsafe conditions, harassment
• **Task Assignment** - Unrelated work, excessive workload
• **Supervision Issues** - Lack of guidance, unavailable supervisor
• **Stipend/Compensation** - Non-payment, incorrect amount
• **Safety Concerns** - Physical or mental safety issues
• **Other** - Any other internship-related concerns

**Information to Include:**
• Clear, factual description of the issue
• Dates and times of incidents
• People involved (if applicable)
• Any evidence or documentation
• Desired resolution

**Process:**
1. Submit grievance
2. Faculty Mentor reviews and responds
3. Resolution or escalation to Principal
4. You can track status and add comments

**Note:** For serious safety concerns, contact your Faculty Mentor directly in addition to filing a grievance.`,
    summary: 'Reporting internship issues through grievance system',
    category: 'GENERAL_INQUIRIES' as SupportCategory,
    tags: ['grievance', 'report', 'issue', 'internship-problem', 'complaint'],
  },
  {
    title: 'What should I do if I have a technical issue with the portal?',
    content: `**For system/portal technical issues, submit a support ticket:**

**Navigation:** Help & Support > Submit Ticket

**Common Technical Issues:**
• Login problems
• Page not loading
• Upload failures
• Display errors
• Missing data
• Slow performance

**Information to Include:**
1. **Issue Description** - What's happening?
2. **Expected Behavior** - What should happen?
3. **Steps to Reproduce** - How to recreate the issue?
4. **Screenshots** - Visual evidence helps a lot
5. **Browser/Device Info** - Chrome/Windows/Mobile etc.
6. **Error Messages** - Exact text of any errors

**Priority Levels:**
• **Low** - Minor inconvenience
• **Medium** - Affects productivity
• **High** - Cannot complete important tasks
• **Urgent** - Critical deadline impacted

**Alternative:** For urgent issues, also email dtepunjab.internship@gmail.com with "URGENT" in subject line.`,
    summary: 'Reporting technical issues with the portal',
    category: 'TECHNICAL_ISSUES' as SupportCategory,
    tags: ['technical', 'issue', 'portal', 'bug', 'error', 'support-ticket'],
  },
  {
    title: 'How can I track my submitted queries?',
    content: `**Track all your support tickets in one place:**

**Navigation:** Help & Support > My Queries

**Information Displayed:**
• Ticket Number (e.g., SUP-20251223-0001)
• Subject/Title
• Category
• Priority Level
• Current Status
• Last Updated Date
• Response Count

**Ticket Statuses:**
• **Open** - Submitted, awaiting review
• **Assigned** - Assigned to support staff
• **In Progress** - Being worked on
• **Pending User** - Waiting for your response
• **Resolved** - Issue fixed
• **Closed** - Ticket completed

**Actions You Can Take:**
• View ticket details and full conversation
• Add replies with additional information
• View resolution when provided
• Rate support received (if enabled)

**Tip:** Check "Pending User" tickets - they may need your response to proceed.`,
    summary: 'Tracking support query status',
    category: 'GENERAL_INQUIRIES' as SupportCategory,
    tags: ['queries', 'track', 'status', 'support', 'tickets', 'my-queries'],
  },
  {
    title: 'Can I view my application history?',
    content: `**Yes, you can view all your internship applications:**

**Navigation:** Internship Portal > My Applications

**Information Displayed:**
• All submitted internship applications
• Application status (Pending/Approved/Rejected)
• Company details
• Duration and dates
• Submission timestamp

**Application Statuses:**
• **Pending** - Awaiting Faculty Mentor review
• **Approved** - Accepted, internship active
• **Rejected** - Not approved (reason provided)
• **Withdrawn** - You withdrew the application
• **Completed** - Internship finished successfully

**Actions Available:**
• View full application details
• Track approval progress
• See rejection reasons (if applicable)
• Access related documents

**Note:** You can only have one active (approved) internship. Previous applications remain in history for your reference.`,
    summary: 'Viewing internship application history',
    category: 'INTERNSHIP_QUERIES' as SupportCategory,
    tags: ['application', 'history', 'view', 'status', 'my-applications'],
  },

  // ==========================================
  // FACULTY/TEACHER FAQs - Access & Setup (3 FAQs)
  // ==========================================
  {
    title: 'How do I receive my login credentials? (Faculty)',
    content: `**Faculty login credentials are provided by your Principal.**

**Credential Distribution:**
• Sent to your official institutional email address
• Contains username and temporary password
• Includes portal URL and basic instructions

**If You Haven't Received Credentials:**
1. Check your spam/junk email folder
2. Verify your email is correctly registered with admin
3. Contact your Principal or administration office
4. Request credential resend

**First Login Steps:**
1. Access the portal at https://placeintern.com/login
2. Enter provided username and password
3. Change password when prompted (mandatory)
4. Complete your profile information

**Security Note:** Never share your credentials. Each faculty member should have their own unique account.`,
    summary: 'Faculty credential distribution',
    category: 'ACCOUNT_PROFILE' as SupportCategory,
    tags: ['faculty', 'credentials', 'login', 'email', 'principal'],
  },
  {
    title: 'What is my role as Faculty in the system?',
    content: `**As a Faculty Supervisor (Teacher), you are the primary academic mentor for assigned students.**

**Your Key Responsibilities:**

**1. Student Supervision**
• Monitor assigned students' internship progress
• Review and approve internship applications
• Track milestone completion

**2. Visit Management**
• Conduct monthly visits (physical/virtual/telephonic)
• Log visit details and observations
• Assess student performance and work environment

**3. Document Verification**
• Review joining letters and monthly reports
• Verify document authenticity
• Provide feedback on submissions

**4. Grievance Handling**
• Receive and respond to student grievances
• Escalate serious issues to Principal
• Ensure timely resolution

**5. Communication**
• Maintain regular contact with students
• Coordinate with industry supervisors
• Report to Principal on progress

**Dashboard:** Your Faculty Dashboard shows assigned students, pending visits, and action items.`,
    summary: 'Faculty supervisor role and responsibilities',
    category: 'FEATURE_GUIDANCE' as SupportCategory,
    tags: ['faculty', 'role', 'responsibilities', 'supervisor', 'teacher'],
  },
  {
    title: 'How are students assigned to me?',
    content: `**Students are assigned by the Principal through the Mentor Assignment module.**

**Assignment Process:**
1. Principal accesses Mentor Assignment
2. Selects students (individual or bulk)
3. Chooses Faculty Mentor from dropdown
4. Confirms assignment

**You Cannot:**
• Self-assign students
• Remove student assignments
• Transfer students to other faculty

**After Assignment:**
• Students appear on your dashboard
• You can view their complete profiles
• You're responsible for their supervision

**Assignment Considerations:**
• Based on department/branch alignment
• Considers faculty workload
• May group students by company location
• Takes expertise areas into account

**For Reassignment Requests:** Contact your Principal with valid reasons for student reassignment.`,
    summary: 'Student assignment process for faculty',
    category: 'FEATURE_GUIDANCE' as SupportCategory,
    tags: ['student', 'assignment', 'mentor', 'principal', 'allocation'],
  },

  // ==========================================
  // FACULTY FAQs - Student Supervision (3 FAQs)
  // ==========================================
  {
    title: 'How many students will I supervise?',
    content: `**The number of students varies based on institutional decisions.**

**Typical Ratios:**
• Small institutions: 5-10 students per faculty
• Medium institutions: 10-20 students per faculty
• Large institutions: 15-25 students per faculty

**Factors Affecting Assignment:**
• Total students in internship program
• Number of available faculty supervisors
• Faculty teaching workload
• Geographic distribution of internships
• Specialization alignment

**Managing Large Numbers:**
• Prioritize students with urgent issues
• Schedule visits efficiently by location
• Use group communications when possible
• Leverage virtual visits for distant locations

**Workload Concerns:** If you feel overwhelmed, discuss workload balancing with your Principal.`,
    summary: 'Student supervision load',
    category: 'FEATURE_GUIDANCE' as SupportCategory,
    tags: ['students', 'supervise', 'count', 'ratio', 'workload'],
  },
  {
    title: 'How do I view my assigned students?',
    content: `**Multiple ways to view your assigned students:**

**1. Dashboard View**
• Shows Assigned Students table on your main dashboard
• Quick overview of all students
• Color-coded status indicators

**2. Detailed View**
**Navigation:** Faculty Supervision > Assigned Students

**Information Available:**
• Student name and registration number
• Contact details (email, phone)
• Company name and location
• Internship start/end dates
• Current status (Active/Completed)
• Documents submitted
• Visit history
• Pending actions

**Filtering Options:**
• By status (Active, Pending, Completed)
• By company
• By document status
• By visit status

**Actions from Student View:**
• Log a visit
• View submitted documents
• Send communications
• Access grievances`,
    summary: 'Viewing assigned students',
    category: 'FEATURE_GUIDANCE' as SupportCategory,
    tags: ['assigned', 'students', 'view', 'list', 'dashboard'],
  },
  {
    title: 'What are my key responsibilities as Faculty Mentor?',
    content: `**Your Key Responsibilities:**

**1. Monthly Visits (Mandatory)**
• Conduct at least 1 visit per month per student
• Physical, virtual, or telephonic
• Log all visits with observations

**2. Internship Monitoring**
• Review internship applications
• Track student progress
• Ensure milestone completion
• Monitor document submissions

**3. Document Verification**
• Review joining letters
• Verify monthly reports
• Check completion certificates
• Provide feedback

**4. Grievance Resolution**
• Respond to student grievances promptly
• Investigate issues fairly
• Escalate serious matters to Principal
• Document resolutions

**5. Student Guidance**
• Provide academic and professional advice
• Address concerns and challenges
• Facilitate communication with industry
• Support career development

**6. Reporting**
• Maintain accurate records
• Report issues to Principal
• Contribute to institutional analytics`,
    summary: 'Key responsibilities of faculty mentors',
    category: 'FEATURE_GUIDANCE' as SupportCategory,
    tags: ['responsibilities', 'faculty', 'mentor', 'duties', 'key'],
  },

  // ==========================================
  // FACULTY FAQs - Visits & Documentation (5 FAQs)
  // ==========================================
  {
    title: 'How often must I visit students?',
    content: `**Minimum: 1 visit per month for each assigned student**

**Total Required Visits:**
• For 4-month internship: 4 visits minimum
• For 6-month internship: 6 visits minimum
• Visits should be distributed throughout duration

**Visit Scheduling Tips:**
• Plan visits at the start of each month
• Coordinate with students' availability
• Group nearby students for efficiency
• Mix visit types based on circumstances

**What Counts as a Visit:**
• Physical visit to internship site
• Video conference (Google Meet, Zoom)
• Telephonic discussion (documented)

**All visits must be:**
• Logged in the system
• Include observations and feedback
• Dated and categorized by type

**Tip:** Don't cluster all visits at month-end. Spread them for better monitoring.`,
    summary: 'Monthly visit requirement',
    category: 'INTERNSHIP_QUERIES' as SupportCategory,
    tags: ['visit', 'monthly', 'requirement', 'faculty', 'frequency'],
  },
  {
    title: 'What types of visits are allowed?',
    content: `**Three types of visits are equally valid:**

**1. Physical Visit**
• In-person visit to internship location
• Direct observation of work environment
• Face-to-face interaction with student and supervisor
• **Best for:** First visit, issue investigation, final review

**2. Virtual Visit**
• Video call using Google Meet, Zoom, Teams, etc.
• Screen sharing to see student's work
• Can include industry supervisor
• **Best for:** Remote locations, regular check-ins

**3. Telephonic Visit**
• Voice call with student
• Can include three-way call with supervisor
• Documented conversation
• **Best for:** Quick check-ins, follow-ups, urgent matters

**Recommendations:**
• At least 1-2 physical visits during internship
• Mix visit types for comprehensive coverage
• Use virtual visits for distant locations
• Document all visits regardless of type

**All types are equally valid** for meeting your visit requirements.`,
    summary: 'Allowed visit types',
    category: 'INTERNSHIP_QUERIES' as SupportCategory,
    tags: ['visit', 'types', 'physical', 'virtual', 'telephonic', 'allowed'],
  },
  {
    title: 'How do I log a visit?',
    content: `**To log a visit after conducting it:**

**Navigation:** Faculty Supervision > Visit Logs > Log New Visit

**Required Information:**

**1. Basic Details**
• Select student from dropdown
• Visit date (when it occurred)
• Visit type (Physical/Virtual/Telephonic)

**2. Observations**
• Student performance assessment
• Work quality observations
• Attitude and professionalism
• Skills being developed

**3. Work Environment**
• Industry support provided
• Resources available
• Safety conditions
• Team dynamics

**4. Feedback & Follow-up**
• Issues identified
• Recommendations given
• Follow-up actions required
• Notes for next visit

**After Logging:**
• Visit appears in your visit history
• Counts toward monthly requirement
• Student can view (non-confidential parts)
• Contributes to analytics

**Tip:** Log visits within 24-48 hours while details are fresh.`,
    summary: 'Logging faculty visits',
    category: 'DATA_REPORTS' as SupportCategory,
    tags: ['visit', 'log', 'record', 'faculty', 'how-to'],
  },
  {
    title: 'What should I include in visit logs?',
    content: `**Comprehensive visit logs should include:**

**1. Visit Information**
• Exact date and time
• Visit type (Physical/Virtual/Telephonic)
• Duration of visit
• Location (if physical)

**2. Student Performance**
• Quality of work produced
• Technical skills demonstrated
• Soft skills observed
• Initiative and enthusiasm level

**3. Work Environment Assessment**
• Workspace adequacy
• Tools and resources provided
• Industry supervisor involvement
• Learning opportunities available

**4. Industry Supervisor Feedback**
• Their assessment of student
• Areas of strength
• Areas for improvement
• Overall satisfaction

**5. Issues & Concerns**
• Any problems identified
• Student's challenges
• Safety or ethical concerns
• Resource gaps

**6. Action Items**
• Recommendations given to student
• Follow-up tasks
• Escalation requirements
• Goals for next period

**Note:** Be factual and objective. These logs contribute to official records.`,
    summary: 'Visit log content requirements',
    category: 'DATA_REPORTS' as SupportCategory,
    tags: ['visit', 'log', 'content', 'include', 'details'],
  },
  {
    title: 'Can I edit a visit log after submission?',
    content: `**Visit log editing has restrictions:**

**Editable Period:**
• Within 24-48 hours of submission (varies by institution)
• Only for minor corrections

**Typically Editable:**
• Typos and grammatical errors
• Additional observations remembered
• Clarifying existing comments

**Not Editable:**
• Visit date
• Visit type
• Student selection
• Core assessment ratings

**If Major Corrections Needed:**
1. Contact your Principal
2. Explain the error
3. Provide correct information
4. Admin may make corrections or add addendum

**Best Practices:**
• Review before submitting
• Take notes during visits
• Log promptly while fresh
• Double-check student selection

**Why Restrictions Exist:** Visit logs are official records used for audits and analytics. Data integrity must be maintained.`,
    summary: 'Editing visit logs after submission',
    category: 'DATA_REPORTS' as SupportCategory,
    tags: ['visit', 'log', 'edit', 'modify', 'after-submission'],
  },

  // ==========================================
  // FACULTY FAQs - Grievance Management (3 FAQs)
  // ==========================================
  {
    title: 'What types of grievances might I receive?',
    content: `**Common Grievance Categories:**

**1. Workplace Environment**
• Hostile or unfriendly atmosphere
• Harassment or discrimination
• Inadequate facilities
• Unsafe working conditions

**2. Task Assignment Issues**
• Work unrelated to internship objectives
• Excessive or unreasonable workload
• No meaningful work assigned
• Tasks beyond skill level

**3. Supervision Problems**
• Industry supervisor unavailable
• Lack of guidance and mentoring
• Poor communication
• Unfair treatment

**4. Compensation Issues**
• Stipend not paid
• Incorrect payment amount
• Delayed payments
• Unauthorized deductions

**5. Safety Concerns**
• Physical safety risks
• Mental health impacts
• Harassment incidents
• Unethical requests

**6. Logistical Issues**
• Transportation problems
• Accommodation issues
• Timing/schedule conflicts
• Documentation problems

**Your Response:** Assess severity, investigate fairly, and resolve or escalate appropriately.`,
    summary: 'Types of student grievances faculty may receive',
    category: 'GENERAL_INQUIRIES' as SupportCategory,
    tags: ['grievance', 'types', 'categories', 'issues', 'complaints'],
  },
  {
    title: 'How quickly should I respond to grievances?',
    content: `**Response Time Guidelines:**

**Urgent/Safety Issues: IMMEDIATELY (Same Day)**
• Physical safety threats
• Harassment incidents
• Mental health emergencies
• Serious ethical violations
**Action:** Contact student immediately, escalate to Principal if needed

**High Priority: Within 24 Hours**
• Workplace conflicts
• Supervisor issues
• Payment problems
**Action:** Acknowledge receipt, begin investigation

**Medium Priority: Within 48 Hours**
• Task assignment concerns
• Minor workplace issues
• Documentation problems
**Action:** Review and respond with action plan

**Low Priority: Within 72 Hours**
• General inquiries
• Suggestions
• Minor inconveniences
**Action:** Address at earliest convenience

**Response Should Include:**
• Acknowledgment of the issue
• Investigation steps being taken
• Expected resolution timeline
• Any immediate actions student should take

**Note:** Even if you can't resolve immediately, acknowledge receipt promptly.`,
    summary: 'Grievance response time guidelines',
    category: 'GENERAL_INQUIRIES' as SupportCategory,
    tags: ['grievance', 'response', 'time', 'quickly', 'urgent'],
  },
  {
    title: 'How do I handle student grievances?',
    content: `**Step-by-step grievance handling:**

**Step 1: Review the Grievance**
• Read full details carefully
• Understand the issue and context
• Note severity and urgency

**Step 2: Acknowledge Receipt**
• Respond to student promptly
• Confirm you're looking into it
• Provide expected timeline

**Step 3: Investigate**
• Gather all relevant facts
• Contact industry supervisor if needed
• Review related documents/visit logs
• Hear all sides objectively

**Step 4: Determine Resolution**
• Identify appropriate action
• Consider student's wellbeing
• Ensure fair outcome
• Document your reasoning

**Step 5: Respond with Resolution**
• Explain findings
• State the resolution
• Outline any follow-up actions
• Offer further support if needed

**Step 6: Follow Up**
• Check if resolution is effective
• Ensure no retaliation
• Document closure

**When to Escalate to Principal:**
• Safety concerns
• Legal implications
• Cannot reach resolution
• Pattern of issues
• Complaints about yourself`,
    summary: 'Handling student grievances step-by-step',
    category: 'GENERAL_INQUIRIES' as SupportCategory,
    tags: ['grievance', 'handle', 'resolve', 'faculty', 'process'],
  },

  // ==========================================
  // FACULTY FAQs - Progress Tracking (3 FAQs)
  // ==========================================
  {
    title: 'How do I monitor student document submissions?',
    content: `**Your dashboard provides comprehensive document tracking:**

**Dashboard Metrics:**
• **Joining Letters:** X Submitted / Y Total
• **Monthly Reports:** X Submitted / Y Expected
• **Pending Reports:** Count requiring follow-up

**Detailed View:**
**Navigation:** Faculty Supervision > Assigned Students > Select Student

**For Each Student, You Can See:**
• Joining letter status (Submitted/Pending/Verified)
• Each monthly report status
• Submission dates
• Your verification status

**Document Statuses:**
• **Pending** - Not yet submitted
• **Submitted** - Uploaded, awaiting review
• **Verified** - You've approved it
• **Rejected** - Needs resubmission

**Alerts:**
• Dashboard highlights overdue documents
• Color-coded indicators (Red = urgent)
• Notification when documents are submitted

**Action:** Review and verify submitted documents regularly. Follow up on missing submissions.`,
    summary: 'Monitoring student document submissions',
    category: 'DATA_REPORTS' as SupportCategory,
    tags: ['documents', 'monitor', 'submissions', 'tracking', 'status'],
  },
  {
    title: "What do I do if a student hasn't submitted required documents?",
    content: `**Follow-up Process for Missing Documents:**

**Step 1: Identify Missing Documents**
• Check student's submission status
• Note which documents are overdue
• Check how long overdue

**Step 2: First Reminder (After Due Date)**
• Contact student via system message
• Specify which documents are pending
• Set new deadline (3-5 days)

**Step 3: Second Reminder (If Still Missing)**
• Call or email student directly
• Understand the reason for delay
• Offer assistance if there are issues

**Step 4: Document Follow-ups**
• Log your contact attempts
• Note student's responses
• Record any issues mentioned

**Step 5: Escalation (If Needed)**
• If no response after multiple attempts
• Report to Principal
• May affect student's internship status

**Common Reasons for Delays:**
• Technical upload issues
• Awaiting company documents
• Personal circumstances
• Forgot/unaware of deadline

**Tip:** Prevent delays by reminding students before deadlines during visits.`,
    summary: 'Following up on missing document submissions',
    category: 'DATA_REPORTS' as SupportCategory,
    tags: ['documents', 'missing', 'follow-up', 'reminder', 'overdue'],
  },
  {
    title: 'How do I verify submitted documents?',
    content: `**Document Verification Process:**

**Navigation:** Faculty Supervision > Assigned Students > [Student] > Documents

**Verification Steps:**

**1. Open Document**
• Click on the submitted document
• Download and review content
• Check document quality

**2. Verify Authenticity**
• Company letterhead present
• Proper signatures
• Correct student name
• Valid dates
• Professional formatting

**3. Verify Content**
• **Joining Letter:** Role, duration, company details match
• **Monthly Report:** Covers relevant period, sufficient detail
• **Completion Certificate:** Confirms successful completion

**4. Take Action**
• **Verify:** Mark as verified if everything is correct
• **Reject:** Request resubmission with specific feedback
• **Query:** Ask student for clarification

**Red Flags:**
• Mismatched details
• Missing signatures
• Generic templates
• Inconsistent dates
• Poor quality scans

**After Verification:**
• Status updates to "Verified"
• Contributes to progress metrics
• Student is notified`,
    summary: 'How to verify student-submitted documents',
    category: 'DATA_REPORTS' as SupportCategory,
    tags: ['documents', 'verify', 'review', 'check', 'authenticity'],
  },

  // ==========================================
  // FACULTY FAQs - Student Registration (2 FAQs)
  // ==========================================
  {
    title: 'Can Faculty register new students?',
    content: `**Yes, Faculty members can register students in most configurations.**

**Individual Registration:**
**Navigation:** Students > Register Student

**Required Fields:**
• Registration Number (unique)
• Full Name
• Email Address
• Contact Number
• Program/Course
• Batch/Year
• Branch/Department

**Bulk Registration:**
**Navigation:** Students > Bulk Register Student
• Download Excel template
• Fill in student details
• Upload completed file
• System processes all records

**After Registration:**
• Student accounts are created
• Credentials need to be sent separately
• Students appear in institution directory
• Ready for mentor assignment

**Note:** Registration capabilities may vary by institution. Check with your Principal if you don't see these options.`,
    summary: 'Faculty ability to register students',
    category: 'ACCOUNT_PROFILE' as SupportCategory,
    tags: ['faculty', 'register', 'students', 'new', 'create'],
  },
  {
    title: 'How do I send login credentials to students?',
    content: `**After registering students, send them their credentials:**

**Navigation:** Students > Send Credentials

**Single Student:**
1. Search for the student
2. Select the student record
3. Click "Send Credentials"
4. Credentials are emailed to registered email

**Multiple Students (Bulk):**
1. Use filters to select students
2. Check multiple students
3. Click "Send Credentials to Selected"
4. All selected students receive emails

**What Students Receive:**
• Username (Registration Number)
• Temporary password
• Portal URL
• Basic login instructions

**Important Notes:**
• Verify email addresses are correct before sending
• Students must change password on first login
• Credentials can be resent if needed
• Check with students if they don't receive

**Troubleshooting:**
• Ask students to check spam folder
• Verify email address in system
• Resend if necessary
• Contact admin for persistent issues`,
    summary: 'Sending login credentials to students',
    category: 'ACCOUNT_PROFILE' as SupportCategory,
    tags: ['credentials', 'send', 'login', 'email', 'students'],
  },

  // ==========================================
  // PRINCIPAL FAQs - Administrative (3 FAQs)
  // ==========================================
  {
    title: 'How is my Principal account created?',
    content: `**Principal accounts are created by the State Directorate.**

**Account Creation Process:**
1. State Directorate receives institution registration
2. Principal account is created in the system
3. Credentials are sent to your official email

**Information Required:**
• Full name
• Official email address
• Institution name and code
• Contact number
• Designation

**If You Haven't Received Credentials:**
1. Check spam/junk email folder
2. Contact State Directorate support
3. Email: dtepunjab.internship@gmail.com
4. Provide: Name, Institution, Email

**First Login:**
• Access portal at https://placeintern.com/login
• Enter provided credentials
• Change password (mandatory)
• Complete institutional profile

**Note:** Only State Directorate can create Principal accounts. Faculty and students cannot have Principal access.`,
    summary: 'Principal account creation process',
    category: 'ACCOUNT_PROFILE' as SupportCategory,
    tags: ['principal', 'account', 'creation', 'state-directorate', 'credentials'],
  },
  {
    title: 'What is my role as Principal in the system?',
    content: `**As Principal, you are the institutional leader for the internship program.**

**Your Key Functions:**

**1. Institutional Oversight**
• Monitor overall institutional performance
• Track KPIs and metrics
• Ensure compliance with requirements
• Report to State Directorate

**2. User Management**
• Create and manage faculty accounts
• Register students (or delegate)
• Reset passwords when needed
• Manage user access

**3. Mentor Assignment**
• Assign students to faculty mentors
• Balance workloads
• Reassign when necessary
• Monitor mentor performance

**4. Grievance Management**
• Handle escalated grievances
• Review faculty decisions
• Ensure fair resolution
• Escalate to State Directorate if needed

**5. Analytics & Reporting**
• Access institutional dashboards
• Generate reports
• Identify areas for improvement
• Track completion rates

**Your Dashboard:** Shows comprehensive institutional metrics, pending actions, and alerts requiring attention.`,
    summary: 'Principal role and responsibilities',
    category: 'FEATURE_GUIDANCE' as SupportCategory,
    tags: ['principal', 'role', 'responsibilities', 'administration', 'oversight'],
  },
  {
    title: 'What are my key responsibilities as Principal?',
    content: `**Principal Key Responsibilities:**

**1. Staff Management**
• Create faculty/staff accounts
• Assign appropriate roles
• Monitor faculty performance
• Handle staff-related issues
• Reset credentials when needed

**2. Student Oversight**
• Ensure all students are registered
• Monitor registration completeness
• Track overall student progress
• Address student welfare concerns

**3. Mentor Assignment**
• Assign all students to faculty mentors
• Balance mentor workloads
• Handle reassignment requests
• Ensure coverage for all students

**4. Quality Assurance**
• Review institutional metrics
• Ensure visit requirements are met
• Monitor document submissions
• Track grievance resolution rates

**5. Escalation Handling**
• Receive escalated grievances
• Make final institutional decisions
• Escalate to State Directorate when needed
• Ensure fair and timely resolution

**6. Compliance & Reporting**
• Meet State Directorate requirements
• Submit required reports
• Maintain accurate records
• Respond to audits

**Dashboard:** Your Principal Dashboard shows all these areas in one place.`,
    summary: 'Principal key responsibilities overview',
    category: 'FEATURE_GUIDANCE' as SupportCategory,
    tags: ['principal', 'responsibilities', 'key', 'duties', 'management'],
  },

  // ==========================================
  // PRINCIPAL FAQs - Faculty Management (6 FAQs)
  // ==========================================
  {
    title: 'How do I create faculty accounts?',
    content: `**To create new faculty/staff accounts:**

**Navigation:** Administration > Add Staff (or Create Staff)

**Required Information:**
• Full Name
• Email Address (official)
• Contact Number
• Department/Branch
• Designation
• Initial Password (or auto-generate)

**Steps:**
1. Navigate to Add Staff
2. Fill in required fields
3. Set initial password
4. Select role (Faculty/Teacher)
5. Click Create Account

**After Creation:**
• Account is immediately active
• Credentials sent to email
• Faculty can log in and change password
• Ready for student assignment

**Bulk Creation:**
**Navigation:** Administration > Bulk Upload Staff
• Download template
• Fill in all faculty details
• Upload and process

**Note:** Verify email addresses before creating accounts to ensure credential delivery.`,
    summary: 'Creating faculty accounts',
    category: 'ACCOUNT_PROFILE' as SupportCategory,
    tags: ['faculty', 'account', 'create', 'staff', 'new'],
  },
  {
    title: 'Can I edit faculty information?',
    content: `**Yes, you can edit faculty information as Principal.**

**Navigation:** Administration > Staff List > Select Faculty > Edit

**Editable Fields:**
• Name (for corrections)
• Email address
• Contact number
• Department
• Designation
• Active status

**Non-Editable Fields:**
• User ID (system-generated)
• Role type
• Creation date
• Account history

**To Edit:**
1. Go to Staff List
2. Search for the faculty member
3. Click on their profile
4. Click Edit button
5. Make necessary changes
6. Save changes

**When to Edit:**
• Correcting name spelling
• Updating contact info
• Changing department assignment
• Updating designation

**Note:** Major changes may require notifying the faculty member.`,
    summary: 'Editing faculty information',
    category: 'ACCOUNT_PROFILE' as SupportCategory,
    tags: ['faculty', 'edit', 'information', 'modify', 'update'],
  },
  {
    title: 'How do I assign students to faculty mentors?',
    content: `**To assign students to faculty mentors:**

**Navigation:** Students > Mentor Assignment

**Individual Assignment:**
1. Select a student from the list
2. Click "Assign Mentor"
3. Choose faculty from dropdown
4. Confirm assignment

**Bulk Assignment:**
1. Use filters to select students (by batch, branch, etc.)
2. Select multiple students
3. Choose faculty mentor
4. Click "Assign Selected"

**Assignment Considerations:**
• Balance workload across faculty
• Consider geographic proximity
• Align specialization when possible
• Check faculty availability

**After Assignment:**
• Student appears on faculty's dashboard
• Faculty can begin supervision
• Student sees mentor details
• Notifications sent to both

**Viewing Assignments:**
• Mentor Assignment page shows all assignments
• Filter by faculty to see their students
• Filter by unassigned to find pending assignments`,
    summary: 'Assigning students to mentors',
    category: 'FEATURE_GUIDANCE' as SupportCategory,
    tags: ['assign', 'mentor', 'students', 'faculty', 'allocation'],
  },
  {
    title: 'How many students should I assign to each faculty member?',
    content: `**Recommended ratios depend on your institutional context:**

**General Guidelines:**
• **Minimum:** 5 students per faculty
• **Optimal:** 10-15 students per faculty
• **Maximum:** 20-25 students per faculty

**Factors to Consider:**

**1. Faculty Workload**
• Teaching responsibilities
• Research commitments
• Administrative duties
• Travel feasibility

**2. Student Distribution**
• Geographic spread of internships
• Complexity of industries
• Student support needs
• First-time vs. repeat interns

**3. Institutional Resources**
• Total students in program
• Available faculty count
• Budget for visits
• Time constraints

**Balancing Tips:**
• Distribute evenly first
• Adjust for special cases
• Consider experience levels
• Review and rebalance periodically

**Monitor:** Use analytics to track if faculty are managing their load effectively.`,
    summary: 'Guidelines for student-to-faculty ratios',
    category: 'FEATURE_GUIDANCE' as SupportCategory,
    tags: ['students', 'faculty', 'ratio', 'assign', 'workload'],
  },
  {
    title: 'Can I reassign a student to a different mentor?',
    content: `**Yes, students can be reassigned to different faculty mentors.**

**Navigation:** Students > Mentor Assignment

**To Reassign:**
1. Find the student
2. Click "Change Mentor" or "Reassign"
3. Select new faculty mentor
4. Provide reason (optional but recommended)
5. Confirm reassignment

**Valid Reasons for Reassignment:**
• Faculty member on leave
• Workload balancing
• Geographic convenience
• Specialization alignment
• Conflict resolution
• Student/faculty request

**After Reassignment:**
• Student moves to new faculty's dashboard
• Previous mentor loses access
• New mentor receives notification
• Student is notified of change

**Important Considerations:**
• Inform both faculty members
• Brief new mentor on student status
• Ensure continuity of supervision
• Transfer any pending actions

**Note:** Try to minimize reassignments for stability, but don't hesitate when necessary.`,
    summary: 'Reassigning students to different mentors',
    category: 'FEATURE_GUIDANCE' as SupportCategory,
    tags: ['reassign', 'mentor', 'change', 'student', 'transfer'],
  },
  {
    title: "How do I reset a faculty member's password?",
    content: `**To reset a faculty member's password:**

**Navigation:** Administration > Staff List > Select Faculty

**Steps:**
1. Go to Staff List
2. Search for the faculty member
3. Click on their profile
4. Click "Reset Password" button
5. Confirm the action

**What Happens:**
• New temporary password is generated
• Sent to faculty's registered email
• Faculty must change password on next login
• Old password stops working immediately

**Alternative Method:**
• Use "Send Credentials" feature
• Re-sends login details to email

**When to Reset:**
• Faculty forgot password
• Security concern
• Account locked due to failed attempts
• Suspected unauthorized access

**Security Note:**
• Only reset when faculty requests it
• Verify identity before resetting
• Advise faculty to change password immediately
• Never share passwords via unsecure channels

**Tip:** Encourage faculty to use strong, memorable passwords.`,
    summary: 'Resetting faculty passwords',
    category: 'ACCOUNT_PROFILE' as SupportCategory,
    tags: ['reset', 'password', 'faculty', 'credentials', 'staff'],
  },

  // ==========================================
  // PRINCIPAL FAQs - Student Management (4 FAQs)
  // ==========================================
  {
    title: 'How do I register students?',
    content: `**Two methods for student registration:**

**Method 1: Individual Registration**
**Navigation:** Students > Register Student

**Steps:**
1. Click "Register Student"
2. Enter all required details
3. Review information
4. Click "Submit"

**Required Fields:**
• Registration Number
• Full Name
• Email Address
• Contact Number
• Program/Course
• Batch/Year
• Branch/Department

**Method 2: Bulk Registration**
**Navigation:** Students > Bulk Register Student

**Steps:**
1. Download Excel template
2. Fill in student details (one row per student)
3. Ensure all required fields are complete
4. Upload the file
5. Review any errors
6. Confirm upload

**After Registration:**
• Student accounts are created
• Must send credentials separately
• Students can then log in
• Ready for mentor assignment

**Tip:** Verify data accuracy before bulk upload to avoid errors.`,
    summary: 'Student registration options',
    category: 'ACCOUNT_PROFILE' as SupportCategory,
    tags: ['student', 'register', 'individual', 'bulk', 'create'],
  },
  {
    title: 'What information is required for student registration?',
    content: `**Required Fields for Student Registration:**

**Mandatory Fields:**
• **Registration Number** - Unique identifier (e.g., 2021-CS-001)
• **Full Name** - As per official records
• **Email Address** - For credentials and notifications
• **Contact Number** - For emergency contact
• **Program/Course** - B.Tech, BCA, Diploma, etc.
• **Batch/Year** - Admission year or batch name
• **Branch/Department** - CSE, ECE, Mechanical, etc.

**Optional Fields:**
• Father's/Guardian's Name
• Date of Birth
• Gender
• Address
• Emergency Contact
• Photo

**Data Format Requirements:**
• Email: Valid format (student@example.com)
• Phone: 10 digits (no country code)
• Registration Number: Follow institution format
• Names: Use proper capitalization

**Bulk Upload:**
• Use exact column names from template
• Don't change column order
• Leave optional fields blank if unknown
• Check for duplicate registration numbers`,
    summary: 'Required information for student registration',
    category: 'ACCOUNT_PROFILE' as SupportCategory,
    tags: ['student', 'registration', 'required', 'fields', 'information'],
  },
  {
    title: 'Can I view all students in my institution?',
    content: `**Yes, you have access to complete student directory.**

**Navigation:** Students > All Students

**View Options:**
• **List View** - Tabular format with sorting
• **Grid View** - Card-based layout
• **Export** - Download as Excel/CSV

**Information Available:**
• Registration Number
• Full Name
• Contact Details
• Program/Branch
• Batch/Year
• Internship Status
• Assigned Mentor
• Document Status

**Filters Available:**
• By Batch/Year
• By Branch/Department
• By Internship Status
• By Mentor Assignment
• By Document Status
• Search by Name/Reg. No.

**Actions from Student View:**
• View detailed profile
• Assign/Change mentor
• View internship details
• Access documents
• Send credentials

**Tip:** Use filters to find specific groups of students quickly.`,
    summary: 'Viewing all students in institution',
    category: 'FEATURE_GUIDANCE' as SupportCategory,
    tags: ['students', 'view', 'all', 'institution', 'directory'],
  },
  {
    title: 'How do I send credentials to newly registered students?',
    content: `**After registration, send login credentials:**

**Navigation:** Students > Send Credentials

**Single Student:**
1. Search for the student
2. Click "Send Credentials"
3. Confirm action
4. Email sent to registered address

**Multiple Students (Bulk):**
1. Go to Send Credentials
2. Filter by batch/branch/status
3. Select students who need credentials
4. Click "Send to Selected"
5. Confirm bulk send

**What Students Receive:**
• Welcome email with:
  - Username (Registration Number)
  - Temporary Password
  - Portal URL
  - Login instructions
  - Support contact

**Tracking:**
• View credential send status
• See who hasn't received
• Resend if needed

**Best Practices:**
• Verify email addresses first
• Send in batches if large numbers
• Follow up with students
• Check spam folder issues

**Note:** Students must change password on first login.`,
    summary: 'Sending credentials to registered students',
    category: 'ACCOUNT_PROFILE' as SupportCategory,
    tags: ['credentials', 'send', 'students', 'login', 'email'],
  },

  // ==========================================
  // PRINCIPAL FAQs - Analytics (4 FAQs)
  // ==========================================
  {
    title: 'Where can I view institutional performance metrics?',
    content: `**Access comprehensive analytics from your Principal Dashboard.**

**Primary Dashboard:**
**Navigation:** Internship Management > Analytics & Reports

**Available Metrics:**

**1. Overview Statistics**
• Total students enrolled
• Active internships
• Completed internships
• Pending registrations

**2. Document Compliance**
• Joining letter submission rate
• Monthly report completion rate
• Documents pending verification

**3. Faculty Performance**
• Visit completion rates
• Average visits per faculty
• Pending visit requirements

**4. Grievance Metrics**
• Open grievances
• Resolution rate
• Average resolution time
• Escalated cases

**5. Trend Analysis**
• Monthly progress charts
• Comparative batch analysis
• Year-over-year trends

**Export Options:**
• Download reports as PDF/Excel
• Schedule automated reports
• Share with stakeholders`,
    summary: 'Viewing institutional analytics',
    category: 'DATA_REPORTS' as SupportCategory,
    tags: ['analytics', 'metrics', 'performance', 'dashboard', 'reports'],
  },
  {
    title: 'What key metrics should I monitor?',
    content: `**Critical Metrics for Principal Monitoring:**

**1. Internship Coverage**
• % of students with active internships
• Target: 100% of eligible students
• Action: Follow up on students without internships

**2. Joining Letter Rate**
• % of students with submitted joining letters
• Target: 100% within first 2 weeks
• Action: Remind faculty to follow up

**3. Monthly Report Submission**
• % of reports submitted on time
• Target: >90% on-time submission
• Action: Identify chronic late submitters

**4. Faculty Visit Completion**
• % of required visits completed
• Target: 100% compliance
• Action: Address faculty falling behind

**5. Grievance Resolution**
• % resolved within SLA
• Target: >95% resolved in time
• Action: Investigate delays

**6. Overall Completion Rate**
• % of internships successfully completed
• Target: >95%
• Action: Support at-risk students

**Dashboard Updates:** Check these metrics weekly for early intervention.`,
    summary: 'Key metrics principals should monitor',
    category: 'DATA_REPORTS' as SupportCategory,
    tags: ['metrics', 'monitor', 'key', 'performance', 'kpi'],
  },
  {
    title: 'How do I track individual student progress?',
    content: `**Multiple ways to track student progress:**

**Navigation:** Internship Management > Student Progress

**For Any Student:**
1. Search by name or registration number
2. View comprehensive progress dashboard

**Progress Indicators:**
• **Internship Status:** Applied/Approved/Active/Completed
• **Documents:** Joining letter, monthly reports, certificates
• **Visits:** Faculty visits completed/pending
• **Grievances:** Open/Resolved count
• **Timeline:** Key dates and milestones

**Progress Percentage:**
• Overall completion percentage
• Breakdown by category
• Visual progress bar

**Detailed Views:**
• Document history with dates
• Visit log summaries
• Grievance history
• Communication records

**Actions Available:**
• Contact student
• View assigned mentor
• Access documents
• Review visit logs

**Tip:** Use student progress view before parent meetings or reviews.`,
    summary: 'Tracking individual student progress',
    category: 'DATA_REPORTS' as SupportCategory,
    tags: ['student', 'progress', 'track', 'individual', 'monitoring'],
  },
  {
    title: 'How do I monitor faculty performance?',
    content: `**Track faculty performance through dedicated analytics:**

**Navigation:** Internship Management > Faculty Progress

**Faculty Performance Metrics:**

**1. Student Load**
• Number of assigned students
• Active vs. completed supervisions
• Comparison with average

**2. Visit Compliance**
• Required visits vs. completed
• % compliance rate
• Overdue visits count

**3. Visit Quality**
• Types of visits (physical/virtual/telephonic)
• Average visit duration
• Observation completeness

**4. Document Review**
• Documents awaiting verification
• Average verification time
• Pending actions

**5. Grievance Handling**
• Assigned grievances
• Resolution rate
• Average resolution time
• Escalations

**Performance View Per Faculty:**
• Individual faculty dashboard
• Detailed statistics
• Trend over time
• Comparison with peers

**Actions:**
• Identify underperforming areas
• Recognize top performers
• Provide targeted support
• Adjust workloads if needed`,
    summary: 'Monitoring faculty performance',
    category: 'DATA_REPORTS' as SupportCategory,
    tags: ['faculty', 'performance', 'monitor', 'tracking', 'visits'],
  },

  // ==========================================
  // PRINCIPAL FAQs - Grievance Management (3 FAQs)
  // ==========================================
  {
    title: 'What types of grievances will I see as Principal?',
    content: `**As Principal, you handle escalated and institutional-level grievances:**

**1. Escalated from Faculty**
• Issues faculty couldn't resolve
• Complex multi-party disputes
• Safety concerns
• Policy interpretation questions

**2. Complaints About Faculty**
• Student complaints against mentors
• Faculty misconduct allegations
• Supervision quality issues
• Communication failures

**3. Institutional Issues**
• Systemic problems
• Resource constraints
• Policy violations
• Cross-department conflicts

**4. Serious Matters**
• Harassment complaints
• Safety violations
• Legal concerns
• Ethical breaches

**5. Appeal Cases**
• Students appealing faculty decisions
• Requests for policy exceptions
• Reassessment requests

**Your Role:**
• Final institutional authority
• Ensure fair investigation
• Make binding decisions
• Escalate to State Directorate if needed

**Priority:** Address safety concerns immediately.`,
    summary: 'Types of grievances principals handle',
    category: 'GENERAL_INQUIRIES' as SupportCategory,
    tags: ['grievance', 'types', 'principal', 'escalated', 'complaints'],
  },
  {
    title: 'How do I access student grievances?',
    content: `**Access all grievances through the Principal Dashboard:**

**Navigation:** Internship Management > Grievances (or Student Grievances)

**Grievance Dashboard Shows:**
• Total grievances count
• Status breakdown (Open/In Progress/Resolved/Closed)
• Priority distribution
• Recent submissions

**Filtering Options:**
• By status
• By priority
• By category
• By date range
• By faculty/student
• By escalation level

**For Each Grievance:**
• Grievance ID
• Student details
• Category and priority
• Description
• Current handler
• Response history
• Attachments

**Actions Available:**
• View full details
• Add response
• Assign/Reassign handler
• Change priority/status
• Escalate to State Directorate
• Resolve/Close

**Notifications:** You receive alerts for new escalated grievances and urgent matters.`,
    summary: 'Accessing student grievances',
    category: 'GENERAL_INQUIRIES' as SupportCategory,
    tags: ['grievance', 'access', 'view', 'principal', 'dashboard'],
  },
  {
    title: 'What is my role in grievance resolution?',
    content: `**As Principal, you are the final institutional authority for grievances.**

**Your Responsibilities:**

**1. Review Escalated Cases**
• Understand full context
• Review faculty's handling
• Identify gaps or errors

**2. Investigate Thoroughly**
• Gather all facts
• Hear all parties
• Document findings
• Maintain confidentiality

**3. Make Decisions**
• Fair and unbiased judgment
• Based on evidence and policy
• Consider all perspectives
• Document reasoning

**4. Communicate Resolution**
• Inform all parties
• Explain decision clearly
• Outline any actions required
• Set expectations

**5. Follow Up**
• Ensure resolution is implemented
• Monitor for compliance
• Check for retaliation
• Learn for future prevention

**When to Escalate to State Directorate:**
• Legal implications
• Pattern across institutions
• Cannot resolve at institution level
• Requires policy change
• Serious safety/ethical concerns

**Key Principles:**
• Act promptly
• Be fair and objective
• Maintain confidentiality
• Document everything`,
    summary: 'Principal role in grievance resolution',
    category: 'GENERAL_INQUIRIES' as SupportCategory,
    tags: ['grievance', 'resolution', 'principal', 'role', 'authority'],
  },

  // ==========================================
  // PRINCIPAL FAQs - Role & Permission (3 FAQs)
  // ==========================================
  {
    title: 'How do I manage user roles?',
    content: `**Managing user roles and permissions:**

**Navigation:** Administration > Role Management (if available)

**Your Role Management Capabilities:**

**Creating Users:**
• Faculty/Teacher accounts
• Staff accounts
• Student accounts (direct or delegated)

**Assigning Roles:**
• Set role during account creation
• Role determines access permissions
• Each user has one primary role

**Role Types You Can Manage:**
• **FACULTY/TEACHER** - Student supervision, visits, documents
• **STUDENT** - Internship submission, reports, grievances
• **STAFF** - Administrative support (varies by setup)

**Viewing Role Assignments:**
• Staff List shows current roles
• Filter by role type
• See active/inactive status

**Modifying Access:**
• Activate/Deactivate accounts
• Cannot change role type directly
• Delete and recreate for role changes

**Note:** Principal and State Directorate roles are managed at higher levels.`,
    summary: 'Managing user roles',
    category: 'ACCOUNT_PROFILE' as SupportCategory,
    tags: ['roles', 'manage', 'users', 'permissions', 'administration'],
  },
  {
    title: 'What roles can I create or modify?',
    content: `**Roles you can manage as Principal:**

**Can Create:**

**1. FACULTY / TEACHER**
• Full faculty supervision capabilities
• Student assignment
• Visit logging
• Document verification
• Grievance handling

**2. STUDENT**
• Internship submission
• Document uploads
• Grievance submission
• Profile management

**3. STAFF (if enabled)**
• Administrative support
• Limited access based on configuration
• May include admission officers, coordinators

**Cannot Create/Modify:**

**1. PRINCIPAL**
• Created by State Directorate only
• Cannot create additional principals
• Cannot change your own role

**2. STATE_DIRECTORATE**
• State-level administrators
• Created at state level only

**3. INDUSTRY**
• Industry partner accounts
• May be managed separately

**Role Properties:**
• Roles are predefined with set permissions
• Cannot customize individual permissions
• Each user has exactly one role`,
    summary: 'Roles principals can create or modify',
    category: 'ACCOUNT_PROFILE' as SupportCategory,
    tags: ['roles', 'create', 'modify', 'types', 'permissions'],
  },
  {
    title: 'Can I give a faculty member additional permissions?',
    content: `**Role permissions are predefined and standardized.**

**Current Limitation:**
• Cannot customize individual permissions
• All faculty have same base permissions
• Role-based access control is fixed

**What You CAN Do:**

**1. Assign Additional Responsibilities**
• More student assignments
• Special supervision tasks
• Coordinator duties (informal)

**2. Create Multiple Accounts (Not Recommended)**
• Different roles need separate accounts
• Not ideal - creates confusion

**3. Request Custom Configuration**
• Contact State Directorate
• Explain specific requirements
• May be addressed in system updates

**Why Standardized Permissions:**
• Ensures consistency
• Simplifies administration
• Maintains data security
• Easier audit compliance

**Alternative Approaches:**
• Delegate specific tasks manually
• Use external communication for special coordination
• Document special arrangements

**For Special Requirements:** Contact State Directorate support at dtepunjab.internship@gmail.com to discuss institutional needs.`,
    summary: 'Faculty additional permissions',
    category: 'ACCOUNT_PROFILE' as SupportCategory,
    tags: ['permissions', 'faculty', 'additional', 'custom', 'access'],
  },

  // ==========================================
  // TECHNICAL SUPPORT FAQs (Extended)
  // ==========================================
  {
    title: 'The page is not loading properly. What should I do?',
    content: `**Troubleshooting steps for page loading issues:**

**Step 1: Basic Refresh**
• Press Ctrl + F5 (Windows) or Cmd + Shift + R (Mac)
• Forces browser to reload without cache

**Step 2: Clear Browser Cache**
• Chrome: Settings > Privacy > Clear browsing data
• Firefox: Options > Privacy > Clear Data
• Edge: Settings > Privacy > Clear browsing data
• Select "Cached images and files"

**Step 3: Try Different Browser**
• If Chrome fails, try Firefox or Edge
• Rule out browser-specific issues

**Step 4: Check Internet Connection**
• Test other websites
• Try restarting your router
• Check if others have same issue

**Step 5: Disable Browser Extensions**
• Ad blockers can interfere
• Temporarily disable and retry

**Step 6: Check System Time**
• Incorrect time can cause security errors
• Sync your device time automatically

**If Issue Persists:**
• Submit a support ticket
• Include: Browser name/version, OS, screenshot
• Note exact page URL that fails`,
    summary: 'Page loading troubleshooting steps',
    category: 'TECHNICAL_ISSUES' as SupportCategory,
    tags: ['page', 'loading', 'troubleshoot', 'browser', 'refresh'],
  },
  {
    title: "I'm getting an error message. What should I do?",
    content: `**How to handle and report error messages:**

**Immediate Steps:**

**1. Screenshot the Error**
• Capture the entire screen
• Include the URL bar
• Note the exact time

**2. Document the Context**
• What were you trying to do?
• What did you click/enter?
• Did it work before?

**3. Try Again**
• Refresh the page
• Try the action again
• Sometimes temporary glitches resolve

**4. Try Alternative Method**
• Different browser
• Different device
• Incognito/private mode

**If Error Persists:**

**Submit Support Ticket:**
• Category: Technical Issues
• Priority: Based on urgency
• Include:
  - Screenshot of error
  - Steps to reproduce
  - Your role and username
  - Browser and OS
  - Time of occurrence

**Common Error Types:**
• 404 - Page not found (URL may be wrong)
• 403 - Access denied (permission issue)
• 500 - Server error (system issue)
• Timeout - Slow connection or server busy`,
    summary: 'Reporting error messages',
    category: 'TECHNICAL_ISSUES' as SupportCategory,
    tags: ['error', 'message', 'report', 'screenshot', 'troubleshoot'],
  },
  {
    title: 'My uploaded file is not showing. What could be wrong?',
    content: `**Common causes and solutions for upload issues:**

**Check File Size**
• Maximum: 5-10 MB for documents
• Solution: Compress using online tools or reduce quality

**Check File Format**
• Supported: PDF, DOC, DOCX
• Not supported: ZIP, EXE, unusual formats
• Solution: Convert to PDF

**Check Filename**
• Avoid special characters (#, %, &, etc.)
• Avoid very long names
• Use simple alphanumeric names

**Check Internet Connection**
• Slow connections may timeout
• Try during off-peak hours
• Use wired connection if possible

**Browser Issues**
• Clear cache and cookies
• Disable ad blockers
• Try different browser

**Check If Upload Completed**
• Wait for confirmation message
• Don't navigate away during upload
• Check progress bar completed

**After Upload:**
• Wait a minute and refresh
• Check the correct section
• Verify correct document type selected

**Still Not Showing?**
• Submit support ticket
• Include: File details, browser, steps tried
• We'll investigate and help`,
    summary: 'File upload troubleshooting',
    category: 'TECHNICAL_ISSUES' as SupportCategory,
    tags: ['file', 'upload', 'not-showing', 'troubleshoot', 'missing'],
  },
  {
    title: 'How do I submit a technical query?',
    content: `**Submitting a technical support ticket:**

**Navigation:** Help & Support > Submit Ticket

**Step-by-Step:**

**1. Select Category**
• Technical Issues
• Account & Profile
• Data & Reports
• Feature Guidance
• General Inquiries

**2. Set Priority**
• **Low:** Minor inconvenience
• **Medium:** Affects productivity
• **High:** Cannot complete tasks
• **Urgent:** Critical deadline impacted

**3. Write Subject**
• Clear and specific (e.g., "Cannot upload monthly report - file error")
• Avoid vague subjects like "Help needed"

**4. Describe the Issue**
• What happened?
• What were you trying to do?
• When did it start?
• Any error messages?
• Steps to reproduce

**5. Attach Screenshots (Optional but helpful)**
• Error messages
• Relevant screens
• Evidence of issue

**6. Submit**
• Click Submit Ticket
• Note your ticket number
• Track in My Queries

**Response Time:**
• Low: 72 hours
• Medium: 48 hours
• High: 24 hours
• Urgent: Same day`,
    summary: 'Submitting technical support tickets',
    category: 'TECHNICAL_ISSUES' as SupportCategory,
    tags: ['technical', 'query', 'submit', 'ticket', 'support'],
  },
  {
    title: 'How can I track my technical query status?',
    content: `**Track your support tickets easily:**

**Navigation:** Help & Support > My Queries

**What You'll See:**
• All your submitted tickets
• Current status of each
• Last response date
• Action required flags

**Status Meanings:**

| Status | Meaning |
|--------|---------|
| Open | Submitted, awaiting review |
| Assigned | Assigned to support staff |
| In Progress | Being worked on |
| Pending User | Needs your response |
| Resolved | Issue fixed |
| Closed | Ticket completed |

**Actions You Can Take:**
• **View Details:** Full conversation history
• **Reply:** Add more information
• **View Resolution:** See how issue was fixed

**"Pending User" Tickets:**
• Support team needs your input
• Check and respond promptly
• Delays your resolution if ignored

**Notifications:**
• Email notifications for updates
• Check email including spam folder
• In-app notifications on dashboard

**Tip:** Check My Queries regularly, especially for Pending User status.`,
    summary: 'Tracking technical query status',
    category: 'TECHNICAL_ISSUES' as SupportCategory,
    tags: ['track', 'query', 'status', 'my-queries', 'technical'],
  },
  {
    title: 'I cannot log in. What should I do?',
    content: `**Login troubleshooting steps:**

**1. Verify Username**
• Students: Registration Number (e.g., 2021-CS-001)
• Faculty/Staff: Assigned username
• Check spelling and format

**2. Verify Password**
• Check Caps Lock status
• Passwords are case-sensitive
• Try typing in notepad first to see characters

**3. Check Portal URL**
• Correct: https://placeintern.com/login
• Avoid old bookmarks that may be wrong

**4. Account Status**
• First-time login? Wait for credentials email
• Account may be inactive - contact admin
• May be locked after failed attempts

**5. Browser Issues**
• Clear cache and cookies
• Try incognito/private mode
• Try different browser

**6. Connection Issues**
• Test your internet
• Try from different network
• Disable VPN if using one

**If Still Cannot Login:**

**Contact Your Supervisor:**
• Students → Faculty Mentor
• Faculty → Principal
• Principal → State Directorate

**Provide:**
• Your username/Registration Number
• When you last logged in
• Any error messages seen`,
    summary: 'Login troubleshooting',
    category: 'ACCOUNT_PROFILE' as SupportCategory,
    tags: ['login', 'cannot', 'troubleshoot', 'access', 'password'],
  },
  {
    title: 'My account seems to be locked. What happened?',
    content: `**Account lockout explanation and resolution:**

**Why Accounts Get Locked:**
• Multiple failed login attempts (usually 5+)
• Security precaution against unauthorized access
• Automatic protection mechanism

**Signs of Locked Account:**
• "Account locked" message
• Cannot login despite correct password
• "Too many attempts" error

**How to Unlock:**

**Contact Your Supervisor:**
| Your Role | Contact |
|-----------|---------|
| Student | Faculty Mentor |
| Faculty | Principal |
| Principal | State Directorate |

**Information to Provide:**
• Your full name
• Username/Registration Number
• When you last successfully logged in
• Confirm you own the account

**Resolution Process:**
1. Supervisor verifies your identity
2. Account is unlocked
3. Password may be reset
4. You receive new credentials

**Prevention Tips:**
• Store password securely
• Use "Forgot Password" if unsure
• Don't share credentials
• Don't try multiple guesses

**Security Note:** If you didn't attempt multiple logins, report possible unauthorized access immediately.`,
    summary: 'Account lockout resolution',
    category: 'ACCOUNT_PROFILE' as SupportCategory,
    tags: ['account', 'locked', 'security', 'unlock', 'failed-attempts'],
  },
  {
    title: "I didn't receive my login credentials email. What should I do?",
    content: `**Steps to resolve missing credential emails:**

**1. Check Spam/Junk Folder**
• System emails often get filtered
• Search for "placeintern" or "dtepunjab"
• Mark as "Not Spam" if found

**2. Check Correct Email**
• Verify email registered in system
• Check for typos in email address
• Try alternate email if applicable

**3. Wait Adequate Time**
• Email delivery can take 5-15 minutes
• Check again after 30 minutes
• Peak times may have delays

**4. Check Email Filters**
• Review any auto-filtering rules
• Check blocked senders list
• Whitelist the sender domain

**5. Request Resend**
• Contact who registered you:
  - Students: Faculty Mentor
  - Faculty: Principal
  - Principal: State Directorate
• Request credential resend

**Information to Provide:**
• Your name and role
• Registration Number (if student)
• Email address
• When you were registered

**Alternative:**
• Ask admin to verify email address
• Update email if incorrect
• Resend after verification

**Note:** Never ask for credentials over unsecure channels.`,
    summary: 'Missing credentials email',
    category: 'ACCOUNT_PROFILE' as SupportCategory,
    tags: ['credentials', 'email', 'not-received', 'spam', 'missing'],
  },
  {
    title: 'My data is not displaying correctly. What should I do?',
    content: `**Troubleshooting data display issues:**

**1. Refresh the Page**
• Press F5 or Ctrl+R
• Forces data reload from server

**2. Clear Browser Cache**
• Cached data may be outdated
• Clear and reload fresh data

**3. Check Login Status**
• Session may have expired
• Log out and log back in
• Verify you're in correct account

**4. Verify Data Was Saved**
• Did you get confirmation when entering?
• Check for error messages at submission
• May need to re-enter data

**5. Check Filters**
• Data may be filtered out
• Clear all filters
• Reset to default view

**6. Check Date Ranges**
• Data might be outside selected range
• Expand date range
• Check correct period

**If Data is Missing or Wrong:**

**Submit Support Ticket With:**
• Which data is affected
• What it should show
• What it's showing instead
• Screenshots of both states
• When you last saw correct data

**Note:** Some data depends on other submissions. Ensure prerequisites are complete.`,
    summary: 'Troubleshooting data display issues',
    category: 'DATA_REPORTS' as SupportCategory,
    tags: ['data', 'display', 'incorrect', 'missing', 'troubleshoot'],
  },
  {
    title: 'I cannot export or download reports. What is wrong?',
    content: `**Troubleshooting export/download issues:**

**1. Check Permissions**
• Ensure you have permission for that report
• Some reports are role-restricted
• Try a different report you know you can access

**2. Pop-up Blocker**
• Downloads may open in new window
• Check pop-up blocker settings
• Allow pop-ups from placeintern.com

**3. Download Location**
• Check your Downloads folder
• Check browser download history
• File may have downloaded with different name

**4. Browser Settings**
• Enable downloads in browser settings
• Check if download was blocked
• Try different browser

**5. File Size**
• Large exports take time
• Wait for completion
• Don't click multiple times

**6. Storage Space**
• Ensure device has free space
• Clear unnecessary files
• Try different storage location

**7. Ad Blocker Interference**
• Disable ad blocker temporarily
• Some block download scripts
• Whitelist the site

**If Still Failing:**
• Submit support ticket
• Specify which report
• Include browser details
• Note any error messages`,
    summary: 'Export and download troubleshooting',
    category: 'DATA_REPORTS' as SupportCategory,
    tags: ['export', 'download', 'reports', 'failing', 'troubleshoot'],
  },
  {
    title: 'The portal is not responsive on my tablet. What should I do?',
    content: `**Optimizing portal access on tablets:**

**The portal is optimized for desktop use** but can be accessed on tablets with these tips:

**1. Use Landscape Mode**
• Rotate tablet horizontally
• Wider view shows more content
• Tables and forms display better

**2. Use Desktop Mode**
• In browser menu, select "Desktop site"
• Chrome: Menu > Desktop site
• Safari: Share > Request Desktop Website

**3. Zoom Controls**
• Pinch to zoom on specific areas
• Use browser zoom settings
• 90% zoom often helps visibility

**4. Supported Browsers**
• Use Chrome or Safari
• Keep browser updated
• Avoid mini/lite browsers

**5. Split View**
• Avoid split-screen with other apps
• Give browser full screen

**For Critical Tasks:**
• Use desktop computer when possible
• Especially for:
  - Document uploads
  - Complex forms
  - Report generation
  - Data entry

**Known Limitations:**
• Some dropdowns may be hard to select
• Tables may require horizontal scroll
• Pop-ups may not position well

**Note:** A desktop or laptop provides the best experience for full functionality.`,
    summary: 'Tablet responsiveness issues',
    category: 'TECHNICAL_ISSUES' as SupportCategory,
    tags: ['tablet', 'responsive', 'mobile', 'display', 'landscape'],
  },
  {
    title: 'Can I access the portal from my mobile phone?',
    content: `**Yes, the portal is accessible from mobile browsers.**

**Recommended Setup:**

**Browsers:**
• Chrome for Android
• Safari for iPhone
• Latest versions recommended

**Access:**
• Same URL: https://placeintern.com/login
• Same credentials as desktop
• Full functionality available

**Mobile-Friendly Features:**
• Dashboard viewing
• Status checking
• Basic navigation
• Notification viewing
• Simple form submissions

**Best on Desktop:**
• Document uploads
• Complex forms
• Report generation
• Data tables
• Detailed analytics

**Mobile Tips:**

**1. Rotate for Complex Pages**
• Use landscape mode
• Better view of tables

**2. Use "Desktop Site" Option**
• Some pages render better
• Access from browser menu

**3. Bookmark the Login Page**
• Easy access
• Avoid typing URL each time

**4. Keep Browser Updated**
• Better compatibility
• Security patches

**Note:** For urgent tasks like document submission deadlines, use desktop if possible for most reliable experience.`,
    summary: 'Mobile device accessibility',
    category: 'TECHNICAL_ISSUES' as SupportCategory,
    tags: ['mobile', 'phone', 'access', 'browser', 'responsive'],
  },
  {
    title: 'What file types can I upload?',
    content: `**Accepted file formats by document type:**

**Documents (Reports, Letters, Certificates):**
• **PDF** (.pdf) - Highly Recommended
• **Microsoft Word** (.doc, .docx)
• **Rich Text** (.rtf)

**Images (Profile Photos Only):**
• **JPEG** (.jpg, .jpeg)
• **PNG** (.png)

**Not Accepted:**
• ZIP archives (.zip)
• Executable files (.exe)
• Video files (.mp4, .avi)
• Spreadsheets (.xlsx) - unless specifically requested

**Format Recommendations:**

| Document Type | Best Format |
|---------------|-------------|
| Joining Letter | PDF |
| Monthly Report | PDF |
| Certificates | PDF |
| Profile Photo | JPEG |

**Why PDF is Preferred:**
• Universal compatibility
• Maintains formatting
• Smaller file sizes
• Professional appearance
• Cannot be easily modified

**Converting to PDF:**
• MS Word: File > Save As > PDF
• Google Docs: File > Download > PDF
• Online: Use free PDF converters
• Mobile: Print to PDF option`,
    summary: 'Accepted file formats',
    category: 'TECHNICAL_ISSUES' as SupportCategory,
    tags: ['file', 'types', 'format', 'upload', 'pdf', 'accepted'],
  },
  {
    title: 'What is the maximum file size for uploads?',
    content: `**File size limits by type:**

**Documents:**
• Maximum: 5-10 MB (varies by document type)
• Recommended: Under 5 MB

**Images:**
• Maximum: 2-5 MB
• Recommended: Under 2 MB

**Reducing File Size:**

**For PDFs:**
• Use online PDF compressors
• Reduce image quality in original document
• Save with "Reduce File Size" option
• Split very large documents

**For Images:**
• Reduce resolution
• Use compression tools
• Change format (JPEG is smaller than PNG)
• Crop unnecessary areas

**For Scanned Documents:**
• Scan at 200-300 DPI (not 600+)
• Use grayscale instead of color
• Save as PDF directly

**Online Tools:**
• smallpdf.com - PDF compression
• compressjpeg.com - Image compression
• ilovepdf.com - PDF tools

**If File is Too Large:**
1. Check the file size first
2. Compress using tools above
3. Ensure quality is still readable
4. Retry upload

**Note:** Very low compression may make documents unreadable. Test before uploading.`,
    summary: 'File size limits',
    category: 'TECHNICAL_ISSUES' as SupportCategory,
    tags: ['file', 'size', 'maximum', 'limit', 'compress'],
  },
  {
    title: 'My file upload keeps failing. What should I do?',
    content: `**Comprehensive file upload troubleshooting:**

**1. Check File Requirements**
• Size under limit (5-10 MB)
• Supported format (PDF, DOC, DOCX)
• No special characters in filename
• Not password-protected

**2. Check Internet Connection**
• Stable connection required
• Try different network
• Avoid uploading on mobile data

**3. Browser Optimization**
• Clear cache and cookies
• Disable extensions temporarily
• Try incognito mode
• Try different browser

**4. Rename the File**
• Use simple name (letters, numbers only)
• Remove spaces and special characters
• Keep name short (under 50 characters)
• Example: "JoiningLetter_Jan2025.pdf"

**5. Try Different Approach**
• Refresh page before retry
• Don't click upload multiple times
• Wait for progress to complete
• Don't navigate away during upload

**6. File Preparation**
• Re-save the file fresh
• Convert to PDF if using other format
• Compress if near size limit

**If All Else Fails:**

**Submit Support Ticket:**
• Describe the error exactly
• File type and size
• Browser and device used
• Steps you've tried
• Screenshot of error

**Alternative:** Ask your supervisor if they can upload on your behalf while issue is resolved.`,
    summary: 'File upload failure troubleshooting',
    category: 'TECHNICAL_ISSUES' as SupportCategory,
    tags: ['file', 'upload', 'failing', 'error', 'troubleshoot'],
  },
  {
    title: 'The portal is running slowly. How can I improve performance?',
    content: `**Optimizing portal performance:**

**1. Browser Optimization**
• Close unnecessary tabs (they use memory)
• Clear browser cache and cookies
• Disable unused extensions
• Update browser to latest version

**2. Network Improvements**
• Use wired connection if possible
• Move closer to WiFi router
• Check internet speed
• Avoid peak usage times

**3. Device Optimization**
• Close other applications
• Restart device
• Check available storage
• Update operating system

**4. Portal-Specific Tips**
• Load fewer items per page
• Use filters to reduce data shown
• Avoid opening multiple portal tabs
• Refresh if page becomes sluggish

**5. Timing**
• Try during off-peak hours
• Early morning or late evening
• Avoid deadline days if possible

**6. Alternative Access**
• Try from different device
• Try from different location
• Use mobile data as alternative

**If Consistently Slow:**

**Report to Support:**
• Specify which pages are slow
• Time of day
• Browser and device info
• Your internet speed (test at speedtest.net)

**Note:** System-wide slowness during peak times may be normal. Plan critical tasks for off-peak hours.`,
    summary: 'Performance optimization tips',
    category: 'TECHNICAL_ISSUES' as SupportCategory,
    tags: ['slow', 'performance', 'speed', 'optimize', 'browser'],
  },
  {
    title: 'Who do I contact for urgent technical issues?',
    content: `**Urgent issue escalation:**

**Definition of Urgent:**
• Cannot complete task before critical deadline
• System completely inaccessible
• Data loss or corruption
• Security concerns

**Immediate Actions:**

**1. Submit HIGH Priority Ticket**
• Help & Support > Submit Ticket
• Select "Urgent" priority
• Clearly state deadline

**2. Email Support Directly**
• Email: dtepunjab.internship@gmail.com
• Subject: "URGENT: [Brief Issue Description]"
• Include:
  - Your name and role
  - Registration Number
  - Institution
  - Detailed problem description
  - Deadline affected

**3. Contact Your Supervisor**
• Students → Faculty Mentor
• Faculty → Principal
• Principal → State Directorate

**4. Document Everything**
• Screenshot errors
• Note exact time of issue
• Keep trying alternative approaches

**Response Expectations:**
• Urgent tickets: Same business day
• Critical system outages: Within hours
• Non-urgent: 24-48 hours

**While Waiting:**
• Try alternative browsers/devices
• Ask colleague if they have same issue
• Prepare all information for support

**Note:** Reserve "Urgent" for true emergencies. Overuse delays response for everyone.`,
    summary: 'Urgent technical support contact',
    category: 'TECHNICAL_ISSUES' as SupportCategory,
    tags: ['urgent', 'contact', 'emergency', 'support', 'immediate'],
  },

  // ==========================================
  // SYSTEM-SPECIFIC ADDITIONAL FAQs
  // ==========================================
  {
    title: 'What is the difference between Grievance and Support Ticket?',
    content: `**Two different systems for different purposes:**

**Grievances (Internship Portal > Submit Grievance)**
**Purpose:** Report issues related to your internship experience

**Use For:**
• Workplace problems
• Industry supervisor issues
• Company-related concerns
• Safety matters
• Stipend/payment issues
• Harassment or discrimination
• Task assignment concerns

**Handled By:** Faculty Mentor → Principal → State Directorate (escalation chain)

**Support Tickets (Help & Support > Submit Ticket)**
**Purpose:** Report technical issues with the portal/system

**Use For:**
• Login problems
• Upload failures
• Page errors
• Missing data
• System bugs
• Feature questions
• General inquiries

**Handled By:** State Directorate Technical Support Team

**Quick Guide:**
| Issue | Use |
|-------|-----|
| Company not paying stipend | Grievance |
| Cannot upload stipend document | Support Ticket |
| Industry supervisor is absent | Grievance |
| Supervisor name showing wrong | Support Ticket |
| Unsafe workplace | Grievance |
| Error saving form | Support Ticket |`,
    summary: 'Difference between grievances and support tickets',
    category: 'GENERAL_INQUIRIES' as SupportCategory,
    tags: ['grievance', 'support-ticket', 'difference', 'which', 'use'],
  },
  {
    title: 'What happens if I miss a monthly report deadline?',
    content: `**Consequences and recovery for late submissions:**

**Immediate Effects:**
• Report marked as "Late" in system
• Affects your progress percentage
• Flagged for faculty mentor attention
• May trigger follow-up from mentor

**Impact on Progress:**
• Dashboard shows incomplete status
• Progress metrics affected
• May impact overall evaluation
• Visible to Principal in reports

**What You Should Do:**

**1. Submit ASAP**
• Don't delay further
• Upload even if late
• Late submission > No submission

**2. Notify Faculty Mentor**
• Explain the reason
• Apologize for delay
• Confirm submission

**3. Avoid Future Delays**
• Set calendar reminders
• Start report a week early
• Check dashboard regularly

**Repeated Late Submissions:**
• Faculty mentor discussion
• May require explanation to Principal
• Could affect recommendations
• Pattern may have consequences

**Grace Period:**
• Some institutions allow 3-5 days grace
• Check with your institution
• Don't rely on grace period

**Tip:** Set monthly reminder for 1st of each month to prepare your report.`,
    summary: 'Missing monthly report deadlines',
    category: 'DATA_REPORTS' as SupportCategory,
    tags: ['monthly-report', 'deadline', 'late', 'missed', 'consequences'],
  },
  {
    title: 'How does the notification system work?',
    content: `**PlaceIntern notification system explained:**

**Notification Types:**

**1. Email Notifications**
• Sent to registered email
• Important updates and reminders
• Credential information
• Deadline alerts

**2. In-App Notifications**
• Dashboard alerts
• Bell icon updates
• Action required items
• Status changes

**What You'll Be Notified About:**

**Students:**
• Application status changes
• Document verification updates
• Faculty visit schedules
• Grievance responses
• Deadline reminders

**Faculty:**
• New student assignments
• Document submissions
• Grievance assignments
• Visit reminders
• Student updates

**Principals:**
• Escalated grievances
• Institutional alerts
• Performance summaries
• System announcements

**Managing Notifications:**
• Check email regularly (including spam)
• Log into dashboard daily
• Click notification bell for details
• Mark as read after reviewing

**Not Receiving Notifications?**
• Check spam folder
• Verify email address
• Check notification settings
• Submit support ticket if persistent`,
    summary: 'How notifications work in the system',
    category: 'FEATURE_GUIDANCE' as SupportCategory,
    tags: ['notifications', 'alerts', 'email', 'updates', 'reminders'],
  },
  {
    title: 'Can I change my registered email address?',
    content: `**Yes, you can update your email address.**

**For Students:**
1. Go to Student Profile > Profile
2. Click Edit Profile
3. Update email address field
4. Save changes
5. Verify new email if required

**For Faculty:**
1. Access your profile settings
2. Update email field
3. Save changes
4. May need admin verification

**For Principals:**
• Contact State Directorate
• Provide new official email
• They will update in system

**Important Considerations:**

**Before Changing:**
• New email should be valid and accessible
• Prefer institutional email over personal
• Ensure you can receive emails

**After Changing:**
• All notifications go to new email
• Previous email no longer receives alerts
• Login credentials sent to new email

**Verification May Be Required:**
• OTP sent to new email
• Click verification link
• Confirm change

**If You Cannot Change Email:**
• Contact your supervisor
• They can assist with update
• Submit support ticket if needed

**Note:** Keep your email updated for important notifications and credential recovery.`,
    summary: 'Changing registered email address',
    category: 'ACCOUNT_PROFILE' as SupportCategory,
    tags: ['email', 'change', 'update', 'profile', 'registered'],
  },
  {
    title: 'What should I do when my internship ends?',
    content: `**End of internship checklist:**

**1. Upload Completion Certificate**
• Request from company HR
• Should be on company letterhead
• Include completion dates
• Upload to your profile

**2. Submit Final Monthly Report**
• Cover your last month's work
• Include overall summary
• Mention key learnings
• Don't skip this report

**3. Ensure All Documents Submitted**
• Check all monthly reports uploaded
• Joining letter verified
• Any pending submissions completed

**4. Update Internship Status**
• Mark internship as completed (if required)
• Confirm end date is correct
• Verify company details

**5. Provide Feedback (if asked)**
• Industry supervisor feedback
• Faculty mentor feedback
• System feedback

**6. Request References**
• From industry supervisor
• From HR if applicable
• Store for future use

**7. Check Progress Dashboard**
• All milestones should be complete
• Address any pending items
• Take screenshot for records

**What Happens Next:**
• Status changes to "Completed"
• Progress metrics finalized
• Available for next internship (if applicable)
• Records maintained for reference`,
    summary: 'End of internship procedures',
    category: 'INTERNSHIP_QUERIES' as SupportCategory,
    tags: ['internship', 'end', 'complete', 'certificate', 'final'],
  },
  {
    title: 'How is my internship data kept secure?',
    content: `**Data security measures in PlaceIntern:**

**Technical Security:**
• **HTTPS Encryption:** All data transmitted securely
• **Password Protection:** Encrypted password storage
• **Session Security:** Auto-logout on inactivity
• **Access Control:** Role-based permissions

**Data Protection:**
• Only authorized users see your data
• Faculty sees only assigned students
• Principals see only their institution
• State Directorate has appropriate oversight

**Your Responsibilities:**
• Never share your password
• Log out on shared computers
• Use strong, unique password
• Report suspicious activity

**Data Storage:**
• Secure cloud infrastructure
• Regular backups
• Data retained per policy
• Deleted upon request (with approval)

**Who Can Access Your Data:**
| Role | Can See |
|------|---------|
| You | Your own data |
| Faculty Mentor | Your internship data |
| Principal | Institutional data |
| State Directorate | All data (oversight) |

**Privacy Practices:**
• Minimal data collection
• Purpose-limited use
• No unauthorized sharing
• Compliance with regulations

**Concerns?** Contact support if you notice any security issues.`,
    summary: 'Data security and privacy measures',
    category: 'GENERAL_INQUIRIES' as SupportCategory,
    tags: ['security', 'privacy', 'data', 'protection', 'safe'],
  },
  {
    title: 'What is the Industry Partner/Supervisor role?',
    content: `**Understanding the Industry Partner role in PlaceIntern:**

**Who Are Industry Partners?**
• Companies offering internships
• Organizations employing students
• Industry supervisors at companies

**Their Role in the System:**

**1. Profile Management**
• Company profile creation
• Industry supervisor details
• Work locations

**2. Internship Coordination**
• Confirm student placements
• Provide work assignments
• Support faculty visits

**3. Student Supervision**
• Day-to-day guidance
• Work assignment
• Performance assessment
• Attendance monitoring

**4. Documentation**
• Issue joining letters
• Provide completion certificates
• Feedback submission

**Interaction Points:**

**Students:**
• Report to industry supervisor
• Follow company guidelines
• Seek guidance on tasks

**Faculty:**
• Coordinate visit schedules
• Provide student updates
• Share performance feedback

**System Access:**
• Some companies have portal access
• Others coordinate via email
• Faculty facilitates communication

**Note:** Not all companies have system accounts. Coordination may happen through faculty mentors.`,
    summary: 'Industry partner role explanation',
    category: 'FEATURE_GUIDANCE' as SupportCategory,
    tags: ['industry', 'partner', 'supervisor', 'company', 'role'],
  },
  {
    title: 'How do I change my profile photo?',
    content: `**Updating your profile photo:**

**Navigation:** Profile > Edit Profile (varies by role)

**Steps:**
1. Go to your profile page
2. Click Edit or the photo area
3. Click "Upload Photo" or camera icon
4. Select image file from device
5. Crop if needed
6. Save changes

**Photo Requirements:**
• **Format:** JPEG or PNG
• **Size:** Under 2 MB
• **Dimensions:** Square preferred (200x200 to 500x500 pixels)
• **Content:** Professional headshot

**Best Practices:**
• Use recent, clear photo
• Face clearly visible
• Plain background preferred
• Professional attire
• Good lighting
• Avoid group photos
• Avoid cartoon/avatars

**If Upload Fails:**
• Check file size (reduce if needed)
• Try different format (JPEG usually works best)
• Use different browser
• Clear cache and retry

**Why Have a Photo?**
• Easy identification
• Professional appearance
• ID card generation
• System correspondence

**Note:** Photo is visible to your supervisors and may be used in reports.`,
    summary: 'Changing profile photo',
    category: 'ACCOUNT_PROFILE' as SupportCategory,
    tags: ['profile', 'photo', 'change', 'upload', 'picture'],
  },
  {
    title: 'What are the dashboard widgets and what do they mean?',
    content: `**Understanding your dashboard widgets:**

**Student Dashboard Widgets:**

**1. Internship Status**
• Shows current internship status
• Company name and duration
• Days remaining

**2. Milestones**
• Internship Data: ✓/✗
• Joining Letter: ✓/✗
• Monthly Reports: X/Y completed
• Grievances: Open count

**3. Faculty Mentor Card**
• Assigned mentor name
• Contact details
• Visit schedule

**4. Recent Activity**
• Latest submissions
• Status changes
• Notifications

**Faculty Dashboard Widgets:**

**1. Student Overview**
• Total assigned students
• Active internships
• Completed count

**2. Pending Actions**
• Visits due
• Documents to review
• Grievances to handle

**3. Visit Progress**
• Completed vs. required
• This month status
• Overdue indicators

**Principal Dashboard Widgets:**

**1. Institutional Summary**
• Total students
• Active internships
• Completion rate

**2. Performance Metrics**
• Document submission rates
• Visit compliance
• Grievance resolution

**3. Alerts**
• Urgent matters
• Escalated grievances
• Action required items

**Tip:** Check your dashboard daily for updates and pending actions.`,
    summary: 'Dashboard widgets explained',
    category: 'FEATURE_GUIDANCE' as SupportCategory,
    tags: ['dashboard', 'widgets', 'overview', 'metrics', 'status'],
  },
  {
    title: 'Is there a mobile app for PlaceIntern?',
    content: `**Current Mobile Access Status:**

**Mobile App:**
• Currently, there is no dedicated mobile app
• Future mobile app may be developed
• Check announcements for updates

**Mobile Browser Access:**
• Full portal accessible via mobile browsers
• Same URL: https://placeintern.com
• Same credentials as desktop

**Mobile Browser Recommendations:**
• **Android:** Chrome browser
• **iPhone:** Safari browser
• Keep browser updated

**Creating a Home Screen Shortcut:**

**Android (Chrome):**
1. Open portal in Chrome
2. Tap menu (3 dots)
3. Select "Add to Home screen"
4. Name it "PlaceIntern"
5. Confirm

**iPhone (Safari):**
1. Open portal in Safari
2. Tap Share icon
3. Select "Add to Home Screen"
4. Name it "PlaceIntern"
5. Confirm

**This Creates:**
• App-like icon on home screen
• Quick access without typing URL
• Opens directly in browser

**Mobile Limitations:**
• Some complex features work better on desktop
• Document uploads easier on desktop
• Tables may require scrolling

**Recommendation:** Use mobile for checking status and simple tasks. Use desktop for document submissions and complex operations.`,
    summary: 'Mobile app availability and alternatives',
    category: 'TECHNICAL_ISSUES' as SupportCategory,
    tags: ['mobile', 'app', 'phone', 'android', 'iphone'],
  },
];

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 80)
    .trim();
}

async function main() {
  console.log('🌱 Starting Comprehensive FAQ Seed...\n');
  console.log(`📊 Total FAQs to create: ${faqData.length}\n`);

  // Find a STATE_DIRECTORATE user to be the author
  let author = await prisma.user.findFirst({
    where: { role: 'STATE_DIRECTORATE' },
  });

  if (!author) {
    console.log('⚠️  No STATE_DIRECTORATE user found. Creating a default one...');
    author = await prisma.user.create({
      data: {
        email: 'faq-author@placeintern.com',
        password: 'hashed-password-placeholder',
        name: 'FAQ System',
        role: 'STATE_DIRECTORATE',
        active: true,
      },
    });
  }

  console.log(`📝 Using author: ${author.name} (${author.email})\n`);

  // Delete existing FAQs (skip if MongoDB doesn't support transactions)
  try {
    const deletedCount = await prisma.fAQArticle.deleteMany({});
    console.log(`🗑️  Deleted ${deletedCount.count} existing FAQ articles.\n`);
  } catch (deleteError: any) {
    if (deleteError.code === 'P2031') {
      console.log(`⚠️  Skipping delete (MongoDB standalone mode). Will upsert FAQs instead.\n`);
    } else {
      throw deleteError;
    }
  }

  // Create FAQs
  let createdCount = 0;
  const errors: string[] = [];
  const slugMap = new Map<string, number>();

  for (const faq of faqData) {
    let slug = generateSlug(faq.title);

    // Handle duplicate slugs
    if (slugMap.has(slug)) {
      const count = slugMap.get(slug)! + 1;
      slugMap.set(slug, count);
      slug = `${slug}-${count}`;
    } else {
      slugMap.set(slug, 1);
    }

    try {
      // Determine which roles should see this FAQ
      const targetRoles = determineTargetRoles(faq.title, faq.category);

      // Manual find + create/update pattern to avoid MongoDB transaction requirement
      const existing = await prisma.fAQArticle.findFirst({
        where: { slug: slug },
      });

      if (existing) {
        await prisma.fAQArticle.update({
          where: { id: existing.id },
          data: {
            title: faq.title,
            content: faq.content,
            summary: faq.summary,
            category: faq.category,
            tags: faq.tags,
            targetRoles: targetRoles,
            isPublished: true,
            authorName: author.name || 'System',
          },
        });
      } else {
        await prisma.fAQArticle.create({
          data: {
            title: faq.title,
            content: faq.content,
            summary: faq.summary,
            category: faq.category,
            tags: faq.tags,
            targetRoles: targetRoles,
            slug: slug,
            isPublished: true,
            authorId: author.id,
            authorName: author.name || 'System',
            viewCount: Math.floor(Math.random() * 150) + 10,
            helpfulCount: Math.floor(Math.random() * 30) + 1,
          },
        });
      }
      createdCount++;
      const roleInfo = targetRoles.length > 0 ? ` [${targetRoles.join(', ')}]` : ' [ALL]';
      console.log(`✅ Created: ${faq.title.substring(0, 50)}...${roleInfo}`);
    } catch (error: any) {
      errors.push(`${faq.title}: ${error.message}`);
      console.error(`❌ Failed: ${faq.title.substring(0, 40)}... - ${error.message}`);
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`🎉 FAQ Seeding Complete!`);
  console.log(`${'='.repeat(50)}`);
  console.log(`   ✅ Created: ${createdCount} articles`);
  console.log(`   ❌ Errors: ${errors.length}`);

  if (errors.length > 0) {
    console.log('\n⚠️  Errors encountered:');
    errors.forEach((e) => console.log(`   - ${e}`));
  }

  // Print category breakdown
  const categoryStats = await prisma.fAQArticle.groupBy({
    by: ['category'],
    _count: true,
    orderBy: {
      _count: {
        category: 'desc',
      },
    },
  });

  console.log('\n📊 FAQ Category Distribution:');
  console.log('-'.repeat(40));
  categoryStats.forEach((stat) => {
    const label = stat.category.replace(/_/g, ' ');
    console.log(`   ${label.padEnd(25)} : ${stat._count} articles`);
  });
  console.log('-'.repeat(40));
  console.log(`   ${'TOTAL'.padEnd(25)} : ${createdCount} articles`);

  // Print role distribution
  console.log('\n🎯 FAQ Role Visibility Distribution:');
  console.log('-'.repeat(50));

  const allFaqs = await prisma.fAQArticle.findMany({ select: { targetRoles: true } });
  const roleDistribution: Record<string, number> = {
    'ALL (Public)': 0,
    STUDENT: 0,
    PRINCIPAL: 0,
    'TEACHER/FACULTY_SUPERVISOR': 0,
    'INDUSTRY/INDUSTRY_SUPERVISOR': 0,
    STATE_DIRECTORATE: 0,
    SYSTEM_ADMIN: 0,
  };

  allFaqs.forEach((faq) => {
    if (faq.targetRoles.length === 0) {
      roleDistribution['ALL (Public)']++;
    } else if (faq.targetRoles.includes('STUDENT')) {
      roleDistribution['STUDENT']++;
    } else if (faq.targetRoles.includes('PRINCIPAL')) {
      roleDistribution['PRINCIPAL']++;
    } else if (faq.targetRoles.includes('TEACHER')) {
      roleDistribution['TEACHER/FACULTY_SUPERVISOR']++;
    } else if (faq.targetRoles.includes('INDUSTRY')) {
      roleDistribution['INDUSTRY/INDUSTRY_SUPERVISOR']++;
    } else if (faq.targetRoles.includes('STATE_DIRECTORATE')) {
      roleDistribution['STATE_DIRECTORATE']++;
    } else if (faq.targetRoles.includes('SYSTEM_ADMIN')) {
      roleDistribution['SYSTEM_ADMIN']++;
    }
  });

  Object.entries(roleDistribution).forEach(([role, count]) => {
    if (count > 0) {
      console.log(`   ${role.padEnd(35)} : ${count} articles`);
    }
  });
  console.log('-'.repeat(50));
}

// Only run main if this file is executed directly (not imported)
if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
      await pool.end();
    });
}
