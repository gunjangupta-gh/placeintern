import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { THROTTLE_PRESETS } from '../../../core/config/throttle.config';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../../../core/auth/decorators/roles.decorator';
import { RolesGuard } from '../../../core/auth/guards/roles.guard';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { Role } from '../../../generated/prisma/client';
import { CoordinatorReminderService } from './coordinator-reminder.service';
import { SendReminderDto, PendingActionsFilterDto } from './dto/send-reminder.dto';

@ApiTags('Coordinator - Reminders')
@ApiBearerAuth()
@Controller('coordinator/training/reminders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.FACULTY_COORDINATOR)
export class CoordinatorReminderController {
  constructor(private readonly reminderService: CoordinatorReminderService) {}

  @Throttle({ default: THROTTLE_PRESETS.list })
  @Get('pending-actions')
  @ApiOperation({ summary: 'Get faculty with pending actions (for targeted reminders)' })
  async getPendingActions(@Query() filters: PendingActionsFilterDto, @Req() req) {
    return this.reminderService.getFacultyWithPendingActions(req.user.institutionId, filters);
  }

  @Throttle({ default: THROTTLE_PRESETS.mutation })
  @Post('enroll-training')
  @ApiOperation({ summary: 'Send reminder to enroll for trainings' })
  async sendEnrollReminder(@Body() dto: SendReminderDto, @Req() req) {
    return this.reminderService.sendEnrollmentReminder(dto, {
      userId: req.user.userId,
      institutionId: req.user.institutionId,
      name: req.user.name,
    });
  }

  @Throttle({ default: THROTTLE_PRESETS.mutation })
  @Post('pre-test')
  @ApiOperation({ summary: 'Send reminder to fill pre-test' })
  async sendPreTestReminder(@Body() dto: SendReminderDto, @Req() req) {
    return this.reminderService.sendPreTestReminder(dto, {
      userId: req.user.userId,
      institutionId: req.user.institutionId,
      name: req.user.name,
    });
  }

  @Throttle({ default: THROTTLE_PRESETS.mutation })
  @Post('post-test')
  @ApiOperation({ summary: 'Send reminder to fill post-test' })
  async sendPostTestReminder(@Body() dto: SendReminderDto, @Req() req) {
    return this.reminderService.sendPostTestReminder(dto, {
      userId: req.user.userId,
      institutionId: req.user.institutionId,
      name: req.user.name,
    });
  }

  @Throttle({ default: THROTTLE_PRESETS.mutation })
  @Post('lesson-plan')
  @ApiOperation({ summary: 'Send reminder to submit lesson plans' })
  async sendLessonPlanReminder(@Body() dto: SendReminderDto, @Req() req) {
    return this.reminderService.sendLessonPlanReminder(dto, {
      userId: req.user.userId,
      institutionId: req.user.institutionId,
      name: req.user.name,
    });
  }
}
