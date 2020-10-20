import { Task } from '../helper';
import { Options as AddonInfoOptions } from './addoninfo';
import { Options as ImagesOptions } from './images';
import { Options as LocalizationOptions } from './localization';
import { Options as PanoramaOptions } from './panorama';
import { Options as ResourcesOptions } from './resources';
import { Options as ScriptsOptions } from './scripts';

export interface GetTasksOptions {
  maps?: null | boolean;
  sounds?: null | boolean;
  prettier?: null | boolean;
  eslint?: null | boolean;
  rootScripts?: null | boolean;
  resources?: null | boolean | ResourcesOptions;
  addoninfo?: null | boolean | AddonInfoOptions;
  images?: null | boolean | ImagesOptions;
  localization?: null | boolean | LocalizationOptions;
  scripts?: null | boolean | ScriptsOptions;
  vscripts?: null | boolean;
  panorama?: null | boolean | PanoramaOptions;

  extraTasks?: (Task<any> | Promise<Task<any>>)[];
}

export function getTasks(options: GetTasksOptions = {}) {
  const create = Object.assign(() => loadTasks(create.options), { options });
  return create;
}

async function loadTasks(options: GetTasksOptions = {}): Promise<Task<any>[]> {
  const tasks: Promise<Task<any>>[] = (options.extraTasks ?? []).map((x) => Promise.resolve(x));

  const addTask = <T>(
    load: () => Promise<{ default: new (arg?: T) => Task<T> }>,
    option: T | boolean | null | undefined,
  ) => {
    if (option === false) return;
    tasks.push(
      (async () => {
        const LoadedTask = (await load()).default;
        return option == null || option === true ? new LoadedTask() : new LoadedTask(option);
      })(),
    );
  };

  addTask(() => import('./addoninfo'), options.addoninfo);
  addTask(() => import('./eslint'), options.eslint);
  addTask(() => import('./images'), options.images);
  addTask(() => import('./localization'), options.localization);
  addTask(() => import('./maps'), options.maps);
  addTask(() => import('./panorama'), options.panorama);
  addTask(() => import('./prettier'), options.prettier);
  addTask(() => import('./resources'), options.resources);
  addTask(() => import('./root-scripts'), options.rootScripts);
  addTask(() => import('./scripts'), options.scripts);
  addTask(() => import('./sounds'), options.sounds);
  addTask(() => import('./vscripts'), options.vscripts);

  return Promise.all(tasks);
}
