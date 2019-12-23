import { getGroupSchema, Plugin } from '../../plugin';

export const EnsureSchemaExistsPlugin: Plugin = ({ hooks, error, collectedSchemas }) => {
  hooks.transform.tap({ name: 'ValidateSchemasPlugin', stage: -10 }, (files, group) => {
    if (getGroupSchema(collectedSchemas, group) != null) return;

    for (const fileName of Object.keys(files)) {
      error({
        fileName,
        level: 'warning',
        message: `Group '${group}' has no schema`,
      });
    }
  });
};
