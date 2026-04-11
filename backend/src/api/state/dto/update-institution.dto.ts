import { PartialType } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';
import { CreateInstitutionDto } from './create-institution.dto';

export class UpdateInstitutionDto extends PartialType(CreateInstitutionDto) {
	@ApiPropertyOptional({ description: 'Covered area rows nested relation payload' })
	@IsOptional()
	@IsObject()
	coveredAreaDetails?: Record<string, any>;
}
