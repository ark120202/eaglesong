import portraits from '@dota-data/scripts/files/portraits';
import { Plugin } from '../service';

export const ExtendPortraitsPlugin: Plugin = hooks => {
  hooks.transform.tap('ExtendPortraitsPlugin', (files, group) => {
    if (group !== 'portraits') return;
    files.___base___ = portraits;
  });
};
