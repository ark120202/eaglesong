import * as s from 'dota-data/lib/schema';
import _ from 'lodash';
import { Plugin } from '../../plugin';

export interface Recipe {
  cost?: number;
  requirements: string[] | string[][];
}

export const ItemRecipePlugin: Plugin = ({ hooks }) => {
  hooks.schemas.tap('ItemRecipePlugin', (schemas) => {
    const schema = schemas['npc/npc_items_custom'];
    for (const element of schema.getRestRootsLike(s.ObjectSchema)) {
      element.field(
        'Recipe',
        s
          .obj('ItemRecipe')
          .field('cost', s.int().min(0))
          .field('requirements', s.oneOf([s.array(s.str()), s.array(s.array(s.str()))])),
      );
    }
  });

  hooks.transform.tap('ItemRecipePlugin', (files, group) => {
    if (group !== 'npc/npc_items_custom') return;

    const recipeItems: Record<string, any> = {};
    _.each(files, (file) =>
      _.each(file, (item: { Recipe?: Recipe }, itemName) => {
        if (item.Recipe == null) return;

        let allRequirements: string[][] = [];
        if (item.Recipe.requirements != null && Array.isArray(item.Recipe.requirements)) {
          // @ts-ignore
          if (item.Recipe.requirements.every((x) => typeof x === 'string')) {
            allRequirements = [item.Recipe.requirements as string[]];
            // @ts-ignore
          } else if (item.Recipe.requirements.every((x) => Array.isArray(x))) {
            allRequirements = item.Recipe.requirements as string[][];
          }
        }

        const recipeItemName = `item_recipe_${itemName.replace(/^item_/, '')}`;
        recipeItems[recipeItemName] = {
          BaseClass: 'item_datadriven',
          Model: 'models/props_gameplay/recipe.mdl',
          AbilityTextureName: 'item_recipe',
          ItemCost: item.Recipe.cost ?? 0,
          ItemRecipe: true,
          ItemResult: itemName,
          ItemRequirements: Object.fromEntries(
            allRequirements.map((requirements, index) => [
              String(index + 1).padStart(2, '0'),
              requirements.join(';'),
            ]),
          ),
        };

        delete item.Recipe;
      }),
    );

    files.$recipeItems = recipeItems;
  });
};
