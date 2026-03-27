import { ZodError } from 'zod';
import type { SiteManagementContext } from './context';
import { ToolNotFoundError, ValidationError, normalizeUnknownError } from './errors';
import type { ToolExecutionResult, ToolRegistry } from './types';

export async function executeTool(
  registry: ToolRegistry,
  context: SiteManagementContext,
  toolName: string,
  input: unknown,
): Promise<ToolExecutionResult> {
  const tool = registry[toolName];
  if (!tool) {
    const error = new ToolNotFoundError(toolName);
    return {
      ok: false,
      tool: toolName,
      error: { code: error.code, message: error.message, details: error.details },
    };
  }

  try {
    const parsedInput = tool.inputSchema.parse(input);
    const result = await tool.handler(context, parsedInput);
    return {
      ok: true,
      tool: toolName,
      result,
    };
  } catch (error) {
    const normalizedError =
      error instanceof ZodError
        ? new ValidationError('Tool input validation failed.', error.flatten())
        : normalizeUnknownError(error);
    return {
      ok: false,
      tool: toolName,
      error: {
        code: normalizedError.code,
        message: normalizedError.message,
        details: normalizedError.details,
      },
    };
  }
}
