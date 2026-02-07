/**
 * Pagination Utility
 * Shared utility for handling pagination across all services
 */

/**
 * Interface for pagination parameters
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
}

/**
 * Interface for paginated result metadata
 */
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Interface for paginated response
 */
export interface PaginatedResult<T> {
  data?: T[];
  items?: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Calculate skip and take values for pagination
 *
 * @param params - Pagination parameters (page and limit)
 * @param defaultLimit - Default limit if not provided (default: 10)
 * @returns Object containing page, limit, and skip values
 *
 * @example
 * const { page, limit, skip } = calculatePagination({ page: 2, limit: 20 });
 * // Returns: { page: 2, limit: 20, skip: 20 }
 */
export function calculatePagination(
  params: PaginationParams,
  defaultLimit: number = 10,
): { page: number; limit: number; skip: number } {
  const page = params.page && params.page > 0 ? params.page : 1;
  const limit = params.limit && params.limit > 0 ? params.limit : defaultLimit;
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

/**
 * Format paginated response with metadata
 *
 * @param items - Array of items to return
 * @param total - Total count of items
 * @param page - Current page number
 * @param limit - Number of items per page
 * @param dataKey - Key to use for items array ('data' or 'items', default: 'data')
 * @returns Paginated result object
 *
 * @example
 * const result = formatPaginatedResponse(students, 100, 2, 10);
 * // Returns: { data: [...], total: 100, page: 2, limit: 10, totalPages: 10 }
 *
 * @example
 * const result = formatPaginatedResponse(applications, 50, 1, 20, 'applications');
 * // Returns: { applications: [...], total: 50, page: 1, limit: 20, totalPages: 3 }
 */
export function formatPaginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
  dataKey?: string,
): any {
  const totalPages = Math.ceil(total / limit);

  const response: any = {
    total,
    page,
    limit,
    totalPages,
  };

  // Use custom key if provided, otherwise use 'data'
  if (dataKey) {
    response[dataKey] = items;
  } else {
    response.data = items;
  }

  return response;
}

/**
 * Create pagination metadata object
 *
 * @param total - Total count of items
 * @param page - Current page number
 * @param limit - Number of items per page
 * @returns Pagination metadata
 *
 * @example
 * const meta = createPaginationMeta(100, 2, 10);
 * // Returns: { total: 100, page: 2, limit: 10, totalPages: 10 }
 */
export function createPaginationMeta(
  total: number,
  page: number,
  limit: number,
): PaginationMeta {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Validate and sanitize pagination parameters
 * Ensures page and limit are positive numbers and within reasonable bounds
 *
 * @param params - Pagination parameters to validate
 * @param options - Validation options (maxLimit, defaultLimit)
 * @returns Validated pagination parameters
 *
 * @example
 * const validated = validatePaginationParams({ page: -1, limit: 1000 }, { maxLimit: 100 });
 * // Returns: { page: 1, limit: 100 }
 */
export function validatePaginationParams(
  params: PaginationParams,
  options: { maxLimit?: number; defaultLimit?: number } = {},
): { page: number; limit: number } {
  const { maxLimit = 100, defaultLimit = 10 } = options;

  let page = params.page || 1;
  let limit = params.limit || defaultLimit;

  // Ensure positive values
  page = Math.max(1, Math.floor(page));
  limit = Math.max(1, Math.floor(limit));

  // Apply max limit
  limit = Math.min(limit, maxLimit);

  return { page, limit };
}

/**
 * Helper to execute paginated Prisma query with Promise.all pattern
 * This is a convenience function that handles the common pattern of
 * fetching data and count in parallel
 *
 * @param queryFn - Function that returns the Prisma query for items
 * @param countFn - Function that returns the Prisma count query
 * @param params - Pagination parameters
 * @param options - Additional options (defaultLimit, dataKey)
 * @returns Promise that resolves to paginated result
 *
 * @example
 * const result = await executePaginatedQuery(
 *   (skip, take) => prisma.student.findMany({ skip, take, where }),
 *   () => prisma.student.count({ where }),
 *   { page: 1, limit: 10 }
 * );
 */
export async function executePaginatedQuery<T>(
  queryFn: (skip: number, take: number) => Promise<T[]>,
  countFn: () => Promise<number>,
  params: PaginationParams,
  options: { defaultLimit?: number; dataKey?: string } = {},
): Promise<any> {
  const { defaultLimit = 10, dataKey } = options;
  const { page, limit, skip } = calculatePagination(params, defaultLimit);

  const [items, total] = await Promise.all([
    queryFn(skip, limit),
    countFn(),
  ]);

  return formatPaginatedResponse(items, total, page, limit, dataKey);
}
