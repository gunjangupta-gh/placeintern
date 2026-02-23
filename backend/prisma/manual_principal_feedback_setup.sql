CREATE TABLE IF NOT EXISTS public.principal_feedbacks (
  id text PRIMARY KEY,
  "principalId" text NOT NULL,
  "institutionId" text,
  "visitLocation" text,
  "visitDate" timestamp(3),
  "visitDuration" text,
  "visitType" "VisitType" NOT NULL DEFAULT 'PHYSICAL',
  status "VisitLogStatus" NOT NULL DEFAULT 'SCHEDULED',
  "studentPerformance" text,
  "workEnvironment" text,
  "skillsDevelopment" text,
  "attendanceStatus" text,
  "workQuality" text,
  "responseFromOrganisation" text,
  "observationsAboutStudent" text,
  "observationsAboutIndustry" text,
  "studentProgressRating" integer,
  "industryCooperationRating" integer,
  "workEnvironmentRating" integer,
  "mentoringSupportRating" integer,
  "overallSatisfactionRating" integer,
  "issuesIdentified" text,
  recommendations text,
  "actionRequired" text,
  "visitPhotos" text[] NOT NULL DEFAULT '{}',
  "meetingMinutes" text,
  "attendeesList" text[] NOT NULL DEFAULT '{}',
  "filesUrl" text,
  "reportSubmittedTo" text,
  "followUpRequired" boolean NOT NULL DEFAULT false,
  "nextVisitDate" timestamp(3),
  "visitMonth" integer,
  "visitYear" integer,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isDeleted" boolean NOT NULL DEFAULT false,
  "deletedAt" timestamp(3)
);

CREATE TABLE IF NOT EXISTS public.principal_feedback_students (
  id text PRIMARY KEY,
  "principalFeedbackId" text NOT NULL,
  "studentId" text NOT NULL,
  "isPresent" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT principal_feedback_students_unique UNIQUE ("principalFeedbackId", "studentId")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'principal_feedbacks_principalId_fkey') THEN
    ALTER TABLE public.principal_feedbacks
      ADD CONSTRAINT principal_feedbacks_principalId_fkey
      FOREIGN KEY ("principalId") REFERENCES public."User"(id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'principal_feedbacks_institutionId_fkey') THEN
    ALTER TABLE public.principal_feedbacks
      ADD CONSTRAINT principal_feedbacks_institutionId_fkey
      FOREIGN KEY ("institutionId") REFERENCES public."Institution"(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'principal_feedback_students_principalFeedbackId_fkey') THEN
    ALTER TABLE public.principal_feedback_students
      ADD CONSTRAINT principal_feedback_students_principalFeedbackId_fkey
      FOREIGN KEY ("principalFeedbackId") REFERENCES public.principal_feedbacks(id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'principal_feedback_students_studentId_fkey') THEN
    ALTER TABLE public.principal_feedback_students
      ADD CONSTRAINT principal_feedback_students_studentId_fkey
      FOREIGN KEY ("studentId") REFERENCES public."Student"(id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS principal_feedbacks_principalId_idx ON public.principal_feedbacks("principalId");
CREATE INDEX IF NOT EXISTS principal_feedbacks_institutionId_idx ON public.principal_feedbacks("institutionId");
CREATE INDEX IF NOT EXISTS principal_feedbacks_status_idx ON public.principal_feedbacks(status);
CREATE INDEX IF NOT EXISTS principal_feedbacks_visitDate_idx ON public.principal_feedbacks("visitDate");
CREATE INDEX IF NOT EXISTS principal_feedbacks_isDeleted_idx ON public.principal_feedbacks("isDeleted");
CREATE INDEX IF NOT EXISTS principal_feedbacks_principalId_isDeleted_idx ON public.principal_feedbacks("principalId", "isDeleted");
CREATE INDEX IF NOT EXISTS principal_feedbacks_institutionId_status_idx ON public.principal_feedbacks("institutionId", status);
CREATE INDEX IF NOT EXISTS principal_feedbacks_visitMonth_visitYear_idx ON public.principal_feedbacks("visitMonth", "visitYear");
CREATE INDEX IF NOT EXISTS principal_feedback_students_studentId_idx ON public.principal_feedback_students("studentId");
CREATE INDEX IF NOT EXISTS principal_feedback_students_principalFeedbackId_idx ON public.principal_feedback_students("principalFeedbackId");
