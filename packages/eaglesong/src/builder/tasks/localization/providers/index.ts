import { DotaLanguage, FlatLocalizationFiles, Multilingual } from '../types';
import { FileSystemProvider } from './fs';
import { OneSkyProvider, OneSkyProviderOptions } from './onesky';

export interface Provider {
  name: string;
  makeLocalGroups(
    baseFiles: FlatLocalizationFiles,
    defaultLanguage: DotaLanguage,
  ): Multilingual<FlatLocalizationFiles>;
  fetchFiles?(): Promise<Multilingual<FlatLocalizationFiles>>;
  pushFiles?(files: FlatLocalizationFiles): Promise<{ removed: string[] }>;
}

export type ProviderOption =
  | { type: 'fs' }
  | ({ type: 'onesky' } & OneSkyProviderOptions)
  | Provider
  | undefined;

// eslint-disable-next-line unicorn/no-object-as-default-parameter
export function resolveProviderOption(option: ProviderOption = { type: 'fs' }): Provider {
  if ('type' in option) {
    switch (option.type) {
      case 'fs':
        return new FileSystemProvider();
      case 'onesky':
        return new OneSkyProvider(option);
    }
  }

  return option;
}
