import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Req,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Roles } from '../../core/auth/decorators/roles.decorator';
import { Role, BulkJobType, BulkJobStatus } from '../../generated/prisma/client';
import { BulkJobService } from './bulk-job.service';
import { BulkQueueService } from './bulk-queue.service';
import {
  BulkJobResponseDto,
  BulkJobListResponseDto,
  BulkJobListQueryDto,
} from './dto/bulk-job.dto';

@ApiTags('Bulk Jobs - History & Tracking')
@Controller('bulk/jobs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class BulkJobController {
  constructor(
    private readonly bulkJobService: BulkJobService,
    private readonly bulkQueueService: BulkQueueService,
  ) {}

  @Get()
  @Roles(Role.PRINCIPAL, Role.SYSTEM_ADMIN, Role.STATE_DIRECTORATE)
  @ApiOperation({ summary: 'List all bulk jobs for the institution' })
  @ApiQuery({ name: 'type', enum: BulkJobType, required: false })
  @ApiQuery({ name: 'status', enum: BulkJobStatus, required: false })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiQuery({ name: 'fromDate', type: String, required: false })
  @ApiQuery({ name: 'toDate', type: String, required: false })
  @ApiQuery({ name: 'institutionId', type: String, required: false, description: 'For STATE_DIRECTORATE to filter by institution' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of bulk jobs',
    type: BulkJobListResponseDto,
  })
  async listJobs(
    @Req() req: any,
    @Query() query: BulkJobListQueryDto,
  ): Promise<BulkJobListResponseDto> {
    const user = req.user;
    let institutionId: string | null;

    if (user.role === Role.STATE_DIRECTORATE) {
      // STATE_DIRECTORATE can see all jobs or filter by specific institution
      institutionId = query['institutionId'] || null;
    } else {
      // PRINCIPAL and others can only see their own institution's jobs
      institutionId = user.institutionId;
      if (!institutionId) {
        throw new BadRequestException('Institution ID not found for the user');
      }
    }

    return this.bulkJobService.listJobs(institutionId, query);
  }

  @Get('active')
  @Roles(Role.PRINCIPAL, Role.SYSTEM_ADMIN, Role.STATE_DIRECTORATE)
  @ApiOperation({ summary: 'Get active (queued/processing) jobs' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of active bulk jobs',
  })
  async getActiveJobs(@Req() req: any) {
    const user = req.user;
    let institutionId: string | null;

    if (user.role === Role.STATE_DIRECTORATE) {
      // STATE_DIRECTORATE can see all active jobs
      institutionId = null;
    } else {
      institutionId = user.institutionId;
      if (!institutionId) {
        throw new BadRequestException('Institution ID not found for the user');
      }
    }

    return this.bulkJobService.getActiveJobs(institutionId);
  }

  @Get('my-jobs')
  @ApiOperation({ summary: 'Get jobs created by the current user' })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of bulk jobs created by user',
  })
  async getMyJobs(@Req() req: any, @Query('limit') limit?: number) {
    return this.bulkJobService.getJobsByUser(req.user.sub, limit || 10);
  }

  @Get('stats')
  @Roles(Role.PRINCIPAL, Role.SYSTEM_ADMIN, Role.STATE_DIRECTORATE)
  @ApiOperation({ summary: 'Get bulk job statistics' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Bulk job statistics',
  })
  async getJobStats(@Req() req: any) {
    const user = req.user;
    let institutionId: string | null;

    if (user.role === Role.STATE_DIRECTORATE) {
      // STATE_DIRECTORATE gets aggregate stats for all institutions
      institutionId = null;
    } else {
      institutionId = user.institutionId;
      if (!institutionId) {
        throw new BadRequestException('Institution ID not found for the user');
      }
    }

    return this.bulkJobService.getJobStats(institutionId);
  }

  @Get('queue-status')
  @Roles(Role.SYSTEM_ADMIN, Role.STATE_DIRECTORATE)
  @ApiOperation({ summary: 'Get queue status (admin only)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Queue status information',
  })
  async getQueueStatus() {
    return this.bulkQueueService.getQueueStatus();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get bulk job details by ID' })
  @ApiParam({ name: 'id', description: 'Bulk job ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Bulk job details',
    type: BulkJobResponseDto,
  })
  async getJobById(@Param('id') id: string, @Req() req: any) {
    const job = await this.bulkJobService.getJobById(id);
    const user = req.user;

    // STATE_DIRECTORATE and SYSTEM_ADMIN can see all jobs
    if (user.role === Role.STATE_DIRECTORATE || user.role === Role.SYSTEM_ADMIN) {
      return job;
    }

    // Others can only see their own institution's jobs or jobs they created
    if (job.institutionId !== user.institutionId && job.createdById !== user.sub) {
      throw new BadRequestException('Access denied to this job');
    }

    return job;
  }

  @Post(':id/cancel')
  @Roles(Role.PRINCIPAL, Role.SYSTEM_ADMIN, Role.STATE_DIRECTORATE)
  @ApiOperation({ summary: 'Cancel a queued job' })
  @ApiParam({ name: 'id', description: 'BullMQ Job ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Job cancelled successfully',
  })
  async cancelJob(@Param('id') id: string, @Req() req: any) {
    const job = await this.bulkJobService.getJobByJobId(id);
    const user = req.user;

    // STATE_DIRECTORATE and SYSTEM_ADMIN can cancel any job
    if (user.role !== Role.STATE_DIRECTORATE && user.role !== Role.SYSTEM_ADMIN) {
      if (job.institutionId !== user.institutionId) {
        throw new BadRequestException('Access denied to this job');
      }
    }

    await this.bulkJobService.cancelJob(id, user.sub);

    // Also remove from BullMQ queue
    await this.bulkQueueService.removeJob(id);

    return { success: true, message: 'Job cancelled successfully' };
  }

  @Post(':id/retry')
  @Roles(Role.PRINCIPAL, Role.SYSTEM_ADMIN, Role.STATE_DIRECTORATE)
  @ApiOperation({ summary: 'Retry a failed job' })
  @ApiParam({ name: 'id', description: 'BullMQ Job ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Job queued for retry',
  })
  async retryJob(@Param('id') id: string, @Req() req: any) {
    const job = await this.bulkJobService.getJobByJobId(id);
    const user = req.user;

    // STATE_DIRECTORATE and SYSTEM_ADMIN can retry any job
    if (user.role !== Role.STATE_DIRECTORATE && user.role !== Role.SYSTEM_ADMIN) {
      if (job.institutionId !== user.institutionId) {
        throw new BadRequestException('Access denied to this job');
      }
    }

    if (job.status !== BulkJobStatus.FAILED) {
      throw new BadRequestException('Only failed jobs can be retried');
    }

    const retried = await this.bulkQueueService.retryJob(id);

    if (!retried) {
      throw new BadRequestException('Job not found in queue');
    }

    return { success: true, message: 'Job queued for retry' };
  }

  @Post('queue/pause')
  @Roles(Role.SYSTEM_ADMIN)
  @ApiOperation({ summary: 'Pause the bulk operations queue (admin only)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Queue paused',
  })
  async pauseQueue() {
    await this.bulkQueueService.pauseQueue();
    return { success: true, message: 'Queue paused' };
  }

  @Post('queue/resume')
  @Roles(Role.SYSTEM_ADMIN)
  @ApiOperation({ summary: 'Resume the bulk operations queue (admin only)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Queue resumed',
  })
  async resumeQueue() {
    await this.bulkQueueService.resumeQueue();
    return { success: true, message: 'Queue resumed' };
  }
}
