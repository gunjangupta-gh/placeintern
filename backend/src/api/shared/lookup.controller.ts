import { Controller, Get, Post, Put, Delete, Query, Body, Param, UseGuards } from '@nestjs/common';
import { LookupService } from './lookup.service';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Roles } from '../../core/auth/decorators/roles.decorator';
import { Role } from '../../generated/prisma/client';

@Controller('shared/lookup')
@UseGuards(JwtAuthGuard)
export class LookupController {
  constructor(private readonly lookupService: LookupService) {}

  @Get('institutions')
  async getInstitutions(@Query('includeInactive') includeInactive?: string) {
    // For reports, pass ?includeInactive=true to get all institutions
    return this.lookupService.getInstitutions(includeInactive === 'true');
  }

  @Get('batches')
  async getBatches() {
    return this.lookupService.getBatches();
  }

  @Get('departments')
  async getDepartments() {
    return this.lookupService.getDepartments();
  }

  @Get('branches')
  async getBranches() {
    return this.lookupService.getBranches();
  }

  @Get('industries')
  async getIndustries() {
    return this.lookupService.getIndustries();
  }

  @Get('roles')
  async getRoles() {
    return this.lookupService.getRoles();
  }

  // ==========================================
  // CRUD Operations (State Directorate Only)
  // ==========================================

  // Batch CRUD
  @Post('batches')
  @UseGuards(RolesGuard)
  @Roles(Role.STATE_DIRECTORATE)
  async createBatch(@Body() data: { name: string }) {
    return this.lookupService.createBatch(data);
  }

  @Put('batches/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.STATE_DIRECTORATE, Role.PRINCIPAL)
  async updateBatch(@Param('id') id: string, @Body() data: { name?: string; isActive?: boolean }) {
    return this.lookupService.updateBatch(id, data);
  }

  @Delete('batches/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.STATE_DIRECTORATE)
  async deleteBatch(@Param('id') id: string) {
    return this.lookupService.deleteBatch(id);
  }

  // Department CRUD
  @Post('departments')
  @UseGuards(RolesGuard)
  @Roles(Role.STATE_DIRECTORATE)
  async createDepartment(@Body() data: { name: string; shortName?: string; code: string }) {
    return this.lookupService.createDepartment(data);
  }

  @Put('departments/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.STATE_DIRECTORATE)
  async updateDepartment(@Param('id') id: string, @Body() data: { name?: string; shortName?: string; code?: string; isActive?: boolean }) {
    return this.lookupService.updateDepartment(id, data);
  }

  @Delete('departments/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.STATE_DIRECTORATE)
  async deleteDepartment(@Param('id') id: string) {
    return this.lookupService.deleteDepartment(id);
  }

  // Branch CRUD
  @Post('branches')
  @UseGuards(RolesGuard)
  @Roles(Role.STATE_DIRECTORATE)
  async createBranch(@Body() data: { name: string; shortName: string; code: string; duration: number }) {
    return this.lookupService.createBranch(data);
  }

  @Put('branches/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.STATE_DIRECTORATE)
  async updateBranch(@Param('id') id: string, @Body() data: { name?: string; shortName?: string; code?: string; duration?: number; isActive?: boolean }) {
    return this.lookupService.updateBranch(id, data);
  }

  @Delete('branches/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.STATE_DIRECTORATE)
  async deleteBranch(@Param('id') id: string) {
    return this.lookupService.deleteBranch(id);
  }
}
