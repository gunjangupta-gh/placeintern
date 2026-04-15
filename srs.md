**1\. Introduction**  
**1.1 Scope**  
**1.2 Definitions, Acronyms, and Abbreviations**  
**1.3 Glossary**

**2\. Overall Description**  
**2.1 Product perspective**  
**2.2 Product Features**  
**2.3 Users**

**3\. Functional Requirements**  
The given below functional requirements comprise of modules for all panels.  
We have added the description of each according to our understanding.

**3.1 State**   
As a state-level administration, I have to access the internship stats, compliance records.  
**3.1.1 Dashboard**  
The state dashboard includes students internships stats, faculty and student compliance stats. College wise compliance score.

Acceptance criteria

* Dashboard contains 4 stat cards include of:  
1. Total students: shows the total number of students and total number active internships.  
2. Monthly reports: it shows month wise monthly report submission progress out of total expected with submitted reports.  
3. Total mentors: it shows the total number of mentors there in all colleges.  
4. Faculty visits: it shows the month wise faculty visits logging progress.

* In the dashboard there is the 2nd section which shows two side by side cards displaying the monthly report performer and faculty visits performers college wise top 5 and bottom 5 performers.  
* Top industries card shows the top 10 companies where the highest number of students joined for internships.  
* The Joining Report & Student Mapping card shows the number of joining reports submitted out of total active internships. And how many students are mapped to faculty means faculty are assigned as mentor to the students.  
* Visits by type shows current month visit distribution in pie chart according to their visit type(physical, telephonic and virtual visits).

**3.1.2 Internship Overview**  
At the state level I want to access all the colleges' internship overviews, their students count, number of reports and visits required or completed. There files they upload.

Acceptance criteria

* A college list shows the detailed internship overview throughout their college.  
* In the detail panel in the overview tab it shows the number of students, reports, and visits progress month wise. Visits by type distribution.  
* In the students tab it shows the list of the students in their college with the company name in which they are doing their internships. And the report column shows the report submission status and visit status.  
* In the files tab it shows the file explorer of their college students records like documents, visit logs, monthly reports, joining reports through this they can easily access all the files.

**3.1.3 Institutions**  
As a state level administration I have access to manage all the institutions. There staff and students.  
**3.1.3.1 Manage Institution**  
As a state level administration I have access to manage all the institutions.

Acceptance criteria 

* It contains 4 stats card

Total institutes: total number of institutes  
Active: total number of active institutes  
Inactive: total number of inactive institutes

* List of institutions which shows the institution's details which includes institution name, location, institute type, contact, student and faculty count, status(active or inactive).  
* Action items include view, edit and delete buttons.  
* Add institute button for add new institutes

**3.1.3.2 Principals**  
At the state level it can manage the principal's users.

Acceptance criteria 

* List of principals throughout all the institutes.  
* List includes the principal name, email, phone, institution name, designation, created date, status(active or inactive) and action buttons  
* Action buttons include edit, reset password and deactivate the user.  
* Edit principal can edit there basic info, designation.


**3.1.3.3 Students directory**  
Acceptance criteria 

* List of the students in all institutes.  
* List includes student name, college anime, branch, phone, status, internship status with company name, mentor assigned name and joining report submitted status.  
* Export to excel button to export all the students list in excel format.  
* Filters for the institutions wise, branch, status, internship status, mentor status wise filter options.

**3.1.4 Companies**  
At the state level I want to know the students are doing their internships in which companies.

Acceptance criteria

* There is 4 stat cards:  
1. Total companies: shows the total number of companies in which students enrolled for the internships  
2. Students placed: show the number of students are doing internships   
3. Self-identified: show the number of self-identified(college provided) internships.  
4. Self-id rate: shows the self-identify application rate

* Filters to filter based on the company name, industry type(self-identified) sorting (sort by students, institution, name) and ascending and descending sorting also.  
* List of the companies includes company name, industry type, active students:shows the number of students and institute count from the students enrolled. Top institutions, status, view action.  
* View action shows the modal which includes company full details and institutions wise student list.

**3.1.5 Report Builder**  
As state level admin i have to access the records in the excel format so that easily access the compliance, system wide reports.

Acceptance criteria

