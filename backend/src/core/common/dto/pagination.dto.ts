import { IsOptional, IsInt, Min, Max, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface CursorPaginatedResult<T> {
  data: T[];
  meta: {
    nextCursor: string | null;
    prevCursor: string | null;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export class PaginationHelper {
  static paginate<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
  ): PaginatedResult<T> {
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  static cursorPaginate<T>(
    data: T[],
    limit: number,
    cursorField: keyof T,
  ): CursorPaginatedResult<T> {
    const hasNextPage = data.length > limit;
    const items = hasNextPage ? data.slice(0, limit) : data;

    return {
      data: items,
      meta: {
        nextCursor:
          hasNextPage && items.length > 0
            ? String(items[items.length - 1][cursorField])
            : null,
        prevCursor:
          items.length > 0 ? String(items[0][cursorField]) : null,
        hasNextPage,
        hasPreviousPage: false, // This would need to be determined by the query
      },
    };
  }
}
