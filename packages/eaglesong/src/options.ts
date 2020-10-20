import fs from 'fs-extra';
import mem from 'mem';
import path from 'path';
import { _import } from './builder/helper';
import { BuildOptions } from './commands/builder';
import { LaunchOptions } from './commands/launch';
import { PublishOptions } from './commands/publish';

export { BuildOptions, PublishOptions, LaunchOptions };
export interface Options extends BuildOptions, PublishOptions, LaunchOptions {
  addonName?: string;
  dotaPath?: string;
}

export const loadOptions = mem(
  async (context: string): Promise<Options> => {
    const configPath = ['eaglesong.config.local.ts', 'eaglesong.config.ts']
      .map((name) => path.resolve(context, name))
      .find(fs.existsSync);

    if (configPath == null) {
      throw new Error('Eaglesong configuration file (`eaglesong.config.ts`) not found.');
    }

    return (await _import(configPath)).default;
  },
);
