import { createHash } from 'crypto';
import _ from 'lodash';
import request from 'request-promise-native';
import { Provider } from '.';
import { DotaLanguage, FlatLocalizationFile, FlatLocalizationFiles, Multilingual } from '../types';

const escapeFileName = (fileName: string) => fileName.replace(/(\\|\/)/g, ' -> ');
const unescapeFileName = (fileName: string) => fileName.replace(/ -> /g, '/');

const time = () => Math.floor(Date.now() / 1000);

const languageMap: Record<DotaLanguage, string> = {
  brazilian: 'pt-BR',
  bulgarian: 'bg',
  czech: 'cs',
  danish: 'da',
  dutch: 'nl',
  english: 'en-US', // TODO: en?
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
  russian: 'ru-RU', // TODO: ru?
  schinese: 'zh-CN',
  spanish: 'es',
  swedish: 'sv',
  tchinese: 'zh-TW',
  thai: 'th',
  turkish: 'tr',
  ukrainian: 'uk',
  vietnamese: 'vi',
};

interface StringsOutputResponse {
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

export interface ProviderOptionsOneSky {
  type: 'onesky';
  projectID: number;
  apiKey: string;
  secret?: string;
}

export class OneSky implements Provider {
  public name = this.constructor.name;
  private projectID = this._opts.projectID;
  private apiKey = this._opts.apiKey;
  private secret = this._opts.secret != null ? this._opts.secret : process.env.ONESKY_SECRET;
  public constructor(private _opts: ProviderOptionsOneSky) {}

  public async fetchFiles() {
    const result: StringsOutputResponse = await this.request({
      qs: { 'platform-id': this.projectID },
      uri: 'https://api.oneskyapp.com/2/string/output',
    });

    const map: Multilingual<FlatLocalizationFiles> = {};

    _.each(result.translation, (languages, fileName) =>
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
      formData: {
        file: {
          options: { filename: escapeFileName(fileName) },
          value: JSON.stringify(content),
        },
        file_format: 'HIERARCHICAL_JSON',
        is_allow_translation_same_as_original: 'false',
        is_keeping_all_strings: 'false',
      },
      method: 'POST',
      uri: `https://platform.api.onesky.io/1/projects/${this.projectID}/files`,
    });

    if (result.meta.status !== 201) {
      throw new Error(`Response status is ${result.meta.status}, expected 201`);
    }
  }

  private async removeFile(fileName: string) {
    const result = await this.request({
      method: 'DELETE',
      qs: { file_name: fileName },
      uri: `https://platform.api.onesky.io/1/projects/${this.projectID}/files`,
    });

    return result.data;
  }

  private async listAllFiles() {
    let results: FileListResponse = [];
    let page = 1;

    while (true) {
      const onPage = await this.listFilesOnPage(page);
      if (onPage.length === 0) return results;

      results = results.concat(onPage);
      page += 1;
    }
  }

  private async listFilesOnPage(page: number): Promise<FileListResponse> {
    const result = await this.request({
      qs: { page, per_page: 100 },
      uri: `https://platform.api.onesky.io/1/projects/${this.projectID}/files`,
    });

    return result.data;
  }

  private getDevHash() {
    if (this.secret == null) return;

    return createHash('md5')
      .update(String(time()) + this.secret)
      .digest('hex');
  }

  private request(options: request.Options) {
    return request({
      ...options,
      json: true,
      qs: {
        // TODO: Remove legacy api usage
        'api-key': this.apiKey,

        api_key: this.apiKey,
        dev_hash: this.getDevHash(),
        timestamp: time(),
        ...options.qs,
      },
    });
  }
}
