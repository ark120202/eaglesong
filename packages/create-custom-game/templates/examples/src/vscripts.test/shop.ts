import { getRecipesAndCosts } from '!/shop';

describe('getRecipesAndCosts', () => {
  test('without recipe', () => {
    expect(getRecipesAndCosts({ item_rapier: { ItemCost: 100 } })).toEqual({
      item_rapier: { cost: 100, recipes: [] },
    });
  });
  test('with recipe', () => {
    expect(
      getRecipesAndCosts({
        item_test1: { ItemCost: 10 },
        item_test2: { ItemCost: 20 },
        item_test3: { ItemCost: 30 },

        item_rapier: {},
        item_recipe_rapier: {
          ItemCost: 1000,
          RecipeItems: {
            '01': 'item_test1;item_test2',
            '02': 'item_test2;item_test3',
          },
        },
      }),
    ).toEqual({
      item_rapier: {
        cost: 1030,
        recipes: [
          ['item_test1', 'item_test2', 'item_recipe_rapier'],
          ['item_test2', 'item_test3', 'item_recipe_rapier'],
        ],
      },
      item_test1: { cost: 10, recipes: [] },
      item_test2: { cost: 20, recipes: [] },
      item_test3: { cost: 30, recipes: [] },
    });
  });
});
