import {
  NamedType,
  ServiceErrorReporter,
  ServicePluginApi,
  ServiceProvider,
} from '@eaglesong/helper-task';
import dedent from 'dedent';
import _ from 'lodash';
import pProps from 'p-props';
import { AsyncSeriesHook, Hook } from 'tapable';
import { Provider, ProviderOption, resolveProviderOption } from './providers';
import {
  DotaLanguage,
  FlatLocalizationFile,
  FlatLocalizationFiles,
  isDotaLanguage,
  LocalizationFile,
  LocalizationFiles,
  Multilingual,
} from './types';

export {
  DotaLanguage,
  FlatLocalizationFile,
  FlatLocalizationFiles,
  LocalizationFile,
  LocalizationFiles,
  Provider,
  ProviderOption,
};

export type Plugin = (api: PluginApi) => void;
export type PluginApi = ServicePluginApi & { hooks: Hooks };

function getFilesMeta(files: LocalizationFiles) {
  const fileList = Object.values(files);
  const values: string[] = fileList.flatMap(Object.values);
  const chars = values.reduce((n, s) => n + s.length, 0);

  return {
    files: fileList.length,
    strings: values.length,
    chars,
  };
}

export type Hooks = LocalizationService['hooks'] & NamedType;
export class LocalizationService {
  public hooks = {
    /**
     * Called for all files before they are pushed to localization provider.
     *
     * Used for making custom syntax rules.
     */
    preprocess: new AsyncSeriesHook<[LocalizationFile, string]>(['file', 'fileName']),

    /**
     * Called either for local files and localiz
     * ed ones, received from provider.
     *
     * Used to implement any custom behavior.
     */
    postprocess: new AsyncSeriesHook<[FlatLocalizationFiles, DotaLanguage]>(['files', 'language']),

    /**
     * Called before sending strings to localization provider.
     */
    push: new AsyncSeriesHook<[FlatLocalizationFiles]>(['files']),

    /**
     * The last hook before emitting merged files.
     */
    emit: new AsyncSeriesHook<[FlatLocalizationFile, DotaLanguage]>(['file', 'language']),
  };

  private readonly provider: Provider;
  constructor(
    context: string,
    plugins: Plugin[],
    serviceProvider: ServiceProvider,
    private readonly error: ServiceErrorReporter,
    private readonly defaultLanguage: DotaLanguage,
    providerOption: ProviderOption,
  ) {
    this.provider = resolveProviderOption(providerOption);

    const api: PluginApi = {
      hooks: this.hooks,
      serviceProvider,
      error,
      context,
    };

    plugins.forEach(p => p(api));
  }

  private readonly baseFiles: FlatLocalizationFiles = {};
  public async addFile(fileName: string, fileContent: LocalizationFile) {
    this.baseFiles[fileName] = await this.preprocess(fileContent, fileName);
  }

  public removeFile(fileName: string) {
    delete this.baseFiles[fileName];
  }

  /**
   * Attach (or replace) string.
   * Made for external service usage.
   *
   * @param key String identifier
   * @param value Localized (to base language) line.
   * @param fileName Relative name of string's source file. Used in localization platforms.
   */
  public addString(key: string, value: string, fileName: string) {
    let dict = this.baseFiles[fileName];
    if (dict == null) dict = this.baseFiles[fileName] = {};
    dict[key] = value;
  }

  public canPushBaseLocalizations() {
    return this.provider.pushFiles != null;
  }

  public async pushBaseLocalizations(log: (message: string) => void) {
    if (!this.canPushBaseLocalizations()) {
      throw new Error('Localization provider not supports remote features');
    }

    const baseFiles = _.cloneDeep(this.baseFiles);
    await this.hooks.push.promise(baseFiles);

    const { files, strings, chars } = getFilesMeta(baseFiles);
    log(dedent`
      [Localization] Pushing update to ${this.provider.name} consisting of:
        - ${files} files
        - ${strings} strings
        - ${chars} chars
    `);

    try {
      const { removed } = await this.provider.pushFiles!(baseFiles);

      if (removed.length > 0) log(`[Localization] Removed ${removed.length} files`);
      log('[Localization] Push complete');
    } catch (error) {
      log(`[Localization] Push error:\n${error.toString()}`);
    }
  }

  public canFetchLocalizations() {
    return this.provider.fetchFiles != null;
  }

  public async fetchLocalizations(): Promise<Multilingual<FlatLocalizationFile>> {
    if (!this.canFetchLocalizations()) {
      throw new Error('Localization provider not supports remote features');
    }

    return this.postprocessAll(await this.provider.fetchFiles!());
  }

  public async emit(): Promise<Multilingual<FlatLocalizationFile>> {
    return this.postprocessAll(
      this.provider.makeLocalGroups(this.baseFiles, this.defaultLanguage),
      this.hooks.emit,
    );
  }

  private async preprocess(
    file: LocalizationFile,
    fileName: string,
  ): Promise<FlatLocalizationFile> {
    file = _.cloneDeep(file);
    await this.hooks.preprocess.promise(file, fileName);

    _.each(file, (value, key) => {
      if (typeof value !== 'string') {
        this.error({
          fileName,
          message:
            `String "${key}" has incorrect value of type ${typeof value} (string expected). ` +
            'Change it or apply plugin to transform it.',
        });
      }
    });

    return file as FlatLocalizationFile;
  }

  private async postprocess(
    files: FlatLocalizationFiles,
    language: DotaLanguage,
  ): Promise<FlatLocalizationFile> {
    files = _.cloneDeep(files);

    await this.hooks.postprocess.promise(files, language);

    const keyCache: Record<string, string[]> = {};
    _.each(files, (file, fileName) =>
      Object.keys(file).forEach(key => {
        if (keyCache[key] == null) keyCache[key] = [];
        keyCache[key].push(fileName);
      }),
    );

    for (const [key, fileList] of Object.entries(keyCache)) {
      if (fileList.length > 1) {
        const definedIn = fileList.length === 1 ? `'${fileList[0]}'` : `[${fileList.join(', ')}]`;
        this.error({
          message: `Key ${key} is defined in ${definedIn}, yet only one definition is allowed.`,
        });
      }
    }

    return Object.assign({}, ...Object.values(files));
  }

  private async postprocessAll(
    groups: Multilingual<FlatLocalizationFiles>,
    hook?: Hook<[FlatLocalizationFile, DotaLanguage], void>,
  ): Promise<Multilingual<FlatLocalizationFile>> {
    const localizedFiles = await pProps(groups, async (files, language) => {
      if (files == null) return;
      if (!isDotaLanguage(language)) {
        throw new Error(`Language '${language}' is unsupported`);
      }

      const processed = await this.postprocess(files, language);
      if (hook != null) {
        await hook.promise(processed, language);
      }

      return processed;
    });

    return localizedFiles;
  }
}
