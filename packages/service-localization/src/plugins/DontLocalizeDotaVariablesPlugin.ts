import _ from 'lodash';
import { Hooks } from '..';

const DOTA_VARIABLE_REGEXP = /^%?\+?\$\w+$/;

export async function DontLocalizeDotaVariablesPlugin(hooks: Hooks) {
  hooks.push.tap('DontLocalizeDotaVariablesPlugin', files =>
    _.each(files, file =>
      _.each(file, (v, k) => {
        if (!DOTA_VARIABLE_REGEXP.test(v)) delete file[k];
      }),
    ),
  );
}
