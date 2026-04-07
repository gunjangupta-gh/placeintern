import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';

// Import sub-services
import { StateDashboardService } from './services/state-dashboard.service';
import { StateInstitutionService } from './services/state-institution.service';
import { StatePrincipalService } from './services/state-principal.service';
import { StateStaffService } from './services/state-staff.service';
import { StateReportsService } from './services/state-reports.service';
import { StateIndustryService } from './services/state-industry.service';
import { StateMentorService } from './services/state-mentor.service';
import { StateRestoreService, RestorableEntityType } from './services/state-restore.service';
import { StateComplianceService, MonthlyComplianceParams, InstitutionComplianceParams } from './services/state-compliance.service';
import { StateStudentService, GetAllStudentsParams } from './services/state-student.service';

/**
 * State Service - Main facade that delegates to specialized sub-services
 *
 * This service acts as a facade/coordinator for all state-level operations.
 * Each sub-service handles a specific domain:
 * - StateDashboardService: Dashboard stats, alerts, compliance summary
 * - StateInstitutionService: Institution CRUD and details
 * - StatePrincipalService: Principal management
 * - StateStaffService: Staff and user management
 * - StateReportsService: Reports, analytics, performance metrics
 * - StateIndustryService: Industry approval and company management
 * - StateMentorService: Mentor assignment operations
 */
@Injectable()
export class StateService {
  private readonly logger = new Logger(StateService.name);

  constructor(
    private readonly dashboardService: StateDashboardService,
    private readonly institutionService: StateInstitutionService,
    private readonly principalService: StatePrincipalService,
    private readonly staffService: StateStaffService,
    private readonly reportsService: StateReportsService,
    private readonly industryService: StateIndustryService,
    private readonly mentorService: StateMentorService,
    private readonly restoreService: StateRestoreService,
    private readonly complianceService: StateComplianceService,
    private readonly studentService: StateStudentService,
  ) {}

  // ==========================================
  // DASHBOARD & OVERVIEW METHODS
  // ==========================================

  async getDashboardStats() {
    return this.dashboardService.getDashboardStats();
  }

  async getDashboard(params?: { month?: number; year?: number }) {
    return this.dashboardService.getDashboard(params);
  }

  async getCriticalAlerts() {
    // Pass getInstitutionsWithStats method for internal use
    return this.dashboardService.getCriticalAlerts(
      (params) => this.institutionService.getInstitutionsWithStats(params)
    );
  }

  async getActionItems() {
    return this.dashboardService.getActionItems(
      (params) => this.institutionService.getInstitutionsWithStats(params)
    );
  }

  async getComplianceSummary() {
    return this.dashboardService.getComplianceSummary(
      (params) => this.institutionService.getInstitutionsWithStats(params)
    );
  }

  async getCollegeWiseBreakdown(
    type: 'students' | 'reports' | 'mentors' | 'visits',
    params?: { month?: number; year?: number }
  ) {
    return this.dashboardService.getCollegeWiseBreakdown(type, params);
  }

  async getVisitsByType(params?: { month?: number; year?: number }) {
    return this.dashboardService.getVisitsByType(params);
  }

  // ==========================================
  // INSTITUTION METHODS
  // ==========================================

  async getInstitutions(params: {
    page?: number;
    limit?: number;
    search?: string;
    city?: string;
    isActive?: boolean;
    status?: 'active' | 'inactive' | 'all';
  }) {
    return this.institutionService.getInstitutions(params);
  }

  async getInstitutionsWithStats(params: { page?: number; limit?: number; search?: string; month?: number; year?: number }) {
    return this.institutionService.getInstitutionsWithStats(params);
  }

  async getInstitutionById(id: string) {
    return this.institutionService.getInstitutionById(id);
  }

  async getInstitutionOverview(id: string) {
    return this.institutionService.getInstitutionOverview(id);
  }

  async getInstitutionStudents(
    institutionId: string,
    params: {
      cursor?: string;
      limit: number;
      search?: string;
      filter: 'assigned' | 'unassigned' | 'all';
      branch?: string;
      companyId?: string;
      reportStatus?: 'all' | 'submitted' | 'pending' | 'not_submitted';
      visitStatus?: 'all' | 'visited' | 'pending';
      selfIdentified?: 'all' | 'yes' | 'no';
      status?: 'active' | 'inactive' | 'all';
    },
  ) {
    return this.institutionService.getInstitutionStudents(institutionId, params);
  }

  async getInstitutionCompanies(id: string, params: { limit: number; search?: string }) {
    return this.institutionService.getInstitutionCompanies(id, params);
  }

  async getInstitutionFacultyAndPrincipal(id: string) {
    return this.institutionService.getInstitutionFacultyAndPrincipal(id);
  }

  async createInstitution(data: Prisma.InstitutionCreateInput, userId?: string) {
    return this.institutionService.createInstitution(data, userId);
  }

  async updateInstitution(id: string, data: Prisma.InstitutionUpdateInput, userId?: string) {
    return this.institutionService.updateInstitution(id, data, userId);
  }

