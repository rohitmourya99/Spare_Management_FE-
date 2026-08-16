import { Response } from 'express';

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  message: string;
  data?: T;
  pagination?: PaginationMeta;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  errors?: Record<string, string> | string[];
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export class ApiResponse {
  static success<T>(
    res: Response,
    data: T,
    message = 'Success',
    statusCode = 200
  ): Response {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
    } as ApiSuccessResponse<T>);
  }

  static paginated<T>(
    res: Response,
    data: T[],
    pagination: PaginationMeta,
    message = 'Success'
  ): Response {
    return res.status(200).json({
      success: true,
      message,
      data,
      pagination,
    } as ApiSuccessResponse<T[]>);
  }

  static created<T>(res: Response, data: T, message = 'Created successfully'): Response {
    return res.status(201).json({
      success: true,
      message,
      data,
    } as ApiSuccessResponse<T>);
  }

  static noContent(res: Response): Response {
    return res.status(204).send();
  }

  static badRequest(res: Response, message: string): Response {
    return res.status(400).json({ success: false, message } as ApiErrorResponse);
  }

  static unauthorized(res: Response, message = 'Unauthorized'): Response {
    return res.status(401).json({ success: false, message } as ApiErrorResponse);
  }

  static forbidden(res: Response, message = 'Forbidden'): Response {
    return res.status(403).json({ success: false, message } as ApiErrorResponse);
  }

  static notFound(res: Response, message = 'Not found'): Response {
    return res.status(404).json({ success: false, message } as ApiErrorResponse);
  }

  static conflict(res: Response, message: string): Response {
    return res.status(409).json({ success: false, message } as ApiErrorResponse);
  }

  static validationError(res: Response, errors: Record<string, string>): Response {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors,
    } as ApiErrorResponse);
  }

  static serverError(res: Response, message = 'Internal server error'): Response {
    return res.status(500).json({ success: false, message } as ApiErrorResponse);
  }
}

/**
 * Build pagination metadata
 */
export function buildPagination(
  page: number,
  limit: number,
  total: number
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

/**
 * Parse pagination query params
 */
export function parsePagination(query: {
  page?: string;
  limit?: string;
}): { page: number; limit: number; skip: number } {
  const page = Math.max(1, parseInt(query.page ?? '1', 10));
  const limit = Math.min(10000, Math.max(1, parseInt(query.limit ?? '20', 10)));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}
