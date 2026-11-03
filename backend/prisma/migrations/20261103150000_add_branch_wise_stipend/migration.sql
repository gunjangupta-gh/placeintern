-- Branch-wise stipend (null = use the opportunity stipend)
ALTER TABLE "opportunity_branches" ADD COLUMN "stipend" TEXT;
