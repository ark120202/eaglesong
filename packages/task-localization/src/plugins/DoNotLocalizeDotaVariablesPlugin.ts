import _ from 'lodash';
import { Plugin } from '../service';

const DOTA_VARIABLE_REGEXP = /^%?\+?\$\w+$/;

export const DoNotLocalizeDotaVariablesPlugin: Plugin = ({ hooks }) => {
  hooks.push.tap('DoNotLocalizeDotaVariablesPlugin', files =>
    _.each(files, file =>
      _.each(file, (v, k) => {
        if (DOTA_VARIABLE_REGEXP.test(v)) {
          delete file[k];
        }
      }),
    ),
  );
};
