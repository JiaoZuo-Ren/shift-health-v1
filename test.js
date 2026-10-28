/* 本地验收脚本：验证 script.js 的判断逻辑与规则表一字不差
   运行方式：在 shift-health 目录下执行  node test.js  */
'use strict';

const site = require('./script.js');
const { getAdvice, bins } = site;

let pass = 0;
let fail = 0;

function check(name, actual, expected) {
  const ok = actual === expected;
  if (ok) {
    pass++;
    console.log('PASS  ' + name);
  } else {
    fail++;
    console.log('FAIL  ' + name);
    console.log('  expected: ' + JSON.stringify(expected));
    console.log('  actual:   ' + JSON.stringify(actual));
  }
}

/* ---------- 五组验收用例（页面验收标准） ---------- */
const cases = [
  {
    name: '用例1 久坐7 睡眠5 心率80 步数2000 → 第1行',
    input: [7, 5, 80, 2000], row: 1,
    advice: '今天久坐偏多、活动偏少。不建议直接去跑步，先每坐50分钟站起来2分钟，晚饭后散步15分钟；同时睡眠偏少、心率偏高，今天不适合高强度运动。优先补觉，白天加一次10分钟闭眼休息。',
    key: '今天最该做：中午闭眼休息10分钟，不安排高强度。'
  },
  {
    name: '用例2 久坐7 睡眠6.5 心率65 步数2500 → 第7行',
    input: [7, 6.5, 65, 2500], row: 7,
    advice: '今天久坐偏多、活动偏少。不建议直接去跑步，先每坐50分钟站起来2分钟，晚饭后散步15分钟；睡眠和心率都在可接受范围，今天可以安排20—30分钟低强度活动。',
    key: '今天最该做：每50分钟站起来2分钟。'
  },
  {
    name: '用例3 久坐7 睡眠8 心率留空 步数8000 → 第12行',
    input: [7, 8, null, 8000], row: 12,
    advice: '久坐多但活动量够，保持。注意每坐50分钟站起来一次，别连续坐满两小时；睡眠够，今天可以正常安排活动，避免连续久坐。',
    key: '今天最该做：保持节奏，别连续坐满两小时。'
  },
  {
    name: '用例4 久坐3 睡眠5 心率65 步数2000 → 第14行',
    input: [3, 5, 65, 2000], row: 14,
    advice: '今天久坐控制得不错，保持。如果步数够，不用额外加运动；如果步数少，晚饭后散步15分钟。睡眠偏少，避开高强度训练。',
    key: '今天最该做：每50分钟站起来2分钟。'
  },
  {
    name: '用例5 久坐5 睡眠6.5 心率65 步数4000 → 第19行',
    input: [5, 6.5, 65, 4000], row: 19,
    advice: '久坐中等；睡眠和心率都在可接受范围，今天可以安排20—30分钟低强度活动，记得定时起身。',
    key: '今天最该做：保持节奏，别连续坐满两小时。'
  }
];

for (const c of cases) {
  const out = getAdvice(c.input[0], c.input[1], c.input[2], c.input[3]);
  check(c.name + ' | 行号', out && out.row, c.row);
  check(c.name + ' | 活动建议', out && out.advice, c.advice);
  check(c.name + ' | 今天最该做', out && out.key, c.key);
}

/* ---------- 兜底规则用例（表中未列出的组合） ---------- */
const fallbackCases = [
  {
    name: '兜底1 久坐7 睡眠6.5 心率80 步数2500 → 基于第7行文案 + 固定最该做',
    input: [7, 6.5, 80, 2500], baseRow: 7,
    key: '今天最该做：中午闭眼休息10分钟，不安排高强度。'
  },
  {
    name: '兜底2 久坐3 睡眠6.5 心率80 步数4000 → 基于第15行文案 + 固定最该做',
    input: [3, 6.5, 80, 4000], baseRow: 15,
    key: '今天最该做：中午闭眼休息10分钟，不安排高强度。'
  },
  {
    name: '兜底3 久坐5 睡眠8 心率80 步数3000 → 基于第20行文案 + 固定最该做',
    input: [5, 8, 80, 3000], baseRow: 20,
    key: '今天最该做：中午闭眼休息10分钟，不安排高强度。'
  }
];

for (const c of fallbackCases) {
  const out = getAdvice(c.input[0], c.input[1], c.input[2], c.input[3]);
  const base = site.RULES.find(r => r.id === c.baseRow);
  check(c.name + ' | 是否走兜底', out && out.fallback, true);
  check(c.name + ' | 活动建议=基行原文', out && out.advice, base.advice);
  check(c.name + ' | 今天最该做=固定短句', out && out.key, c.key);
}

/* ---------- 区间边界 ---------- */
check('边界 久坐4 → 4to6', bins.sedentaryBin(4), '4to6');
check('边界 久坐6 → 4to6', bins.sedentaryBin(6), '4to6');
check('边界 久坐6.1 → gt6', bins.sedentaryBin(6.1), 'gt6');
check('边界 久坐3.9 → lt4', bins.sedentaryBin(3.9), 'lt4');
check('边界 睡眠6 → 6to7', bins.sleepBin(6), '6to7');
check('边界 睡眠7 → 6to7', bins.sleepBin(7), '6to7');
check('边界 睡眠7.1 → gte7', bins.sleepBin(7.1), 'gte7');
check('边界 睡眠5.9 → lt6', bins.sleepBin(5.9), 'lt6');
check('边界 步数3000 → 3000to5999', bins.stepsBin(3000), '3000to5999');
check('边界 步数5999 → 3000to5999', bins.stepsBin(5999), '3000to5999');
check('边界 步数6000 → gte6000', bins.stepsBin(6000), 'gte6000');
check('边界 步数2999 → lt3000', bins.stepsBin(2999), 'lt3000');
check('边界 心率70 → normal', bins.hrBin(70), 'normal');
check('边界 心率71 → high', bins.hrBin(71), 'high');
check('边界 心率留空(空串) → normal', bins.hrBin(''), 'normal');
check('边界 心率null → normal', bins.hrBin(null), 'normal');

console.log('--------------------------------');
console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail > 0 ? 1 : 0);
