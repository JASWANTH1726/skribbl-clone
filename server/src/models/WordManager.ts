import wordsData from '../data/words.json' with { type: 'json' };

export interface WordEntry {
  word: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export class WordManager {
  private words: WordEntry[] = wordsData as WordEntry[];

  /**
   * Normalizes and validates user-submitted custom words.
   */
  public static sanitizeCustomWords(rawWords: unknown): string[] {
    if (!Array.isArray(rawWords)) {
      throw new Error('Custom words must be a list.');
    }
    if (rawWords.length > 200) {
      throw new Error('A maximum of 200 custom words is allowed.');
    }

    const words = new Set<string>();
    let totalLength = 0;
    for (const item of rawWords) {
      if (typeof item !== 'string') {
        throw new Error('Each custom word must be text.');
      }
      const word = item.trim().toLowerCase();
      if (word.length === 0) {
        throw new Error('Custom words cannot contain empty entries.');
      }
      if (word.length < 2 || word.length > 30 || !/^[a-z0-9]+([ -][a-z0-9]+)*$/.test(word)) {
        throw new Error('Custom words must be 2-30 characters and use letters, numbers, spaces, or hyphens.');
      }
      if (words.has(word)) {
        throw new Error(`Duplicate custom word: ${word}.`);
      }
      totalLength += word.length + 1;
      if (totalLength > 1000) {
        throw new Error('Custom words must fit within 1,000 characters.');
      }
      words.add(word);
    }

    return Array.from(words);
  }

  /**
   * Retrieves randomized word choices.
   * If custom words are provided, prioritizes them.
   * If custom words are fewer than needed, supplements with the default curated dictionary.
   */
  public getRandomWords(count: number = 3, category?: string, customWords?: string[]): string[] {
    const validCustom = customWords ? WordManager.sanitizeCustomWords(customWords) : [];

    // Shuffle custom words
    const shuffledCustom = [...validCustom].sort(() => 0.5 - Math.random());

    if (shuffledCustom.length >= count) {
      return shuffledCustom.slice(0, count);
    }

    // Include all available custom words, then supplement with default pool
    const result: string[] = [...shuffledCustom];

    let defaultPool = this.words;
    if (category && category !== 'all') {
      const filtered = this.words.filter(w => w.category === category);
      if (filtered.length >= count) {
        defaultPool = filtered;
      }
    }

    const shuffledDefault = [...defaultPool.map(w => w.word)].sort(() => 0.5 - Math.random());
    for (const w of shuffledDefault) {
      if (!result.includes(w)) {
        result.push(w);
      }
      if (result.length >= count) break;
    }

    return result;
  }

  public getAllCategories(): string[] {
    const cats = new Set(this.words.map(w => w.category));
    return ['all', ...Array.from(cats)];
  }
}
