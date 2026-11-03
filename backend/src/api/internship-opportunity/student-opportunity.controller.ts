import { Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Roles } from '../../core/auth/decorators/roles.decorator';
import { Role } from '../../generated/prisma/client';
import { EligibilityService } from './eligibility.service';
import { StudentOpportunityService } from './student-opportunity.service';
import { PageQueryDto } from './dto/opportunity.dto';

@ApiTags('Student - Internship Opportunities')
@Controller('internships')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STUDENT)
export class StudentOpportunityController {
  constructor(
    private readonly service: StudentOpportunityService,
    private readonly eligibility: EligibilityService,
  ) {}

  @Get('eligible')
  @ApiOperation({ summary: "Internships open to the student's branch, with per-item eligibility" })
  list(@Req() req: any, @Query() q: PageQueryDto) {
    return this.service.listForStudent(req.user.userId, q);
  }

  @Get('eligibility')
  @ApiOperation({ summary: 'Profile completeness required before applying' })
  profileStatus(@Req() req: any) {
    return this.eligibility.getProfileStatus(req.user.userId);
  }

  @Get(':id')
  getOne(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.getForStudent(req.user.userId, id);
  }

  @Post(':id/apply')
  @ApiOperation({ summary: 'Apply (up to 2 pending applications per student; seats enforced under lock)' })
  apply(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.apply(req.user.userId, id);
  }
}
