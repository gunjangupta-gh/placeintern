# Faculty Training Feedback Form Linking

## Overview

All 61 faculty trainings have been automatically linked to the **Faculty Training Feedback** form during the seeding process.

## Verification Results

✅ **100% Coverage**
- Total trainings: **61**
- With feedback form: **61** ✓
- Without feedback form: **0**

## Feedback Form Details

**Form ID:** `cf92db9b-b466-4bcd-89c4-4ae6ea47203c`
**Form Title:** Faculty Training Feedback
**Purpose:** TRAINING
**Total Questions:** 14

### Questions Included:

1. **Relevance of the training content to your teaching needs** (Rating 1-5)
2. **Quality of training materials provided** (Rating 1-5)
3. **Knowledge and expertise of the trainer(s)** (Rating 1-5)
4. **Clarity of explanation / communication skills** (Rating 1-5)
5. **Balance between theory and practical examples** (Rating 1-5)
6. **Engagement and interaction during sessions** (Rating 1-5)
7. **Time management of sessions** (Rating 1-5)
8. **Usefulness of hands-on / practical exercises** (Rating 1-5)
9. **What were your key learnings from this training?** (Text)
10. **How do you plan to apply this knowledge in your teaching?** (Text)
11. **Did the training meet your initial expectations?** (Single Select)
12. **What can be improved in future trainings?** (Text - Optional)
13. **Any specific topics you would like covered in future?** (Text - Optional)
14. **Details of the equipment/machinery required for implementation** (Text - Optional)

## How It Works

### During Training Seed

The seed script (`seed-faculty-trainings-2026.ts`) automatically:

1. **Finds the feedback form** by title and purpose
   ```typescript
   const feedbackForm = await prisma.feedbackForm.findFirst({
     where: {
       title: 'Faculty Training Feedback',
       purpose: 'TRAINING',
     },
   });
   ```

2. **Links it to each training** during creation/update
   ```typescript
   await prisma.training.create({
     data: {
       ...trainingData,
       feedbackFormId: feedbackForm.id, // Auto-linked
     },
   });
   ```

### Manual Linking

If you need to link the feedback form to trainings manually later, use:

```bash
npm run seed:link-feedback-to-trainings
```

This script will:
- Find the Faculty Training Feedback form
- Find all trainings without a feedback form
- Link them automatically

## Verification Commands

### Check Feedback Form Links
```bash
npx ts-node prisma/check-feedback-links.ts
```

Output:
- Total trainings count
- Trainings with feedback form
- Trainings without feedback form
- Sample trainings with form status

### Verify All Training Data
```bash
npm run seed:verify-trainings
```

Output includes:
- Training details
- Provider statistics
- Delivery mode breakdown
- Capacity summary
- Free vs Paid trainings

## Feedback Form Flow

1. **Faculty applies for training** → Application submitted
2. **Admin approves application** → Faculty can attend
3. **Training is conducted** → Faculty attends training
4. **Post-training feedback** → Faculty fills the linked feedback form
5. **Admin reviews feedback** → Improves future trainings

## Benefits of Auto-Linking

✅ **Consistency**: All trainings use the same feedback form
✅ **No Manual Work**: Automatically linked during seeding
✅ **Easy Updates**: Re-run seed to update existing trainings
✅ **Feedback Ready**: Trainings are ready for feedback collection immediately

## Customizing Feedback Forms

If you want to use different feedback forms for specific trainings:

1. **Create additional feedback forms** using the feedback form module
2. **Manually update specific trainings** in Prisma Studio or via script:
   ```typescript
   await prisma.training.update({
     where: { id: 'training-id' },
     data: { feedbackFormId: 'custom-form-id' },
   });
   ```

## Pre-Test and Post-Test Forms

Currently, trainings do NOT have pre-test or post-test forms linked. To add these:

1. **Create pre-test/post-test forms** (similar to feedback forms)
2. **Update the seed script** to link them:
   ```typescript
   await prisma.training.create({
     data: {
       ...trainingData,
       feedbackFormId: feedbackForm.id,
       preTestFormId: preTestForm?.id,  // Add this
       postTestFormId: postTestForm?.id, // Add this
     },
   });
   ```

## Troubleshooting

### Issue: Trainings have no feedback form

**Solution:**
```bash
npm run seed:link-feedback-to-trainings
```

### Issue: Feedback form not found

**Solution:**
```bash
npm run seed:faculty-training-feedback
```

### Issue: Need to update feedback form questions

**Solution:**
1. Edit `prisma/seed-faculty-training-feedback-form.ts`
2. Run: `npm run seed:faculty-training-feedback`
3. The form will be updated (trainings will still be linked)

## Database Relations

```
Training (61 records)
    ↓ (feedbackFormId)
FeedbackForm (1 record: "Faculty Training Feedback")
    ↓ (questions)
Questions (14 questions: ratings, text, single select)
    ↓ (responses)
FeedbackResponse (after faculty submit feedback)
```

## Next Steps

1. ✅ **Feedback forms are linked** - Done automatically
2. 🔲 **Add pre-test forms** - For assessing prerequisites knowledge
3. 🔲 **Add post-test forms** - For assessing learning outcomes
4. 🔲 **Link target branches** - Associate trainings with specific branches
5. 🔲 **Add trainer details** - Update with trainer names and bios
6. 🔲 **Configure reminders** - Send feedback reminders after training
7. 🔲 **Set up analytics** - Dashboard for feedback analysis

## Resources

- Feedback Form Seed: `prisma/seed-faculty-training-feedback-form.ts`
- Training Seed: `prisma/seed-faculty-trainings-2026.ts`
- Link Script: `prisma/link-feedback-to-trainings.ts`
- Verification Script: `prisma/check-feedback-links.ts`
