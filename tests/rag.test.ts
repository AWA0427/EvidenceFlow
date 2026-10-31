import { describe, expect, it } from 'vitest';
import { searchBenchmarks, tokenize, explainQuery } from '../server/lib/rag';

describe('BM25 检索', () => {
  it('中文分词产生字与二元组', () => {
    const tokens = tokenize('服饰退货率 ROI');
    expect(tokens).toContain('服');
    expect(tokens).toContain('服饰');
    expect(tokens).toContain('roi');
  });

  it('按主题召回相关基准', () => {
    const results = searchBenchmarks('服饰退货率 换季 库存', 3);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toContain('退货');
  });

  it('同一文档只保留一个片段', () => {
    const results = searchBenchmarks('SaaS 研发效能 DORA 部署频率 变更失败率', 4);
    const ids = results.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('无匹配时返回空数组', () => {
    expect(searchBenchmarks('zzzzzz-not-a-real-topic', 3)).toEqual([]);
  });

  it('解释检索词', () => {
    expect(explainQuery('服饰退货率')).toContain('服饰');
  });
});
