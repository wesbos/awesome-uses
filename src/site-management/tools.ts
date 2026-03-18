import { createToolRegistry, listTools } from './registry';
import { peopleTools } from './functions/people';
import { profileTagTools } from './functions/profile-tags';
import { tagTools } from './functions/tags';
import { personItemTools } from './functions/person-items';
import { itemTools } from './functions/items';
import { pipelineTools } from './functions/pipeline';
import { avatarTools } from './functions/avatars';

export const allTools = [
  ...peopleTools,
  ...profileTagTools,
  ...tagTools,
  ...personItemTools,
  ...itemTools,
  ...pipelineTools,
  ...avatarTools,
];

export const toolRegistry = createToolRegistry(allTools);
export const sortedTools = listTools(toolRegistry);
