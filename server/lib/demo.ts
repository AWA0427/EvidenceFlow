import type {
  ActionItem,
  ChartSpec,
  Claim,
  ClaimInput,
  ClaimStatus,
  DemoCase,
  Evidence,
  Insight,
  KPI,
  SourceDoc,
} from '../../shared/types';
import { locateQuote } from './text';

/**
 * 演示案例不是「假数据滤镜」，而是可被逐句核对的真实结构：
 * 每一条主张都带原文引用，每一个推导值都带公式。
 * 断网/无 Key 时，评审仍然可以完整体验证据链。
 */

interface ClaimSeed extends ClaimInput {
  id: string;
  status?: ClaimStatus;
  criticNote?: string;
}

interface DemoSeed {
  title: string;
  subtitle: string;
  summary: string;
  healthScore: number;
  claims: ClaimSeed[];
  kpis: KPI[];
  charts: ChartSpec[];
  insights: Insight[];
  actions: ActionItem[];
}

function makeSource(id: string, name: string, content: string): SourceDoc {
  return {
    id,
    name,
    kind: 'transcript',
    content,
    charCount: content.length,
    createdAt: new Date().toISOString(),
  };
}

const CONSUMER_CONTENT = `【会议主题】澄野生活 2026 年 Q3 经营复盘及 Q4 冲刺会
【时间】2026-10-24
【参会人】周宁（运营 VP）、林澈（数码品类）、苏禾（美妆）、顾言（服饰）、陈放（市场）

一、经营总盘
Q3 全渠道 GMV 完成 1,840 万元，季度目标 1,600 万元。整体退货率 7.2%，较上季度下降 1.4 个百分点。管理层口径称同比增长 28.4%，但本期材料未附去年同期绝对值。

二、品类拆分
智能数码：GMV 780 万元，目标 650 万元；AI 降噪耳机客单价 680 元。
美妆护肤：GMV 520 万元，目标 480 万元；抗老精华复购率 34%。
服饰箱包：GMV 340 万元，目标 350 万元；秋装受降温推迟影响，动销率 61%。
居家日用：GMV 200 万元，目标 120 万元；极简收纳系列贡献 46%。

三、渠道表现
抖音直播：曝光 850 万人次，进店率 12.8%，下单转化率 4.2%，ROI 3.6。
小红书种草：曝光 420 万人次，互动率 6.5%，站外导流进店 18.5 万人次，ROI 4.1。
传统电商搜索：曝光 610 万人次，进店率 8.9%，转化率 5.6%，ROI 5.2。

四、风险与资源
服饰滞销库存 95 万元，仓储占用成本环比上升 18%。
市场部剩余投放预算 210 万元。

五、决议
苏禾：10 月 31 日前输出美妆双 11 核心组套方案。
顾言：11 月 3 日前启动服饰专场清仓直播，目标两周消化 60% 滞销库存。
陈放：11 月 5 日前完成全渠道 ROI 动态看板。`;

const SAAS_CONTENT = `【会议主题】云栈科技 Sprint 42 迭代复盘与架构治理评审
【时间】2026-10-26
【参会人】赵衡（CTO）、孙启（架构）、钱宁（前端）、周牧（SRE）、吴越（QA）

一、交付情况
Sprint 42 计划 45 个 Story，按期交付 41 个，交付率 91.1%。本周期完成 186 故事点，计划 204 故事点，团队速率环比提升 12.5%。

二、稳定性与性能
核心 API P99 响应延迟由 340ms 降至 118ms。核心服务可用性 99.98%，本周期未发生 P0/P1 故障。前端首屏 LCP 由 2.4s 降至 1.1s。自动化测试覆盖率由 68% 提升至 82.4%，接口自动化用例 1,420 条。

三、遗留问题
线上 P2/P3 偶发缺陷 8 个，主要集中在低版本 Safari 多行文本光标错位。容器镜像构建耗时 14 分钟，影响每日发版频次。GraphQL 网关方案仍处于调研阶段，尚未评审。

四、决议
钱宁：10 月 30 日前修复 Safari 兼容性问题并完成 Canary 灰度。
周牧：11 月 2 日前落地 Docker 多阶段构建与缓存，将构建耗时压缩至 4 分钟以内。
孙启：11 月 6 日前提交 GraphQL 网关技术方案。`;

const MARKETING_CONTENT = `【会议主题】远望智能 9 月全渠道获客与线索质量复盘
【时间】2026-10-28
【参会人】林岚（CMO）、高远（搜索投放）、郑一（海外社媒）、沈清（内容）、黄禾（销售运营）

一、总盘
本月投放预算 150 万元，实际消耗 142.8 万元。新增 MQL 12,450 条，平均 CPL 114.7 元。签约 ARR 428 万元，综合 ROI 3.0。

二、渠道
Google 搜索：消耗 55 万元，MQL 5,200 条，SQL 转化率 24.5%。
领英 B2B：消耗 38 万元，MQL 2,100 条，SQL 转化率 38.2%。
微信生态：消耗 32 万元，MQL 3,600 条，SQL 转化率 14.8%。
海外播客：消耗 17.8 万元，MQL 1,550 条，SQL 转化率 19.4%。

三、问题
微信端 CPL 最低，但 SQL 转化率仅 14.8%，销售跟进耗时偏高。领英 CPL 最高，但 SQL 转化率最高。当前归因口径把自然搜索线索计入了 Google 投放 ROI。

四、决议
高远：11 月 1 日前把微信预算收窄 25%，追加到领英与 Google 核心词。
沈清：11 月 4 日前产出 3 篇企业级白皮书。
黄禾：11 月 2 日前上线 MQL 线索打分，并修正自然流量归因口径。`;

