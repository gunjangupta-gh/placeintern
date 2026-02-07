# Pagination Utility

A shared utility module for handling pagination consistently across all backend services.

## Overview

This utility provides standardized pagination functionality that eliminates code duplication and ensures consistent pagination behavior across the application.

## Common Pattern Identified

Before this utility, the pagination pattern was repeated across multiple services:

```typescript
// Repeated in student.service.ts, faculty.service.ts, principal.service.ts
const { page = 1, limit = 10 } = params;
const skip = (page - 1) * limit;

const [items, total] = await Promise.all([
  this.prisma.model.findMany({ where, skip, take: limit }),
  this.prisma.model.count({ where }),
]);

return {
  items,
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit),
};
```

## Features

- Calculate skip/take values from page/limit parameters
- Format paginated responses with consistent metadata
- Validate and sanitize pagination parameters
- Execute paginated queries with a single function call
- TypeScript types for type safety

## Usage Examples

### Basic Pagination Calculation

```typescript
import { calculatePagination } from '@/common/utils';

const { page, limit, skip } = calculatePagination({ page: 2, limit: 20 });
// Returns: { page: 2, limit: 20, skip: 20 }
```

### Format Paginated Response

```typescript
import { formatPaginatedResponse } from '@/common/utils';

const students = await prisma.student.findMany({ skip, take: limit });
const total = await prisma.student.count();

return formatPaginatedResponse(students, total, page, limit);
// Returns: { data: [...], total: 100, page: 2, limit: 20, totalPages: 5 }
```

### Custom Data Key

```typescript
import { formatPaginatedResponse } from '@/common/utils';

return formatPaginatedResponse(students, total, page, limit, 'students');
// Returns: { students: [...], total: 100, page: 2, limit: 20, totalPages: 5 }
```

### Execute Paginated Query (Recommended)

The easiest way to use the utility - handles everything in one call:

```typescript
import { executePaginatedQuery } from '@/common/utils';

async getStudents(params: { page?: number; limit?: number; search?: string }) {
  const where = params.search ? {
    name: { contains: params.search, mode: 'insensitive' }
  } : {};

  return executePaginatedQuery(
    (skip, take) => this.prisma.student.findMany({
      where,
      skip,
      take,
      include: { batch: true, branch: true },
      orderBy: { createdAt: 'desc' },
    }),
    () => this.prisma.student.count({ where }),
    params,
    { dataKey: 'students' }
  );
}
```

### Validate Pagination Parameters

```typescript
import { validatePaginationParams } from '@/common/utils';

const validated = validatePaginationParams(
  { page: -1, limit: 1000 },
  { maxLimit: 100, defaultLimit: 10 }
);
// Returns: { page: 1, limit: 100 }
```

### Manual Implementation (More Control)

```typescript
import { calculatePagination, formatPaginatedResponse } from '@/common/utils';

async getApplications(
  studentId: string,
  params: { page?: number; limit?: number; status?: string }
) {
  const { page, limit, skip } = calculatePagination(params);

  const where: Prisma.InternshipApplicationWhereInput = {
    studentId,
  };

  if (params.status) {
    where.status = params.status as ApplicationStatus;
  }

  const [applications, total] = await Promise.all([
    this.prisma.internshipApplication.findMany({
      where,
      skip,
      take: limit,
      include: {
        internship: {
          include: { industry: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    this.prisma.internshipApplication.count({ where }),
  ]);

  return formatPaginatedResponse(applications, total, page, limit, 'applications');
}
```

## API Reference

### Types

#### `PaginationParams`
```typescript
interface PaginationParams {
  page?: number;
  limit?: number;
}
```

#### `PaginationMeta`
```typescript
interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

#### `PaginatedResult<T>`
```typescript
interface PaginatedResult<T> {
  data?: T[];
  items?: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

### Functions

#### `calculatePagination(params, defaultLimit?)`
Calculates skip and take values from page/limit parameters.

**Parameters:**
- `params` - Pagination parameters
- `defaultLimit` - Default limit if not provided (default: 10)

**Returns:** `{ page: number, limit: number, skip: number }`

#### `formatPaginatedResponse(items, total, page, limit, dataKey?)`
Formats a paginated response with metadata.

**Parameters:**
- `items` - Array of items to return
- `total` - Total count of items
- `page` - Current page number
- `limit` - Number of items per page
- `dataKey` - Optional key for items array (default: 'data')

**Returns:** Paginated result object

#### `createPaginationMeta(total, page, limit)`
Creates pagination metadata object.

**Parameters:**
- `total` - Total count of items
- `page` - Current page number
- `limit` - Number of items per page

**Returns:** `PaginationMeta`

#### `validatePaginationParams(params, options?)`
Validates and sanitizes pagination parameters.

**Parameters:**
- `params` - Pagination parameters to validate
- `options` - Validation options (maxLimit, defaultLimit)

**Returns:** `{ page: number, limit: number }`

#### `executePaginatedQuery(queryFn, countFn, params, options?)`
Executes a paginated Prisma query with Promise.all pattern.

**Parameters:**
- `queryFn` - Function that returns the Prisma query for items
- `countFn` - Function that returns the Prisma count query
- `params` - Pagination parameters
- `options` - Additional options (defaultLimit, dataKey)

**Returns:** Promise that resolves to paginated result

## Migration Guide

### Before (Old Pattern)
```typescript
async getStudents(params: { page?: number; limit?: number }) {
  const { page = 1, limit = 10 } = params;
  const skip = (page - 1) * limit;

  const [students, total] = await Promise.all([
    this.prisma.student.findMany({ skip, take: limit }),
    this.prisma.student.count(),
  ]);

  return {
    students,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
```

### After (Using Utility)
```typescript
import { executePaginatedQuery } from '@/common/utils';

async getStudents(params: { page?: number; limit?: number }) {
  return executePaginatedQuery(
    (skip, take) => this.prisma.student.findMany({ skip, take }),
    () => this.prisma.student.count(),
    params,
    { dataKey: 'students' }
  );
}
```

## Benefits

1. **Consistency**: Ensures all paginated endpoints follow the same pattern
2. **DRY Principle**: Eliminates code duplication across services
3. **Type Safety**: Full TypeScript support with proper typing
4. **Maintainability**: Single source of truth for pagination logic
5. **Validation**: Built-in parameter validation and sanitization
6. **Flexibility**: Multiple functions for different use cases

## Testing

```typescript
import {
  calculatePagination,
  formatPaginatedResponse,
  validatePaginationParams,
} from '@/common/utils';

describe('Pagination Utility', () => {
  it('should calculate skip value correctly', () => {
    const result = calculatePagination({ page: 3, limit: 20 });
    expect(result).toEqual({ page: 3, limit: 20, skip: 40 });
  });

  it('should use default limit when not provided', () => {
    const result = calculatePagination({ page: 1 });
    expect(result).toEqual({ page: 1, limit: 10, skip: 0 });
  });

  it('should format paginated response correctly', () => {
    const items = [{ id: 1 }, { id: 2 }];
    const result = formatPaginatedResponse(items, 100, 2, 10);

    expect(result).toEqual({
      data: items,
      total: 100,
      page: 2,
      limit: 10,
      totalPages: 10,
    });
  });

  it('should validate and sanitize parameters', () => {
    const result = validatePaginationParams(
      { page: -5, limit: 1000 },
      { maxLimit: 100 }
    );

    expect(result).toEqual({ page: 1, limit: 100 });
  });
});
```
