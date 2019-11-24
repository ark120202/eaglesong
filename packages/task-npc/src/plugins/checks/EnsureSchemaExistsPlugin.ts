import { Plugin } from '../../service';

export const EnsureSchemaExistsPlugin: Plugin = ({ hooks, error, collectedSchemas }) => {
  hooks.transform.tap({ name: 'ValidateSchemasPlugin', stage: -10 }, (_files, group) => {
    if (collectedSchemas[group] == null) {
      error(null, `Group "${group}" has no schema`, 'warning');
    }
  });
};
