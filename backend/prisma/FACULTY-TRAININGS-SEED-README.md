# Faculty Trainings 2026 Seed Script

This document explains how to seed faculty trainings from the FDP 2026 Annual Training Plan Excel file.

## Prerequisites

1. **Install the xlsx package** (for reading Excel files):
   ```bash
   cd d:\placeintern\backend
   npm install xlsx
   npm install @types/xlsx --save-dev
   ```

2. **Ensure the Excel file is in the correct location**:
   - The script expects the file at: `D:\chrome download\FDP 2026 Annual Training Plan (Final) .xlsx`
   - Or update the `EXCEL_FILE_PATH` constant in `seed-faculty-trainings-2026.ts` to point to your file location

## Expected Excel File Structure

The seed script is flexible and will try to match various column names. Here are the supported column names (case-insensitive):

### Required Columns:
- **Title** (or "Training Title", "Program Name")
- **Start Date** (or "From Date", "From", "Date")
- **Capacity** (or "Max Participants", "Seats") - defaults to 50 if missing

### Optional Columns:
- **End Date** (or "To Date", "To") - defaults to Start Date if missing
- **Application Deadline** (or "Deadline", "Last Date") - defaults to 7 days before start date if missing
- **Description** (or "Details", "About")
- **Provider** (or "Provided By", "Organizing Body")
- **Trainer Name** (or "Trainer", "Resource Person")
- **Trainer Bio** (or "Trainer Details")
- **Trainer Contact** (or "Contact")
- **Duration** (or "Hours", "Duration (Hours)") - in hours
- **Delivery Mode** (or "Mode", "Training Mode") - ONLINE/OFFLINE/HYBRID
- **Difficulty** (or "Level") - BEGINNER/INTERMEDIATE/ADVANCED
- **Venue** (or "Location")
- **Address**
- **City**
- **State**
- **Meeting Link** (or "Online Link")
- **Prerequisites** (or "Pre-requisites")
- **Cost** (or "Fee", "Registration Fee")
- **Learning Outcomes** (or "Outcomes", "Objectives") - semicolon or comma separated
- **Designation** (or "For", "Target Audience")

### Example Excel Structure:

| Title | Start Date | End Date | Duration | Capacity | Delivery Mode | Trainer Name | Provider | City | State | Difficulty |
|-------|------------|----------|----------|----------|---------------|--------------|----------|------|-------|------------|
| Advanced Python Programming | 2026-03-15 | 2026-03-17 | 24 | 30 | ONLINE | Dr. John Smith | IIT Bombay | Mumbai | Maharashtra | ADVANCED |
| Introduction to AI | 2026-04-10 | 2026-04-12 | 18 | 50 | HYBRID | Prof. Jane Doe | NPTEL | Delhi | Delhi | BEGINNER |

## Running the Seed Script

1. **Navigate to the backend directory**:
   ```bash
   cd d:\placeintern\backend
   ```

2. **Run the seed script**:
   ```bash
   npm run seed:faculty-trainings-2026
   ```

3. **Check the output**:
   - The script will show progress for each training
   - It will display a summary at the end:
     - Total trainings found in Excel
     - Number created
     - Number updated (if training already exists)
     - Number skipped (if errors occurred)

## How It Works

1. **Reads the Excel file** using the `xlsx` library
2. **Parses each row** and maps columns to the Training model fields
3. **Checks for existing trainings** by matching title and start date
4. **Creates new trainings** or **updates existing ones** in the database
5. **Handles date formats**:
   - Excel serial dates (e.g., 44621)
   - String dates (e.g., "2026-03-15", "15-03-2026", "15/03/2026")
6. **Sets defaults** for missing optional fields

## Troubleshooting

### Error: "Cannot find module 'xlsx'"
**Solution**: Install the xlsx package:
```bash
npm install xlsx
```

### Error: "No active user found to assign as createdById"
**Solution**: Ensure you have at least one active user in the database (preferably SYSTEM_ADMIN or STATE_DIRECTORATE role)

### Error: "Failed to parse Excel file"
**Possible causes**:
1. File path is incorrect - update `EXCEL_FILE_PATH` in the script
2. File is password-protected - remove password protection
3. File is corrupted - re-download or repair the file
4. File format is not .xlsx - convert to .xlsx format

### Training dates are incorrect
**Solution**: Check your Excel date format. The script supports:
- Excel serial dates (numeric)
- ISO dates (YYYY-MM-DD)
- Common formats (DD-MM-YYYY, DD/MM/YYYY)

### Some trainings are skipped
**Solution**: Check the console output for specific error messages. Common issues:
- Invalid dates
- Missing required fields (title, capacity)
- Database constraints (unique keys, foreign keys)

## Customizing the Script

If your Excel file has different column names, you can modify the `parseExcelFile()` function in `seed-faculty-trainings-2026.ts`:

```typescript
// Example: If your Excel uses "Programme Title" instead of "Title"
title: (row['Programme Title'] || row['Title'] || row['Training Title'] || `Training ${index + 1}`).toString(),
```

## Database Schema Reference

The Training model includes:
- **Basic Info**: title, description
- **Provider**: providedBy, trainerName, trainerBio, trainerContact
- **Schedule**: startDate, endDate, startTime, endTime, duration, applicationDeadline
- **Location**: deliveryMode, venue, address, city, state, meetingLink
- **Capacity**: capacity, prerequisites, difficulty
- **Cost**: cost (optional)
- **Learning**: learningOutcomes (JSON array)
- **Target**: designation (target audience)
- **Status**: isActive, isPublished
- **Relations**: feedbackForm, preTestForm, postTestForm, targetBranches

## Post-Seeding Tasks

After successfully seeding trainings, you may want to:

1. **Link trainings to target branches** (if you have branch-specific trainings)
2. **Assign feedback forms** to trainings
3. **Set up pre-test and post-test forms** for assessments
4. **Review and adjust** application deadlines
5. **Publish trainings** for faculty to apply (if not auto-published)

## Support

If you encounter issues not covered in this README, check:
1. The console output for detailed error messages
2. The database logs
3. The Prisma schema at `prisma/schema.prisma`
4. The seed file at `prisma/seed-faculty-trainings-2026.ts`
