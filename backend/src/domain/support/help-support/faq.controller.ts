import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { FAQService } from './faq.service';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../../core/auth/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../../../core/auth/guards/roles.guard';
import { Roles } from '../../../core/auth/decorators/roles.decorator';
import { CreateFAQDto, UpdateFAQDto } from './dto';
import { SupportCategory } from '../../../generated/prisma/client';

@Controller('support/faq')
export class FAQController {
  constructor(private readonly faqService: FAQService) {}

  /**
   * Get all published FAQ articles filtered by user role
   * Access: Public (optional auth - filters by role if authenticated)
   */
  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  async getPublishedFAQs(@Request() req: any) {
    const userRole = req.user?.role;
    return this.faqService.getPublishedFAQs(userRole);
  }

  /**
   * Search FAQs filtered by user role
   * Access: Public (optional auth)
   */
  @Get('search')
  @UseGuards(OptionalJwtAuthGuard)
  async searchFAQs(@Query('q') query: string, @Request() req: any) {
    const userRole = req.user?.role;
    return this.faqService.searchFAQs(query, userRole);
  }

  /**
   * Get categories with article counts filtered by user role
   * Access: Public (optional auth)
   */
  @Get('categories')
  @UseGuards(OptionalJwtAuthGuard)
  async getCategories(@Request() req: any) {
    const userRole = req.user?.role;
    return this.faqService.getCategoriesWithCounts(userRole);
  }

  /**
   * Get popular FAQs filtered by user role
   * Access: Public (optional auth)
   */
  @Get('popular')
  @UseGuards(OptionalJwtAuthGuard)
  async getPopularFAQs(@Query('limit') limit?: string, @Request() req?: any) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const userRole = req?.user?.role;
    return this.faqService.getPopularFAQs(limitNum, userRole);
  }

  /**
   * Get FAQs by category filtered by user role
   * Access: Public (optional auth)
   */
  @Get('category/:category')
  @UseGuards(OptionalJwtAuthGuard)
  async getFAQsByCategory(@Param('category') category: SupportCategory, @Request() req: any) {
    const userRole = req.user?.role;
    return this.faqService.getFAQsByCategory(category, userRole);
  }

  /**
   * Get all FAQ articles (including drafts) - Admin only
   * Access: STATE_DIRECTORATE only
   */
  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STATE_DIRECTORATE')
  async getAllFAQs() {
    return this.faqService.getAllFAQs();
  }

  /**
   * Get FAQ by slug (public view)
   * Access: Public
   */
  @Get('slug/:slug')
  async getFAQBySlug(@Param('slug') slug: string) {
    return this.faqService.getFAQBySlug(slug);
  }

  /**
   * Mark FAQ as helpful
   * Access: Public
   */
  @Post(':id/helpful')
  async markHelpful(@Param('id') id: string) {
    return this.faqService.markHelpful(id);
  }

  /**
   * Create a new FAQ article
   * Access: STATE_DIRECTORATE only
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STATE_DIRECTORATE')
  async createFAQ(@Body() data: CreateFAQDto, @Request() req: any) {
    return this.faqService.createFAQ(req.user.userId, data);
  }

  /**
   * Get FAQ by ID (admin)
   * Access: STATE_DIRECTORATE only
   */
  @Get('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STATE_DIRECTORATE')
  async getFAQById(@Param('id') id: string) {
    return this.faqService.getFAQById(id);
  }

  /**
   * Update an FAQ article
   * Access: STATE_DIRECTORATE only
   */
  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STATE_DIRECTORATE')
  async updateFAQ(
    @Param('id') id: string,
    @Body() data: UpdateFAQDto,
    @Request() req: any,
  ) {
    return this.faqService.updateFAQ(id, req.user.userId, data);
  }

  /**
   * Delete an FAQ article
   * Access: STATE_DIRECTORATE only
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STATE_DIRECTORATE')
  async deleteFAQ(@Param('id') id: string) {
    return this.faqService.deleteFAQ(id);
  }
}
