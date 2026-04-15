**Training Calendar \- SRS**

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
**3.1.1 Dashboard**

### As a State-Level Administrator, I want to check overall stats related to the training like total training, application, lesson plans, feedback forms etc.

Acceptance Criteria

* Stat cards at the top of the page to display overview about the training features.   
  * Trainings: shows published, conducted, hours delivered matrix  
  * Faculty Trainings: includes applied, completed and ongoing matrices  
  * Lesson Plan: showing how many plans were created  
  * Completion and Hours: showing how many faculties complete their 40 hours and average hours per faculty  
* Quick access(navigation) from these stat cards  
* Course Wise No. of Faculty distribution table which shows course wise faculty, completed trainings and feedback submitted count.

**3.1.2 Manage Trainings**	

### As a State-Level Administrator, I want to manage the Training List so that I can maintain an accurate and up-to-date catalog of available trainings for all faculties.

Acceptance Criteria

* A paginated and searchable listing interface which display all trainings.  
* Listing should contain training name,dates,mode,status,Actions.  
* User can view the training list in **tabular** and **calendar** views.  
* User can add a new training with mandatory fields validated.  
* Newly added training appears in both tabular and calendar views.  
* Training defaults to Inactive unless activated.  
* Add feedback form from the list dropdown to add training feedback form  
* User can edit existing training details.  
* Changes are saved and reflected immediately in both views.  
* User can activate or deactivate a training.  
* Active trainings are visible in the calendar view.  
* Deactivated trainings are not shown in the calendar but remains in the tabular list with status.  
* Add form to capture following information:  
  * Training Title  
  * Description  
  * Training Provider  
  * Mentor Name  
  * Mentor Email  
  * Venue  
  * Meeting Link (for online)  
* If no branch is selected then the training should be visible to all the faculties.  
* In the training list it contains various actions including view, attendance, test, feedback, edit, status.  
* The view action button is color coded. It shows red if the application for that training is pending and if the application is all approved then it shows the green colored icon.  
* Test and feedback action button redirect to a detailed page for showing list of the responses and feedback from the faculties.

**3.1.3 Manage Test Forms**

### As a State-Level Administrator, I want to manage Test forms ( both pre and post test forms)

Acceptance Criteria

* User can add test form template as there need with different type of questions sets  
* They can publish to training so that the faculty can fill out the test form.  
* Pre test is to be filled before the training starts and post test is to be filled after the training completed.  
* User can edit as per there need  
* User can view the list of responses submitted by the faculties.

**3.1.4 Manage Feedback Forms**

### As a State-Level Administrator, I want to manage Feedback forms 

Acceptance Criteria

* User can add feedback form template as there need with different type of questions sets  
* They can publish to training so that after training the faculty can fill out the form  
* User can edit as per there need  
* User can view the list of responses submitted by the faculties 

**3.1.5 Lesson Plans**

### As a State-Level Administrator, I want to check lesson plans

Acceptance Criteria

* User can view the faculty submitted lesson plans.  
* They can review lesson plans and make them approve, reject it.


**3.2 Principal**  
**3.2.1 Overview**

### As a Principal, I want to check all the trainings, stat cards for display details from all over the institute like total training, application from their institution.

Acceptance Criteria

* User can view the stat cards for the trainings, faculty trainings, completion metrics, hours distribution.   
* User can view the list of the enrolled faculties trainings and easily navigate on click to their detail page.  
* Training list shows the training name, training date, mode, enrolled faculty and action columns.  
* Enrolled faulty shows faculty name in comma separated way.  
* Actions items includes view attendance, view test responses, view feedback, view lesson plans.  

**3.2.2 Applications**

### As a Principal, I want to check all the trainings application from their institute faculty members. Also i can approve and reject the applications. 

Acceptance Criteria

* User can view list of the application submitted by the faculty and from view action i can check full detail of the application.  
* User can approve and reject the applications.

**3.2.3 Lesson plans**

### As a Principal, I want to check all the lesson plans submitted by their institute faculty members. Also i can approve and reject the lesson plans. 

Acceptance Criteria

* User can view a list of the lesson plans submitted by the faculty and from view action i can check full detail of the lesson plans.  
* User can approve and reject the lesson plans.

**3.2.4 Recommended Trainings**

### As a Principal, I want to check all the recommended training from their institute faculty members. Also i can approve and reject the applications. 

