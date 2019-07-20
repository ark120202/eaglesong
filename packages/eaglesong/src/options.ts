import fs from 'fs-extra';
import mem from 'mem';
import path from 'path';
import { BuildOptions } from './commands/builder';
import { LaunchOptions } from './commands/launch';
import { PublishOptions } from './commands/publish';

export { BuildOptions, PublishOptions, LaunchOptions };
export interface Options extends BuildOptions, PublishOptions, LaunchOptions {
  addonName?: string;
  dotaPath?: string;
}

const configNames = ['eaglesong.config.ts', 'eaglesong.config.local.ts'];
async function find(context: string) {
  const possibleConfigs = await Promise.all(
    configNames.map(async name => {
      const absolute = path.resolve(context, name);
      const exists = await fs.pathExists(absolute);
      return { exists, absolute };
    }),
  );

  return possibleConfigs
    .filter(x => x.exists)
    .map(x => x.absolute)
    .pop();
}

export const loadOptions = mem(
  async (context: string): Promise<Options> => {
    const configPath = await find(context);
    if (configPath == null) {
      throw new Error('Eaglesong configuration file (`eaglesong.config.ts`) not found.');
    }

    // eslint-disable-next-line node/no-deprecated-api
    if (require.extensions['.ts'] == null) {
      // Type checking and linting is done in a plugin
      (await import('ts-node')).register({ transpileOnly: true });
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(configPath).default;
  },
);
