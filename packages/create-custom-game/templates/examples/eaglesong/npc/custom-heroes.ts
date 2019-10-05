import * as s from '@dota-data/scripts/lib/schema';
import { Hooks } from '@eaglesong/task-npc';

export function CustomHeroesPlugin(hooks: Hooks) {
  hooks.schemas.tap('CustomHeroesPlugin', schemas => {
    schemas['custom-heroes'] = s.root().rest(
      s
        .obj('CustomHero')
        .field('model', s.str(), { require: true })
        .field('modelScale', s.num(), { require: true })
        .field('attackRate', s.num(), { require: true })
        .field('abilities', s.array(s.str()), { require: true }),
    );
  });

  hooks.transform.tap('CustomHeroesPlugin', (files, group) => {
    if (group === 'custom-heroes') {
      for (const key in files) {
        delete files[key];
      }
    }
  });
}