function consumerSeed(): DemoSeed {
  const claims: ClaimSeed[] = [
    {
      id: 'c-gmv',
      metric: 'Q3 全渠道 GMV',
      value: 1840,
      displayValue: '1,840 万元',
      unit: '万元',
      quote: 'Q3 全渠道 GMV 完成 1,840 万元',
      category: '经营总盘',
    },
    {
      id: 'c-target',
      metric: 'Q3 GMV 目标',
      value: 1600,
      displayValue: '1,600 万元',
      unit: '万元',
      quote: '季度目标 1,600 万元',
      category: '经营总盘',
    },
    {
      id: 'c-achievement',
      metric: 'GMV 目标达成率',
      value: 115,
      displayValue: '115.0%',
      unit: '%',
      quote: 'Q3 全渠道 GMV 完成 1,840 万元，季度目标 1,600 万元。',
      formula: '1,840 ÷ 1,600 = 115.0%',
      category: '经营总盘',
    },
    {
      id: 'c-return',
      metric: '整体退货率',
      value: 7.2,
      displayValue: '7.2%',
      unit: '%',
      quote: '整体退货率 7.2%',
      category: '经营质量',
    },
    {
      id: 'c-yoy',
      metric: 'GMV 同比增长',
      value: 28.4,
      displayValue: '28.4%',
      unit: '%',
      quote: '管理层口径称同比增长 28.4%',
      status: 'partial',
      criticNote: '材料未附去年同期绝对值（基期），无法验证同比口径与统计范围，暂不进入高管摘要。',
      category: '经营总盘',
    },
    {
      id: 'c-digital',
      metric: '智能数码 GMV',
      value: 780,
      displayValue: '780 万元',
      unit: '万元',
      quote: '智能数码：GMV 780 万元，目标 650 万元',
      category: '品类',
    },
    {
      id: 'c-digital-target',
      metric: '智能数码目标',
      value: 650,
      displayValue: '650 万元',
      unit: '万元',
      quote: '目标 650 万元',
      category: '品类',
    },
    {
      id: 'c-digital-rate',
      metric: '智能数码达成率',
      value: 120,
      displayValue: '120.0%',
      unit: '%',
      quote: '智能数码：GMV 780 万元，目标 650 万元',
      formula: '780 ÷ 650 = 120.0%',
      category: '品类',
    },
    {
      id: 'c-beauty',
      metric: '美妆护肤 GMV',
      value: 520,
      displayValue: '520 万元',
      unit: '万元',
      quote: '美妆护肤：GMV 520 万元，目标 480 万元',
      category: '品类',
    },
    {
      id: 'c-beauty-target',
      metric: '美妆护肤目标',
      value: 480,
      displayValue: '480 万元',
      unit: '万元',
      quote: '目标 480 万元',
      category: '品类',
    },
    {
      id: 'c-beauty-rate',
      metric: '美妆护肤达成率',
      value: 108.3,
      displayValue: '108.3%',
      unit: '%',
      quote: '美妆护肤：GMV 520 万元，目标 480 万元',
      formula: '520 ÷ 480 = 108.3%',
      category: '品类',
    },
    {
      id: 'c-apparel',
      metric: '服饰箱包 GMV',
      value: 340,
      displayValue: '340 万元',
      unit: '万元',
      quote: '服饰箱包：GMV 340 万元，目标 350 万元',
      category: '品类',
    },
    {
      id: 'c-apparel-target',
      metric: '服饰箱包目标',
      value: 350,
      displayValue: '350 万元',
      unit: '万元',
      quote: '目标 350 万元',
      category: '品类',
    },
    {
      id: 'c-apparel-rate',
      metric: '服饰箱包达成率',
      value: 97.1,
      displayValue: '97.1%',
      unit: '%',
      quote: '服饰箱包：GMV 340 万元，目标 350 万元',
      formula: '340 ÷ 350 = 97.1%',
      category: '品类',
    },
    {
      id: 'c-home',
      metric: '居家日用 GMV',
      value: 200,
      displayValue: '200 万元',
      unit: '万元',
      quote: '居家日用：GMV 200 万元，目标 120 万元',
      category: '品类',
    },
    {
      id: 'c-home-target',
      metric: '居家日用目标',
      value: 120,
      displayValue: '120 万元',
      unit: '万元',
      quote: '目标 120 万元',
      category: '品类',
    },
    {
      id: 'c-home-rate',
      metric: '居家日用达成率',
      value: 166.7,
      displayValue: '166.7%',
      unit: '%',
      quote: '居家日用：GMV 200 万元，目标 120 万元',
      formula: '200 ÷ 120 = 166.7%',
      category: '品类',
    },
    {
      id: 'c-inventory',
      metric: '服饰滞销库存',
      value: 95,
      displayValue: '95 万元',
      unit: '万元',
      quote: '服饰滞销库存 95 万元',
      category: '风险',
    },
    {
      id: 'c-warehouse',
      metric: '仓储占用成本环比',
      value: 18,
      displayValue: '+18%',
      unit: '%',
      quote: '仓储占用成本环比上升 18%',
      category: '风险',
    },
    {
      id: 'c-budget',
      metric: '剩余投放预算',
      value: 210,
      displayValue: '210 万元',
      unit: '万元',
      quote: '市场部剩余投放预算 210 万元',
      category: '资源',
    },
    {
      id: 'c-douyin-roi',
      metric: '抖音直播 ROI',
      value: 3.6,
      displayValue: '3.6',
      quote: 'ROI 3.6',
      category: '渠道',
    },
    {
      id: 'c-xhs-roi',
      metric: '小红书 ROI',
      value: 4.1,
      displayValue: '4.1',
      quote: 'ROI 4.1',
      category: '渠道',
    },
    {
      id: 'c-search-roi',
      metric: '搜索自营 ROI',
      value: 5.2,
      displayValue: '5.2',
      quote: 'ROI 5.2',
      category: '渠道',
    },
    {
      id: 'c-headphone-aov',
      metric: 'AI 降噪耳机客单价',
      value: 680,
      displayValue: '680 元',
      unit: '元',
      quote: 'AI 降噪耳机客单价 680 元',
      category: '品类',
    },
    {
      id: 'c-repeat',
      metric: '抗老精华复购率',
      value: 34,
      displayValue: '34%',
      unit: '%',
      quote: '抗老精华复购率 34%',
      category: '品类',
    },
    {
      id: 'c-sell-through',
      metric: '秋装动销率',
      value: 61,
      displayValue: '61%',
      unit: '%',
      quote: '动销率 61%',
      category: '品类',
    },
    {
      id: 'c-home-share',
      metric: '极简收纳系列贡献',
      value: 46,
      displayValue: '46%',
      unit: '%',
      quote: '极简收纳系列贡献 46%',
      category: '品类',
    },
  ];

  return {
    title: '澄野生活 Q3 经营复盘',
    subtitle: '消费品牌 · 全渠道 · 2026 Q3',
    summary:
      'Q3 GMV 1,840 万元，目标达成率 115.0%，增长主要由智能数码（120.0%）与居家日用（166.7%）拉动；服饰箱包是唯一未达标品类（97.1%），并伴随 95 万元滞销库存与仓储成本 +18% 的压力。全店退货率 7.2%，但缺少服饰分品类退货数据，不能直接推断服饰退货改善。管理层口径的同比增速缺少基期绝对值，已标记为待核实，不进入高管结论。',
    healthScore: 82,
    claims,
    kpis: [
      {
        id: 'kpi-gmv',
        label: 'Q3 全渠道 GMV',
        value: '1,840',
        unit: '万元',
        change: '目标达成 115.0%',
        trend: 'up',
        description: '目标 1,600 万元，超额 240 万元',
        claimId: 'c-gmv',
      },
      {
        id: 'kpi-return',
        label: '整体退货率',
        value: '7.2',
        unit: '%',
        change: '环比 -1.4pp',
        trend: 'up',
        description: '缺少分品类退货率，暂不能归因',
        claimId: 'c-return',
      },
      {
        id: 'kpi-inventory',
        label: '服饰滞销库存',
        value: '95',
        unit: '万元',
        change: '仓储成本 +18%',
        trend: 'down',
        description: '当前最确定的现金流风险',
        claimId: 'c-inventory',
      },
      {
        id: 'kpi-budget',
        label: '剩余投放预算',
        value: '210',
        unit: '万元',
        change: '待重新分配',
        trend: 'neutral',
        description: '需先统一渠道 ROI 口径',
        claimId: 'c-budget',
      },
    ],
    charts: [
      {
        id: 'chart-category',
        title: '品类目标 vs 实际 GMV',
        type: 'bar',
        description: '服饰箱包是唯一未达标品类；居家日用超额最明显。',
        categories: ['智能数码', '美妆护肤', '服饰箱包', '居家日用'],
        series: [
          { name: '季度目标', data: [650, 480, 350, 120], color: 'var(--chart-muted)' },
          { name: '实际 GMV', data: [780, 520, 340, 200], color: 'var(--accent)' },
        ],
        claimIds: ['c-digital', 'c-beauty', 'c-apparel', 'c-home'],
      },
      {
        id: 'chart-roi',
        title: '渠道 ROI 对比',
        type: 'bar',
        description: '搜索自营 ROI 最高，但三类渠道的归因窗口需要统一。',
        categories: ['抖音直播', '小红书', '搜索自营'],
        series: [{ name: 'ROI', data: [3.6, 4.1, 5.2], color: 'var(--verified)' }],
        claimIds: ['c-douyin-roi', 'c-xhs-roi', 'c-search-roi'],
      },
      {
        id: 'chart-share',
        title: 'GMV 品类结构',
        type: 'pie',
        description: '智能数码贡献约 42.4%，是当前的增长基本盘。',
        categories: ['智能数码', '美妆护肤', '服饰箱包', '居家日用'],
        series: [{ name: 'GMV 占比', data: [42.4, 28.3, 18.5, 10.8] }],
        claimIds: ['c-gmv', 'c-digital', 'c-beauty', 'c-apparel', 'c-home'],
      },
    ],
    insights: [
      {
        id: 'ins-growth',
        title: '增长由数码与家居拉动，服饰是唯一缺口',
        body: '智能数码超额 130 万元、居家日用超额 80 万元；服饰箱包差目标 10 万元。Q4 不应把预算平均撒向所有品类，应优先守住数码的供给与家居的动销，同时单独处理服饰库存。',
        impact: 'high',
        category: '品类策略',
        claimIds: ['c-digital', 'c-home', 'c-apparel'],
      },
      {
        id: 'ins-inventory',
        title: '95 万滞销库存是当前最确定的现金流风险',
        body: '服饰库存 95 万元，仓储成本环比 +18%。清仓能回笼现金，但会稀释毛利；决策表应同时列出折扣、预计回款和毛利损失，而不是只写「清库存」。',
        impact: 'high',
        category: '库存风险',
        claimIds: ['c-inventory', 'c-warehouse'],
      },
      {
        id: 'ins-returns',
        title: '全店退货率 7.2% 不能直接证明服饰退货改善',
        body: '当前材料只有全店退货率，没有服饰分品类退货率。全店均值可能被低退货品类稀释；建议补充分品类、分渠道退货数据后再判断。',
        impact: 'medium',
        category: '经营质量',
        claimIds: ['c-return'],
      },
      {
        id: 'ins-yoy',
        title: '同比 +28.4% 缺少基期，已从高管摘要中拦截',
        body: '材料只给了同比百分比，没有去年同期绝对值、统计范围和口径变化。该主张无法交叉验证，系统将其标记为「待核实」，避免把未经证实的增长写进结论。',
        impact: 'medium',
        category: '数据质量',
        claimIds: ['c-yoy'],
      },
      {
        id: 'ins-channel',
        title: '预算再分配前，先统一 ROI 口径',
        body: '搜索 ROI 5.2、小红书 4.1、抖音 3.6，但内容渠道存在长尾转化与品牌溢出，短周期 ROI 会低估内容价值。建议统一「毛利 / 投放费用」口径并拉长归因窗口。',
        impact: 'medium',
        category: '渠道策略',
        claimIds: ['c-search-roi', 'c-xhs-roi', 'c-douyin-roi'],
      },
    ],
    actions: [
      {
        id: 'act-beauty',
        task: '输出美妆双 11 核心组套方案',
        owner: '苏禾',
        deadline: '2026-10-31',
        priority: 'high',
        status: 'in_progress',
        claimId: 'c-beauty',
      },
      {
        id: 'act-clearance',
        task: '启动服饰专场清仓直播，目标两周消化 60% 滞销库存',
        owner: '顾言',
        deadline: '2026-11-03',
        priority: 'urgent',
        status: 'pending',
        claimId: 'c-inventory',
      },
      {
        id: 'act-roi',
        task: '完成全渠道 ROI 动态看板，统一归因口径',
        owner: '陈放',
        deadline: '2026-11-05',
        priority: 'high',
        status: 'pending',
        claimId: 'c-search-roi',
      },
      {
        id: 'act-yoy',
        task: '补齐去年同期 GMV 绝对值与统计口径，重新验证同比',
        owner: '周宁',
        deadline: '2026-10-29',
        priority: 'normal',
        status: 'pending',
        claimId: 'c-yoy',
      },
    ],
  };
}

