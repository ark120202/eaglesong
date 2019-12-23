import { getPortraits } from 'dota-data/lib/scripts';
import path from 'path';
import { Plugin } from '../plugin';

export const ExtendPortraitsPlugin: Plugin = ({ hooks, context }) => {
  hooks.transform.tapPromise('ExtendPortraitsPlugin', async (files, group) => {
    if (group !== 'npc/portraits') return;

    const cachePath = path.join(context, 'node_modules/.cache/dota-data/scripts');
    files.___base___ = await getPortraits({ cache: { path: cachePath } });
  });
};
