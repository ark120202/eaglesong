import { buildTasks } from '@eaglesong/tasks';
import { Options } from 'eaglesong';

const config: Options = {
  publish: {
    strategies: {
      release: {
        workshopId: 0,
        // if conventional-commits: bump: { commit: version => `chore(release): ${version}` },
      },
    },
  },
  buildTasks: buildTasks(),
};

export default config;
