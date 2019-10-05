import _ from 'lodash';
import { Hooks } from '../service';

function flatten(
  object: Record<string, any>,
  previousKey: string,
  tokens: Record<string, any> = {},
) {
  _.each(object, (value, currentKey) => {
    const isVariable = currentKey.startsWith('$');

    if (isVariable) currentKey = currentKey.slice(1);
    let newKey = currentKey === '_' ? previousKey : `${previousKey}_${currentKey}`;
    if (isVariable) newKey = `$${newKey}`;

    if (_.isPlainObject(value)) {
      flatten(value, newKey, tokens);
    } else {
      tokens[newKey] = value;
    }
  });

  return tokens;
}

export function NestingPlugin(hooks: Hooks) {
  hooks.preprocess.tap('NestingPlugin', file => {
    _.each(file, (value, key) => {
      if (!_.isPlainObject(value)) return;

      const flatProperties = flatten(value, key);
      delete file[key];
      Object.assign(file, flatProperties);
    });
  });
}
