import { createToolRegistry, listTools } from './registry';
import { peopleTools } from './functions/people';
import { profileTagTools } from './functions/profile-tags';
import { categoryTools } from './functions/categories';
import { personItemTools } from './functions/person-items';
import { itemTools } from './functions/items';
import { pipelineTools } from './functions/pipeline';

export const allTools = [
  ...peopleTools,
  ...profileTagTools,
  ...categoryTools,
  ...personItemTools,
  ...itemTools,
  ...pipelineTools,
];

export const toolRegistry = createToolRegistry(allTools);
export const sortedTools = listTools(toolRegistry);