* The report catalog includes different types of reports that I can use and have a configuration panel where I can take columns that are needed to be included in the report.  
* Report catalog includes:

**1\. Student Reports**  
Student reports include student directory, student compliance report, students by branch, and students without internship.

* Student directory: report includes student details, mentor name, institution name, internship status, and active status.  
* Student compliance report: report includes student details, internship status, joining report status, monthly report count, last report date, and active status.  
* Students by branch: report includes branch-wise student distribution, active/completed/pending internships, placed students, and average compliance percentage.  
* Students without internship: report includes students who have not filled any internship application, with branch, year, institution, mentor, and active status.

**2\. Mentor Reports**  
Mentor reports include mentor list, mentor-student assignments, and unassigned students.

* Mentor list: report includes mentor profile, institution, department, assigned student count, internship tracking metrics, and active status.  
* Mentor-student assignments: report includes mentor-to-student mapping, student internship status, assignment date, last visit, and student/mentor activity flags.  
* Unassigned students: report includes students without mentor assignment, registration age, branch, year, institution, and internship presence.

**3\. Internship Reports**  
Internship reports include internships by institution and self-identified internships.

* Internships by institution: report includes institution-wise total students, active/completed/pending internships, submitted visits, submitted reports, joining report count, and internship rate percentage.  
* Self-identified internships: report includes student profile, company and HR details, internship timeline, stipend, verification status, mentor details, joining letter status, and application fill rate.

**4\. Compliance Reports**  
Compliance reports include faculty visit compliance, monthly report compliance, and joining report status.

* Faculty visit compliance: report includes student, mentor, institution, required/completed/pending visits, compliance percentage, and last visit details.  
* Monthly report compliance: report includes expected/submitted/approved/pending monthly reports, compliance percentage, and latest submission details.  
* Joining report status: report includes joining letter submission/approval status, internship start date, days since start, mentor details, and active status.

**5\. Institution Reports**  
Institution reports include institution summary, institution comparison, and branch-wise summary.

* Institution summary: report includes institution profile, city/district/type, students/faculty/branches count, internship metrics, placement rate, and active status.  
* Institution comparison: report includes comparative metrics across institutions such as internship rate, compliance rate, placement rate, average visits, average reports, and overall score.  
* Branch-wise summary: report includes branch and institution level student count, assigned mentors, internship metrics, and average compliance score.

**6\. Pending Reports**  
Pending reports include pending monthly visits, pending monthly reports, pending joining letters, and pending mentor assignments.

* Pending monthly visits: report includes faculty/student/company mapping with days since last visit, visits due, and urgency level.  
* Pending monthly reports: report includes students with pending report month/year, days past due, submitted vs expected report count.  
* Pending joining letters: report includes students with pending joining letters, internship start date, days since start, mentor and institution details.  
* Pending mentor assignments: report includes students awaiting mentor assignment with branch, year, registration date, days pending, and internship availability.

**7\. User Activity Reports**  
User activity reports include user login activity report, user session history, never logged in users, default password users, inactive users report, and user audit log.

* User login activity report: report includes account creation, login count, last/previous login, password change status, role, institution, and account activity.  
* User session history: report includes session start/end activity, session duration, IP/device details, and session/account status.  
* Never logged in users: report includes users who never logged in since account creation, password status, role, and account activity.  
* Default password users: report includes users who have not changed default password, login count, role, institution, and account status.  
* Inactive users report: report includes users inactive for selected period with last login, inactivity days, and account status.  
* User audit log: report includes action trail with user, role, entity type, description, timestamp, and IP/device metadata.

**8\. Industry Reports**  
Industry reports include industry-wise student distribution and stipend analysis, and top institutes per industry/company.

* Industry-wise student distribution and stipend analysis: report includes company-wise student count, stipend totals/averages/min-max, and active/completed split.  
* Top 3 institutes per industry/company: report includes company totals, ranked top 3 institutes, institute-wise student count, stipend metrics, and active/completed split.

Configuration Panel Requirements  
1\. The configuration panel must show all available columns for the selected report.  
2\. Default columns are pre-selected and user can add/remove optional columns.  
3\. Selected columns define the final exported excel headers and order.  
4\. Filters must be shown contextually based on selected report definition.  
5\. Sortable columns should be available for sorting before export.

