import _ from 'lodash';
import { Plugin } from '../service';

export const NestingPlugin: Plugin = ({ hooks }) => {
  hooks.preprocess.tap('NestingPlugin', (file) => {
    function flatten(object: Record<string, any>, previousKey?: string) {
      _.each(object, (value, key) => {
        if (typeof value === 'string') return;

        const fullKey =
          previousKey == null ? key : key === '_' ? previousKey : `${previousKey}_${key}`;

        delete object[key];
        if (_.isPlainObject(value)) {
          flatten(value, fullKey);
        } else if (Array.isArray(value)) {
          flatten(Object.fromEntries(value.map((v, i) => [i + 1, v])), fullKey);
        } else {
          file[fullKey] = String(value);
        }
      });
    }

    flatten(file);
  });
};