  async deleteInstitution(id: string, userId?: string) {
    return this.institutionService.deleteInstitution(id, userId);
  }

  // ==========================================
  // PRINCIPAL METHODS
  // ==========================================

  async getPrincipals(params: {
    page?: number;
    limit?: number;
    institutionId?: string;
    search?: string;
    active?: boolean;
  }) {
    return this.principalService.getPrincipals(params);
  }

  async createPrincipal(data: {
    name: string;
    email: string;
    password: string;
    phoneNo?: string;
    institutionId: string;
  }) {
    return this.principalService.createPrincipal(data);
  }

  async getPrincipalById(id: string) {
    return this.principalService.getPrincipalById(id);
  }

  async updatePrincipal(id: string, data: {
    name?: string;
    email?: string;
    phoneNo?: string;
    phone?: string;
    institutionId?: string;
    active?: boolean;
    designation?: string;
  }) {
    return this.principalService.updatePrincipal(id, data);
  }

  async deletePrincipal(id: string, deletedBy?: string) {
    return this.principalService.deletePrincipal(id, deletedBy);
  }

  async togglePrincipalStatus(id: string, toggledBy?: string) {
    return this.principalService.togglePrincipalStatus(id, toggledBy);
  }

  async resetPrincipalPassword(id: string, resetBy?: string) {
    return this.principalService.resetPrincipalPassword(id, resetBy);
  }

  // ==========================================
  // STAFF METHODS
  // ==========================================

  async getStaff(params: {
    page?: number;
    limit?: number;
    institutionId?: string;
    role?: string;
    search?: string;
    branchName?: string;
    active?: boolean;
  }) {
    return this.staffService.getStaff(params);
  }

  async createStaff(data: {
    name: string;
    email: string;
    password: string;
    phoneNo?: string;
    role: string;
    institutionId: string;
    designation?: string;
  }) {
    return this.staffService.createStaff(data);
  }

  async getStaffById(id: string) {
    return this.staffService.getStaffById(id);
  }

  async updateStaff(id: string, data: {
    name?: string;
    email?: string;
    phoneNo?: string;
    role?: string;
    designation?: string;
    institutionId?: string;
    isActive?: boolean;
    active?: boolean;
  }) {
    return this.staffService.updateStaff(id, data);
  }

  async deleteStaff(id: string) {
    return this.staffService.deleteStaff(id);
  }

  async deleteFaculty(id: string) {
    return this.staffService.deleteFaculty(id);
  }

  async toggleFacultyStatus(id: string) {
    return this.staffService.toggleFacultyStatus(id);
  }

  async resetStaffPassword(id: string) {
    return this.staffService.resetStaffPassword(id);
  }

