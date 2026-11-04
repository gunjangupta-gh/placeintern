import { Module } from '@nestjs/common';
import { InternshipModule } from '../../domain/internship/internship.module';
import { EligibilityService } from './eligibility.service';
import { FacultyOpportunityActionsController, InstitutionOpportunityController } from './institution-opportunity.controller';
import { InstitutionOpportunityService } from './institution-opportunity.service';
import { OpportunityExportService } from './opportunity-export.service';
import { OpportunityImportService } from './opportunity-import.service';
import { OpportunityService } from './opportunity.service';
import { StateOpportunityController } from './state-opportunity.controller';
import { StudentOpportunityController } from './student-opportunity.controller';
import { StudentOpportunityService } from './student-opportunity.service';

/**
 * Internship opportunities published by the State Directorate (Excel upload), browsed and
 * applied to by students. Self-contained: it only adds routes/tables and writes ordinary
 * InternshipApplication rows, so existing mentor / report / visit workflows are untouched.
 * PrismaService, CacheService and AuditService come from global modules.
 */
@Module({
  imports: [InternshipModule], // ExpectedCycleService
  controllers: [
    StateOpportunityController,
    StudentOpportunityController,
    InstitutionOpportunityController,
    FacultyOpportunityActionsController,
  ],
  providers: [
    EligibilityService,
    OpportunityImportService,
    OpportunityExportService,
    OpportunityService,
    StudentOpportunityService,
    InstitutionOpportunityService,
  ],
})
export class InternshipOpportunityModule {}
