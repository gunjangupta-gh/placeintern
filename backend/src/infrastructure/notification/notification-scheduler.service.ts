import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationService } from './notification.service';
import { PrismaService } from '../../core/database/prisma.service';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';
import { ApplicationStatus } from '../../generated/prisma/client';

@Injectable()
export class NotificationSchedulerService implements OnModuleDestroy {
  private readonly logger = new Logger(NotificationSchedulerService.name);
  private readonly appUrl: string;

  // Track scheduled timeouts for cleanup
  private scheduledTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    private notificationService: NotificationService,
    private prisma: PrismaService,
    private mailService: MailService,
    private configService: ConfigService,
  ) {
    this.appUrl = this.configService.get('FRONTEND_URL') || this.configService.get('APP_URL', 'http://localhost:5173');
  }

  /**
   * Cleanup all scheduled timeouts on module destroy
   */
  onModuleDestroy(): void {
    this.logger.log(`Cleaning up ${this.scheduledTimeouts.size} scheduled notifications`);
    for (const [id, timeout] of this.scheduledTimeouts) {
      clearTimeout(timeout);
      this.logger.debug(`Cleared scheduled notification: ${id}`);
    }
    this.scheduledTimeouts.clear();
  }

  // ============ FACULTY VISIT REMINDERS ============
  /**
   * Remind faculty 7 days before visit is due
   * Runs every day at 9 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendFacultyVisitReminders(): Promise<void> {
    this.logger.log('Checking for pending faculty visits...');
    try {
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      const currentMonthName = this.getMonthName(currentMonth);
      const oneMonthAgo = new Date(now);
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      const upcomingEnd = new Date(now);
      upcomingEnd.setDate(upcomingEnd.getDate() + 7);

      // Find active mentor assignments and build mentor maps
      const assignments = await this.prisma.mentorAssignment.findMany({
        where: {
          isActive: true,
          mentor: { active: true, role: 'TEACHER' },
          student: { user: { active: true } },
        },
        select: {
          mentorId: true,
          studentId: true,
          mentor: { select: { id: true, name: true, email: true } },
        },
      });

      const mentorByStudent = new Map<string, { id: string; name: string; email: string }>();
      const mentorStats = new Map<string, { mentor: { id: string; name: string; email: string }; pendingCount: number; upcomingCount: number }>();

      for (const assignment of assignments) {
        if (!assignment.mentor) continue;
        mentorByStudent.set(assignment.studentId, assignment.mentor);
        if (!mentorStats.has(assignment.mentorId)) {
          mentorStats.set(assignment.mentorId, {
            mentor: assignment.mentor,
            pendingCount: 0,
            upcomingCount: 0,
          });
        }
      }

      const studentIds = Array.from(new Set(assignments.map(a => a.studentId)));

      // Get active applications for assigned students
      const applications = studentIds.length > 0
        ? await this.prisma.internshipApplication.findMany({
            where: {
              studentId: { in: studentIds },
              isActive: true,
              status: { in: [ApplicationStatus.JOINED, ApplicationStatus.SELECTED, ApplicationStatus.APPROVED] },
              startDate: { not: null, lte: now },
              OR: [{ endDate: { gte: now } }, { endDate: null }],
            },
            select: { id: true, studentId: true },
          })
        : [];

      // Last visit per application
      const lastVisits = applications.length > 0
        ? await this.prisma.facultyVisitLog.groupBy({
            by: ['applicationId'],
            where: { isDeleted: false, applicationId: { in: applications.map(a => a.id) } },
            _max: { visitDate: true },
          })
        : [];

      const lastVisitMap = new Map<string, Date | null>(
        lastVisits.map(v => [v.applicationId, v._max.visitDate ? new Date(v._max.visitDate) : null]),
      );

      // Count pending visits (no visit in last month) per mentor
      for (const app of applications) {
        const mentor = mentorByStudent.get(app.studentId);
        if (!mentor) continue;
        const stats = mentorStats.get(mentor.id);
        if (!stats) continue;
        const lastVisit = lastVisitMap.get(app.id);
        if (!lastVisit || lastVisit < oneMonthAgo) {
          stats.pendingCount++;
        }
      }

      // Count upcoming scheduled visits per faculty (next 7 days)
      const upcomingVisits = await this.prisma.facultyVisitLog.findMany({
        where: {
          isDeleted: false,
          status: 'SCHEDULED',
          visitDate: { gte: now, lte: upcomingEnd },
          faculty: { active: true, role: 'TEACHER' },
        },
        select: { facultyId: true },
      });

      for (const visit of upcomingVisits) {
        const stats = mentorStats.get(visit.facultyId);
        if (stats) {
          stats.upcomingCount++;
        }
      }

      // Send notifications to faculty
      let notifiedCount = 0;
      for (const [, data] of mentorStats) {
        if (data.pendingCount === 0 && data.upcomingCount === 0) continue;

        const parts: string[] = [];
        if (data.pendingCount > 0) {
          parts.push(`${data.pendingCount} pending visit(s)`);
        }
        if (data.upcomingCount > 0) {
          parts.push(`${data.upcomingCount} upcoming visit(s) in the next 7 days`);
        }

        await this.notificationService.create(
          data.mentor.id,
          'FACULTY_VISIT_REMINDER',
          'Faculty Visit Reminder',
          `You have ${parts.join(' and ')} for ${currentMonthName} ${currentYear}. Please review your visit schedule.`,
          {
            pendingCount: data.pendingCount,
            upcomingCount: data.upcomingCount,
            month: currentMonth,
            monthName: currentMonthName,
            year: currentYear,
          },
        );

        // In-app only: email intentionally disabled for faculty visit reminders.
        // await this.mailService.queueMail({
        //   to: data.mentor.email,
        //   subject: 'Reminder: Faculty Visit Schedule',
        //   template: 'faculty-visit-reminder',
        //   context: {
        //     name: data.mentor.name,
        //     studentCount: data.pendingCount,
        //     pendingCount: data.pendingCount,
        //     upcomingCount: data.upcomingCount,
        //     month: currentMonthName,
        //     year: currentYear,
        //     dashboardUrl: `${this.appUrl}/faculty/visits`,
        //   },
        // });

        notifiedCount++;
      }

      this.logger.log(`Faculty visit reminders sent to ${notifiedCount} faculty members`);
    } catch (error) {
      this.logger.error('Failed to send faculty visit reminders', error.stack);
    }
  }

  /**
   * Remind students about upcoming scheduled faculty visits
   * Runs every day at 9:15 AM
   */
  @Cron('15 9 * * *')
  async sendStudentUpcomingVisitReminders(): Promise<void> {
    this.logger.log('Checking for upcoming faculty visits for students...');
    try {
      const now = new Date();
      const upcomingEnd = new Date(now);
      upcomingEnd.setDate(upcomingEnd.getDate() + 7);

      const scheduledVisits = await this.prisma.facultyVisitLog.findMany({
        where: {
          isDeleted: false,
          status: 'SCHEDULED',
          visitDate: { gte: now, lte: upcomingEnd },
          application: {
            student: { user: { active: true } },
          },
        },
        select: {
          visitDate: true,
          application: {
            select: {
              student: {
                select: {
                  id: true,
                  user: { select: { id: true, name: true, email: true, active: true } },
                },
              },
            },
          },
        },
      });

      const studentMap = new Map<string, { userId: string; name: string; email: string | null; count: number; nextVisitDate: Date }>();

      for (const visit of scheduledVisits) {
        const student = visit.application?.student;
        const user = student?.user;
        if (!student || !user || !user.active || !visit.visitDate) continue;

        const existing = studentMap.get(student.id);
        if (existing) {
          existing.count += 1;
          if (visit.visitDate < existing.nextVisitDate) {
            existing.nextVisitDate = visit.visitDate;
          }
        } else {
          studentMap.set(student.id, {
            userId: user.id,
            name: user.name,
            email: user.email || null,
            count: 1,
            nextVisitDate: visit.visitDate,
          });
        }
      }

      let notifiedCount = 0;
      for (const [, data] of studentMap) {
        const dateLabel = data.nextVisitDate.toLocaleDateString('default', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
        const visitMonth = data.nextVisitDate.getMonth() + 1;
        const visitYear = data.nextVisitDate.getFullYear();
        const visitMonthName = this.getMonthName(visitMonth);

        await this.notificationService.create(
          data.userId,
          'STUDENT_VISIT_REMINDER',
          'Upcoming Faculty Visit',
          `You have ${data.count} upcoming faculty visit(s). Next visit on ${dateLabel} (${visitMonthName} ${visitYear}).`,
          {
            upcomingCount: data.count,
            nextVisitDate: data.nextVisitDate,
            month: visitMonth,
            monthName: visitMonthName,
            year: visitYear,
          },
        );

        // In-app only: email intentionally disabled for student visit reminders.
        // if (data.email) {
        //   await this.mailService.queueMail({
        //     to: data.email,
        //     subject: 'Upcoming Faculty Visit Reminder',
        //     template: 'student-visit-reminder',
        //     context: {
        //       name: data.name,
        //       upcomingCount: data.count,
        //       nextVisitDate: dateLabel,
        //       month: visitMonthName,
        //       year: visitYear,
        //       dashboardUrl: `${this.appUrl}/student/dashboard`,
        //     },
        //   });
        // }

        notifiedCount++;
      }

      this.logger.log(`Student upcoming visit reminders sent to ${notifiedCount} students`);
    } catch (error) {
      this.logger.error('Failed to send student visit reminders', error.stack);
    }
  }

  // ============ STUDENT MONTHLY REPORT REMINDERS ============
  /**
   * Weekly reminder on Mondays for pending monthly reports
   * Runs every Monday at 9 AM
   */
  @Cron('0 9 * * 1') // Monday 9 AM
  async sendMonthlyReportReminder(): Promise<void> {
    this.logger.log('Sending weekly monthly report reminders...');
    try {
      const { month: targetMonth, year: targetYear } = this.getPreviousMonthPeriod();
      const targetMonthName = this.getMonthName(targetMonth);

      // Find students with active applications
      const studentsWithActiveApplications = await this.prisma.internshipApplication.findMany({
        where: {
          isActive: true,
          status: { in: [ApplicationStatus.JOINED, ApplicationStatus.SELECTED, ApplicationStatus.APPROVED] },
        },
        include: {
          mentor: {
            select: {
              id: true,
              name: true,
              email: true,
              active: true,
            },
          },
          student: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  active: true,
                },
              },
            },
          },
        },
      });

      const facultyPendingCounts = new Map<string, { facultyId: string; name: string; email: string | null; pendingCount: number }>();

      for (const app of studentsWithActiveApplications) {
        if (!app.student?.user?.active) continue;

        // Check if report already submitted
        const existingReport = await this.prisma.monthlyReport.findFirst({
          where: {
            studentId: app.studentId,
            reportMonth: targetMonth,
            reportYear: targetYear,
            isDeleted: false,
            status: { in: ['SUBMITTED', 'APPROVED'] },
          },
        });

        if (!existingReport) {
          if (app.mentorId && app.mentor?.active) {
            const existingFaculty = facultyPendingCounts.get(app.mentorId);
            if (existingFaculty) {
              existingFaculty.pendingCount += 1;
            } else {
              facultyPendingCounts.set(app.mentorId, {
                facultyId: app.mentorId,
                name: app.mentor.name,
                email: app.mentor.email || null,
                pendingCount: 1,
              });
            }
          }

          const userId = app.student.user.id;
          const userEmail = app.student.user.email ;
          const userName = app.student.user.name ;

          await this.notificationService.create(
            userId,
            'MONTHLY_REPORT_REMINDER',
            'Monthly Report Reminder',
            `Please submit your monthly internship report for ${targetMonthName} ${targetYear}.`,
            { month: targetMonth, monthName: targetMonthName, year: targetYear },
          );

          // In-app only: email intentionally disabled for weekly monthly report reminders.
          // if (userEmail) {
          //   await this.mailService.queueMail({
          //     to: userEmail,
          //     subject: 'Reminder: Submit Your Monthly Internship Report',
          //     template: 'monthly-report-reminder',
          //     context: {
          //       name: userName,
          //       month: this.getMonthName(targetMonth),
          //       year: targetYear,
          //       reportUrl: `${this.appUrl}/student/reports`,
          //     },
          //   });
          // }
        }
      }

      let facultyNotifiedCount = 0;
      for (const [, facultyData] of facultyPendingCounts) {
        await this.notificationService.create(
          facultyData.facultyId,
          'FACULTY_PENDING_MONTHLY_REPORTS',
          'Pending Monthly Reports',
          `${facultyData.pendingCount} student(s) have not submitted ${targetMonthName} ${targetYear} monthly reports yet.`,
          {
            month: targetMonth,
            monthName: targetMonthName,
            year: targetYear,
            pendingCount: facultyData.pendingCount,
          },
        );
        facultyNotifiedCount++;
      }

      this.logger.log(`Monthly report reminders sent successfully (faculty notified: ${facultyNotifiedCount})`);
    } catch (error) {
      this.logger.error('Failed to send monthly report reminders', error.stack);
    }
  }

  /**
   * Final reminder on 25th of each month for pending reports
   * Runs on 25th of every month at 9 AM
   */
  @Cron('0 9 25 * *') // 25th at 9 AM
  async sendMonthlyReportFinalReminder(): Promise<void> {
    this.logger.log('Sending final monthly report reminders...');
    try {
      const { month: targetMonth, year: targetYear } = this.getPreviousMonthPeriod();
      const targetMonthName = this.getMonthName(targetMonth);

      // Find students with active applications
      const studentsWithActiveApplications = await this.prisma.internshipApplication.findMany({
        where: {
          isActive: true,
          status: { in: [ApplicationStatus.JOINED, ApplicationStatus.SELECTED, ApplicationStatus.APPROVED] },
        },
        include: {
          mentor: {
            select: {
              id: true,
              name: true,
              email: true,
              active: true,
            },
          },
          student: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  active: true,
                },
              },
            },
          },
        },
      });

      const facultyPendingCounts = new Map<string, { facultyId: string; name: string; email: string | null; pendingCount: number }>();

      for (const app of studentsWithActiveApplications) {
        if (!app.student?.user?.active) continue;

        // Check if report already submitted
        const existingReport = await this.prisma.monthlyReport.findFirst({
          where: {
            studentId: app.studentId,
            reportMonth: targetMonth,
            reportYear: targetYear,
            isDeleted: false,
            status: { in: ['SUBMITTED', 'APPROVED'] },
          },
        });

        if (!existingReport) {
          if (app.mentorId && app.mentor?.active) {
            const existingFaculty = facultyPendingCounts.get(app.mentorId);
            if (existingFaculty) {
              existingFaculty.pendingCount += 1;
            } else {
              facultyPendingCounts.set(app.mentorId, {
                facultyId: app.mentorId,
                name: app.mentor.name,
                email: app.mentor.email || null,
                pendingCount: 1,
              });
            }
          }

          const userId = app.student.user.id;
          const userEmail = app.student.user.email ;
          const userName = app.student.user.name;

          await this.notificationService.create(
            userId,
            'MONTHLY_REPORT_URGENT',
            'URGENT: Monthly Report Due Soon!',
            `Your monthly report for ${targetMonthName} ${targetYear} is pending. Submit now!`,
            { month: targetMonth, monthName: targetMonthName, year: targetYear, urgent: true },
          );

          if (userEmail) {
            await this.mailService.queueMail({
              to: userEmail,
              subject: 'URGENT: Monthly Report Deadline Approaching!',
              template: 'monthly-report-urgent',
              context: {
                name: userName,
                month: targetMonthName,
                year: targetYear,
                daysLeft: 30 - 25,
                reportUrl: `${this.appUrl}/student/reports`,
              },
            });
          }
        }
      }

      let facultyNotifiedCount = 0;
      for (const [, facultyData] of facultyPendingCounts) {
        await this.notificationService.create(
          facultyData.facultyId,
          'FACULTY_PENDING_MONTHLY_REPORTS_URGENT',
          'Urgent: Pending Monthly Reports',
          `${facultyData.pendingCount} student(s) still have pending ${targetMonthName} ${targetYear} monthly reports.`,
          {
            month: targetMonth,
            monthName: targetMonthName,
            year: targetYear,
            pendingCount: facultyData.pendingCount,
            urgent: true,
          },
        );
        facultyNotifiedCount++;
      }

      this.logger.log(`Urgent report reminders sent successfully (faculty notified: ${facultyNotifiedCount})`);
    } catch (error) {
      this.logger.error('Failed to send urgent report reminders', error.stack);
    }
  }

  // ============ WEEKLY SUMMARY ============
  /**
   * Weekly summary every Monday at 10 AM (in-app only)
   */
  @Cron('0 10 * * 1') // Monday 10 AM
  async sendWeeklySummary(): Promise<void> {
    this.logger.log('Generating weekly summary...');
    try {
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);

      // Get stats for the week
      const [totalApplications, totalReports, newPlacements] = await Promise.all([
        this.prisma.internshipApplication.count({
          where: { createdAt: { gte: lastWeek } },
        }),
        this.prisma.monthlyReport.count({
          where: { submittedAt: { gte: lastWeek }, isDeleted: false },
        }),
        this.prisma.internshipApplication.count({
          where: {
            status: { in: [ApplicationStatus.JOINED, ApplicationStatus.SELECTED] },
            updatedAt: { gte: lastWeek },
          },
        }),
      ]);

      // Send to principals
      const principals = await this.prisma.user.findMany({
        where: { role: 'PRINCIPAL', active: true },
        select: { id: true, institutionId: true },
      });

      for (const principal of principals) {
        // Get institution-specific stats
        const instApplications = await this.prisma.internshipApplication.count({
          where: {
            createdAt: { gte: lastWeek },
            student: { institutionId: principal.institutionId },
          },
        });

        const instReports = await this.prisma.monthlyReport.count({
          where: {
            submittedAt: { gte: lastWeek },
            isDeleted: false,
            student: { institutionId: principal.institutionId },
          },
        });

        await this.notificationService.create(
          principal.id,
          'WEEKLY_SUMMARY',
          'Weekly Institution Summary',
          `This week: ${instApplications} new applications, ${instReports} reports submitted.`,
          {
            newApplications: instApplications,
            submittedReports: instReports,
            weekEnding: new Date().toISOString(),
          },
        );
      }

      // Send state-level summary to STATE_DIRECTORATE users
      const stateUsers = await this.prisma.user.findMany({
        where: { role: 'STATE_DIRECTORATE', active: true },
        select: { id: true },
      });

      for (const user of stateUsers) {
        await this.notificationService.create(
          user.id,
          'WEEKLY_SUMMARY',
          'State-Level Weekly Summary',
          `This week across all institutions: ${totalApplications} applications, ${totalReports} reports, ${newPlacements} new placements.`,
          {
            totalApplications,
            totalReports,
            newPlacements,
            weekEnding: new Date().toISOString(),
          },
        );
      }

      this.logger.log('Weekly summaries sent successfully');
    } catch (error) {
      this.logger.error('Failed to send weekly summary', error.stack);
    }
  }

  // ============ NOTIFICATION CLEANUP ============
  /**
   * Cleanup old read notifications (older than 30 days)
   * Runs every day at midnight
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOldNotifications(): Promise<void> {
    this.logger.log('Running notification cleanup...');
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Delete read notifications older than 30 days
      const readResult = await this.prisma.notification.deleteMany({
        where: {
          read: true,
          createdAt: { lt: thirtyDaysAgo },
        },
      });

      // Delete unread notifications older than 90 days (even if not read)
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const unreadResult = await this.prisma.notification.deleteMany({
        where: {
          read: false,
          createdAt: { lt: ninetyDaysAgo },
        },
      });

      this.logger.log(
        `Notification cleanup complete: ${readResult.count} read (30+ days), ${unreadResult.count} unread (90+ days) deleted`
      );
    } catch (error) {
      this.logger.error('Failed to cleanup old notifications', error.stack);
    }
  }

  // ============ UTILITY METHODS ============
  /**
   * Schedule a notification for a specific user
   * Returns the schedule ID for cancellation if needed
   */
  async scheduleNotification(
    userId: string,
    type: string,
    title: string,
    body: string,
    scheduledAt: Date,
    data?: any,
  ): Promise<string | null> {
    try {
      const delay = scheduledAt.getTime() - Date.now();

      if (delay > 0) {
        // Generate unique ID for this scheduled notification
        const scheduleId = `${userId}-${type}-${Date.now()}`;

        const timeout = setTimeout(async () => {
          try {
            await this.notificationService.create(userId, type, title, body, data);
            this.logger.log(`Scheduled notification sent to user ${userId}`);
          } catch (error) {
            this.logger.error(`Failed to send scheduled notification to user ${userId}`, error.stack);
          } finally {
            // Remove from tracking after execution
            this.scheduledTimeouts.delete(scheduleId);
          }
        }, delay);

        // Track the timeout for cleanup
        this.scheduledTimeouts.set(scheduleId, timeout);
        this.logger.log(`Notification scheduled for user ${userId} at ${scheduledAt} (ID: ${scheduleId})`);

        return scheduleId;
      } else {
        this.logger.warn('Scheduled time is in the past, sending immediately');
        await this.notificationService.create(userId, type, title, body, data);
        return null;
      }
    } catch (error) {
      this.logger.error('Failed to schedule notification', error.stack);
      throw error;
    }
  }

  /**
   * Cancel a scheduled notification
   */
  cancelScheduledNotification(scheduleId: string): boolean {
    const timeout = this.scheduledTimeouts.get(scheduleId);
    if (timeout) {
      clearTimeout(timeout);
      this.scheduledTimeouts.delete(scheduleId);
      this.logger.log(`Cancelled scheduled notification: ${scheduleId}`);
      return true;
    }
    return false;
  }

  /**
   * Get count of pending scheduled notifications
   */
  getPendingScheduledCount(): number {
    return this.scheduledTimeouts.size;
  }

  /**
   * Send bulk notifications
   */
  async sendBulkNotifications(
    userIds: string[],
    type: string,
    title: string,
    body: string,
    data?: any,
  ): Promise<void> {
    try {
      const promises = userIds.map((userId) =>
        this.notificationService.create(userId, type, title, body, data),
      );

      await Promise.all(promises);
      this.logger.log(`Bulk notifications sent to ${userIds.length} users`);
    } catch (error) {
      this.logger.error('Failed to send bulk notifications', error.stack);
      throw error;
    }
  }

  /**
   * Get month name from month number
   */
  private getMonthName(month: number): string {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1] || 'Unknown';
  }

  private getPreviousMonthPeriod(): { month: number; year: number } {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return {
      month: date.getMonth() + 1,
      year: date.getFullYear(),
    };
  }
}
