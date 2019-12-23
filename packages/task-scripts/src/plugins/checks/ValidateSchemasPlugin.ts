import _ from 'lodash';
import { getGroupSchema, Plugin } from '../../plugin';

export const ValidateSchemasPlugin: Plugin = ({ hooks, error, collectedSchemas }) => {
  hooks.transform.tap({ name: 'ValidateSchemasPlugin', stage: -10 }, (files, group) => {
    const schema = getGroupSchema(collectedSchemas, group);
    if (schema == null) return;

    _.each(files, (file, fileName) => {
      delete file.$schema;

      for (const message of schema.validateRoot(file)) {
        error({ fileName, message });
      }
    });
  });
};
