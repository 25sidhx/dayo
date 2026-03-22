// Open Food Facts — free, no key, unlimited, open database
// https://world.openfoodfacts.org/data

export interface FoodResult {
  name: string;
  calories: number;     // kcal per 100g
  protein: number;      // g per 100g
  carbs: number;        // g per 100g
  fat: number;          // g per 100g
  servingSize?: string;
}

export async function searchFood(query: string, limit = 5): Promise<FoodResult[]> {
  if (!query.trim()) return [];

  try {
    const url = new URL('https://world.openfoodfacts.org/cgi/search.pl');
    url.searchParams.set('search_terms', query);
    url.searchParams.set('search_simple', '1');
    url.searchParams.set('action', 'process');
    url.searchParams.set('json', '1');
    url.searchParams.set('page_size', String(limit));
    url.searchParams.set('fields', 'product_name,nutriments,serving_size');

    // Timeout after 6 seconds — OpenFoodFacts can be very slow
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return [];

    const json = await res.json();
    const products = (json.products ?? []) as Array<Record<string, unknown>>;

    return products
      .filter((p) => p.product_name && (p.nutriments as Record<string, number>)?.['energy-kcal_100g'])
      .map((p) => {
        const n = p.nutriments as Record<string, number>;
        return {
          name:        String(p.product_name),
          calories:    Math.round(n['energy-kcal_100g'] ?? 0),
          protein:     Math.round((n['proteins_100g'] ?? 0) * 10) / 10,
          carbs:       Math.round((n['carbohydrates_100g'] ?? 0) * 10) / 10,
          fat:         Math.round((n['fat_100g'] ?? 0) * 10) / 10,
          servingSize: p.serving_size ? String(p.serving_size) : undefined,
        };
      })
      .slice(0, limit);
  } catch {
    return []; // silently return empty on timeout or network error
  }
}
