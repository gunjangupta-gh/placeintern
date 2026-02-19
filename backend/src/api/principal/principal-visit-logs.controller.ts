import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../core/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Role } from '../../generated/prisma/client';
import {
  CreatePrincipalVisitLogDto,
  PrincipalVisitLogQueryDto,
  UpdatePrincipalVisitLogDto,
} from './dto/principal-visit-log.dto';
import { PrincipalVisitLogsService } from './principal-visit-logs.service';

@ApiTags('Principal Visit Logs')
@ApiBearerAuth()
@Controller('principal/visit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PRINCIPAL)
export class PrincipalVisitLogsController {
  constructor(private readonly principalVisitLogsService: PrincipalVisitLogsService) {}

  @Get()
  @ApiOperation({ summary: 'Get principal visit logs with filters and dashboard stats' })
  @ApiResponse({ status: 200, description: 'Principal visit logs fetched successfully' })
  async getVisitLogs(@Request() req, @Query() query: PrincipalVisitLogQueryDto) {
    return this.principalVisitLogsService.getVisitLogs(req.user.userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get principal visit log by id' })
  @ApiResponse({ status: 200, description: 'Principal visit log fetched successfully' })
  async getVisitLogById(@Request() req, @Param('id') id: string) {
    return this.principalVisitLogsService.getVisitLogById(req.user.userId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create principal visit log' })
  @ApiResponse({ status: 201, description: 'Principal visit log created successfully' })
  async createVisitLog(@Request() req, @Body() dto: CreatePrincipalVisitLogDto) {
    return this.principalVisitLogsService.createVisitLog(req.user.userId, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update principal visit log' })
  @ApiResponse({ status: 200, description: 'Principal visit log updated successfully' })
  async updateVisitLog(@Request() req, @Param('id') id: string, @Body() dto: UpdatePrincipalVisitLogDto) {
    return this.principalVisitLogsService.updateVisitLog(req.user.userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete principal visit log' })
  @ApiResponse({ status: 200, description: 'Principal visit log deleted successfully' })
  async deleteVisitLog(@Request() req, @Param('id') id: string) {
    return this.principalVisitLogsService.deleteVisitLog(req.user.userId, id);
  }
}
