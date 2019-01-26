import { Hooks, NpcPluginApi } from '../..';

export function EnsureSchemaExistsPlugin(hooks: Hooks, { error, collectedSchemas }: NpcPluginApi) {
  hooks.transform.tap({ name: 'ValidateSchemasPlugin', stage: -10 }, (_files, group) => {
    if (collectedSchemas[group] == null) {
      error(null, `Group "${group}" has no schema`, 'warning');
    }
  });
}