function saasSeed(): DemoSeed {
  const claims: ClaimSeed[] = [
    {
      id: 's-planned',
      metric: '计划 Story 数',
      value: 45,
      displayValue: '45 个',
      unit: '个',
      quote: 'Sprint 42 计划 45 个 Story',
      category: '交付',
    },
    {
      id: 's-delivered',
      metric: '按期交付 Story 数',
      value: 41,
      displayValue: '41 个',
      unit: '个',
      quote: '按期交付 41 个',
      category: '交付',
    },
    {
      id: 's-delivery-rate',
      metric: 'Story 交付率',
      value: 91.1,
      displayValue: '91.1%',
      unit: '%',
      quote: '计划 45 个 Story，按期交付 41 个，交付率 91.1%',
      formula: '41 ÷ 45 = 91.1%',
      category: '交付',
    },
    {
      id: 's-points',
      metric: '完成故事点',
      value: 186,
      displayValue: '186 点',
      unit: '点',
      quote: '本周期完成 186 故事点',
      category: '交付',
    },
    {
      id: 's-points-plan',
      metric: '计划故事点',
      value: 204,
      displayValue: '204 点',
      unit: '点',
      quote: '计划 204 故事点',
      category: '交付',
    },
    {
      id: 's-velocity',
      metric: '团队速率环比',
      value: 12.5,
      displayValue: '+12.5%',
      unit: '%',
      quote: '团队速率环比提升 12.5%',
      category: '交付',
    },
    {
      id: 's-p99-before',
      metric: 'API P99 优化前',
      value: 340,
      displayValue: '340ms',
      unit: 'ms',
      quote: 'P99 响应延迟由 340ms 降至 118ms',
      category: '性能',
    },
    {
      id: 's-p99',
      metric: 'API P99 当前',
      value: 118,
      displayValue: '118ms',
      unit: 'ms',
      quote: 'P99 响应延迟由 340ms 降至 118ms',
      category: '性能',
    },
    {
      id: 's-p99-improve',
      metric: 'P99 降幅',
      value: 65.3,
      displayValue: '65.3%',
      unit: '%',
      quote: 'P99 响应延迟由 340ms 降至 118ms',
      formula: '(340 − 118) ÷ 340 = 65.3%',
      category: '性能',
    },
    {
      id: 's-availability',
      metric: '核心服务可用性',
      value: 99.98,
      displayValue: '99.98%',
      unit: '%',
      quote: '核心服务可用性 99.98%',
      category: '稳定性',
    },
    {
      id: 's-lcp-before',
      metric: '首屏 LCP 优化前',
      value: 2.4,
      displayValue: '2.4s',
      unit: 's',
      quote: '首屏 LCP 由 2.4s 降至 1.1s',
      category: '性能',
    },
    {
      id: 's-lcp',
      metric: '首屏 LCP 当前',
      value: 1.1,
      displayValue: '1.1s',
      unit: 's',
      quote: '首屏 LCP 由 2.4s 降至 1.1s',
      category: '性能',
    },
    {
      id: 's-coverage-before',
      metric: '测试覆盖率优化前',
      value: 68,
      displayValue: '68%',
      unit: '%',
      quote: '自动化测试覆盖率由 68% 提升至 82.4%',
      category: '质量',
    },
    {
      id: 's-coverage',
      metric: '自动化测试覆盖率',
      value: 82.4,
      displayValue: '82.4%',
      unit: '%',
      quote: '自动化测试覆盖率由 68% 提升至 82.4%',
      category: '质量',
    },
    {
      id: 's-cases',
      metric: '接口自动化用例',
      value: 1420,
      displayValue: '1,420 条',
      unit: '条',
      quote: '接口自动化用例 1,420 条',
      category: '质量',
    },
    {
      id: 's-bugs',
      metric: 'P2/P3 偶发缺陷',
      value: 8,
      displayValue: '8 个',
      unit: '个',
      quote: '线上 P2/P3 偶发缺陷 8 个',
      category: '质量',
    },
    {
      id: 's-build',
      metric: '镜像构建耗时',
      value: 14,
      displayValue: '14 分钟',
      unit: '分钟',
      quote: '容器镜像构建耗时 14 分钟',
      category: '效能',
    },
    {
      id: 's-build-target',
      metric: '镜像构建目标',
      value: 4,
      displayValue: '4 分钟',
      unit: '分钟',
      quote: '将构建耗时压缩至 4 分钟以内',
      category: '效能',
    },
  ];

  return {
    title: '云栈科技 Sprint 42 研发效能评审',
    subtitle: 'SaaS · 研发效能 · Sprint 42',
    summary:
      'Sprint 42 交付率 91.1%，完成 186/204 故事点，P99 从 340ms 降至 118ms，可用性 99.98%，性能与稳定性改善明确。当前瓶颈不在交付速度，而在 CI：镜像构建仍需 14 分钟，距离 4 分钟目标有 10 分钟差距；另有 8 个 P2/P3 缺陷集中在 Safari 兼容性。GraphQL 网关仍处于调研阶段，不能当作已落地成果。',
    healthScore: 88,
    claims,
    kpis: [
      {
        id: 'kpi-delivery',
        label: 'Story 交付率',
        value: '91.1',
        unit: '%',
        change: '41 / 45',
        trend: 'up',
        description: '完成 186 / 204 故事点',
        claimId: 's-delivery-rate',
      },
      {
        id: 'kpi-p99',
        label: 'API P99',
        value: '118',
        unit: 'ms',
        change: '-65.3%',
        trend: 'up',
        description: '由 340ms 优化至 118ms',
        claimId: 's-p99',
      },
      {
        id: 'kpi-availability',
        label: '核心可用性',
        value: '99.98',
        unit: '%',
        change: '零 P0/P1',
        trend: 'neutral',
        description: '本周期未发生重大故障',
        claimId: 's-availability',
      },
      {
        id: 'kpi-build',
        label: '镜像构建耗时',
        value: '14',
        unit: '分钟',
        change: '目标 4 分钟',
        trend: 'down',
        description: '当前最明确的效能瓶颈',
        claimId: 's-build',
      },
    ],
    charts: [
      {
        id: 'chart-velocity',
        title: '计划 vs 实际故事点',
        type: 'bar',
        description: '交付率 91.1%，剩余 18 点未完成。',
        categories: ['Sprint 42'],
        series: [
          { name: '计划', data: [204], color: 'var(--chart-muted)' },
          { name: '实际', data: [186], color: 'var(--accent)' },
        ],
        claimIds: ['s-points', 's-points-plan'],
      },
      {
        id: 'chart-latency',
        title: 'P99 延迟优化',
        type: 'bar',
        description: 'P99 从 340ms 降至 118ms，降幅 65.3%。',
        categories: ['优化前', '当前'],
        series: [{ name: 'P99 (ms)', data: [340, 118], color: 'var(--verified)' }],
        claimIds: ['s-p99-before', 's-p99'],
      },
      {
        id: 'chart-coverage',
        title: '测试覆盖率变化',
        type: 'line',
        description: '覆盖率从 68% 提升至 82.4%，增加 14.4 个百分点。',
        categories: ['优化前', '当前'],
        series: [{ name: '覆盖率 (%)', data: [68, 82.4], color: 'var(--accent)' }],
        claimIds: ['s-coverage-before', 's-coverage'],
      },
    ],
    insights: [
      {
        id: 'ins-delivery',
        title: '交付速度不是当前瓶颈',
        body: '交付率 91.1%、速率环比 +12.5%，说明团队吞吐处于健康区间。继续加人或加班未必有效，先把 CI 反馈时间降下来。',
        impact: 'high',
        category: '研发效能',
        claimIds: ['s-delivery-rate', 's-velocity'],
      },
      {
        id: 'ins-ci',
        title: 'CI 构建 14 分钟，是发版频率的硬约束',
        body: '镜像构建距离 4 分钟目标差 10 分钟。多阶段构建、依赖缓存和并行层可以优先做；否则每日多次发版会被流水线卡住。',
        impact: 'high',
        category: '工程效能',
        claimIds: ['s-build', 's-build-target'],
      },
      {
        id: 'ins-quality',
        title: '质量改善真实，但 Safari 缺陷仍是用户可见风险',
        body: '覆盖率 82.4%、零 P0/P1 是明确成果；8 个 P2/P3 缺陷集中在低版本 Safari，属于特定用户群的可感知问题，建议在灰度前补齐兼容性用例。',
        impact: 'medium',
        category: '质量',
        claimIds: ['s-coverage', 's-bugs'],
      },
      {
        id: 'ins-graphql',
        title: 'GraphQL 网关尚未评审，不能计入本期成果',
        body: '材料明确写了「仍处于调研阶段」，因此不应把网关升级写进交付总结。可在下一周期以 ADR（架构决策记录）形式评审。',
        impact: 'medium',
        category: '架构治理',
        claimIds: ['s-delivery-rate'],
      },
    ],
    actions: [
      {
        id: 'act-safari',
        task: '修复 Safari 多行文本光标问题并完成 Canary 灰度',
        owner: '钱宁',
        deadline: '2026-10-30',
        priority: 'urgent',
        status: 'in_progress',
        claimId: 's-bugs',
      },
      {
        id: 'act-docker',
        task: '落地 Docker 多阶段构建与缓存，将构建压缩到 4 分钟内',
        owner: '周牧',
        deadline: '2026-11-02',
        priority: 'high',
        status: 'pending',
        claimId: 's-build',
      },
      {
        id: 'act-graphql',
        task: '提交 GraphQL 网关技术方案与 ADR',
        owner: '孙启',
        deadline: '2026-11-06',
        priority: 'normal',
        status: 'pending',
        claimId: 's-delivery-rate',
      },
    ],
  };
}

