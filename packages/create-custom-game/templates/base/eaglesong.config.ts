import { Options } from '@eaglesong/cli';
import { buildTasks } from '@eaglesong/tasks';
// if examples: import { CustomHeroesPlugin } from './eaglesong/npc';

const config: Options = {
  publish: {
    presets: {
      release: {
        workshopId: 0,
        // if conventional-commits: bump: { commit: version => `chore(release): ${version}` },
      },
    },
  },
  buildTasks: buildTasks({
    // if examples: npc: { plugins: [CustomHeroesPlugin] },
    panorama: {
      common: {
        polyfill: {
          lifetime: 'compiler',
          preserveRealm: true,
          modules: ['panorama-polyfill'],
        },
        vendor: {
          lifetime: 'compiler',
          preserveRealm: false,
          modules: ['querystring-es3', 'tslib', 'ramda'],
        },
      },
    },
  }),
};

export default config;
