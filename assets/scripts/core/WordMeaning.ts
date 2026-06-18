import { JsonAsset, resources } from 'cc';

const MEANING_RESOURCE = 'config/word_meanings';
const LOADING_TEXT = '释义加载中';
const MISSING_TEXT = '这个单词暂时没有释义';

let meanings: Record<string, string> = {};
let loading = false;
let loaded = false;

export function preloadWordMeanings(): void {
  if (loaded || loading) return;

  loading = true;
  resources.load(MEANING_RESOURCE, JsonAsset, (error, asset) => {
    loading = false;
    if (error || !asset?.json) {
      return;
    }

    meanings = asset.json as Record<string, string>;
    loaded = true;
  });
}

export function getWordMeaning(word: string): string {
  if (!loaded) {
    preloadWordMeanings();
    return LOADING_TEXT;
  }

  return meanings[word.toUpperCase()] ?? MISSING_TEXT;
}