function marketingSeed(): DemoSeed {
  const claims: ClaimSeed[] = [
    {
      id: 'm-budget',
      metric: '本月投放预算',
      value: 150,
      displayValue: '150 万元',
      unit: '万元',
      quote: '本月投放预算 150 万元',
      category: '预算',
    },
    {
      id: 'm-spend',
      metric: '实际消耗',
      value: 142.8,
      displayValue: '142.8 万元',
      unit: '万元',
      quote: '实际消耗 142.8 万元',
      category: '预算',
    },
    {
      id: 'm-mql',
      metric: '新增 MQL',
      value: 12450,
      displayValue: '12,450 条',
      unit: '条',
      quote: '新增 MQL 12,450 条',
      category: '获客',
    },
    {
      id: 'm-cpl',
      metric: '平均 CPL',
      value: 114.7,
      displayValue: '114.7 元',
      unit: '元',
      quote: '平均 CPL 114.7 元',
      category: '获客',
    },
    {
      id: 'm-arr',
      metric: '签约 ARR',
      value: 428,
      displayValue: '428 万元',
      unit: '万元',
      quote: '签约 ARR 428 万元',
      category: '营收',
    },
    {
      id: 'm-roi',
      metric: '综合 ROI',
      value: 3.0,
      displayValue: '3.0',
      quote: '综合 ROI 3.0',
      category: '营收',
    },
    {
      id: 'm-google-spend',
      metric: 'Google 消耗',
      value: 55,
      displayValue: '55 万元',
      unit: '万元',
      quote: 'Google 搜索：消耗 55 万元',
      category: '渠道',
    },
    {
      id: 'm-google-sql',
      metric: 'Google SQL 转化率',
      value: 24.5,
      displayValue: '24.5%',
      unit: '%',
      quote: 'SQL 转化率 24.5%',
      category: '渠道',
    },
    {
      id: 'm-linkedin-spend',
      metric: '领英消耗',
      value: 38,
      displayValue: '38 万元',
      unit: '万元',
      quote: '领英 B2B：消耗 38 万元',
      category: '渠道',
    },
    {
      id: 'm-linkedin-sql',
      metric: '领英 SQL 转化率',
      value: 38.2,
      displayValue: '38.2%',
      unit: '%',
      quote: 'SQL 转化率 38.2%',
      category: '渠道',
    },
    {
      id: 'm-wechat-spend',
      metric: '微信消耗',
      value: 32,
      displayValue: '32 万元',
      unit: '万元',
      quote: '微信生态：消耗 32 万元',
      category: '渠道',
    },
    {
      id: 'm-wechat-sql',
      metric: '微信 SQL 转化率',
      value: 14.8,
      displayValue: '14.8%',
      unit: '%',
      quote: 'SQL 转化率 14.8%',
      category: '渠道',
    },
    {
      id: 'm-podcast-spend',
      metric: '播客消耗',
      value: 17.8,
      displayValue: '17.8 万元',
      unit: '万元',
      quote: '海外播客：消耗 17.8 万元',
      category: '渠道',
    },
    {
      id: 'm-podcast-sql',
      metric: '播客 SQL 转化率',
      value: 19.4,
      displayValue: '19.4%',
      unit: '%',
      quote: 'SQL 转化率 19.4%',
      category: '渠道',
    },
    {
      id: 'm-attribution',
      metric: '归因口径问题',
      value: null,
      displayValue: '自然流量计入 Google ROI',
      quote: '当前归因口径把自然搜索线索计入了 Google 投放 ROI',
      status: 'partial',
      criticNote: '归因口径被污染，Google ROI 与综合 ROI 不能直接用于预算决策。',
      category: '数据质量',
    },
  ];

  return {
    title: '远望智能 9 月全渠道获客复盘',
    subtitle: 'B2B SaaS · 市场增长 · 2026 年 9 月',
    summary:
      '9 月消耗 142.8 万元，新增 MQL 12,450 条，平均 CPL 114.7 元，签约 ARR 428 万元，综合 ROI 3.0。领英的 SQL 转化率 38.2% 最高，微信 14.8% 最低；但当前归因把自然搜索线索计入 Google 投放 ROI，渠道 ROI 与预算再分配结论都需要先修正口径。',
    healthScore: 76,
    claims,
    kpis: [
      {
        id: 'kpi-mql',
        label: '新增 MQL',
        value: '12,450',
        unit: '条',
        change: 'CPL 114.7 元',
        trend: 'up',
        description: '数量增长，但需看 SQL 质量',
        claimId: 'm-mql',
      },
      {
        id: 'kpi-roi',
        label: '综合 ROI',
        value: '3.0',
        unit: 'x',
        change: 'ARR 428 万元',
        trend: 'neutral',
        description: '归因口径待修正',
        claimId: 'm-roi',
      },
      {
        id: 'kpi-linkedin',
        label: '领英 SQL 转化率',
        value: '38.2',
        unit: '%',
        change: '全渠道最高',
        trend: 'up',
        description: 'CPL 高但线索质量高',
        claimId: 'm-linkedin-sql',
      },
      {
        id: 'kpi-wechat',
        label: '微信 SQL 转化率',
        value: '14.8',
        unit: '%',
        change: '全渠道最低',
        trend: 'down',
        description: '低 CPL 未转化为高质量商机',
        claimId: 'm-wechat-sql',
      },
    ],
    charts: [
      {
        id: 'chart-spend',
        title: '渠道消耗 vs SQL 转化率',
        type: 'bar',
        description: '领英消耗中等但 SQL 转化率最高；微信消耗不低、转化率最低。',
        categories: ['Google', '领英', '微信', '播客'],
        series: [
          { name: '消耗 (万元)', data: [55, 38, 32, 17.8], color: 'var(--chart-muted)' },
          { name: 'SQL 转化率 (%)', data: [24.5, 38.2, 14.8, 19.4], color: 'var(--accent)' },
        ],
        claimIds: ['m-google-spend', 'm-linkedin-spend', 'm-wechat-spend', 'm-podcast-spend'],
      },
      {
        id: 'chart-funnel',
        title: 'MQL → SQL → ARR',
        type: 'funnel',
        description: '从 MQL 到 SQL 的质量筛选，是当前最值得优化的环节。',
        categories: ['MQL', 'SQL', '签约 ARR'],
        series: [{ name: '规模', data: [12450, 3088, 428], color: 'var(--verified)' }],
        claimIds: ['m-mql', 'm-arr'],
      },
      {
        id: 'chart-sql',
        title: '各渠道 SQL 转化率',
        type: 'bar',
        description: '领英 38.2% 领先，微信 14.8% 垫底。',
        categories: ['Google', '领英', '微信', '播客'],
        series: [{ name: 'SQL 转化率 (%)', data: [24.5, 38.2, 14.8, 19.4], color: 'var(--accent)' }],
        claimIds: ['m-google-sql', 'm-linkedin-sql', 'm-wechat-sql', 'm-podcast-sql'],
      },
    ],
    insights: [
      {
        id: 'ins-linkedin',
        title: '领英是质量最高的渠道，但不能用 CPL 否定它',
        body: '领英 CPL 最高，但 SQL 转化率 38.2% 全渠道第一。预算决策应看「合格 SQL 成本」与「成单客户获取成本」，而不是只看 CPL。',
        impact: 'high',
        category: '渠道策略',
        claimIds: ['m-linkedin-spend', 'm-linkedin-sql'],
      },
      {
        id: 'ins-wechat',
        title: '微信的低 CPL 正在挤占销售时间',
        body: '微信 SQL 转化率 14.8%，为全渠道最低。低 CPL 带来大量低意向线索，销售跟进成本没有被计入 ROI。建议收窄预算并提高留资门槛。',
        impact: 'high',
        category: '线索质量',
        claimIds: ['m-wechat-spend', 'm-wechat-sql'],
      },
      {
        id: 'ins-attribution',
        title: '归因口径被污染，预算结论暂不可发布',
        body: '自然搜索线索被计入 Google 投放 ROI，导致 Google 与综合 ROI 被高估。系统已将该主张标记为「待核实」，并阻止其进入高管摘要；修正归因后再做预算再分配。',
        impact: 'high',
        category: '数据质量',
        claimIds: ['m-attribution', 'm-roi'],
      },
    ],
    actions: [
      {
        id: 'act-budget',
        task: '微信预算收窄 25%，追加到领英与 Google 核心词',
        owner: '高远',
        deadline: '2026-11-01',
        priority: 'high',
        status: 'pending',
        claimId: 'm-wechat-sql',
      },
      {
        id: 'act-whitepaper',
        task: '产出 3 篇企业级白皮书，用于领英线索培育',
        owner: '沈清',
        deadline: '2026-11-04',
        priority: 'normal',
        status: 'pending',
        claimId: 'm-linkedin-sql',
      },
      {
        id: 'act-attribution',
        task: '上线 MQL 线索打分，修正自然流量归因口径',
        owner: '黄禾',
        deadline: '2026-11-02',
        priority: 'urgent',
        status: 'pending',
        claimId: 'm-attribution',
      },
    ],
  };
}

