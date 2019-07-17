import fs from 'fs-extra';
import yaml from 'js-yaml';
import _ from 'lodash';

const customHeroesPath = __dirname + '/../custom-heroes.yml';
export default () => {
  // api.addDependency('customHeroesPath')
  const customHeroes: CustomHeroes.Root = yaml.safeLoad(fs.readFileSync(customHeroesPath, 'utf8'));
  _.mapValues(customHeroes, (hero): NpcUnitsCustom.Root[string] => ({
    BaseClass: 'npc_dota_hero',
    // // @ts-ignore
    // HeroFrameworkDummyUnit: true,
    Model: hero.model,
    ModelScale: hero.modelScale,
  }));
};
