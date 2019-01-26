/* import { ServiceProvider } from '@eaglesong/helper-service';
import NpcService from '@eaglesong/service-npc';
import _ from 'lodash';
import { Hooks } from '..';

export async function ScepterDescriptionPlugin(hooks: Hooks, serviceProvider: ServiceProvider) {
  const npcService = serviceProvider(NpcService);
  if (!npcService) throw new Error('NPC Service is required');

  hooks.postprocess.tap('ScepterDescriptionPlugin', (files) => {
    npcService.forEachEntityInFiles(['npc_abilities_custom'], (value, key) => {
      if (value.HasScepterUpgrade !== 1) return;
      some(files, file => some(file, (value, key) => ))
    })
  });
} */
export async function ScepterDescriptionPlugin() {
  // TODO:
}