Acceptance Criteria

* User can view the list of the recommended training submitted by the faculty and from view action i can check full detail of the training.  
* User can approve and reject the training.

**3.3 Faculty**  
**3.3.1 Dashboard**

### As a Faculty, I want to check all the available trainings, my enrollments, pending actions.

Acceptance Criteria

* Stat card at the top of the page to display training hours completed, trainings attended, pending actions count.  
* Easy mark attendance card to show only the training that I enrolled and today is start date. And if the training is for multiple days it can mark from that section.  
* Trainings Attended card show the enrolled trainings, user can view. It only appears when you mark the attendance for that training.  
* Pending action card show pending actions like submit feedback, pre and post form fill user can directly click on that and do things accordingly.  
* All the stats and response are shown after you successfully mark the attendance. 

**3.3.2 Calender**

### As a Faculty, I want to view and apply for Training

Acceptance Criteria

* A paginated and searchable listing interface which display all eligible trainings.  
* Listing should contain training name,dates,mode,status,Actions.  
* User can view the training list in **tabular** and **calendar** views.  
* Newly added eligible training appears in both tabular and calendar views.  
* User can click on training to view detailed view of the training.  
* User can apply for training in the detail view of the training

**3.3.3 My Application**

### As a Faculty, I want to view applied trainings

Acceptance Criteria

* A paginated and searchable listing interface which display all applied trainings.  
* Listing should contain training name,status,applied date, Actions.  
* User can click on eye icon to view detailed view of the training.  
* User can also mark attendance by click on check mark action button.  
* User can add feedback and lesson plans after the completion of the training.

**3.3.4 Lesson plans**

### As a Faculty, I want to add lesson plans as this is mandatory for all.

Acceptance Criteria

* A paginated and searchable listing interface which display all lesson plans for the training.  
* Listing should contain lesson plans name, training name, proposed for which semester dates,update date status,Action.  
* They can filter out based on the status (draft, approved, inreview, all).  
* User can create new lesson plan by selecting the training and also can edit it.

**3.3.5 Recommend Training**

### As a Faculty, I want to recommend training.

Acceptance Criteria

* A paginated listing interface which display all recommended training that they have created.  
* Listing should contain lesson plans training name, priority, status, submitted, Action.  
* They can filter out based on the status (all, pending, reviewed).  
* User can create new recommend training and also  can edit it.  
* User can also view their recommend training details

**3.4 Faculty coordinator**  
Faculty coordinator is the one who can manage training as of state but only their branch wise scope. And also they can access to training enrollment like other faculties

**3.4.1 Manage Trainings**

### As a faculty coordinator, I want to manage the Training List so that I can maintain an accurate and up-to-date catalog of available training for all faculties of their branch.

Acceptance Criteria

* Fours stat card for quick analytics same as state training dashboard. Includes trainings, faculty trainings, lesson plan, completion hours matrices.  
* A paginated and searchable listing interface which display all trainings.  
* Listing should contain training name,dates,mode,status,Actions.  
* User can view the training list in **tabular** and **calendar** views.  
* User can add a new training with mandatory fields validated.  
* Newly added training appears in both tabular and calendar views.  
* Training defaults to Inactive unless activated.  
* Add feedback form from the list dropdown to add training feedback form  
* User can edit existing training details.  
* Changes are saved and reflected immediately in both views.  
* User can activate or deactivate a training.  
* Active trainings are visible in the calendar view.  
* Deactivated trainings are not shown in the calendar but remains in the tabular list with status.  
* Add form to capture following information:  
  * Training Title  
  * Description  
  * Training Provider  
  * Mentor Name  
  * Mentor Email  
  * Venue  
  * Meeting Link (for online)  
* If no branch is selected then the training should be visible to all the faculties.  
* In the training list it contains various actions including view, attendance, test, feedback, edit, status.  
* The view action button is color coded. It shows red if the application for that training is pending and if the application is all approved then it shows the green colored icon.  
* Test and feedback action button redirect to a detailed page for showing list of the responses and feedback from the faculties.

**3.4.2 Review Applications**  
As faculty coordinator it review applications 

Acceptance criteria 

* Users can see the applications for the training within their branch scope only. They can approve, reject it.

**3.4.2 Review Lesson plans**  
As faculty coordinator it review Lesson plans

Acceptance criteria 

* Users can see the lesson plan submitted by faculties. They can approve, reject or change needs.

