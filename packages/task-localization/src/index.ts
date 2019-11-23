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
  ProviderOption,
} from './service';

export * from './service';

export interface Options {
  provider?: ProviderOption;
  defaultLanguage?: DotaLanguage;
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
    options.provider,
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
    // TODO:
    // if (this.hasFlag('push-localization')) {
    if (process.env.EAGLESONG_PUSH_LOCALIZATION) {
      if (this.service.canPushBaseLocalizations()) {
        await this.service.pushBaseLocalizations(console.log);
      } else {
        this.error(
          null,
          '--push-localization flag cannot be used with a localization provider without remote features',
          'warning',
        );
      }
    }

    if (this.dotaPath == null) return;
    await pProps(artifacts, (tokens, lang) => this.emitFile(lang, tokens!));
  }

  private async fetchLocalizations() {
    if (this.dotaPath == null) return;
    if (!this.service.canFetchLocalizations()) return;

    const localizations = await this.service.fetchLocalizations();
    delete localizations[this.options.defaultLanguage || 'english'];

    await pProps(localizations, (file, lang) => this.emitFile(lang, file!));
  }

  private async emitFile(language: string, tokens: FlatLocalizationFile) {
    const filePath = this.resolvePath('game', `resource/addon_${language}.txt`);
    await this.outputKV1(filePath, { lang: tokens }, true);
  }
}
