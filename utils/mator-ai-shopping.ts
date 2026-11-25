import { router } from 'expo-router';

export type MatorAIEntrySource =
  | 'category_inline'
  | 'category_end'
  | 'category_empty'
  | 'subcategory_empty'
  | 'search_zero_results'
  | 'filter_zero_results'
  | 'no_compatible_products'
  | 'product_photo_request';
export type MatorAIShoppingContext = {
  source: MatorAIEntrySource;
  intent: 'find_part' | 'request_photo';
  vehicle?: string;
  categoryId?: string;
  categoryLabel?: string;
  productId?: string;
  productName?: string;
  manufacturer?: string;
  partNumber?: string;
  oemNumbers?: string[];
  searchQuery?: string;
  filters?: Record<string, unknown>;
};

export function buildMatorAIShoppingDraft(
  context: MatorAIShoppingContext,
  language: string,
): string {
  const lang = language.toLowerCase().slice(0, 2);
  const russian = lang === 'ru';
  const uzbek = lang === 'uz';
  const intro =
    context.intent === 'request_photo'
      ? russian
        ? 'Пожалуйста, запросите актуальное фото товара:'
        : uzbek
          ? 'Iltimos, mahsulotning dolzarb suratini soʻrang:'
          : 'Please request a current photo of this product:'
      : russian
        ? 'Помогите найти эту автозапчасть:'
        : uzbek
          ? 'Ushbu avtomobil ehtiyot qismini topishga yordam bering:'
          : 'Please help me find this automotive part:';
  // Only human-readable lines: this lands in the shopper's own composer.
  const lines = [intro];
  if (context.productName)
    lines.push(`${russian ? 'Товар' : uzbek ? 'Mahsulot' : 'Product'}: ${context.productName}`);
  if (context.manufacturer)
    lines.push(
      `${russian ? 'Производитель' : uzbek ? 'Ishlab chiqaruvchi' : 'Manufacturer'}: ${context.manufacturer}`,
    );
  if (context.partNumber)
    lines.push(
      `${russian ? 'Артикул производителя' : uzbek ? 'Ishlab chiqaruvchi artikuli' : 'Manufacturer part number'}: ${context.partNumber}`,
    );
  if (context.oemNumbers?.length) lines.push(`OEM: ${context.oemNumbers.join(', ')}`);
  if (context.searchQuery)
    lines.push(`${russian ? 'Поиск' : uzbek ? 'Qidiruv' : 'Search'}: ${context.searchQuery}`);
  if (context.categoryLabel)
    lines.push(
      `${russian ? 'Категория' : uzbek ? 'Kategoriya' : 'Category'}: ${context.categoryLabel}`,
    );
  if (context.vehicle)
    lines.push(`${russian ? 'Автомобиль' : uzbek ? 'Avtomobil' : 'Vehicle'}: ${context.vehicle}`);
  return lines.join('\n');
}

/** Open the existing Mator AI conversation with a user-editable draft. */
export function openMatorAIShopping(context: MatorAIShoppingContext, language: string): void {
  const shoppingPrompt = buildMatorAIShoppingDraft(context, language);
  router.push({
    pathname: '/(tabs)/(ai-chat)/ai-chat',
    params: { shoppingPrompt, shoppingSource: context.source },
  });
}
