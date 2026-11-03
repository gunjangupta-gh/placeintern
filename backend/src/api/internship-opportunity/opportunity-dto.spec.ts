import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';
import {
  BulkApplicationActionDto,
  ExportApplicationsQueryDto,
  ListApplicationsQueryDto,
} from './dto/opportunity.dto';

/** Same options as main.ts, so a request the frontend sends is judged exactly as in production. */
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
const run = (metatype: any, type: 'body' | 'query', value: any) =>
  pipe.transform(value, { type, metatype } as ArgumentMetadata);

const ID = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b';

describe('DTO validation (production pipe settings)', () => {
  describe('GET applications: query filters', () => {
    it('accepts the status group the Applications tab sends', async () => {
      for (const group of ['PENDING', 'SELECTED', 'CLOSED']) {
        await expect(run(ListApplicationsQueryDto, 'query', { group, page: '1', limit: '20' })).resolves.toMatchObject({ group });
      }
    });

    it('accepts the opportunity page query (opportunityId + group + search)', async () => {
      await expect(
        run(ListApplicationsQueryDto, 'query', { opportunityId: ID, group: 'SELECTED', search: 'amit' }),
      ).resolves.toBeDefined();
    });

    it('rejects an unknown group', async () => {
      await expect(run(ListApplicationsQueryDto, 'query', { group: 'EVERYONE' })).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('GET applications/export: query filters', () => {
    it('accepts the same filters the table uses', async () => {
      await expect(run(ExportApplicationsQueryDto, 'query', { opportunityId: ID, group: 'SELECTED', search: 'a' })).resolves.toBeDefined();
      await expect(run(ExportApplicationsQueryDto, 'query', {})).resolves.toBeDefined();
    });

    it('rejects unknown properties', async () => {
      await expect(run(ExportApplicationsQueryDto, 'query', { page: '1' })).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('POST applications/bulk: body', () => {
    it.each(['APPROVE', 'REJECT', 'DELETE'])('accepts action %s', async (action) => {
      await expect(run(BulkApplicationActionDto, 'body', { action, applicationIds: [ID] })).resolves.toMatchObject({ action });
    });

    it('rejects any other action with a clear message', async () => {
      const err: any = await run(BulkApplicationActionDto, 'body', { action: 'ARCHIVE', applicationIds: [ID] }).catch((e) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect(JSON.stringify(err.getResponse().message)).toContain('APPROVE, REJECT, DELETE');
    });

    it('requires at least one valid application id', async () => {
      await expect(run(BulkApplicationActionDto, 'body', { action: 'DELETE', applicationIds: [] })).rejects.toBeInstanceOf(BadRequestException);
      await expect(run(BulkApplicationActionDto, 'body', { action: 'DELETE', applicationIds: ['nope'] })).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
