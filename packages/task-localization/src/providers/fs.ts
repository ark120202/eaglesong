import _ from 'lodash';
import { Provider } from '.';
import { FlatLocalizationFiles, isDotaLanguage, Multilingual } from '../types';

export interface ProviderOptionsFs {
  type: 'fs';
}

export class Fs implements Provider {
  public name = this.constructor.name;
  public makeGroups(baseFiles: FlatLocalizationFiles) {
    const result: Multilingual<FlatLocalizationFiles> = {};

    for (const [name, content] of Object.entries(baseFiles)) {
      const [language] = name.split('/');
      if (!isDotaLanguage(language)) {
        throw new Error(`Unexpected language ${language}`);
      }

      let files = result[language];
      if (files == null) files = result[language] = {};

      files[name] = content;
    }

    return result;
  }
}