const SEEDS: Record<string, () => DemoSeed> = {
  'consumer-q3': consumerSeed,
  'saas-sprint': saasSeed,
  'marketing-roi': marketingSeed,
};

export const DEMO_CASES: DemoCase[] = [
  {
    id: 'consumer-q3',
    title: '澄野生活 Q3 经营复盘',
    subtitle: '消费品牌 · 全渠道',
    industry: '消费零售',
    period: '2026 Q3',
    description: '一份包含 GMV、品类、渠道、库存与决议的完整经营复盘纪要。',
    highlights: ['品类目标达成', '库存现金流风险', '同比口径缺失'],
    source: makeSource('demo-consumer', '澄野生活_Q3经营复盘纪要.txt', CONSUMER_CONTENT),
  },
  {
    id: 'saas-sprint',
    title: '云栈科技 Sprint 42 评审',
    subtitle: 'SaaS · 研发效能',
    industry: '企业服务',
    period: 'Sprint 42',
    description: '交付、性能、稳定性、缺陷与 CI 效能的研发复盘。',
    highlights: ['DORA 视角', 'CI 瓶颈', 'Safari 兼容性'],
    source: makeSource('demo-saas', '云栈科技_Sprint42_复盘纪要.txt', SAAS_CONTENT),
  },
  {
    id: 'marketing-roi',
    title: '远望智能 9 月获客复盘',
    subtitle: 'B2B SaaS · 市场增长',
    industry: '企业服务',
    period: '2026 年 9 月',
    description: '预算、渠道、CPL/SQL 与归因口径的获客复盘。',
    highlights: ['渠道质量', '归因污染', '预算再分配'],
    source: makeSource('demo-marketing', '远望智能_9月获客复盘纪要.txt', MARKETING_CONTENT),
  },
];