Export Requirements  
1\. Export format: excel.  
2\. Export file should include report metadata: report name, generated date/time, filters applied, generated by user.  
3\. Exported data must follow selected columns and selected sort order.  
4\. If no data is available, system should generate an empty-state report with headers and a no-record message.

**3.1.6 Bulk operations**  
As a state-level admin I have to perform bulk upload for different types like institution upload, staff/students, internships.

**3.1.6.1 Institutions**  
As a state-level admin I have to bulk upload the institutions. Download the bulk upload template, fill that and upload it.

**3.1.6.2 Staff/students**   
As a state-level admin I can bulk upload students, staff into the portal.

Acceptance criteria

* Drop down to select the institutions, and drop down for shift to the student and staff uploads and download the template accordingly.  
* Upload the filled template and it shows the list of rows from the template filled and then start uploading.

**3.1.6.3 Internships**  
 As a state-level admin I can bulk upload the internships of the students.

Acceptance criteria

* Drop down to select the institutions, download the template accordingly.  
* Upload the filled template and it shows the list of rows from the template filled and then start uploading.

**3.1.7 System**  
As a state-level admin I have to add branches, batches and add faculty staff. Reset the credentials for all the users over the system, restore the center or watch audit logs.

**3.1.7.1 Master Data**

* Users have access to manage the batches and branches over the portal.  
* There are two tabs, batches and branches through which this user can shift to one other feature.  
* Batches tab shows the list of batches that are created or a button to create a new batch.  
* Branches tab shows the list of branches that are created or a button to create a new one.

**3.1.7.2 Staff**

* List of the staff members include staff name, role, institution, branch, designation, phone, status and action button.  
* The action button includes edit, reset password and deactivate.

**3.1.7.3 Reset Credentials**

* List of all users include name, role, institution, last login, status and reset action button.  
* Reset password will generate random password. Deliver by email to that user.

**3.1.7.4 Restore center**  
As state-level admin i can access which data is deleted or accidentally deleted so that later on we can restore them.

Acceptance criteria

* It consist of 4 stat card:  
1. Total deleted: shows total number of items deleted include of monthly report, faculty visits log and documents.  
2. Monthly reports: shows the total monthly report deleted.  
3. Faculty visits: shows the total faculty visits deleted.  
4. Documents: shows total students documents deleted.  
* Tab section includes monthly reports, faculty visits, documents tab through which it can shift to see the data accordingly.  
* Monthly reports tab contains filters including filters by institution, date range. And the list shows the report name, status, student name, deleted date/time, institution and restore action button.  
* The Faculty Visits tab contains filters including filters by institution, date range. And the list shows the report name, status, student name, deleted date/time, institution and restore action button.  
* The Documents tab contains filters including filters by institution, date range. And the list shows the report name, status, student name, deleted date/time, institution and restore action button.

**3.1.8 Support Management**  
As a state-level admin i can access the grievances related to students, support query through the portal, and help-center to know how the portal works.

**3.1.8.1 Grievances**  
Acceptance criteria

* It consists of 6 stat cards:  
  1. Total: shows the total number of grievances received.  
  2. Pending: shows the total number of grievances that are pending or new.  
  3. Escalated: shows the total number of grievances that are escalated to a higher authority.  
  4. In progress: shows the total number of grievances currently being processed.  
  5. Resolved: shows the total number of grievances that have been resolved.  
  6. Rejected: shows the total number of grievances that have been rejected.  
* A list of grievances with details including subject, faculty mentor, status, created, and action buttons (View Detail, Respond, Escalate).  
* Filters by categories, severity, escalation level.  
* The View Detail action opens a detail panel showing the complete grievance description, attachments, communication history, resolution steps, and status update history.

**3.1.8.2 Support Dashboard**  
Acceptance criteria 

* List of support query (technical queries) includes ticket number, submitter name and role, subject, category, priority, status, created and view action.  
* View modal shows the detailed query from which this user can chat, and change the status.  
* Filters includes of search, status, category, priority, date range.

**3.1.8.3 Help center**  
User want to know how the platform features works

Acceptance criteria 

* List of faq through which the user can easily read and get a guide about the system.

 

## **3.2 Principal**

As a principal-level administration, I have to access the internship stats, student and staff management, mentor assignments, and compliance records of my institution.