**3.4.3 Manage Test Forms**

### As a State-Level Administrator, I want to manage Test forms ( both pre and post test forms)

Acceptance Criteria

* User can add test form template as there need with different type of questions sets  
* They can publish to training so that the faculty can fill out the test form.  
* Pre test is to be filled before the training starts and post test is to be filled after the training completed.  
* User can edit as per there need  
* User can view the list of responses submitted by the faculties.

**3.4.4 Manage Feedback Forms**

### As a State-Level Administrator, I want to manage Feedback forms 

Acceptance Criteria

* User can add feedback form template as there need with different type of questions sets  
* They can publish to training so that after training the faculty can fill out the form  
* User can edit as per there need  
* User can view the list of responses submitted by the faculties 

**3.4.5 Training Recommendations**

### As a Faculty Coordinator, I want to see training recommendations submitted by faculties. 

Acceptance Criteria

* Users can view the recommendations training so that they can accept or reject them.

**3.4.6 Send Reminders**

### As a Faculty Coordinator, I want to send reminders to faculties.

### Acceptance Criteria

* Users can view the list of the reminders tabs like enrollments, pre test, post test, lesson plan and feedback.   
* Through the first section. click on send reminder it sends the reminder for all faculties of the branch. If they select the pre-test tab then it sends a reminder regarding the pre test only.  
* The section shows the list of the faculties they can select any of the faculty and select the reminder type and click on send reminder.  
* This reminder can be either in-app or email.

### **Appendix A: Sample Training Calendar Entry**

**Title:** Advanced CNC Programming with Industry-Grade Software  
 **Discipline:** Mechanical Engineering  
 **Trainer:** \[Industry Partner Name\]  
 **Date:** March 15-17, 2026  
 **Duration:** 24 hours (3 days)  
 **Location:** Training Lab, Campus Building 3  
 **Capacity:** 40 faculty  
 **Delivery Mode:** In-person with laptop requirements  
 **Learning Outcomes:** 1\. Master advanced CNC programming techniques 2\. Operate modern CNC machines and software 3\. Troubleshoot common machining issues 4\. Apply industry standards to classroom projects 5\. Create engaging hands-on labs for students

**Prerequisites:** Basic CNC knowledge desirable  
 **Costs:** Covered by institutional training budget  
 **Application Deadline:** March 1, 2026

### **Appendix B: Sample Feedback Form Questions**

1\.           How relevant was this training to your teaching discipline? (1-5 scale)

2\.           Please rate the overall quality of the trainer and content delivery (1-5 scale)

3\.           How applicable is what you learned to your students’ learning needs? (1-5 scale)

4\.           Did you achieve the stated learning outcomes? (Yes/No/Partially)

5\.           How current/industry-aligned was the content covered? (1-5 scale)

6\.           What are your 3 key takeaways from this training?

7\.           What could be improved in this training?

8\.           What topics would you like to see in future trainings?

9\.           Did this training include direct input from active industry practitioners? (Yes/No)

10\.        Would you recommend this training to colleagues? (Yes/No)

### **Appendix C: Sample Lesson Plan Template**

 **Faculty Name:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_  
 **Training Attended:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_  
 **Discipline:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_  
 **Course/Semester:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

**1\. Connection Between Training & Lesson Plan**  
 Describe how your training learning directly connects to the lesson plan you are designing for your students.

**2\. Learning Objectives**  
 List 3-5 specific learning objectives students will achieve using the new skills/technologies from your training.

**3\. New Skills/Technologies Introduced**  
 What new technical skills or industry tools will your students learn?

**4\. Classroom Delivery Methods**  
 How will you teach this content? (Lectures, labs, projects, demonstrations, etc.)

**5\. Hands-On Activities**  
 Describe 2-3 specific hands-on activities students will complete that align with industry practice.

**6\. Assessment Methods**  
 How will you assess student mastery of these new skills? (Quizzes, projects, presentations, etc.)

**7\. Industry Connections**  
 What real-world examples, case studies, or industry partnerships are integrated into this lesson?

**8\. Resource Requirements**  
 What equipment, software, or industry partnerships are needed to deliver this lesson?

**9\. Implementation Timeline**  
 When will this lesson be taught? (Week/month of semester, duration)

**10\. Expected Student Outcomes**  
 How do you expect this lesson to improve student preparedness for internships/employment?

