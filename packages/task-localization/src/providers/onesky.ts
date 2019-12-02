import { createHash } from 'crypto';
import { dotaLanguagesData } from 'dota-data/lib/localization';
import FormData from 'form-data';
import got from 'got';
import _ from 'lodash';
import { Provider } from '.';
import { DotaLanguage, FlatLocalizationFile, FlatLocalizationFiles, Multilingual } from '../types';

const escapeFileName = (fileName: string) => fileName.replace(/\//g, ' -> ');

const languageCodeToDotaLanguage = _.invert({
  ..._.mapValues(dotaLanguagesData, d => d.code),
  english: 'en-US',
  russian: 'ru-RU',
  vietnamese: 'vi',
}) as Record<string, DotaLanguage>;

type StringsOutputResponse =
  | { response: 'Initializing output for API. Will be ready within 5 minutes' }
  | { response: 'up-to-date' }
  | StringsOutputSuccessResponse;

interface StringsOutputSuccessResponse {
  translation: Record<string, Record<string, FlatLocalizationFile>>;
  md5: string;
}

interface ListFile {
  file_name: string;
  string_count: number;
  last_import: { id: number; status: string };
  uploaded_at: string;
  uploaded_at_timestamp: number;
}

interface ListFilesResponse {
  meta: any;
  data: ListFile[];
}

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
    const result = await got({
      url: 'https://api.oneskyapp.com/2/string/output',
      searchParams: { ...this.getRequestParameters(), 'platform-id': this.projectId },
    }).json<StringsOutputResponse>();

    const map: Multilingual<FlatLocalizationFiles> = {};

    // TODO:
    _.each((result as StringsOutputSuccessResponse).translation, (tokenGroups, fileName) =>
      _.each(tokenGroups, (tokens, languageCode) => {
        const language = languageCodeToDotaLanguage[languageCode];
        if (language == null) {
          throw new Error(`File '${fileName}' has an unknown '${languageCode}' translation`);
        }

        (map[language] ?? (map[language] = {}))[fileName] = tokens;
      }),
    );

    return map;
  }

  public async pushFiles(files: FlatLocalizationFiles) {
    const oldFileNames = (await this.listAllFiles()).map(x => x.file_name);
    const newFileNames = Object.keys(files).map(escapeFileName);
    const removedFileNames = _.difference(oldFileNames, newFileNames);

    await Promise.all(removedFileNames.map(f => this.removeFile(f)));
    await Promise.all(Object.entries(files).map(([path, tokens]) => this.uploadFile(path, tokens)));

    return { removed: removedFileNames };
  }

  private async uploadFile(fileName: string, content: FlatLocalizationFile) {
    const form = new FormData();
    form.append('file', JSON.stringify(content), { filename: escapeFileName(fileName) });
    form.append('file_format', 'HIERARCHICAL_JSON');
    form.append('is_keeping_all_strings', 'false');

    const { statusCode } = await got.post({
      url: `https://platform.api.onesky.io/1/projects/${this.projectId}/files`,
      body: form,
      searchParams: this.getRequestParameters(),
    });

    if (statusCode !== 201) {
      throw new Error(`Response status is ${statusCode}, expected 201`);
    }
  }

  private async removeFile(escapedFileName: string) {
    await got.delete({
      url: `https://platform.api.onesky.io/1/projects/${this.projectId}/files`,
      searchParams: { ...this.getRequestParameters(), file_name: escapedFileName },
    });
  }

  private async listAllFiles() {
    const allFiles: ListFile[] = [];

    let page = 1;
    while (true) {
      const filesOnPage = await this.listFilesOnPage(page);
      if (filesOnPage.length === 0) {
        return allFiles;
      }

      allFiles.push(...filesOnPage);
      page += 1;
    }
  }

  private async listFilesOnPage(page: number) {
    const { data } = await got({
      url: `https://platform.api.onesky.io/1/projects/${this.projectId}/files`,
      searchParams: { ...this.getRequestParameters(), page, per_page: 100 },
    }).json<ListFilesResponse>();

    return data;
  }

  private getRequestParameters() {
    const parameters: Record<string, any> = {
      'api-key': this.apiKey,
      api_key: this.apiKey,
    };

    if (this.secret != null) {
      const timestamp = Math.floor(Date.now() / 1000);
      parameters.timestamp = timestamp;
      parameters.dev_hash = createHash('md5')
        .update(String(timestamp) + this.secret)
        .digest('hex');
    }

    return parameters;
  }
}
