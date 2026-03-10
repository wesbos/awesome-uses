export class SiteManagementError extends Error {
  public readonly code: string;
  public readonly details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export class ToolNotFoundError extends SiteManagementError {
  constructor(toolName: string) {
    super('TOOL_NOT_FOUND', `Unknown tool "${toolName}".`);
  }
}

export class ValidationError extends SiteManagementError {
  constructor(message: string, details?: unknown) {
    super('VALIDATION_ERROR', message, details);
  }
}

export class ConfigurationError extends SiteManagementError {
  constructor(message: string, details?: unknown) {
    super('CONFIGURATION_ERROR', message, details);
  }
}

export class NotFoundError extends SiteManagementError {
  constructor(message: string, details?: unknown) {
    super('NOT_FOUND', message, details);
  }
}

export class ConflictError extends SiteManagementError {
  constructor(message: string, details?: unknown) {
    super('CONFLICT', message, details);
  }
}

export function normalizeUnknownError(error: unknown): SiteManagementError {
  if (error instanceof SiteManagementError) return error;
  if (error instanceof Error) {
    return new SiteManagementError('INTERNAL_ERROR', error.message);
  }
  return new SiteManagementError('INTERNAL_ERROR', 'Unknown error.');
}
