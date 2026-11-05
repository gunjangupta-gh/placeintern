import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Roles } from '../../core/auth/decorators/roles.decorator';
import { Role } from '../../generated/prisma/client';
import { InstitutionOpportunityService } from './institution-opportunity.service';
import {
  IncompleteProfilesQueryDto,
  ListApplicationsQueryDto,
  ListOpportunitiesQueryDto,
  WithdrawApplicationDto,
} from './dto/opportunity.dto';

/**
 * Read-only. Scope comes from the caller's role, not the URL:
 * principal -> own institution; teacher / faculty coordinator -> active mentees only.
 */
@ApiTags('Institution - Internship Opportunities (read-only)')
@Controller(['principal/opportunities', 'faculty/opportunities'])
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PRINCIPAL, Role.TEACHER, Role.FACULTY_COORDINATOR)
export class InstitutionOpportunityController {
  constructor(private readonly service: InstitutionOpportunityService) {}

  private viewer(req: any) {
    return { userId: req.user.userId, role: req.user.role, institutionId: req.user.institutionId };
  }

  @Get()
  @ApiOperation({ summary: 'Published internship opportunities (no industry contact details)' })
  list(@Req() req: any, @Query() q: ListOpportunitiesQueryDto) {
    return this.service.listOpportunities(q, this.viewer(req));
  }

  @Get('applications')
  @ApiOperation({ summary: 'Applications by students in your scope' })
  applications(@Req() req: any, @Query() q: ListApplicationsQueryDto) {
    return this.service.listApplications(this.viewer(req), q);
  }

  @Get('incomplete-profiles')
  @ApiOperation({ summary: 'Students in your scope who cannot apply because their profile is incomplete' })
  incomplete(@Req() req: any, @Query() q: IncompleteProfilesQueryDto) {
    return this.service.incompleteProfiles(this.viewer(req), q);
  }
}

/**
 * The one write a faculty mentor has here: withdraw a pending application of their own mentee.
 * Teacher / Faculty Coordinator only (not Principal); the service re-checks the mentor link.
 */
@ApiTags('Faculty - Internship Opportunities')
@Controller('faculty/opportunities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TEACHER, Role.FACULTY_COORDINATOR)
export class FacultyOpportunityActionsController {
  constructor(private readonly service: InstitutionOpportunityService) {}

  @Post('applications/:applicationId/withdraw')
  @ApiOperation({ summary: "Withdraw (cancel) a mentee's pending internship application" })
  withdraw(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Body() dto: WithdrawApplicationDto,
    @Req() req: any,
  ) {
    return this.service.withdrawApplication(
      { userId: req.user.userId, role: req.user.role, institutionId: req.user.institutionId },
      applicationId,
      dto.reason,
    );
  }
}
