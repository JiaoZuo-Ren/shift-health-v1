/* 本地验收脚本：验证 script.js 的判断逻辑与规则表一字不差
   运行方式：在 shift-health 目录下执行  node test.js  */
'use strict';

const site = require('./script.js');
const { getAdvice, getNightAdvice, bins, computeVitality, validateInputs, computeHydration, computeMicroAction } = site;

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

/* ---------- 五组验收用例（页面验收标准，与升级后规则表逐字一致） ---------- */
const cases = [
  {
    name: '用例1 久坐7 睡眠5 心率80 步数2000 → 第1行',
    input: [7, 5, 80, 2000], row: 1,
    risk: '红灯（恢复不足）',
    advice: '今天只做轻度主动恢复：20分钟平地慢走，强度以说话不喘为准。先每坐50分钟站起来2分钟，晚饭后散步15分钟补步数。',
    key: '今天最该做：中午闭眼休息10分钟，不安排高强度。'
  },
  {
    name: '用例2 久坐7 睡眠6.5 心率65 步数2500 → 第7行',
    input: [7, 6.5, 65, 2500], row: 7,
    risk: '黄灯（久坐偏多）',
    advice: '久坐偏多、步数偏少：晚饭后快走或散步20分钟补步数，强度以说话不喘为准；今天可安排20—30分钟低强度活动。',
    key: '今天最该做：每50分钟站起来2分钟。'
  },
  {
    name: '用例3 久坐7 睡眠8 心率留空 步数8000 → 第12行',
    input: [7, 8, null, 8000], row: 12,
    risk: '黄灯（久坐偏多）',
    advice: '睡眠充足、步数达标：保持今天的活动节奏，可安排30分钟中低强度活动；注意每坐50分钟站起来一次，别连续坐满两小时。',
    key: '今天最该做：保持节奏，别连续坐满两小时。'
  },
  {
    name: '用例4 久坐3 睡眠5 心率65 步数2000 → 第14行',
    input: [3, 5, 65, 2000], row: 14,
    risk: '黄灯（睡眠不足）',
    advice: '久坐控制得不错，睡眠不足：步数够就保持，不用额外加运动；步数少就晚饭后散步15分钟。避开高强度训练。',
    key: '今天最该做：每50分钟站起来2分钟。'
  },
  {
    name: '用例5 久坐5 睡眠6.5 心率65 步数4000 → 第19行',
    input: [5, 6.5, 65, 4000], row: 19,
    risk: '绿灯（状态良好）',
    advice: '睡眠、心率、久坐都在可接受范围：今天可安排20—30分钟中低强度活动（快走或慢跑），记得定时起身。',
    key: '今天最该做：保持节奏，别连续坐满两小时。'
  }
];

for (const c of cases) {
  const out = getAdvice(c.input[0], c.input[1], c.input[2], c.input[3]);
  check(c.name + ' | 行号', out && out.row, c.row);
  check(c.name + ' | 状态分级', out && out.risk, c.risk);
  check(c.name + ' | 活动建议', out && out.advice, c.advice);
  check(c.name + ' | 今天最该做', out && out.key, c.key);
}

/* 用例1 另外核对新增的三块文案 */
{
  const out = getAdvice(7, 5, 80, 2000);
  check('用例1 | 绝对禁忌', out.taboo, '禁止HIIT、大重量抗阻和剧烈有氧——睡眠严重不足且心率偏高时，高强度训练风险大于收益；若静息心率经常超过100次/分，或伴有胸痛、头晕、气短，请就医。');
  check('用例1 | 动作处方', out.action, '每坐50分钟起身2分钟；做3组靠墙静蹲（每组30—45秒），激活臀部、缓解腰椎压力；膝关节不适就减量或停止。');
  check('用例1 | 营养提示', out.nutrition, '下午2点后不再摄入咖啡因（睡前6小时摄入仍会明显缩短睡眠）；晚餐加一份深绿叶菜（菠菜）或一把南瓜子补镁。');
}

/* ---------- 兜底规则用例（心率偏高且睡眠≥6小时的未列组合） ---------- */
const fallbackCases = [
  { name: '兜底1 久坐7 睡眠6.5 心率80 步数2500', input: [7, 6.5, 80, 2500], baseRow: 7 },
  { name: '兜底2 久坐3 睡眠6.5 心率80 步数4000', input: [3, 6.5, 80, 4000], baseRow: 15 },
  { name: '兜底3 久坐5 睡眠8 心率80 步数3000', input: [5, 8, 80, 3000], baseRow: 20 }
];

