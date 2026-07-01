export class PaginationQueryDto {
  page?: number = 1;
  limit?: number = 20;
  sortBy?: string = 'created_at';
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
