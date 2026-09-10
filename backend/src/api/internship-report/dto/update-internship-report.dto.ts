import { PartialType } from '@nestjs/swagger';
import { CreateInternshipReportDto } from './create-internship-report.dto';

export class UpdateInternshipReportDto extends PartialType(CreateInternshipReportDto) {}
