import * as s from '@dota-data/scripts/lib/schema';
import { precacheTypes } from '@dota-data/scripts/lib/schemas/resources';
import _ from 'lodash';
import vdf from 'vdf-extra';
import { Hooks } from '../../service';

const fileFilter = new Set(['npc_items_custom', 'npc_abilities_custom']);
export function AbilityPrecachePlugin(hooks: Hooks) {
  hooks.schemas.tap('AbilityPrecachePlugin', schemas =>
    [schemas.npc_items_custom, schemas.npc_abilities_custom].forEach(schema =>
      schema
        .getRestRootsLike(s.ObjectSchema)
        .forEach(element =>
          element.field(
            'precache',
            s
              .obj()
              .fields(
                Object.entries(precacheTypes).map(([n, pattern]) => [
                  n,
                  s.array(s.str().pattern(pattern)),
                ]),
              ),
          ),
        ),
    ),
  );

  hooks.transform.tap('AbilityPrecachePlugin', (files, group) => {
    if (!fileFilter.has(group)) return;

    _.each(files, file =>
      _.each(file, ({ precache }) => {
        if (precache == null) return;
        _.each(precache, (values, key) => Array.isArray(values) && vdf.set(precache, key, values));
      }),
    );
  });

  hooks.migrate.tap('AbilityPrecachePlugin', (files, group) => {
    if (!fileFilter.has(group)) return;

    _.each(files, file => {
      _.each(file, ({ precache }) => {
        if (precache == null) return;

        _.each(precache, (value, key) => {
          const values: string[] = [value];
          if (precache[vdf.EXTRA_VALUES] && precache[vdf.EXTRA_VALUES][key]) {
            values.push(...precache[vdf.EXTRA_VALUES][key]);
          }

          precache[key] = values;
        });
      });
    });
  });
}