for (const c of fallbackCases) {
  const out = getAdvice(c.input[0], c.input[1], c.input[2], c.input[3]);
  check(c.name + ' | 是否走兜底', out && out.fallback, true);
  check(c.name + ' | 状态分级', out && out.risk, '黄灯（需警惕）');
  check(c.name + ' | 活动建议=兜底文案', out && out.advice, '睡眠和久坐情况尚可，但心率偏高：今天以中低强度活动为主（快走20分钟，心率别明显升高），并安排一次10分钟闭眼休息。');
  check(c.name + ' | 今天最该做=固定短句', out && out.key, '今天最该做：中午闭眼休息10分钟，不安排高强度。');
  check(c.name + ' | 兜底基行号', out && out.row, c.baseRow);
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

/* ---------- 输入范围校验（严谨性：一天只有24小时） ---------- */
check('校验 缺久坐 → 报错', validateInputs(null, 5, 65, 2000, 'day') !== null, true);
check('校验 久坐25 → 报错', validateInputs(25, 5, 65, 2000, 'day') !== null, true);
check('校验 睡眠25 → 报错', validateInputs(7, 25, 65, 2000, 'day') !== null, true);
check('校验 久坐0+睡眠24 → 通过', validateInputs(0, 24, 65, 2000, 'day'), null);
check('校验 心率20 → 报错', validateInputs(7, 5, 20, 2000, 'day') !== null, true);
check('校验 心率260 → 报错', validateInputs(7, 5, 260, 2000, 'day') !== null, true);
check('校验 心率留空 → 通过', validateInputs(7, 5, null, 2000, 'day'), null);
check('校验 步数100001 → 报错', validateInputs(7, 5, 65, 100001, 'day') !== null, true);
check('校验 步数100000 → 通过', validateInputs(7, 5, 65, 100000, 'day'), null);
check('校验 久坐20+睡眠5=25 → 报错', validateInputs(20, 5, 65, 2000, 'day') !== null, true);
check('校验 久坐24+睡眠0=24 → 通过', validateInputs(24, 0, 65, 2000, 'day'), null);
check('校验 夜班模式不校验久坐 → 通过', validateInputs(null, 5, 65, 2000, 'night'), null);
check('校验 正常输入 → 通过', validateInputs(7, 5, 80, 2000, 'day'), null);

/* ---------- 今日活力值（100分制，四条件各扣20，保底20） ---------- */
check('活力 四个条件全中 (7,5,80,2000) → 20', computeVitality(7, 5, 80, 2000), 20);
check('活力 两扣分 (7,6.5,65,2500) → 60', computeVitality(7, 6.5, 65, 2500), 60);
check('活力 一扣分 心率留空 (7,8,null,8000) → 80', computeVitality(7, 8, null, 8000), 80);
check('活力 两扣分 (3,5,65,2000) → 60', computeVitality(3, 5, 65, 2000), 60);
check('活力 无扣分 (5,6.5,65,4000) → 100', computeVitality(5, 6.5, 65, 4000), 100);
check('活力 边界 睡眠=6 不扣', computeVitality(3, 6, 65, 8000), 100);
check('活力 边界 久坐=6 不扣', computeVitality(6, 8, 65, 8000), 100);
check('活力 边界 步数=3000 不扣', computeVitality(3, 8, 65, 3000), 100);
check('活力 边界 心率=70 不扣', computeVitality(3, 8, 70, 8000), 100);
check('活力 全扣且保底 (12,4,90,500) → 20', computeVitality(12, 4, 90, 500), 20);

/* ---------- 最近一次测试（localStorage 文案逻辑） ---------- */
check('上次测试 日期格式化 2026-10-28 → 10月28日', site.formatMonthDay('2026-10-28'), '10月28日');
check('上次测试 日期格式化 2026-01-05 → 1月5日', site.formatMonthDay('2026-01-05'), '1月5日');
check('上次测试 文案生成', site.getLastTestText({ date: '2026-10-28', vitality: 80 }), '你上次测试是在：10月28日，当时活力值：80分');
check('上次测试 无记录返回null', site.getLastTestText(null), null);
check('上次测试 缺日期字段返回null', site.getLastTestText({ vitality: 80 }), null);
check('上次测试 缺活力值字段返回null', site.getLastTestText({ date: '2026-10-28' }), null);

/* ---------- 夜班/倒时差规则 ---------- */
check('夜班 R1 睡眠<5且心率偏高 (4,80,2000) | 状态', getNightAdvice(4, 80, 2000).risk, '红灯（恢复不足）');
check('夜班 R1 活动建议', getNightAdvice(4, 80, 2000).advice, '夜班后睡眠严重不足且心率偏高：今天必须优先补觉，白天拉窗帘避光，只做轻度活动（慢走15分钟），不安排任何高强度活动。');
check('夜班 R1 最该做', getNightAdvice(4, 80, 2000).key, '今天最该做：白天避光补觉，不安排高强度。');
check('夜班 R1 绝对禁忌', getNightAdvice(4, 80, 2000).taboo, '禁止HIIT、大重量抗阻和剧烈有氧；静息心率经常超过100次/分，或伴有胸痛、头晕、气短，请就医。');
check('夜班 兜底A 睡眠<5心率正常 (4,65,8000)', getNightAdvice(4, 65, 8000).advice, '睡眠不足5小时：今天优先补觉，白天避光，只做轻度活动（慢走15分钟）。');
check('夜班 兜底A 心率留空 (4,null,2000)', getNightAdvice(4, null, 2000).advice, '睡眠不足5小时：今天优先补觉，白天避光，只做轻度活动（慢走15分钟）。');
check('夜班 R2 睡眠5-7且步数<3000 (6,65,2500) | 状态', getNightAdvice(6, 65, 2500).risk, '黄灯（夜班正常现象）');
check('夜班 R2 活动建议', getNightAdvice(6, 65, 2500).advice, '夜班后睡眠5—7小时是正常现象，不用焦虑：醒后见光10分钟，散步20分钟补活动量。');
check('夜班 R2 最该做', getNightAdvice(6, 65, 2500).key, '今天最该做：醒后见光10分钟，散步20分钟。');
check('夜班 兜底B 睡眠5-7且步数≥3000 (6,65,8000)', getNightAdvice(6, 65, 8000).advice, '睡眠和活动量都够：保持现状，醒后见光10分钟，今天可安排20—30分钟中低强度活动。');
check('夜班 R3 睡眠≥7 (8,65,0)', getNightAdvice(8, 65, 0).advice, '补觉充足：今天可以正常安排活动（30分钟中低强度均可），但避免在晚间喝咖啡。');
check('夜班 R3 最该做', getNightAdvice(8, 65, 0).key, '今天最该做：保持正常活动，晚上不喝咖啡。');
check('夜班 边界 睡眠=7 → R3', getNightAdvice(7, 65, 2000).advice, '补觉充足：今天可以正常安排活动（30分钟中低强度均可），但避免在晚间喝咖啡。');
check('夜班 边界 睡眠=5 → R2', getNightAdvice(5, 65, 2500).advice, '夜班后睡眠5—7小时是正常现象，不用焦虑：醒后见光10分钟，散步20分钟补活动量。');
check('夜班 活力 久坐留空 (null,5,80,2000) → 40', computeVitality(null, 5, 80, 2000), 40);

/* ---------- 今日饮水目标（按步数分档 + 久坐调整） ---------- */
check('饮水 久坐7步数2000 → 补到2升', computeHydration(2000, 7, 'day'), '今日饮水目标：2 升。久坐超过6小时，工位上放一杯水，每坐满50分钟起身时喝几口。');
check('饮水 久坐3步数2500 → 1.5升', computeHydration(2500, 3, 'day'), '今日饮水目标：1.5 升。平时喝水少就分次补足，别等渴了才喝。');
check('饮水 久坐7步数8000 → 2升', computeHydration(8000, 7, 'day'), '今日饮水目标：2 升。久坐超过6小时，工位上放一杯水，每坐满50分钟起身时喝几口。');
check('饮水 步数10000 → 2.5升', computeHydration(10000, 2, 'day'), '今日饮水目标：2.5 升。平时喝水少就分次补足，别等渴了才喝。');
check('饮水 久坐5步数4000 → 1.8升 每小时提醒', computeHydration(4000, 5, 'day'), '今日饮水目标：1.8 升。坐着工作容易忘记喝水，每小时起身时顺便喝几口。');
check('饮水 久坐5步数6000 → 2升 每小时提醒', computeHydration(6000, 5, 'day'), '今日饮水目标：2 升。坐着工作容易忘记喝水，每小时起身时顺便喝几口。');
check('饮水 夜班 步数2000 → 1.5升 夜班提醒', computeHydration(2000, null, 'night'), '今日饮水目标：1.5 升。夜班补水别在睡前猛灌，白天分次小口喝，起床后先喝一杯温水。');

/* ---------- 微动作建议（一个具体拉伸动作） ---------- */
check('微动作 久坐7 睡眠6.5 → 颈部米字操', computeMicroAction(7, 6.5, 'day'), '颈部米字操：坐直，头缓慢写“米”字，每个方向停顿2秒，重复3轮，缓解久坐颈椎压力。');
check('微动作 久坐5 睡眠6.5 → 扩胸运动', computeMicroAction(5, 6.5, 'day'), '扩胸运动：双手背后交握，挺胸后仰，保持15秒，做3组，打开胸廓、缓解圆肩。');
check('微动作 久坐2 睡眠8 → 髋屈肌拉伸', computeMicroAction(2, 8, 'day'), '髋屈肌拉伸：弓步下压，前腿弯曲、后膝着地，每侧保持30秒，左右各2组，唤醒久坐僵硬的髋部。');
check('微动作 久坐7 睡眠5 → 肩颈放松(睡眠不足)', computeMicroAction(7, 5, 'day'), '肩颈放松（睡眠不足，别做费力拉伸）：耸肩—绕肩各10次，侧头拉伸每侧15秒，做2轮。');
check('微动作 夜班 → 醒后肩颈放松', computeMicroAction(null, 6, 'night'), '醒后肩颈放松：起床站立，耸肩—绕肩各10次，侧头拉伸每侧15秒，帮身体从夜班状态缓过来。');

console.log('--------------------------------');
console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail > 0 ? 1 : 0);
