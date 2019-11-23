import _ from 'lodash';
import { Provider } from '.';
import { FlatLocalizationFiles, isDotaLanguage, Multilingual } from '../types';

export class FileSystemProvider implements Provider {
  public name = this.constructor.name;
  public makeLocalGroups(baseFiles: FlatLocalizationFiles) {
    const result: Multilingual<FlatLocalizationFiles> = {};

    for (const [name, content] of Object.entries(baseFiles)) {
      const [language] = name.split('/');
      if (!isDotaLanguage(language)) {
        throw new Error(`Language '${language}' is unsupported`);
      }

      let files = result[language];
      if (files == null) files = result[language] = {};

      files[name] = content;
    }

    return result;
  }
}
