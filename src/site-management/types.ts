import type { z } from 'zod';
import type { SiteManagementContext } from './context';

export type ToolScope = 'people' | 'profileTags' | 'categories' | 'personItems' | 'items' | 'pipeline';

export type ToolDefinition<
  TSchema extends z.ZodTypeAny = z.ZodTypeAny,
  TResult = unknown,
> = {
  name: string;
  scope: ToolScope;
  description: string;
  inputSchema: TSchema;
  handler: (context: SiteManagementContext, input: z.infer<TSchema>) => Promise<TResult> | TResult;
};

export type ToolRegistry = Record<string, ToolDefinition>;

export type ToolExecutionSuccess<TResult = unknown> = {
  ok: true;
  tool: string;
  result: TResult;
};

export type ToolExecutionFailure = {
  ok: false;
  tool: string;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type ToolExecutionResult<TResult = unknown> =
  | ToolExecutionSuccess<TResult>
  | ToolExecutionFailure;
