import _ from 'lodash';
import { Plugin } from '../../service';

export const ValidateSchemasPlugin: Plugin = ({ hooks, error, collectedSchemas }) => {
  hooks.transform.tap({ name: 'ValidateSchemasPlugin', stage: -10 }, (files, group) => {
    if (collectedSchemas[group] == null) return;
    _.each(files, (file, fileName) => {
      delete file.$schema;

      const schema = collectedSchemas[group];
      for (const message of schema.validateRoot(file)) {
        error({ fileName, message });
      }
    });
  });
};
