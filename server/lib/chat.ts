import type { AnalysisResult, ChatCitation } from '../../shared/types';
import { searchBenchmarks } from './rag';

/**
 * 无 Key 时的本地回答器
 * 它不是“假装调用大模型”，而是明确基于当前看板的 claim / insight / action 做检索式回答
 */
export function localAnswer(question: string, analysis: AnalysisResult): { answer: string; citations: ChatCitation[] } {
  const q = question.trim();
  const citations: ChatCitation[] = [];

  const addCitation = (claimId: string): void => {
    const claim = analysis.claims.find((item) => item.id === claimId);
    if (!claim) return;
    const evidence = analysis.evidence.find((item) => item.claimId === claimId);
    if (citations.some((item) => item.id === claim.id)) return;
    citations.push({
      id: claim.id,
      label: claim.metric,
      sourceName: evidence?.sourceName ?? analysis.sources[0]?.name ?? '原始材料',
      quote: evidence?.quote ?? claim.quote,
    });
  };

  const matchedClaims = analysis.claims.filter((claim) => {
    const terms = [claim.metric, claim.category, claim.displayValue].filter(Boolean);
    return terms.some((term) => q.includes(String(term))) || q.includes(claim.metric.slice(0, 4));
  });

  if (/(风险|问题|异常|缺口|注意)/.test(q)) {
    const risks = analysis.insights
      .filter((item) => item.impact === 'high')
      .sort((a, b) => {
        const riskWeight = (item: typeof a) => (item.category.includes('风险') || item.title.includes('风险') || item.title.includes('库存') ? 2 : 1);
        return riskWeight(b) - riskWeight(a);
      });
    if (risks.length > 0) {
      risks[0].claimIds.forEach(addCitation);
      return {
        answer: `当前最需要关注的是「${risks[0].title}」${risks[0].body.slice(0, 120)}${risks[0].body.length > 120 ? '…' : ''} 建议先把相关证据与责任人对齐，再决定是否进入正式结论`,
        citations,
      };
    }
  }

  if (/(下一步|怎么办|行动|建议|推进)/.test(q)) {
    if (analysis.actions.length > 0) {
      const action = analysis.actions[0];
      if (action.claimId) addCitation(action.claimId);
      return {
        answer: `建议先推进「${action.task}」，责任人为 ${action.owner}，截止 ${action.deadline}它对应的数据依据是 ${action.claimId ?? '当前看板结论'}，执行前请确认该依据仍处于「已核验」状态`,
        citations,
      };
    }
  }

  if (/(行业|基准|对比|一般|正常)/.test(q)) {
    const benchmarks = searchBenchmarks(q, 2);
    if (benchmarks.length > 0) {
      benchmarks.forEach((item, index) => {
        citations.push({
          id: `benchmark-${index + 1}`,
          label: `行业基准 ${index + 1}`,
          sourceName: item.source,
          quote: item.excerpt,
        });
      });
      return {
        answer: `可参考「${benchmarks[0].title}」：${benchmarks[0].excerpt.slice(0, 140)}${benchmarks[0].excerpt.length > 140 ? '…' : ''}注意这是行业参考，不能替代本企业的口径与基期数据`,
        citations,
      };
    }
  }

  if (matchedClaims.length > 0) {
    const claim = matchedClaims[0];
    addCitation(claim.id);
    const statusText =
      claim.status === 'verified'
        ? '该数字已在原文中核对'
        : claim.status === 'partial'
          ? '该数字缺少完整凭证，当前只能作为待核实线索'
          : '该数字没有找到原文依据';
    return {
      answer: `${claim.metric} 为 ${claim.displayValue}${statusText}${claim.formula ? `，计算式：${claim.formula}` : ''}${claim.criticNote ? `质疑记录：${claim.criticNote}` : ''}`,
      citations,
    };
  }

  const verified = analysis.claims.filter((claim) => claim.status === 'verified').slice(0, 3);
  verified.forEach((claim) => addCitation(claim.id));
  return {
    answer: `当前材料中可确认的结论是：${verified.map((claim) => `${claim.metric} ${claim.displayValue}`).join('；')}如果你问的是材料没有提供的指标，请补充原始数据；我不会用外部知识替你补数字`,
    citations,
  };
}

/** 将回答切成适合流式渲染的小块，保留标点 */
export function chunkAnswer(answer: string, size = 6): string[] {
  const chunks: string[] = [];
  for (let index = 0; index < answer.length; index += size) {
    chunks.push(answer.slice(index, index + size));
  }
  return chunks;
}
