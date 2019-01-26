import _ from 'lodash';
import { Provider } from '.';
import { FlatLocalizationFiles, isDotaLanguage, Multilingual } from '../types';

export interface ProviderOptionsFs {
  type: 'fs';
}

export class Fs implements Provider {
  public name = this.constructor.name;
  public makeGroups(baseFiles: FlatLocalizationFiles) {
    return _.reduce<FlatLocalizationFiles, Multilingual<FlatLocalizationFiles>>(
      baseFiles,
      (acc, content, name) => {
        const language = name.split('/')[0];
        if (!isDotaLanguage(language)) throw new Error(`Unexpected language ${language}`);

        let languageAcc = acc[language];
        if (languageAcc == null) languageAcc = acc[language] = {};
        languageAcc[name] = content;

        return acc;
      },
      {},
    );
  }
}
