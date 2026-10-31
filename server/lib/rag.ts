import type { RetrievedBenchmark } from '../../shared/types';
import { BENCHMARK_CHUNKS, type BenchmarkChunk } from '../knowledge/benchmarks';

/**
 * 轻量 BM25 检索器。
 *
 * 为什么不用向量库？
 * - 48 小时赛程里，引入 embedding + 向量库会增加部署与冷启动风险；
 * - 评审更关心「检索是否真的发生、引用是否可核对」，而不是用了多贵的向量库；
 * - BM25 对中文短文本 + 行业术语在小型知识库上足够稳定，且完全可解释。
 *
 * 如果后续要升级，只需替换 searchBenchmarks 的实现，接口保持不变。
 */

const K1 = 1.5;
const B = 0.75;

/** 中文按字 + 二元组切分，英文/数字按词切分。 */
export function tokenize(input: string): string[] {
  const text = input.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ');
  const tokens: string[] = [];
  const latin = text.match(/[a-z0-9][a-z0-9._-]*/g) ?? [];
  tokens.push(...latin);

  const cjkRuns = text.match(/[\u3400-\u9fff]+/g) ?? [];
  for (const run of cjkRuns) {
    for (let i = 0; i < run.length; i += 1) {
      tokens.push(run[i]);
      if (i < run.length - 1) tokens.push(run.slice(i, i + 2));
    }
  }
  return tokens;
}

interface IndexedChunk extends BenchmarkChunk {
  tokens: string[];
  length: number;
}

const INDEX: IndexedChunk[] = BENCHMARK_CHUNKS.map((chunk) => {
  const tokens = tokenize(`${chunk.title} ${chunk.content}`);
  return { ...chunk, tokens, length: tokens.length };
});

const AVG_LENGTH = INDEX.reduce((total, chunk) => total + chunk.length, 0) / Math.max(1, INDEX.length);
const DOC_FREQ = new Map<string, number>();

for (const chunk of INDEX) {
  for (const token of new Set(chunk.tokens)) {
    DOC_FREQ.set(token, (DOC_FREQ.get(token) ?? 0) + 1);
  }
}

function idf(token: string): number {
  const df = DOC_FREQ.get(token) ?? 0;
  return Math.log(1 + (INDEX.length - df + 0.5) / (df + 0.5));
}

export function searchBenchmarks(query: string, limit = 3): RetrievedBenchmark[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const scored = INDEX.map((chunk) => {
    const frequencies = new Map<string, number>();
    for (const token of chunk.tokens) {
      frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
    }

    let score = 0;
    for (const token of new Set(queryTokens)) {
      const tf = frequencies.get(token) ?? 0;
      if (tf === 0) continue;
      const denominator = tf + K1 * (1 - B + (B * chunk.length) / Math.max(1, AVG_LENGTH));
      score += idf(token) * ((tf * (K1 + 1)) / denominator);
    }
    return { chunk, score };
  })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  // 同一篇文档只保留得分最高的片段，避免引用重复；按文档去重后再取 topK。
  const seen = new Set<string>();
  const results: RetrievedBenchmark[] = [];
  for (const { chunk, score } of scored) {
    if (seen.has(chunk.docId)) continue;
    seen.add(chunk.docId);
    results.push({
      id: chunk.docId,
      title: chunk.title,
      source: chunk.source,
      year: chunk.year,
      excerpt: chunk.content,
      score: Number(score.toFixed(3)),
    });
    if (results.length >= limit) break;
  }
  return results;
}

/** 为界面展示提供可解释的检索词。 */
export function explainQuery(query: string): string[] {
  const counts = new Map<string, number>();
  for (const token of tokenize(query)) {
    if (token.length < 2) continue;
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([token]) => token);
}