  async getUsers(params: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    institutionId?: string;
    active?: boolean;
    locked?: boolean;
  }) {
    return this.staffService.getUsers(params);
  }

  async unlockUserAccount(id: string, unlockedBy?: string) {
    return this.staffService.unlockUserAccount(id, unlockedBy);
  }

  // ==========================================
  // REPORTS & ANALYTICS METHODS
  // ==========================================

  async getInstitutionPerformance(institutionId: string, params: {
    month?: number;
    year?: number;
    fromDate?: Date;
    toDate?: Date;
  }) {
    // Convert month/year to fromDate/toDate if provided
    let fromDate = params.fromDate;
    let toDate = params.toDate;

    if (params.month && params.year && !fromDate && !toDate) {
      fromDate = new Date(params.year, params.month - 1, 1);
      toDate = new Date(params.year, params.month, 0, 23, 59, 59);
    }

    return this.reportsService.getInstitutionPerformance(institutionId, { fromDate, toDate });
  }

  async getMonthlyReportStats(params: { month?: number; year?: number; institutionId?: string }) {
    return this.reportsService.getMonthlyReportStats(params);
  }

  async getInstitutionReports(params: {
    institutionId?: string;
    fromDate?: string;
    toDate?: string;
    reportType?: string;
  }) {
    return this.reportsService.getInstitutionReports(params);
  }

  async getAuditLogs(params: {
    page?: number;
    limit?: number;
    institutionId?: string;
    userId?: string;
    action?: string;
    fromDate?: string;
    toDate?: string;
  }) {
    return this.reportsService.getAuditLogs(params);
  }

  async getFacultyVisitStats(params: {
    month?: number;
    year?: number;
    institutionId?: string;
    facultyId?: string;
    fromDate?: Date;
    toDate?: Date;
  }) {
    // Convert month/year to fromDate/toDate if provided
    let fromDate = params.fromDate;
    let toDate = params.toDate;

    if (params.month && params.year && !fromDate && !toDate) {
      fromDate = new Date(params.year, params.month - 1, 1);
      toDate = new Date(params.year, params.month, 0, 23, 59, 59);
    }

    return this.reportsService.getFacultyVisitStats({
      institutionId: params.institutionId,
      facultyId: params.facultyId,
      fromDate,
      toDate,
    });
  }

  async getTopPerformers(params: { limit?: number; month?: number; year?: number }) {
    return this.reportsService.getTopPerformers(params);
  }

  async getStateWidePlacementTrends(years: number = 5) {
    return this.reportsService.getStateWidePlacementTrends(years);
  }

  async getStateWidePlacementStats() {
    return this.reportsService.getStateWidePlacementStats();
  }

  async getMonthlyAnalytics(params: { month?: number; year?: number; institutionId?: string }) {
    return this.reportsService.getMonthlyAnalytics(params);
  }

  // ==========================================
  // INDUSTRY & COMPANY METHODS
  // ==========================================

  async getTopIndustries(params: { limit?: number; month?: number; year?: number }) {
    return this.industryService.getTopIndustries(params);
  }

  async getJoiningLetterStats(params?: { month?: number; year?: number }) {
    return this.reportsService.getJoiningLetterStats(params);
  }

  async getAllCompanies(params: {
    page?: number;
    limit?: number;
    search?: string;
    industryType?: string;
    sortBy?: 'studentCount' | 'institutionCount' | 'companyName';
    sortOrder?: 'asc' | 'desc';
  }) {
    return this.industryService.getAllCompanies(params);
  }

  async getCompanyDetails(companyId: string) {
    return this.industryService.getCompanyDetails(companyId);
  }

  // ==========================================
  // MENTOR METHODS
  // ==========================================

  async getAllMentors(params?: { search?: string; institutionId?: string }) {
    return this.mentorService.getAllMentors(params);
  }

  async getInstitutionMentors(institutionId: string) {
    return this.mentorService.getInstitutionMentors(institutionId);
  }

  async getInstitutionMentorOverview() {
    return this.mentorService.getInstitutionMentorOverview();
  }

  async assignMentorToStudent(studentId: string, mentorId: string, assignedBy: string) {
    return this.mentorService.assignMentorToStudent(studentId, mentorId, assignedBy);
  }

  async removeMentorFromStudent(studentId: string, removedBy: string) {
    return this.mentorService.removeMentorFromStudent(studentId, removedBy);
  }

  async deleteStudent(studentId: string, deletedBy: string) {
    return this.mentorService.deleteStudent(studentId, deletedBy);
  }

  async toggleStudentStatus(studentId: string, toggledBy: string) {
    return this.mentorService.toggleStudentStatus(studentId, toggledBy);
  }

  // ==========================================
  // RESTORE CENTER METHODS
  // ==========================================

  async getDeletedItems(
    type: RestorableEntityType,
    params: {
      page?: number;
      limit?: number;
      search?: string;
      institutionId?: string;
      fromDate?: string;
      toDate?: string;
    },
  ) {
    return this.restoreService.getDeletedItems(type, params);
  }

  async getDeletedItemsSummary(institutionId?: string) {
    return this.restoreService.getDeletedItemsSummary(institutionId);
  }

  async restoreItem(type: RestorableEntityType, id: string, restoredBy?: string) {
    return this.restoreService.restoreItem(type, id, restoredBy);
  }

  async bulkRestore(type: RestorableEntityType, ids: string[], restoredBy?: string) {
    return this.restoreService.bulkRestore(type, ids, restoredBy);
  }

  // ==========================================
  // MONTHLY COMPLIANCE METHODS
  // ==========================================

  async getMonthlyComplianceByInstitution(params: MonthlyComplianceParams) {
    return this.complianceService.getMonthlyComplianceByInstitution(params);
  }

  async getInstitutionComplianceDetails(params: InstitutionComplianceParams) {
    return this.complianceService.getInstitutionComplianceDetails(params);
  }

  async getAvailableComplianceMonths() {
    return this.complianceService.getAvailableComplianceMonths();
  }

  async getStudentDocuments(studentId: string) {
    return this.complianceService.getStudentDocuments(studentId);
  }

  async getInstitutionDocuments(institutionId: string) {
    return this.complianceService.getInstitutionDocuments(institutionId);
  }

  async getInstitutionJoiningLetters(institutionId: string) {
    return this.complianceService.getInstitutionJoiningLetters(institutionId);
  }

  async getInstitutionFileExplorer(institutionId: string) {
    return this.complianceService.getInstitutionFileExplorer(institutionId);
  }

  async getFilePresignedUrl(fileType: 'document' | 'joining-letter' | 'monthly-report' | 'visit-document' | 'visit-photo' | 'visit-signed-document', fileId: string) {
    return this.complianceService.getFilePresignedUrl(fileType, fileId);
  }

  // ==========================================
  // STATE-WIDE STUDENT METHODS
  // ==========================================

  async getAllStudents(params: GetAllStudentsParams) {
    return this.studentService.getAllStudents(params);
  }

  async getAllStudentsForExport(params: Omit<GetAllStudentsParams, 'page' | 'limit'>) {
    return this.studentService.getAllStudentsForExport(params);
  }

  async getStudentsSummary() {
    return this.studentService.getStudentsSummary();
  }
}
