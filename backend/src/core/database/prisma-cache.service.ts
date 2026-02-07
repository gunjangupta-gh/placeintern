import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { LruCacheService } from '../cache/lru-cache.service';

@Injectable()
export class PrismaCacheService extends PrismaService {
  constructor(private cache: LruCacheService) {
    super();
  }

  /**
   * Cached version of institution lookup
   */
  async findInstitutionCached(id: string) {
    return this.cache.getOrSet(
      `institution:${id}`,
      async () => {
        return this.institution.findUnique({
          where: { id },
        });
      },
      { ttl: 300, tags: ['institution', `institution:${id}`] },
    );
  }

  /**
   * Cached version of students lookup with filters
   */
  async findStudentsCached(institutionId: string, filters: any = {}) {
    const cacheKey = `students:${institutionId}:${JSON.stringify(filters)}`;
    return this.cache.getOrSet(
      cacheKey,
      async () => {
        return this.student.findMany({
          where: {
            institutionId,
            ...filters,
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                phoneNo: true,
              },
            },
          },
        });
      },
      { ttl: 120, tags: ['students', `institution:${institutionId}`] },
    );
  }

  /**
   * Cached version of user lookup
   */
  async findUserCached(id: string) {
    return this.cache.getOrSet(
      `user:${id}`,
      async () => {
        return this.user.findUnique({
          where: { id },
          include: {
            Student: true,
            Institution: true,
          },
        });
      },
      { ttl: 300, tags: ['user', `user:${id}`] },
    );
  }

  /**
   * Cached version of faculty lookup
   */
  async findFacultyCached(institutionId: string, filters: any = {}) {
    const cacheKey = `faculty:${institutionId}:${JSON.stringify(filters)}`;
    return this.cache.getOrSet(
      cacheKey,
      async () => {
        return this.user.findMany({
          where: {
            institutionId,
            role: 'TEACHER' as any,
            ...filters,
          },
          select: {
            id: true,
            email: true,
            name: true,
            phoneNo: true,
            role: true,
          },
        });
      },
      { ttl: 120, tags: ['faculty', `institution:${institutionId}`] },
    );
  }

  /**
   * Cached version of internship lookup (self-identified only)
   */
  async findInternshipsCached(studentId: string) {
    return this.cache.getOrSet(
      `internships:student:${studentId}`,
      async () => {
        return this.internshipApplication.findMany({
          where: { studentId, isSelfIdentified: true, isActive: true },
          include: {
            mentor: true,
          },
          orderBy: { createdAt: 'desc' },
        });
      },
      { ttl: 180, tags: ['internships', `student:${studentId}`] },
    );
  }

  /**
   * STUB: Placement feature removed
   */
  async findPlacementsCached(institutionId: string, academicYear?: string) {
    // Placement feature removed - return empty array
    return [];
  }

  /**
   * Cached version of department lookup
   */
  async findDepartmentsCached(institutionId: string) {
    return this.cache.getOrSet(
      `departments:${institutionId}`,
      async () => {
        return this.department.findMany({
          where: { institutionId },
          orderBy: { name: 'asc' },
        });
      },
      { ttl: 600, tags: ['departments', `institution:${institutionId}`] },
    );
  }

  /**
   * Cached version of course lookup
   */
  // NOTE: No Course model exists in current Prisma schema.

  /**
   * Cached version of notification lookup
   */
  async findNotificationsCached(userId: string, limit: number = 10) {
    return this.cache.getOrSet(
      `notifications:${userId}:${limit}`,
      async () => {
        return this.notification.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: limit,
        });
      },
      { ttl: 60, tags: ['notifications', `user:${userId}`] },
    );
  }

  /**
   * Cached version of document lookup
   */
  async findDocumentsCached(entityType: string, entityId: string) {
    return this.cache.getOrSet(
      `documents:${entityType}:${entityId}`,
      async () => {
        // Current schema supports student documents only.
        if (String(entityType).toLowerCase() !== 'student') {
          return [];
        }

        return this.document.findMany({
          where: { studentId: entityId },
          orderBy: { createdAt: 'desc' },
        });
      },
      { ttl: 180, tags: ['documents', `${entityType}:${entityId}`] },
    );
  }

  /**
   * Invalidate cache for specific institution
   */
  async invalidateInstitutionCache(institutionId: string) {
    await this.cache.invalidateByTags([
      `institution:${institutionId}`,
      'institution',
    ]);
  }

  /**
   * Invalidate cache for specific user
   */
  async invalidateUserCache(userId: string) {
    await this.cache.invalidateByTags([`user:${userId}`, 'user']);
  }

  /**
   * Invalidate cache for specific student
   */
  async invalidateStudentCache(studentId: string) {
    await this.cache.invalidateByTags([`student:${studentId}`, 'students']);
  }

  /**
   * Invalidate all caches for an institution and its related entities
   */
  async invalidateAllInstitutionCaches(institutionId: string) {
    await this.cache.invalidateByTags([
      `institution:${institutionId}`,
      'institution',
      'students',
      'faculty',
      'departments',
    ]);
  }
}
