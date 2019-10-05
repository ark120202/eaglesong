import { FlatLocalizationFiles, Multilingual } from '../types';
import { Fs, ProviderOptionsFs } from './fs';
import { OneSky, ProviderOptionsOneSky } from './onesky';

export interface Provider {
  name: string;
  makeGroups?(baseFiles: FlatLocalizationFiles): Multilingual<FlatLocalizationFiles>;
  fetchFiles?(): Promise<Multilingual<FlatLocalizationFiles>>;
  pushFiles?(files: FlatLocalizationFiles): Promise<{ removed: string[] }>;
}

export interface ProviderOptionsCustom {
  type: 'custom';
  platform: Provider;
}

export type ProviderOptions = ProviderOptionsFs | ProviderOptionsOneSky | ProviderOptionsCustom;

export function mapTypeToPlatform(opt: ProviderOptions): Provider {
  switch (opt.type) {
    case 'fs':
      return new Fs();
    case 'onesky':
      return new OneSky(opt);
    case 'custom':
      return opt.platform;
    default:
      throw new Error('Invalid localization platform type.');
  }
}
