import * as s from 'dota-data/lib/schema';
import { precacheTypes } from 'dota-data/lib/schemas';
import _ from 'lodash';
import vdf from 'vdf-extra';
import { Plugin } from '../../plugin';

const fileFilter = new Set(['npc/npc_items_custom', 'npc/npc_abilities_custom']);
export const AbilityPrecachePlugin: Plugin = ({ hooks }) => {
  hooks.schemas.tap('AbilityPrecachePlugin', (schemas) => {
    for (const schemaName of fileFilter) {
      for (const element of schemas[schemaName].getRestRootsLike(s.ObjectSchema)) {
        element.field(
          'precache',
          s
            .obj('Precache')
            .fields(
              Object.entries(precacheTypes).map(([n, pattern]) => [
                n,
                s.array(s.str().pattern(pattern)),
              ]),
            ),
        );
      }
    }
  });

  hooks.transform.tap('AbilityPrecachePlugin', (files, group) => {
    if (!fileFilter.has(group)) return;

    _.each(files, (file) =>
      _.each(file, ({ precache }) => {
        if (precache == null) return;
        _.each(precache, (values, key) => Array.isArray(values) && vdf.set(precache, key, values));
      }),
    );
  });

  hooks.migrate.tap('AbilityPrecachePlugin', (files, group) => {
    if (!fileFilter.has(group)) return;

    _.each(files, (file) => {
      _.each(file, ({ precache }) => {
        if (precache == null) return;

        _.each(precache, (value, key) => {
          const values: string[] = [value];
          if (precache[vdf.EXTRA_VALUES]?.[key]) {
            values.push(...precache[vdf.EXTRA_VALUES][key]);
          }

          precache[key] = values;
        });
      });
    });
  });
};
