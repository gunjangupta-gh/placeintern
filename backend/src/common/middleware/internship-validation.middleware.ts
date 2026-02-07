import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { InternshipPhase } from '../../generated/prisma/client';

@Injectable()
export class InternshipValidationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Validate internship phase transitions
    if (req.body.internshipPhase) {
      this.validatePhaseTransition(req.body);
    }

    // Ensure no deprecated fields are used
    this.ensureNoDeprecatedFields(req.body);

    next();
  }

  private validatePhaseTransition(body: any) {
    const validPhases = Object.values(InternshipPhase);

    if (!validPhases.includes(body.internshipPhase)) {
      throw new BadRequestException(
        `Invalid internship phase. Must be one of: ${validPhases.join(', ')}`
      );
    }

    // Validate phase transition logic
    if (body.internshipPhase === InternshipPhase.ACTIVE && !body.startDate) {
      throw new BadRequestException(
        'Cannot set internship to ACTIVE without a start date'
      );
    }

    if (body.internshipPhase === InternshipPhase.COMPLETED && !body.endDate) {
      throw new BadRequestException(
        'Cannot set internship to COMPLETED without an end date'
      );
    }
  }

  private ensureNoDeprecatedFields(body: any) {
    const deprecatedFields = ['hasJoined', 'reviewedBy', 'internshipStatus'];

    for (const field of deprecatedFields) {
      if (field in body) {
        throw new BadRequestException(
          `Field '${field}' is deprecated. Use 'internshipPhase', 'reviewedAt', or 'reviewRemarks' instead.`
        );
      }
    }
  }
}