### **3.2.1 Dashboard**

The principal dashboard includes students internships stats, faculty compliance stats, mentor coverage and institution level compliance overview.

Acceptance criteria

* Dashboard contains statistics cards include of:  
  * Total students: shows the total number of students enrolled in the institution with breakdown by branch/department.  
  * Total mentors: shows the total number of active mentor profiles with coverage details.  
  * Unassigned students: shows the number of students awaiting mentor assignment.  
  * Partner companies: shows the count of active industry engagements where students are doing internships.  
* Submission status section shows 4 cards:  
  * Monthly reports: shows submitted vs expected reports with current month breakdown and pending count.  
  * Joining reports: shows the joining letter submissions tracking with pending percentage.  
  * Faculty visits: shows completed vs expected visits with month-specific data.  
  * Student grievances: shows total and unaddressed grievances count.  
* Dashboard has two tabs for detailed views:  
  * Internship Details tab: shows table of internship applications and their status.  
  * Faculty Overview tab: shows faculty workload distribution and mentor statistics.  
* Modal details are available for:  
  * Students by Course: branch-wise breakdown with totals and active student counts.  
  * Mentor Details: load distribution, coverage percentage, assignment status.  
  * Partner Companies: list with student placement counts and locations.  
  * Monthly Reports: pending reports with overdue tracking.  
  * Faculty Visits: compliance tracking with dates and statuses.  
  * Joining Letters: upload rate and pending submissions.  
  * Unassigned Students: list of students without mentor assignments.  
  * Student Grievances: total and unaddressed grievances breakdown.

### **3.2.2 Student Management**

As a principal I have access to manage all students in my institution.

#### **3.2.2.1 Student List**

Acceptance criteria

* A paginated list of all students in the institution.  
* List includes student name with profile avatar, department/branch, batch/year, email address, status (active/inactive).  
* Search functionality to search by name or roll number with debounce.  
* Filters for branch/department, batch/year, status.  
* Action buttons include view, edit, reset password, activate/deactivate, delete.  
* View student details shows full profile information.  
* Edit student can update student information.  
* Reset password generates new password for student account.

### **3.2.3 Staff Management**

As a principal I have access to manage all staff members in my institution including faculty, coordinators, and administrators.

Acceptance criteria

* A paginated list of all staff members.  
* List includes staff name with contact email, role and designation, branch/department, phone number, status badge.  
* Search functionality to search by name, email, or ID.  
* Filters for role (Faculty Supervisor, Teacher, HOD, Coordinator) and status.  
* Action buttons include view details, edit, reset password, deactivate/activate, delete.  
* Deactivating staff shows warning about mentor assignments being affected.  
* Faculty visit logs are preserved when deactivating staff.

### **3.2.4 Mentor Assignment**

As a principal I have to manage the mentor-student assignments across my institution.

Acceptance criteria

* Mentor statistics dashboard shows:  
  * Total mentors available  
  * Students assigned to mentors  
  * Mentor coverage percentage  
  * Load distribution visualization  
* Assignment views include:  
  * All assignments: complete assignment listing  
  * Assigned students: students with mentors  
  * Unassigned students: students awaiting assignment  
* Assignment operations include:  
  * Single Assignment: assign mentor to individual student  
  * Bulk Assignment: assign multiple students to same mentor  
  * Edit Assignment: change mentor for a student  
  * Remove Assignment: unassign mentor from student  
  * Auto-Assign: automatically distribute unassigned students evenly  
* Filters for batch/year, branch/department, assignment status, mentor, active students only.  
* Load balancing indicators:  
  * Light (5 or less students)  
  * Optimal (6-15 students)  
  * Heavy (more than 15 students)

### **3.2.5 Faculty Progress**

As a principal I want to track faculty performance and compliance.

Acceptance criteria

* Tracking elements include:  
  * Monthly report submission status  
  * Faculty visit completion rates  
  * Student workload per faculty  
  * Report compliance metrics  
  * Visit frequency analysis

### **3.2.6 Grievances**

As a principal I have to manage student grievances escalated to institution level.

Acceptance criteria

