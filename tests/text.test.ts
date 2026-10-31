import { describe, expect, it } from 'vitest';
import {
  locateQuote,
  numberAppearsInText,
  parseCsv,
  parseNumber,
  growthRate,
  achievementRate,
} from '../server/lib/text';
import { evaluateArithmetic, verifyFormula } from '../server/lib/analysis';

describe('文本与数字工具', () => {
  it('精确/归一化定位引用', () => {
    const source = 'Q3 全渠道 GMV 完成 1,840 万元，季度目标 1,600 万元。';
    expect(locateQuote(source, 'Q3 全渠道 GMV 完成 1,840 万元')?.quote).toBe('Q3 全渠道 GMV 完成 1,840 万元');
    expect(locateQuote(source, 'Q3 全渠道 GMV 完成 1,840 万元，季度目标 1,600 万元。')).not.toBeNull();
    expect(locateQuote(source, '不存在的句子')).toBeNull();
  });

  it('归一化标点与空白后仍能定位', () => {
    const source = 'Q3 全渠道 GMV 完成 1,840 万元，季度目标 1,600 万元。';
    expect(locateQuote(source, 'Q3全渠道GMV完成1,840万元')).not.toBeNull();
  });

  it('解析常见数值格式', () => {
    expect(parseNumber('1,840 万元')).toBe(1840);
    expect(parseNumber('7.2%')).toBe(7.2);
    expect(parseNumber('118ms')).toBe(118);
    expect(parseNumber('无')).toBeNull();
  });

  it('数值是否在文本中出现', () => {
    expect(numberAppearsInText(1840, 'Q3 全渠道 GMV 完成 1,840 万元')).toBe(true);
    expect(numberAppearsInText(115, 'Q3 全渠道 GMV 完成 1,840 万元')).toBe(false);
  });

  it('解析 CSV 并识别数值列', () => {
    const csv = '品类,目标,实际\n数码,650,780\n美妆,480,520\n';
    const parsed = parseCsv(csv);
    expect(parsed.headers).toEqual(['品类', '目标', '实际']);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]['实际']).toBe(780);
  });

  it('计算增长率与达成率', () => {
    expect(growthRate(118, 340)).toBeCloseTo(-65.29, 1);
    expect(achievementRate(1840, 1600)).toBeCloseTo(115, 5);
    expect(achievementRate(1, 0)).toBeNull();
  });
});

describe('确定性公式复算', () => {
  it('只允许四则运算', () => {
    expect(evaluateArithmetic('1,840 / 1,600 * 100')).toBeCloseTo(115, 5);
    expect(evaluateArithmetic('(340 - 118) / 340 * 100')).toBeCloseTo(65.294, 2);
    expect(evaluateArithmetic('41 / 45 * 100')).toBeCloseTo(91.111, 2);
    expect(evaluateArithmetic('alert(1)')).toBeNull();
    expect(evaluateArithmetic('1 / 0')).toBeNull();
  });

  it('校验公式与声称值是否一致', () => {
    expect(verifyFormula('1,840 ÷ 1,600 = 115.0%', 115).ok).toBe(true);
    expect(verifyFormula('(340 − 118) ÷ 340 = 65.3%', 65.3).ok).toBe(true);
    expect(verifyFormula('41 ÷ 45 = 91.1%', 90).ok).toBe(false);
  });
});
