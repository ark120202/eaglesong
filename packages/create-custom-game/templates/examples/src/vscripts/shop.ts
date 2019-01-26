import assert from 'assert';

export function stripItemName(name: string) {
  assert(name.startsWith('item_'));
  return name.substring('item_'.length);
}

export interface DotaItem {
  ItemCost?: number;
}

export interface RecipeItem extends DotaItem {
  RecipeItems: Record<string, string>;
}

export function getRecipeItems(items: Record<string, DotaItem | RecipeItem>) {
  const result: Record<string, string[][]> = {};

  Object.keys(items).forEach(itemName => {
    if (itemName.startsWith('item_recipe_')) return;
    const recipeName = `item_recipe_${stripItemName(itemName)}`;
    const recipe = items[recipeName] as RecipeItem | undefined;

    let recipes: string[][] = [];
    if (recipe) {
      const recipeStrings = Object.values(recipe.RecipeItems);
      recipes = recipeStrings.map(x => x.split(';'));
      if (recipe.ItemCost != null && recipe.ItemCost > 0) {
        recipes.forEach(x => x.push(recipeName));
      }
    }

    result[itemName] = recipes;
  });

  return result;
}

const sum = (...numbers: number[]) => numbers.reduce((total, c) => total + c);
function mapValues<T, K extends keyof T, R>(
  obj: T,
  mapper: (value: T[K], key: string) => R,
): Record<K, R> {
  const result = ({} as any) as Record<keyof T, R>;
  for (const key in obj) {
    result[key] = mapper(obj[key] as any, key);
  }
  return result;
}

export function getRecipesAndCosts(items: Record<string, DotaItem | RecipeItem>) {
  const allRecipes = getRecipeItems(items);
  const calculateCost = (itemName: string): number => {
    const recipes = allRecipes[itemName];
    return !recipes || recipes.length === 0
      ? items[itemName].ItemCost || 0
      : Math.min(...recipes.map(group => sum(...group.map(calculateCost)), 0));
  };

  return mapValues(allRecipes, (recipes, itemName) => ({ cost: calculateCost(itemName), recipes }));
}