export function getDemoCase(id: string): DemoCase | undefined {
  return DEMO_CASES.find((item) => item.id === id);
}

export interface DemoRun {
  source: SourceDoc;
  title: string;
  subtitle: string;
  summary: string;
  healthScore: number;
  claims: Claim[];
  evidence: Evidence[];
  kpis: KPI[];
  charts: ChartSpec[];
  insights: Insight[];
  actions: ActionItem[];
}

/** 将种子主张转成带证据的 Claim；所有引用都必须在原文中真实存在。 */
export function buildDemoRun(caseId: string): DemoRun {
  const demo = getDemoCase(caseId);
  const seedFactory = SEEDS[caseId];
  if (!demo || !seedFactory) {
    throw new Error(`未知演示案例：${caseId}`);
  }
  const seed = seedFactory();
  const claims: Claim[] = [];
  const evidence: Evidence[] = [];

  for (const claim of seed.claims) {
    const location = locateQuote(demo.source.content, claim.quote);
    const isComputed = Boolean(claim.formula);
    const status: ClaimStatus =
      claim.status ??
      (location && (isComputed || claim.value === null || numberInQuote(claim.value, location.quote))
        ? 'verified'
        : location
          ? 'partial'
          : 'unsupported');

    const claimId = claim.id;
    const evidenceId = `ev-${claimId}`;
    const evidenceItem: Evidence = {
      id: evidenceId,
      claimId,
      sourceId: demo.source.id,
      sourceName: demo.source.name,
      quote: location?.quote ?? claim.quote,
      locator: location ? `第 ${paragraphOf(demo.source.content, location.start)} 段` : '未在原文中定位',
      method: isComputed ? 'computed' : 'direct_quote',
      formula: claim.formula,
      inputs: isComputed
        ? [
            { label: '来源', value: demo.source.name },
            { label: '校验方式', value: '原文数值 + 确定性公式' },
          ]
        : undefined,
      confidence: status === 'verified' ? 0.98 : status === 'partial' ? 0.62 : 0.2,
      verified: status === 'verified',
      note:
        status === 'partial'
          ? claim.criticNote ?? '原文存在该表述，但缺少交叉验证条件。'
          : status === 'unsupported'
            ? '原文中未找到可核对的引用。'
            : undefined,
    };

    claims.push({
      id: claimId,
      text: `${claim.metric}：${claim.displayValue}`,
      metric: claim.metric,
      value: claim.value,
      displayValue: claim.displayValue,
      unit: claim.unit,
      quote: claim.quote,
      category: claim.category,
      formula: claim.formula,
      status,
      confidence: evidenceItem.confidence,
      evidenceIds: [evidenceId],
      criticNote: claim.criticNote,
    });
    evidence.push(evidenceItem);
  }

  return {
    source: demo.source,
    title: seed.title,
    subtitle: seed.subtitle,
    summary: seed.summary,
    healthScore: seed.healthScore,
    claims,
    evidence,
    kpis: seed.kpis,
    charts: seed.charts,
    insights: seed.insights,
    actions: seed.actions,
  };
}

function numberInQuote(value: number | null, quote: string): boolean {
  if (value === null) return true;
  const candidates = [String(value), value.toFixed(1), value.toFixed(2)];
  const compact = quote.replace(/[\s,，]/g, '');
  return candidates.some((candidate) => compact.includes(candidate));
}

function paragraphOf(content: string, index: number): number {
  return content.slice(0, index).split(/\n+/).filter((part) => part.trim().length > 0).length;
}

export function caseContent(id: string): string {
  return getDemoCase(id)?.source.content ?? '';
}
