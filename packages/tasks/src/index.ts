import { Task } from '@eaglesong/helper-task';
import { Options as AddonInfoOptions } from '@eaglesong/task-addoninfo';
import { Options as ImagesOptions } from '@eaglesong/task-images';
import { Options as LocalizationOptions } from '@eaglesong/task-localization';
import { Options as NpcOptions } from '@eaglesong/task-npc';
import { Options as PanoramaOptions } from '@eaglesong/task-panorama';
import { Options as ResourcesOptions } from '@eaglesong/task-resources';

export interface GetTasksOptions {
  maps?: null | boolean;
  sounds?: null | boolean;
  prettier?: null | boolean;
  eslint?: null | boolean;
  rootScripts?: null | boolean;
  resources?: null | boolean | ResourcesOptions;
  addoninfo?: null | boolean | AddonInfoOptions;
  images?: null | boolean | ImagesOptions;
  npc?: null | boolean | NpcOptions;
  localization?: null | boolean | LocalizationOptions;
  vscripts?: null | boolean;
  panorama?: null | boolean | PanoramaOptions;
}

export function buildTasks(options: GetTasksOptions = {}) {
  const create = Object.assign(() => getTasks(create.options), { options });
  return create;
}

export async function getTasks(options: GetTasksOptions = {}): Promise<Task<any>[]> {
  const tasks: Promise<Task<any>>[] = [];

  const addTask = <T>(
    load: () => Promise<{ default: new (arg?: T) => Task<T> }>,
    option: T | boolean | null | undefined,
  ) => {
    if (option === false) return;
    tasks.push(
      (async () => {
        const LoadedTask = (await load()).default;
        return option != null && option !== true ? new LoadedTask(option) : new LoadedTask();
      })(),
    );
  };

  addTask(() => import('@eaglesong/task-addoninfo'), options.addoninfo);
  addTask(() => import('@eaglesong/task-eslint'), options.eslint);
  addTask(() => import('@eaglesong/task-images'), options.images);
  addTask(() => import('@eaglesong/task-localization'), options.localization);
  addTask(() => import('@eaglesong/task-maps'), options.maps);
  addTask(() => import('@eaglesong/task-npc'), options.npc);
  addTask(() => import('@eaglesong/task-panorama'), options.panorama);
  addTask(() => import('@eaglesong/task-prettier'), options.prettier);
  addTask(() => import('@eaglesong/task-resources'), options.resources);
  addTask(() => import('@eaglesong/task-root-scripts'), options.rootScripts);
  addTask(() => import('@eaglesong/task-sounds'), options.sounds);
  addTask(() => import('@eaglesong/task-vscripts'), options.vscripts);

  return Promise.all(tasks);
}
