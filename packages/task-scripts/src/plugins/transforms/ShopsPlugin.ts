import * as s from 'dota-data/lib/schema';
import { resourcePatterns } from 'dota-data/lib/schemas';
import _ from 'lodash';
import vdf from 'vdf-extra';
import { isShopGroup, Plugin } from '../../plugin';

export const ShopsPlugin: Plugin = ({ hooks }) => {
  hooks.schemas.tap('ShopsPlugin', schemas => {
    schemas.shops = s.root().rest(s.array(s.str().pattern(resourcePatterns.item)));
  });

  hooks.transform.tap('ShopsPlugin', (files, group) => {
    if (!isShopGroup(group)) return;

    _.each(files, file => {
      _.each(file, (shop, shopName) => {
        file[shopName] = {};
        vdf.set(file[shopName], 'item', shop);
      });
    });
  });
};