* It consists of stat cards showing:  
  1. Total: total number of grievances received.  
  2. Pending: grievances that are pending or new.  
  3. In progress: grievances currently being processed.  
  4. Resolved: grievances that have been resolved.  
  5. Escalated: grievances escalated to higher authority.  
* A list of grievances with details including subject, faculty mentor, status, created date, and action buttons.  
* Filters by status, escalation level, date range, student, grievance type.  
* Escalation levels:  
  1. Faculty Mentor \- Initial escalation  
  2. Principal \- Institution-level escalation  
  3. State Directorate \- State-level escalation  
* Actions include review grievance details, add comments/notes, change status, escalate to higher authority, track resolution timeline.

### **3.2.7 Bulk Operations**

As a principal I have to perform bulk upload for students, staff, and internships.

#### **3.2.7.1 Bulk Upload Students/Staff**

Acceptance criteria

* Upload student and staff data via excel template.  
* Template download button for standardized format.  
* Validation before upload includes required fields check, email format validation, gender validation, data type validation.  
* Steps include: select upload type, download template, fill data, upload file, validation review, confirmation, summary report.

#### **3.2.7.2 Bulk Internship Upload**

Acceptance criteria

* Bulk upload self-identified internship data.  
* Template-based upload.  
* Validation of internship details.  
* Batch processing support.

## 

## **3.3 Faculty**

As a faculty mentor, I have to manage my assigned students, log faculty visits, review monthly reports, and track internship compliance.

### **3.3.1 Dashboard**

The faculty dashboard includes assigned students stats, visit logging progress, monthly reports status, and grievances overview.

Acceptance criteria

* Dashboard contains statistics cards include of:  
  1. Assigned students: total students with breakdown (active/inactive, internal/external).  
  2. Monthly reports (eligible): submitted vs expected ratio using 10-day inclusion rule.  
  3. Visit logs (eligible): completed vs expected ratio using 10-day inclusion rule.  
  4. Joining reports: uploaded vs expected ratio with pending status.  
  5. Grievances: pending vs total count.  
* Assigned students list with quick actions.  
* Dashboard header with faculty profile.  
* Quick visit logging floating button for rapid visit entry.  
* Student details modal for individual student info.  
* Real-time dashboard with automatic data refresh and revalidation indicators.

### **3.3.2 Visit Logging**

As a faculty mentor I have to log my visits to students during their internship.

Acceptance criteria

* Visit types include:  
  * Physical: with GPS location capture  
  * Virtual: video/web-based  
  * Telephonic: phone-based  
* Core visit information includes:  
  * Student selection from assigned students  
  * Visit date and time picker  
  * Visit type selection  
  * Visit status (Completed/Draft)  
  * Next visit date scheduling  
  * Follow-up required flag  
* Physical visit specific fields:  
  * GPS location capture with accuracy details  
  * Location coordinates storage  
  * Geolocation-based verification  
* Project information includes:  
  * Project/work title (max 200 characters)  
  * Assistance required from institute  
  * Organization's response  
  * Supervisor remarks from organization  
  * Significant changes in project plan (max 300 characters)  
* Observations and feedback:  
  * Student observations (minimum 25 words, max 2000 characters)  
  * Feedback shared with student (minimum 25 words, max 2000 characters)  
* Attachments:  
  * Multiple photos (up to 5, automatically optimized to WebP, max 1200x1200px)  
  * Single signed document (PDF/JPG/PNG/GIF, max 10MB)  
* Visit status rules:  
  * Completed visits require all sections filled  
  * Draft visits allow partial information  
  * Only one visit per student per day allowed  
  * Core fields (date, type, location, student) are locked after creation  
* Visit guidance modal displays:  
  * Reference specific tasks observed  
  * Note what student did well with examples  
  * Give 1-2 precise improvement points and next steps  
  * Connect comments to competency/CO/PO

### **3.3.3 Monthly Reports Management**

As a faculty mentor I have to review and approve monthly reports submitted by students.

Acceptance criteria

* Report statuses include:  
  * Draft: student saved but not submitted  
  * Submitted: submitted for faculty review  
  * Under Review: faculty actively reviewing  
  * Approved: faculty approved  
  * Rejected: faculty rejected with reason  
  * Revision Required: changes needed from student  
