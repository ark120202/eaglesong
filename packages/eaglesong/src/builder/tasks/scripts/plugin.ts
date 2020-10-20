import { ServicePluginApi } from '../../helper';
import { Hooks, Schemas } from './service';

export type Plugin = (api: PluginApi) => void;
export type PluginApi = ServicePluginApi & { hooks: Hooks; collectedSchemas: Schemas };

export const isShopGroup = (group: string) => group.split('/')[0] === 'shops';
export const getGroupSchema = (collectedSchemas: Schemas, group: string) =>
  isShopGroup(group) ? collectedSchemas.shops : collectedSchemas[group];
