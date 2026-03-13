#!/usr/bin/env tsx
import { readFile } from 'node:fs/promises';
import { createSiteManagementContext, executeTool, sortedTools, toolRegistry } from '../src/site-management';

type ParsedArgs = {
  command: 'list' | 'call';
  toolName?: string;
  input: unknown;
};

function parseArgs(argv: string[]): ParsedArgs {
  const [commandRaw, maybeToolName, ...rest] = argv;
  const command = commandRaw as ParsedArgs['command'];

  if (!command || !['list', 'call'].includes(command)) {
    throw new Error('Usage: site-management-cli <list|call> [toolName] [--input JSON | --input-file path]');
  }

  const readFlag = (flag: string): string | undefined => {
    const index = rest.indexOf(flag);
    if (index === -1) return undefined;
    return rest[index + 1];
  };

  const inputRaw = readFlag('--input');
  const inputFile = readFlag('--input-file');

  if (command === 'call' && !maybeToolName) {
    throw new Error('Usage: site-management-cli call <toolName> [--input JSON | --input-file path]');
  }

  return {
    command,
    toolName: maybeToolName,
    input:
      typeof inputRaw === 'string'
        ? JSON.parse(inputRaw)
        : inputFile
          ? { __inputFile: inputFile }
          : {},
  };
}

async function resolveInput(input: unknown): Promise<unknown> {
  if (!input || typeof input !== 'object') return input;
  const maybeFile = (input as { __inputFile?: string }).__inputFile;
  if (!maybeFile) return input;
  const raw = await readFile(maybeFile, 'utf8');
  return JSON.parse(raw);
}

async function main() {
  try {
    const parsed = parseArgs(process.argv.slice(2));
    if (parsed.command === 'list') {
      const rows = sortedTools.map((tool) => ({
        name: tool.name,
        scope: tool.scope,
        description: tool.description,
      }));
      console.log(JSON.stringify({ ok: true, total: rows.length, rows }, null, 2));
      return;
    }

    const context = createSiteManagementContext();
    const input = await resolveInput(parsed.input);
    const result = await executeTool(toolRegistry, context, parsed.toolName!, input);
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  }
}

void main();
