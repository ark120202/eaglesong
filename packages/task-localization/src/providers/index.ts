import { FlatLocalizationFiles, Multilingual, DotaLanguage } from '../types';
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
