import {
  NamedType,
  ServiceErrorReporter,
  ServicePlugin,
  ServicePluginApi,
  ServiceProvider,
  TriggerChange,
} from '@eaglesong/helper-service';
import dedent from 'dedent';
import _ from 'lodash';
import pProps from 'p-props';
import { AsyncSeriesHook, Hook } from 'tapable';
import * as defaultPlugins from './plugins';
import { mapTypeToPlatform, Provider, ProviderOptions } from './providers';
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
  defaultPlugins,
  DotaLanguage,
  FlatLocalizationFile,
  FlatLocalizationFiles,
  LocalizationFile,
  LocalizationFiles,
  Provider,
  ProviderOptions,
};

export type LocalizationPluginApi = ServicePluginApi;
export type LocalizationPlugin = ServicePlugin<Hooks, LocalizationPluginApi>;

function getFilesMeta(files: LocalizationFiles) {
  const fileList = Object.values(files);
  const values = fileList.reduce<string[]>((acc, f) => [...acc, ...Object.values(f)], []);
  const chars = values.reduce((n, s) => n + s.length, 0);

  return {
    chars,
    files: fileList.length,
    strings: values.length,
  };
}

export type Hooks = LocalizationService['hooks'] & NamedType;
export class LocalizationService {
  public hooks = {
    /**
     * Called for all files before they are pushed to localization platform.
     *
     * Used for making custom syntax rules.
     */
    preprocess: new AsyncSeriesHook<[LocalizationFile, string]>(['file', 'fileName']),

    /**
     * Called either for local files and localized ones, received from platform.
     *
     * Used to implement any custom behavior.
     */
    postprocess: new AsyncSeriesHook<[FlatLocalizationFiles, DotaLanguage]>(['files', 'language']),

    /**
     * Called before sending strings to localization platform.
     *
     * Used to exclude some strings from being localized.
     */
    push: new AsyncSeriesHook<[FlatLocalizationFiles]>(['files']),

    /**
     * The last hook before releasing files (which are already merged).
     *
     * Can be used to exclude something from output.
     */
    emit: new AsyncSeriesHook<[FlatLocalizationFile, DotaLanguage]>(['file', 'language']),
  };

  private readonly provider: Provider;
  constructor(
    context: string,
    plugins: LocalizationPlugin[],
    serviceProvider: ServiceProvider,
    private readonly error: ServiceErrorReporter,
    triggerChange: TriggerChange,
    private readonly defaultLanguage: DotaLanguage,
    platformOptions: ProviderOptions,
  ) {
    this.provider = mapTypeToPlatform(platformOptions);
    const api: LocalizationPluginApi = { serviceProvider, error, triggerChange, context };
    plugins.forEach(p => p(this.hooks, api));
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
      [LOCALIZATION] Pushing update to ${this.provider.name} consisting of:
        - ${files} files
        - ${strings} strings
        - ${chars} chars
    `);

    try {
      const { removed } = await this.provider.pushFiles!(baseFiles);

      if (removed.length > 0) log(`[LOCALIZATION] Removed ${removed.length} files`);
      log('[LOCALIZATION] Push complete');
    } catch (error) {
      error.message = `[LOCALIZATION] Push error:\n${error.message}`;
      throw error;
    }
  }

  public canFetchLocalizations() {
    return this.provider.fetchFiles != null;
  }

  public async fetchLocalizations(): Promise<Multilingual<FlatLocalizationFile>> {
    if (!this.canFetchLocalizations()) {
      throw new Error('Localization provider not supports remote features');
    }

    const localized = await this.provider.fetchFiles!();
    return this.postprocessAll(localized);
  }

  public async emit(): Promise<Multilingual<FlatLocalizationFile>> {
    const groups: Multilingual<FlatLocalizationFiles> =
      this.provider.makeGroups != null
        ? this.provider.makeGroups(this.baseFiles)
        : { [this.defaultLanguage]: this.baseFiles };
    return this.postprocessAll(groups, this.hooks.emit);
  }

  private async preprocess(
    file: LocalizationFile,
    fileName: string,
  ): Promise<FlatLocalizationFile> {
    file = _.cloneDeep(file);
    await this.hooks.preprocess.promise(file, fileName);

    _.each(file, (value, key) => {
      if (typeof value === 'string') return;
      this.error(
        fileName,
        `String "${key}" has incorrect value of type ${typeof value} (expected string). ` +
          'Change it or apply plugin to transform it.',
      );
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

    Object.entries(keyCache)
      .filter(([, fileList]) => fileList.length > 1)
      .forEach(([key, fileList]) => {
        this.error(
          null,
          `Key ${key} is defined in [${fileList.join(', ')}], yet only one definition is allowed.`,
        );
      });

    return Object.assign({}, ...Object.values(files));
  }

  private async postprocessAll(
    groups: Multilingual<FlatLocalizationFiles>,
    hook?: Hook<[FlatLocalizationFile, DotaLanguage], void>,
  ): Promise<Multilingual<FlatLocalizationFile>> {
    const localizedFiles = await pProps(groups, async (files, language) => {
      if (files == null) return;
      if (!isDotaLanguage(language)) throw new Error(`Unexpected language ${language}`);

      const processed = await this.postprocess(files, language);
      if (hook != null) {
        await hook.promise(processed, language);
      }

      return processed;
    });

    return localizedFiles;
  }
}