* Faculty actions on reports:  
  * View uploaded report PDF with presigned URL  
  * See version history with timestamps and uploader info  
  * View student details associated with report  
  * Approve report with remarks  
  * Reject with mandatory reason (min 10 characters)  
  * Delete reports with confirmation modal  
* Report management features:  
  * Search by student name or roll number  
  * Filter by status (all/submitted/approved/rejected/draft)  
  * Pagination support (default 10 per page)  
  * Sorting by student name, period, submission date  
* Monthly statistics shows:  
  * Expected reports this month (using 10-day rule)  
  * Submitted reports this month  
  * Total/Submitted/Approved/Draft counts  
  * Last updated timestamp

### **3.3.4 Student Progress**

As a faculty mentor I have to monitor progress of my assigned students.

Acceptance criteria

* Student list features:  
  * All assigned students with search  
  * Filter by branch/department  
  * Deduplication by student ID  
  * Student selection for detailed view  
* Student profile shows:  
  * Student name, roll number, branch  
  * Email and phone contact  
  * Profile image display  
  * Applications count, visits count, reports count  
* Student progress dashboard tabs:  
  * Overview tab: active internship status, internship applications (latest 3), recent activity timeline (latest 4 visits), application details with company/role.  
  * Visits tab: all faculty visit logs for student, visit metrics (completed/expected), visit type breakdown, average satisfaction rating, recent visits timeline.  
  * Monthly Feedback: attendance rating (0-5), performance rating (0-5), punctuality rating (0-5), technical skills rating (0-5), overall average calculation, comments/feedback text.  
* Internship management actions:  
  * Edit internship details (status, phase, joining date)  
  * Delete internship with confirmation  
  * Track selection and approval status  
* Monthly report upload on behalf of student:  
  * Month/year selection  
  * File validation (PDF, max 1MB)  
  * For active internships only

### **3.3.5 Self-Identified Internship Approvals**

As a faculty mentor I have to approve self-identified internship applications from my assigned students.

Acceptance criteria

* Application statuses:  
  * Pending Approval: internship phase not active and status not joined  
  * Approved: internship phase is active or status is joined  
* Approval actions include:  
  * View details (modal with full application info)  
  * Approve with joining date (transitions to active phase)  
  * Reject with confirmation (transitions to not started)  
* Approval form includes:  
  * Final status dropdown (Approve or Reject)  
  * Joining date picker (required if approving)  
* Application details displayed:  
  * Student info: name, roll number, branch, email  
  * Company info: name, role/job profile, address  
  * Internship period: duration, stipend, dates  
  * Joining letter (if uploaded) with view button  
  * Additional info: cover letter, other info  
* Statistics cards:  
  * Pending Approval count  
  * Approved count  
  * Total Applications count  
* Tabbed view:  
  * Pending Approval (with badge count)  
  * Approved (with badge count)  
  * All Applications (with badge count)  
* Table columns include:  
  * Student details (name, roll, branch)  
  * Company details (name, role, address)  
  * HR contact (name, phone, email)  
  * Duration and stipend (duration, stipend, start date)  
  * Application date (sortable)  
  * Status tags showing approval/pending/letter status  
  * Actions (view, approve, reject)

### **3.3.6 Joining Letters Management**

As a faculty mentor I have to verify joining letters uploaded by students.

Acceptance criteria

* Letter verification actions:  
  * Verify joining letter with remarks  
  * Reject joining letter with reason  
  * Delete joining letter with confirmation  
  * View letter document with presigned URL  
* Letter upload on behalf of student:  
  * Student selection from dropdown  
  * File upload (PDF/image, max 1MB)  
  * For active internships only  
* Letter details display:  
  * Student information (name, roll, company)  
  * Upload status (pending/verified/rejected)  
  * Upload timestamp and reviewer info  
  * Document viewing with presigned URL  
* Metrics:  
  * Total joining letters count  
  * Uploaded vs expected ratio  
  * Pending count display  
  * "All uploaded" status when 0 pending  
* Search and filter by student name, status.  
* Pagination support.

### **3.3.7 Grievances**

As a faculty mentor I have to respond to grievances raised by my assigned students.

Acceptance criteria

* Grievance statuses:  
  * Submitted/Pending/Under Review: initial states  
  * In Progress: being actively addressed  
  * Resolved/Closed: completion states  
  * Escalated: moved to higher authority  
  * Rejected: faculty rejected grievance  
