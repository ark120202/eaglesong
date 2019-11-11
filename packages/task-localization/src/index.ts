import {
  ServiceErrorReporter,
  ServiceProvider,
  TransformTask,
  TriggerChange,
} from '@eaglesong/helper-task';
import pProps from 'p-props';
import path from 'upath';
import * as defaultPlugins from './plugins';
import {
  DotaLanguage,
  FlatLocalizationFile,
  LocalizationService,
  Plugin,
  ProviderOptions,
} from './service';

export * from './service';

export interface Options {
  defaultLanguage?: DotaLanguage;
  provider?: ProviderOptions;
  defaultPlugins?: boolean | Partial<Record<keyof typeof defaultPlugins, boolean>>;
  customPlugins?: Plugin[];
}

export function createLocalizationService(
  context: string,
  options: Options,
  serviceProvider: ServiceProvider,
  error: ServiceErrorReporter,
  triggerChange: TriggerChange,
) {
  const plugins = [];

  if (options.defaultPlugins !== false) {
    for (const name of Object.keys(defaultPlugins) as (keyof typeof defaultPlugins)[]) {
      if (typeof options.defaultPlugins !== 'object' || options.defaultPlugins[name] !== false) {
        plugins.push(defaultPlugins[name]);
      }
    }
  }

  if (options.customPlugins) {
    plugins.push(...options.customPlugins);
  }

  return new LocalizationService(
    context,
    plugins,
    serviceProvider,
    error,
    triggerChange,
    options.defaultLanguage != null ? options.defaultLanguage : 'english',
    options.provider != null ? options.provider : { type: 'fs' },
  );
}

export default class LocalizationTask extends TransformTask<Options> {
  protected pattern = ['src/localization/**/*', '!**/_*'];

  constructor(options: Options = {}) {
    super(options);
  }

  private get service() {
    const service = this.serviceProvider(LocalizationService);
    if (!service) throw new Error('Service not found');

    return service;
  }

  public apply() {
    this.hooks.boot.tap(this.constructor.name, () => {
      this.registerService(
        createLocalizationService(
          this.context,
          this.options,
          this.serviceProvider,
          (fileName, message, level) =>
            this.error(
              fileName != null ? this.resolvePath(`src/localization/${fileName}`) : fileName,
              message,
              level,
            ),
          fileName => this.triggerChange(fileName),
        ),
      );
    });

    super.apply();
  }

  protected async transformFile(filePath: string) {
    const content = await this.import(filePath);
    await this.service.addFile(
      path.relative(this.resolvePath('src/localization'), filePath),
      content,
    );
  }

  protected removeFile(filePath: string) {
    this.service.removeFile(path.relative(this.resolvePath('src/localization'), filePath));
  }

  protected async beforeWatch(initial: boolean) {
    if (initial) await this.fetchLocalizations();
  }

  protected async afterWatch() {
    if (this.errorLevel) return;

    const artifacts = await this.service.emit();
    if (this.hasFlag('push-localization')) {
      if (this.service.canPushBaseLocalizations()) {
        await this.service.pushBaseLocalizations(console.log);
      } else {
        this.error(
          null,
          'Eaglesong used with a --push-localization flag, ' +
            'but localization provider not supports remote features',
          'warning',
        );
      }
    }

    if (this.dotaPath == null) return;
    await pProps(artifacts, (tokens, lang) => this.outputFile(lang, tokens!));
  }

  private async fetchLocalizations() {
    if (this.dotaPath == null) return;
    if (!this.service.canFetchLocalizations()) return;

    const localizations = await this.service.fetchLocalizations();
    delete localizations[this.options.defaultLanguage || 'english'];

    await pProps(localizations, (file, lang) => this.outputFile(lang, file!));
  }

  private async outputFile(language: string, tokens: FlatLocalizationFile) {
    const kv = { '': { Language: language, Tokens: tokens } };
    // Since localization merging patch, dota not requires separate file for panorama and not requires BOM
    // TODO: Check if UTF-16 LE is still required
    await this.outputKV1(this.resolvePath('game', `resource/addon_${language}.txt`), kv);
  }
}
