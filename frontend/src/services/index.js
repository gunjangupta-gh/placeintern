/**
 * Services Index
 * Centralized export for all service modules
 */

// Core API
export { default as api, apiClient } from './api';

// Domain Services
export { default as StudentService } from './student.service';
export { default as FacultyService } from './faculty.service';
export { default as PrincipalService } from './principal.service';
export { default as IndustryService } from './industry.service';
export { default as StateService } from './state.service';
export { default as AdminService, adminService } from './admin.service';

// Shared Services
export { default as NotificationService } from './notification.service';
export { default as FileService } from './file.service';
export { default as GrievanceService, grievanceService } from './grievance.service';
export { default as CredentialsService, credentialsService } from './credentials.service';
export { default as LookupService, lookupService } from './lookup.service';

// Legacy named exports for backward compatibility
export { studentService } from './student.service';
export { facultyService } from './faculty.service';
export { principalService } from './principal.service';
export { industryService } from './industry.service';
export { stateService } from './state.service';
