import { PartialType, OmitType } from '@nestjs/swagger';
import { CreatePrincipalDto } from './create-principal.dto';

export class UpdatePrincipalDto extends PartialType(
  OmitType(CreatePrincipalDto, ['password', 'institutionId'] as const),
) {}