* Faculty actions:  
  * Respond to grievance: add response text, update status  
  * Escalate grievance: escalate to principal with reason  
  * Reject grievance: reject with reason, changes status to rejected  
  * Update status: manual status updates  
* Escalation chain:  
  * Faculty Mentor (Level 1\)  
  * Principal (Level 2\)  
  * State Directorate (Level 3\)  
* Statistics:  
  * Total grievances count  
  * Pending grievances count  
  * In-progress count  
  * Resolved count  
  * Escalated count  
* Severity levels: Low, Medium, High, Urgent with color coding.  
* Tab filtering works (all/pending/inProgress/resolved/escalated).  
* Timeline shows all updates chronologically.

---

## **3.4 Student**

As a student, I have to manage my internship application, submit monthly reports, upload documents, and track my internship progress.

### **3.4.1 Dashboard**

The student dashboard includes internship status, compliance tracking, mentor information, and action items.

Acceptance criteria

* Dashboard contains welcome banner with personalized greeting and action buttons.  
* Current internship status section displays active internship information with selector for multiple internships.  
* Internship data status card shows:  
  * Completion status: Complete, Pending, or Missing  
  * Pending fields that need to be filled  
  * View action to see details of incomplete fields  
  * For regular internships shows if internship details are linked  
  * For self-identified checks mandatory fields (Company Name, Job Profile, Start Date, End Date)  
* Joining report status card shows:  
  * Status: Uploaded or Pending  
  * Success color if document is uploaded  
  * Upload button to add/replace joining report (PDF format)  
  * Download/View button if uploaded  
  * PDF files only, max 5MB  
* Grievances status card shows:  
  * Total grievance count  
  * Open grievances count  
  * Status indicator (No open / X open)  
* Monthly reports status card shows:  
  * Submitted count vs total expected count  
  * Color coding:  
    * Blue if internship hasn't started yet  
    * Red if overdue reports exist  
    * Yellow if reports are pending  
    * Green if all submitted  
  * Displays pending/overdue months (up to 5 items)  
  * Download format button  
  * Upload report button (shown only after internship starts)  
* Faculty mentor card shows:  
  * Mentor name, email, contact, designation  
  * Faculty visits count  
* Industry supervisor card shows:  
  * Supervisor name, email, contact, designation  
  * Company name  
* Placement interest modal auto-shown until form is filled.

### **3.4.2 Profile Management**

As a student I want to manage my profile information.

Acceptance criteria

* Personal information display:  
  * Roll number, name, email, phone  
  * Date of birth, gender  
  * Address, state, district, tehsil  
* Contact information management:  
  * Masked contact fields for privacy  
  * Reveal functionality via API call  
  * Parent contact information  
* Profile image management:  
  * Avatar upload with image cropping  
  * Automatic optimization and WebP conversion  
  * Supports JPEG, PNG, GIF, WebP  
* Educational information:  
  * Institution details  
  * Course/program information  
  * Semester/year details  
* Document management:  
  * Upload multiple documents  
  * Document type selection  
  * View/delete documents  
  * Document listing with metadata

### **3.4.3 My Internship (Applications)**

As a student I want to view and manage my internship applications.

Acceptance criteria

* Applications list view shows table displaying all self-identified applications.  
* List includes status column (Applied, Approved, Withdrawn, etc.) and application metadata.  
* Application details view contains tabs:  
  * Application Details tab: shows internship information, company details, dates.  
  * Application Progress tab: tracks application status changes.  
  * Application Timeline tab: visual timeline of key events.  
  * Application Feedback tab: faculty feedback and review comments.  
* Monthly reports section within application details:  
  * Displays reports for specific application  
  * Upload/delete reports per application  
  * Report status tracking  
* Faculty visits section:  
  * Shows faculty visits for the internship  
  * Visit date, faculty name, duration, remarks  
  * Visit count progression  
* Actions include:  
  * View detailed application information  
  * Refresh application data  
  * Navigate to submit reports  
  * Delete/manage reports  
  * Withdraw application option

### **3.4.4 Add Internship (Self-Identified)**

As a student I want to submit a self-identified internship application.

Acceptance criteria

