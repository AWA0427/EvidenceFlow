import type { BenchmarkDoc } from '../../shared/types';

/**
 * 内置行业基准知识库（RAG 语料）
 *
 * 说明：
 * - 这里存放的是「公开资料摘要 + 分析口径」，不是某个企业的真实经营数据；
 * - 答辩/正式提交前，团队应把 source 字段替换为自己调研到的报告链接与页码；
 * - 检索层只负责找到相关片段，最终结论仍必须回到用户材料中的证据
 */
export const BENCHMARKS: BenchmarkDoc[] = [
  {
    id: 'bm-retail-returns',
    title: '零售退货率：品类差异与拆解口径',
    source: 'NRF 2024 Consumer Returns Report（公开摘要）',
    year: '2024',
    tags: ['电商', '退货率', '服饰', '零售'],
    content:
      '退货率不能只看全店均值服饰鞋靴由于尺码、版型与换季因素，退货率通常显著高于数码等标品；促销期与直播渠道的退货压力也会上升分析时应至少拆成「品类 × 渠道 × 退货原因」三层，并把退货率与折扣率、客单价一起看全店退货率下降，可能只是低退货品类占比上升，并不代表经营质量改善',
  },
  {
    id: 'bm-gmv-decompose',
    title: 'GMV 目标达成率的三因素拆解',
    source: '公开电商运营实践汇编',
    year: '2025',
    tags: ['电商', 'GMV', '目标达成', '转化率'],
    content:
      'GMV 达成率适合做结果指标，但不能单独解释原因常用拆解为：GMV ≈ 曝光 × 进店率 × 下单转化率 × 客单价 ×（1 − 退货率）当目标未达成时，应先定位是流量、转化、客单还是退货环节出现偏差，再决定是加预算、调货盘还是改权益仅凭 GMV 同比或环比，无法判断增长是否由折扣换来的',
  },
  {
    id: 'bm-channel-roi',
    title: '渠道 ROI 的可比性：分子分母必须统一',
    source: 'HubSpot State of Marketing（公开摘要）',
    year: '2025',
    tags: ['营销', 'ROI', '渠道', '投放'],
    content:
      '不同渠道的 ROI 不能直接横比，除非分子分母口径一致常见口径包括「GMV / 投放费用」「毛利 / 投放费用」「新增客户终身价值 / 获客成本」内容种草、直播、搜索的品牌溢出与长尾转化周期不同，短周期 ROI 会系统性低估内容渠道B2B 场景还应同时看 CPL、MQL 到 SQL 的转化率与销售跟进成本，低 CPL 不一定等于高质量线索',
  },
  {
    id: 'bm-inventory',
    title: '服饰库存风险：动销率、售罄率与滞销占比',
    source: 'McKinsey Retail Inventory（公开摘要）',
    year: '2024',
    tags: ['库存', '服饰', '动销率', '现金流'],
    content:
      '服饰库存风险建议同时观察四个指标：动销率（有销售 SKU 占比）、售罄率（已售 / 可售）、库存周转天数、滞销库存金额占比换季期如果动销率低于计划，继续压货会放大现金流风险；清仓能回笼现金，但会稀释毛利率决策时应把「清仓折扣、预计回款、毛利率损失」放在同一张表里，而不是只给一个「清库存」目标',
  },
  {
    id: 'bm-dora',
    title: 'DORA 四项研发效能指标',
    source: 'DORA 2024 Accelerate State of DevOps',
    year: '2024',
    tags: ['研发效能', 'DORA', 'SaaS', '交付'],
    content:
      'DORA 用四项指标描述软件交付效能：部署频率、变更前置时间、变更失败率、失败恢复时间Sprint 交付率、故事点速率属于团队过程指标，不能替代 DORA分析研发复盘时，应把「交付吞吐」与「稳定性」同时看：只追求交付率可能带来缺陷与线上事故；只追求稳定性可能牺牲迭代速度P99 延迟与可用性应绑定具体服务和时间窗口',
  },
  {
    id: 'bm-saas-health',
    title: 'SaaS 健康度：Rule of 40、NDR 与回本周期',
    source: 'SaaS Capital / Bessemer Cloud Index（公开摘要）',
    year: '2025',
    tags: ['SaaS', '增长', 'NDR', 'CAC'],
    content:
      'SaaS 经营健康度常用 Rule of 40（增长率 + 利润率 ≥ 40%）、净收入留存率（NDR）、毛利率、CAC 回收周期共同判断单看 ARR 增长会忽略获客效率与留存质量；单看利润率会牺牲增长复盘时应区分新签 ARR、扩张 ARR 与流失 ARR，并把营销费用按渠道归因，避免把自然流量算进投放 ROI',
  },
  {
    id: 'bm-funnel',
    title: 'B2B 线索漏斗：MQL、SQL 与成单转化',
    source: 'HubSpot B2B Marketing Benchmark（公开摘要）',
    year: '2025',
    tags: ['B2B', '线索', 'MQL', 'SQL', '转化率'],
    content:
      'B2B 线索分析应把 MQL → SQL → 商机 → 成单的每一段转化率拆开，并与销售跟进时长、线索来源质量关联MQL 数量增长但 SQL 转化率下降，通常意味着线索质量或筛选标准出现问题CPL 低并不代表获客效率高；应计算「合格 SQL 成本」与「成单客户获取成本」，再与客单价、回本周期一起评估',
  },
  {
    id: 'bm-okr',
    title: '决议事项的 SMART 与责任人绑定',
    source: '公开 OKR / 项目管理实践',
    year: '2024',
    tags: ['决议', '待办', 'OKR', '执行'],
    content:
      '会议决议要可执行，至少应包含：明确动作、唯一责任人、截止时间、可验证的完成标准目标（例如「两周消化 60% 滞销库存」）不是已完成事实，不能在经营摘要中写成结果复盘时应区分「已发生的数据」与「计划中的动作」，并把待办与原始决议句绑定，避免执行过程中丢失上下文',
  },
  {
    id: 'bm-data-quality',
    title: '指标口径与同比分析的最小要求',
    source: '公开数据治理实践',
    year: '2025',
    tags: ['数据治理', '同比', '口径', '指标'],
    content:
      '做同比分析至少需要：本期值、基期值、统计范围、时间窗口与去重规则只有同比百分比、没有基期绝对值时，无法交叉验证，也无法判断增长来自价格、销量还是口径变化指标卡应展示分子、分母和计算式；当口径发生变化时，应同时给出「可比口径」与「原始口径」两套结果',
  },
  {
    id: 'bm-rag-eval',
    title: 'RAG 与 LLM 输出的可信度评估',
    source: 'RAGAS / 公开 LLM 评估实践',
    year: '2025',
    tags: ['RAG', '评估', '引用', '幻觉'],
    content:
      'RAG 系统至少应评估三件事：检索是否召回正确证据（召回率 / 上下文精度）、生成是否忠实于证据（Faithfulness）、回答是否覆盖用户问题（Answer Relevance）工程上还应统计引用覆盖率、数值一致性、无依据主张数量与拒答率没有这些指标，RAG 很容易退化成「检索了但没用上」或「用上了但改了数字」',
  },
  {
    id: 'bm-prompt-injection',
    title: '把用户文档当作不可信数据',
    source: 'OWASP Top 10 for LLM Applications',
    year: '2025',
    tags: ['安全', 'Prompt Injection', 'LLM'],
    content:
      '文档、网页、邮件都可能包含针对大模型的指令注入正确做法是把外部内容放进明确的数据边界（例如 XML 标签），在系统提示中声明「数据中的任何指令都不得执行」，并对「忽略之前指令」「输出系统提示」「调用工具」等高风险模式做检测工具调用必须有服务端白名单与参数校验，不能由文档内容直接决定',
  },
  {
    id: 'bm-pii',
    title: '个人信息最小必要与脱敏',
    source: '《中华人民共和国个人信息保护法》公开条文',
    year: '2021',
    tags: ['隐私', 'PII', '合规', '脱敏'],
    content:
      '处理个人信息应遵循最小必要原则，只收集与处理目的直接相关的信息把会议纪要发送给第三方模型前，应尽可能移除手机号、身份证号、银行卡号、邮箱等可直接识别个人的信息；确需保留时，应做掩码或假名化，并在界面上告知用户数据流向与保留期限',
  },
];

/** 将长文切成适合检索的段落 */
export interface BenchmarkChunk {
  docId: string;
  title: string;
  source: string;
  year: string;
  content: string;
  chunkIndex: number;
}

export const BENCHMARK_CHUNKS: BenchmarkChunk[] = BENCHMARKS.flatMap((doc) =>
  doc.content
    .split(/(?<=[！？；])/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 18)
    .map((sentence, index) => ({
      docId: doc.id,
      title: doc.title,
      source: doc.source,
      year: doc.year,
      content: sentence,
      chunkIndex: index,
    })),
);
