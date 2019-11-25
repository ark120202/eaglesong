import { Plugin } from '../../service';

export const EnsureSchemaExistsPlugin: Plugin = ({ hooks, error, collectedSchemas }) => {
  hooks.transform.tap({ name: 'ValidateSchemasPlugin', stage: -10 }, (files, group) => {
    if (collectedSchemas[group] != null) return;

    for (const fileName of Object.keys(files)) {
      error({
        fileName,
        level: 'warning',
        message: `Group '${group}' has no schema`,
      });
    }
  });
};
