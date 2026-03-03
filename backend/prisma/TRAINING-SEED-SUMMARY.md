# Faculty Training Seed Summary

## Seeding Results

**Date:** 2026-03-03
**Total Trainings Created:** 61
**Status:** ✓ Success

## Monthly Distribution

| Month | Count | Details |
|-------|-------|---------|
| Oct 2026 | 6 | Mentoring, IPR, Quality Control trainings |
| Nov 2026 | 6 | Workplace skills, AI tools, Data handling |
| Dec 2026 | 4 | Data analytics, Fashion forecasting |
| Jan 2027 | 2 | Professional Readiness, Mathematics Bridge |
| Feb 2027 | 10 | Design thinking (5 batches), Data Science (3 batches), AutoCAD |
| Mar 2027 | 4 | Cyber Security, Product Design, Pattern Making, Textiles |
| Apr 2027 | 7 | Soft skills, Public Speaking, Leadership, RTI |
| May 2027 | 3 | AutoCAD, Electronic Systems, Medical diagnostics |
| Jun 2027 | 3 | Industry linkages, Arduino, Immunoassays |
| Jul 2027 | 6 | AI & Python, Industrial Automation, Quality Control |
| Aug 2027 | 4 | Architecture, Leather Tech, Drug Discovery, Automation |
| Sep 2027 | 6 | CAD-CAM, Office Automation, Pharma AI, Quality Control |

## Data Extracted from Excel

### Columns Mapped:
1. **Tentative Month** → `startDate` and `endDate` calculation
2. **Training Topic** → `title`
3. **Eligible Participants** → `designation` (target audience)
4. **Number of Trainees** → `capacity`
5. **Duration** → `duration` (converted to hours)
6. **Proposed Dates** → `startDate` and `endDate` (precise dates)
7. **Prefered Partner Institution** → `providedBy`
8. **Budget** → `cost` (0 for free trainings)
9. **Location** → `venue` and `city`
10. **Intended Objective/Outcomes** → `learningOutcomes`

### Additional Fields Set:
- **state**: "Punjab" (all trainings)
- **deliveryMode**: OFFLINE (default, can be changed to ONLINE/HYBRID)
- **difficulty**: INTERMEDIATE (auto-detected from participants field)
- **applicationDeadline**: 7 days before start date
- **isActive**: true
- **isPublished**: true

## Training Categories

The trainings were grouped by categories (used as `description` field):

1. **Professional Development & Workplace/Soft Skill**
   - Professional Readiness Module
   - Design thinking and startup lifecycle (5 batches)
   - Public Speaking
   - Soft skills for faculty (2 batches)
   - Workplace professionalism (2 batches)

2. **Leadership & Mentorship Training**
   - Principal's Leadership Training
   - Middle Leadership training programme
   - Mentoring first-generation learners (2 batches)

3. **Administrative Related Training**
   - Office Management and Procedure
   - Building industry linkages
   - Audit & Budget
   - Intellectual Property Rights

4. **Digital & General Skill**
   - Data handling and analytics (3 batches)
   - Industrial visits (Tata Steel, Trident Group)

5. **Technical Training**
   - Big Data & Data Science (3 batches)
   - Auto CAD (multiple batches)
   - Cyber Security
   - Product Design
   - Digital Pattern Making
   - Electronic System Design (2 batches)
   - AI & Python (2 batches)
   - Industrial Automation & PLC/SCADA (2 batches)
   - CAD-CAM integration (4 batches)
   - And many more specialized technical trainings

## Notable Training Providers

- Wadhwani Foundation
- Innovation Mission Punjab
- PSBTE&IT (Punjab State Board of Technical Education)
- Various Govt. Polytechnic Colleges
- Industry partners (Tata Steel, Trident Group)
- Various academic institutions

## Training Duration

- **Short Duration**: 2-3 days (16-24 hours)
- **Medium Duration**: 3-5 days (24-40 hours)
- **Long Duration**: 1-2 weeks (40-80 hours)

Most trainings are 2-3 days in duration.

## Capacity Range

- **Small Batches**: 12-20 participants
- **Medium Batches**: 25-30 participants
- **Large Batches**: 35-50 participants

Total capacity across all trainings: ~1,800+ faculty members

## Cost Structure

- **Free Trainings**: Most trainings are marked as "Free of Cost"
- **Paid Trainings**: Some specialized trainings may have costs (to be verified)

## Next Steps

1. **Review Training Details**: Verify dates, venues, and capacities
2. **Link to Branches**: Associate trainings with target branches (Computer Science, Civil, Mechanical, etc.)
3. **Assign Feedback Forms**: Link the Faculty Training Feedback Form to all trainings
4. **Set Up Pre/Post Tests**: Create assessment forms for relevant trainings
5. **Configure Application Process**: Set up approval workflows for applications
6. **Publish Trainings**: Make trainings visible to faculty for applications
7. **Monitor Applications**: Track capacity and manage waitlists

## Database Schema Coverage

✅ **Fields Populated:**
- title
- description (category)
- providedBy
- startDate
- endDate
- duration
- applicationDeadline
- deliveryMode
- venue
- city
- state
- capacity
- difficulty
- cost
- learningOutcomes
- designation
- isActive
- isPublished
- createdById
- **feedbackFormId** ✨ **NEW: Automatically linked to "Faculty Training Feedback" form**

⚠️ **Fields Not Populated** (can be added later):
- trainerName
- trainerBio
- trainerContact
- startTime / endTime
- address
- meetingLink
- prerequisites
- preTestFormId
- postTestFormId
- targetBranches (relation)

## Running the Seed Again

To re-run the seed script (will update existing trainings):
```bash
npm run seed:faculty-trainings-2026
```

The script will:
- **Update** existing trainings (matched by title + startDate)
- **Create** new trainings that don't exist
- **Skip** trainings that encounter errors

## Troubleshooting

If you need to:
1. **Delete all seeded trainings**: Use Prisma Studio or SQL
2. **Modify training details**: Edit Excel file and re-run seed
3. **Add missing fields**: Update seed script to parse additional columns
4. **Change date formats**: Adjust `parseDateRange()` function

## Notes

- Some trainings have multiple batches (e.g., "Design thinking" has 5 batches)
- Dates parsed from "16th - 17th Feb" format
- Duration converted from "3 days" to 24 hours (8 hours/day)
- Application deadline set to 7 days before training start
- All trainings set as active and published
