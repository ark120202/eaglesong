import _ from 'lodash';
import { Hooks, NpcPluginApi } from '../../service';

export function ValidateSchemasPlugin(hooks: Hooks, { error, collectedSchemas }: NpcPluginApi) {
  hooks.transform.tap({ name: 'ValidateSchemasPlugin', stage: -10 }, (files, group) => {
    if (collectedSchemas[group] == null) return;
    _.each(files, (file, fileName) => {
      delete file.$schema;

      const errors = collectedSchemas[group].validateRoot(file);
      errors.forEach(message => error(fileName, message));
    });
  });
}
