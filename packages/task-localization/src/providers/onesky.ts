import { createHash } from 'crypto';
import _ from 'lodash';
import request from 'request-promise-native';
import { Provider } from '.';
import { DotaLanguage, FlatLocalizationFile, FlatLocalizationFiles, Multilingual } from '../types';

const escapeFileName = (fileName: string) => fileName.replace(/\//g, ' -> ');
const unescapeFileName = (fileName: string) => fileName.replace(/ -> /g, '/');

/* eslint sort-keys: "error" */

// TODO: Move to dota-data
// https://partner.steamgames.com/doc/store/localization#supported_languages
const originalLanguageMap: Record<DotaLanguage | 'arabic', string> = {
  arabic: 'ar',
  brazilian: 'pt-BR',
  bulgarian: 'bg',
  czech: 'cs',
  danish: 'da',
  dutch: 'nl',
  english: 'en',
  finnish: 'fi',
  french: 'fr',
  german: 'de',
  greek: 'el',
  hungarian: 'hu',
  italian: 'it',
  japanese: 'ja',
  koreana: 'ko',
  latam: 'es-419',
  norwegian: 'no',
  polish: 'pl',
  portuguese: 'pt',
  romanian: 'ro',
  russian: 'ru',
  schinese: 'zh-CN',
  spanish: 'es',
  swedish: 'sv',
  tchinese: 'zh-TW',
  thai: 'th',
  turkish: 'tr',
  ukrainian: 'uk',
  vietnamese: 'vn',
};

const languageMap: Record<DotaLanguage, string> = {
  ...originalLanguageMap,
  english: 'en-US',
  russian: 'ru-RU',
  vietnamese: 'vi',
};

/* eslint sort-keys: "off" */

type StringsOutputResponse =
  | { response: 'Initializing output for API. Will be ready within 5 minutes' }
  | { response: 'up-to-date' }
  | StringsOutputSuccessResponse;

interface StringsOutputSuccessResponse {
  translation: Record<string, Record<string, FlatLocalizationFile>>;
  md5: string;
}

type FileListResponse = {
  file_name: string;
  string_count: number;
  last_import: { id: number; status: string };
  uploaded_at: string;
  uploaded_at_timestamp: number;
}[];

export interface OneSkyProviderOptions {
  projectId: number;
  apiKey: string;
}

export class OneSkyProvider implements Provider {
  public name = this.constructor.name;
  private readonly projectId: number;
  private readonly apiKey: string;
  private readonly secret = process.env.EAGLESONG_ONESKY_SECRET;
  constructor(options: OneSkyProviderOptions) {
    this.projectId = options.projectId;
    this.apiKey = options.apiKey;
  }

  public makeLocalGroups(baseFiles: FlatLocalizationFiles, defaultLanguage: DotaLanguage) {
    return { [defaultLanguage]: baseFiles };
  }

  public async fetchFiles() {
    const result: StringsOutputResponse = await this.request({
      uri: 'https://api.oneskyapp.com/2/string/output',
      qs: { 'platform-id': this.projectId, md5: '0e594afa458e2edefd9956cbf4d44a46' },
    });

    const map: Multilingual<FlatLocalizationFiles> = {};

    // TODO:
    _.each((result as StringsOutputSuccessResponse).translation, (languages, fileName) =>
      _.each(languages, (tokens, oneSkyLang) => {
        const dotaLang = _.findKey(languageMap, x => x === oneSkyLang) as DotaLanguage | undefined;
        if (dotaLang == null) {
          throw new Error(
            `File ${fileName} has an unknown ${oneSkyLang} translation. Check language map.`,
          );
        }

        (map[dotaLang] || (map[dotaLang] = {}))[fileName] = tokens;
      }),
    );

    return map;
  }

  public async pushFiles(files: FlatLocalizationFiles) {
    const oldFileNames = (await this.listAllFiles()).map(file => unescapeFileName(file.file_name));
    const newFileNames = Object.keys(files).map(escapeFileName);
    const removedFileNames = _.pullAll(oldFileNames, newFileNames);

    await Promise.all(removedFileNames.map(f => this.removeFile(f)));
    await Promise.all(Object.entries(files).map(([path, tokens]) => this.uploadFile(path, tokens)));

    return { removed: removedFileNames };
  }

  private async uploadFile(fileName: string, content: FlatLocalizationFile) {
    const result = await this.request({
      uri: `https://platform.api.onesky.io/1/projects/${this.projectId}/files`,
      method: 'POST',
      formData: {
        file: {
          options: { filename: escapeFileName(fileName) },
          value: JSON.stringify(content),
        },
        file_format: 'HIERARCHICAL_JSON',
        // is_allow_translation_same_as_original: 'false',
        is_keeping_all_strings: 'false',
      },
    });

    if (result.meta.status !== 201) {
      throw new Error(`Response status is ${result.meta.status}, expected 201`);
    }
  }

  private async removeFile(fileName: string) {
    const result = await this.request({
      uri: `https://platform.api.onesky.io/1/projects/${this.projectId}/files`,
      method: 'DELETE',
      qs: { file_name: escapeFileName(fileName) },
    });

    return result.data;
  }

  private async listAllFiles() {
    let results: FileListResponse = [];
    let page = 1;

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (true) {
      const onPage = await this.listFilesOnPage(page);
      if (onPage.length === 0) return results;

      results = results.concat(onPage);
      page += 1;
    }
  }

  private async listFilesOnPage(page: number): Promise<FileListResponse> {
    const result = await this.request({
      uri: `https://platform.api.onesky.io/1/projects/${this.projectId}/files`,
      qs: { page, per_page: 100 },
    });

    return result.data;
  }

  private getSecrets() {
    if (this.secret == null) return {};

    const timestamp = Math.floor(Date.now() / 1000);
    return {
      timestamp,
      dev_hash: createHash('md5')
        .update(String(timestamp) + this.secret)
        .digest('hex'),
    };
  }

  private async request(options: request.Options) {
    return request({
      ...options,
      json: true,
      qs: {
        // TODO: Remove legacy api usage
        'api-key': this.apiKey,

        api_key: this.apiKey,
        ...this.getSecrets(),
        ...options.qs,
      },
    });
  }
}
