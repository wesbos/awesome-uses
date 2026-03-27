import type { z } from 'zod';
import type { ToolDefinition, ToolRegistry } from './types';
import { ConflictError } from './errors';

export function defineTool<TSchema extends z.ZodTypeAny, TResult>(
  definition: ToolDefinition<TSchema, TResult>,
): ToolDefinition<TSchema, TResult> {
  return definition;
}

export function createToolRegistry(tools: ToolDefinition[]): ToolRegistry {
  const registry: ToolRegistry = {};
  for (const tool of tools) {
    if (registry[tool.name]) {
      throw new ConflictError(`Duplicate tool registration for "${tool.name}".`);
    }
    registry[tool.name] = tool;
  }
  return registry;
}

export function listTools(registry: ToolRegistry): ToolDefinition[] {
  return Object.values(registry).sort((a, b) => a.name.localeCompare(b.name));
}
