import * as s from '@dota-data/scripts/lib/schema';
import _ from 'lodash';
import { Hooks } from '../..';

const fileFilter = new Set(['npc_units_custom', 'npc_heroes_custom']);

export function UnitAbilitiesPlugin(hooks: Hooks) {
  hooks.schemas.tap('UnitAbilitiesPlugin', schemas =>
    Object.entries(schemas)
      .filter(([schemaName]) => fileFilter.has(schemaName))
      .forEach(([, schema]) =>
        schema.getRestRootsLike(s.ObjectSchema).forEach(element => {
          element.fieldBefore('Ability1', 'Abilities', s.array(s.str()));
          _.times(24, i => element.delete(`Ability${i + 1}`));
        }),
      ),
  );

  hooks.transform.tap('UnitAbilitiesPlugin', (files, group) => {
    if (!fileFilter.has(group)) return;
    _.each(files, file =>
      _.each(file, unit => {
        if (_.isPlainObject(unit) && Array.isArray(unit.Abilities)) {
          for (const [index, ability] of (unit.Abilities as string[]).entries()) {
            unit[`Ability${index + 1}`] = ability;
          }

          delete unit.Abilities;
        }
      }),
    );
  });

  hooks.migrate.tap('UnitAbilitiesPlugin', (files, group) => {
    if (!fileFilter.has(group)) return;
    _.each(files, file => {
      _.each(file, unit => {
        const abilities: string[] = [];
        _.range(1, 24).forEach(n => {
          const name = `Ability${n}`;
          if (unit[name] != null) {
            abilities[n - 1] = unit[name];
            delete unit[name];
          }
        });
        unit.Abilities = abilities;
      });
    });
  });
}