* Internship information form includes:  
  * Company name (with autocomplete dropdown from master list)  
  * Job profile/title  
  * Start date picker  
  * End date picker  
  * Internship duration auto-calculation  
* Company details:  
  * Company address  
  * Company contact information  
  * Company email  
* Supervisor/HR information:  
  * HR/Supervisor name  
  * HR/Supervisor contact  
  * HR/Supervisor email  
  * HR/Supervisor designation  
* Faculty mentor assignment:  
  * Faculty mentor selection from dropdown  
  * Mentor email/contact auto-populated  
  * Mentor designation  
* Joining letter upload:  
  * File upload (PDF format)  
  * File size validation  
  * Preview/download functionality  
* Validation rules:  
  * Company name required  
  * All date fields required  
  * Faculty mentor must be selected  
  * Duration calculated from dates  
  * PDF joining letter required  
  * Student cannot have multiple active internships

### **3.4.5 Monthly Report Submission**

As a student I have to submit monthly reports during my internship.

Acceptance criteria

* Report selection includes:  
  * Application selector dropdown (shows active internships)  
  * Month selector (auto-detects current month)  
  * Year selector (current year \+ 5 previous years)  
  * Auto-month detection toggle  
  * Month filtering based on internship date range  
* Allowed months calculation:  
  * Restricts available months to internship start and end dates  
  * Only shows months within the selected year that fall within internship period  
  * Updates month options when year or application changes  
* Report upload modal:  
  * Monthly report guideline modal confirmation  
  * Link to PDF guideline  
  * File upload field  
  * Before-upload validation  
  * File size max 1MB  
* Report guidelines shows official monthly report format guideline with links to downloadable PDF format template.  
* Report management:  
  * Upload report as draft  
  * Edit existing reports  
  * Delete reports  
  * View submitted reports  
  * Track report versions

### **3.4.6 Document Management**

As a student I have to upload and manage my documents.

Acceptance criteria

* Document upload:  
  * Multiple file types supported  
  * Custom document type selection  
  * File size validation  
  * Progress tracking  
* Document retrieval:  
  * List all student documents  
  * Filter by document type  
  * Pagination support  
  * Date tracking (upload, modification)  
* Document deletion:  
  * Delete specific document  
  * Cascade cleanup from storage  
* Joining letter upload:  
  * PDF format only  
  * Max 5MB file size  
  * Replaces previous version  
  * Delete option available

### **3.4.7 Submit Grievance**

As a student I want to submit grievances related to my internship.

Acceptance criteria

* Grievance form includes:  
  * Category selection dropdown:  
    * Internship Related  
    * Mentor Related  
    * Industry Related  
    * Payment Issue  
    * Workplace Harassment  
    * Work Condition  
    * Safety Concern  
    * Other  
  * Priority selection:  
    * Low (green)  
    * Medium (orange)  
    * High (red)  
    * Urgent (magenta)  
  * Subject/Title field  
  * Description/Details textarea  
  * Escalation level selection  
* Grievance list display:  
  * Table showing all submitted grievances  
  * Columns: ID, Subject, Category, Status, Priority, Date  
  * Status indicators with icons  
* Grievance details view:  
  * Drawer/modal showing full grievance details  
  * Timeline of status changes  
  * Mentor assignment information  
  * Resolution notes/feedback  
  * History of updates  
* Auto-assignment:  
  * Grievance auto-assigned to assigned faculty mentor  
  * Mentor validation before submission

### **3.4.8 Placement Interest Form**

As a student I have to fill the placement interest form.

Acceptance criteria

* Plan after diploma selection:  
  * Private Job  
  * B.Tech \- Higher Education  
  * Govt Job Preparation  
  * Visual option cards with selection highlighting  
* Conditional fields shown only if Private Job selected:  
  * Job location preference: Within Punjab, Outside Punjab  
  * Expected salary range: Rs 10,000-15,000, Rs 15,000-20,000, Rs 20,000+  
* Form management:  
  * Modal is non-dismissible until form is submitted  
  * Appears on first dashboard visit  
  * Status check endpoint to verify if already filled  
  * Update capability for existing form  
* Validation rules:  
  * Plan after diploma required  
  * Job location required if Private Job selected  
  * Expected salary required if Private Job selected

