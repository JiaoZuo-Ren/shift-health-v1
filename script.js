/* 今日活动建议 - 纯固定分支判断（无后端、无数据库）
   本版新增：时间自动昼夜主题 / 环形活力值 / localStorage 历史记录 / AI 私教与追问 */
(function () {
  'use strict';

  /* ================= 区间判定 ================= */
  function sedentaryBin(h) {
    if (h < 4) return 'lt4';
    if (h <= 6) return '4to6';
    return 'gt6';
  }

  function sleepBin(h) {
    if (h < 6) return 'lt6';
    if (h <= 7) return '6to7';
    return 'gte7';
  }

  function stepsBin(s) {
    if (s < 3000) return 'lt3000';
    if (s <= 5999) return '3000to5999';
    return 'gte6000';
  }

  function hrBin(v) {
    if (v === null || v === undefined || v === '') return 'normal';
    if (v > 70) return 'high';
    return 'normal';
  }

  var FALLBACK_KEY = '今天最该做：中午闭眼休息10分钟，不安排高强度。';

  /* 未列出组合的兜底（主要是心率偏高且睡眠≥6小时） */
  var FALLBACK = {
    risk: '黄灯（需警惕）',
    riskLevel: 'yellow',
    advice: '睡眠和久坐情况尚可，但心率偏高：今天以中低强度活动为主（快走20分钟，心率别明显升高），并安排一次10分钟闭眼休息。',
    taboo: '不安排HIIT、大重量抗阻等高强度训练——心率偏高时高强度训练风险大于收益；静息心率经常超过100次/分，或伴有胸痛、头晕、气短，请就医。',
    action: '保持定时起身；久坐多时每50分钟起身2分钟，再补2分钟髋屈肌拉伸。',
    nutrition: '下午2点后不再摄入咖啡因；晚餐加富含镁的食物（菠菜、南瓜子）。',
    key: FALLBACK_KEY
  };

  /* 卡片底部展示的网址（部署后改成你的正式地址） */
  var SITE_URL = 'jiaozuo-ren.github.io';

  /* ================= AI 私教接口（Cloudflare Worker 代理，API Key 存放在 Worker 端） ================= */
  var AI_ENDPOINT = 'https://wandering-shadow-d12b.2179369131.workers.dev/';

  /* 接口在手机网络上可能很慢：给一个明确的等待上限，超时就提示重试，避免无限转圈 */
  var AI_TIMEOUT_MS = 45000;      /* 首字上限：45 秒内还没开始返回就中断（已开始流式输出后不再计时） */
  var AI_SLOW_TIP_SEC = 10;       /* 超过 10 秒换成“网络有点慢”的提示 */

  /* ================= 规则表（20行：状态分级 + 活动建议 + 绝对禁忌 + 动作处方 + 营养提示 + 今天最该做） ================= */
  var RULES = [
    { id: 1,  sedentary: 'gt6',  sleep: 'lt6',   hr: 'high',   steps: 'lt3000',     risk: '红灯（恢复不足）', riskLevel: 'red',
      advice: '今天只做轻度主动恢复：20分钟平地慢走，强度以说话不喘为准。先每坐50分钟站起来2分钟，晚饭后散步15分钟补步数。',
      taboo: '禁止HIIT、大重量抗阻和剧烈有氧——睡眠严重不足且心率偏高时，高强度训练风险大于收益；若静息心率经常超过100次/分，或伴有胸痛、头晕、气短，请就医。',
      action: '每坐50分钟起身2分钟；做3组靠墙静蹲（每组30—45秒），激活臀部、缓解腰椎压力；膝关节不适就减量或停止。',
      nutrition: '下午2点后不再摄入咖啡因（睡前6小时摄入仍会明显缩短睡眠）；晚餐加一份深绿叶菜（菠菜）或一把南瓜子补镁。',
      key: '今天最该做：中午闭眼休息10分钟，不安排高强度。' },
    { id: 2,  sedentary: 'gt6',  sleep: 'lt6',   hr: 'high',   steps: '3000to5999', risk: '红灯（恢复不足）', riskLevel: 'red',
      advice: '睡眠不足且心率偏高，今天以恢复为主：20分钟平地慢走即可，白天加一次10分钟闭眼休息，抽空分段起身。',
      taboo: '禁止HIIT、大重量抗阻和剧烈有氧；静息心率经常超过100次/分，或伴有胸痛、头晕、气短，请就医。',
      action: '每坐50分钟起身2分钟；做3组靠墙静蹲（每组30—45秒）；肩颈发紧时加2分钟耸肩放松。',
      nutrition: '下午2点后不再摄入咖啡因；晚餐加菠菜或南瓜子等富含镁的食物。',
      key: '今天最该做：中午闭眼休息10分钟，不安排高强度。' },
    { id: 3,  sedentary: 'gt6',  sleep: 'lt6',   hr: 'high',   steps: 'gte6000',    risk: '红灯（恢复不足）', riskLevel: 'red',
      advice: '步数达标，但睡眠不足、心率偏高：今天只做轻度主动恢复，20分钟慢走即可；注意每坐50分钟站起来一次，别连续坐满两小时。',
      taboo: '禁止HIIT、大重量抗阻和剧烈有氧——恢复不足时加练只会加深疲劳；静息心率经常超过100次/分请就医。',
      action: '每坐50分钟起身2分钟；做3组靠墙静蹲（每组30—45秒），缓解久坐带来的腰椎压力。',
      nutrition: '下午2点后不再摄入咖啡因；晚餐补富含镁的食物（菠菜、南瓜子），帮助身体放松。',
      key: '今天最该做：中午闭眼休息10分钟，不安排高强度。' },
    { id: 4,  sedentary: 'gt6',  sleep: 'lt6',   hr: 'normal', steps: 'lt3000',     risk: '黄灯（睡眠不足）', riskLevel: 'yellow',
      advice: '睡眠不足、步数偏少：今天不安排剧烈运动，晚饭后快走或散步20分钟补步数，白天加一次10分钟闭眼休息。',
      taboo: '不做高强度训练——睡眠不足时练后恢复差；不靠咖啡硬撑一整天，午后不再喝。',
      action: '每坐50分钟起身2分钟；做3组靠墙静蹲（每组30—45秒）。',
      nutrition: '午后不再摄入咖啡因；晚餐加富含镁的食物（菠菜、南瓜子）。',
      key: '今天最该做：每50分钟站起来2分钟。' },
    { id: 5,  sedentary: 'gt6',  sleep: 'lt6',   hr: 'normal', steps: '3000to5999', risk: '黄灯（睡眠不足）', riskLevel: 'yellow',
      advice: '睡眠不足：今天安排20—30分钟低强度活动即可（快走，说话不喘的强度），记得定时起身，别加量。',
      taboo: '不做高强度训练；午后不再摄入咖啡因，避免影响今晚入睡。',
      action: '每坐50分钟起身2分钟；做3组靠墙静蹲（每组30—45秒）。',
      nutrition: '晚餐加富含镁的食物（菠菜、南瓜子），帮助神经放松。',
      key: '今天最该做：每50分钟站起来2分钟。' },
    { id: 6,  sedentary: 'gt6',  sleep: 'lt6',   hr: 'normal', steps: 'gte6000',    risk: '黄灯（睡眠不足）', riskLevel: 'yellow',
      advice: '步数达标，但睡眠不足：今天保持20—30分钟低强度活动即可，不加重；注意每坐50分钟站起来一次，别连续坐满两小时。',
      taboo: '不做高强度训练；午后不再喝咖啡。',
      action: '每坐50分钟起身2分钟；做3组靠墙静蹲（每组30—45秒）。',
      nutrition: '晚餐补富含镁的食物（菠菜、南瓜子）。',
      key: '今天最该做：保持节奏，别连续坐满两小时。' },
    { id: 7,  sedentary: 'gt6',  sleep: '6to7',  hr: 'normal', steps: 'lt3000',     risk: '黄灯（久坐偏多）', riskLevel: 'yellow',
      advice: '久坐偏多、步数偏少：晚饭后快走或散步20分钟补步数，强度以说话不喘为准；今天可安排20—30分钟低强度活动。',
      taboo: '不建议直接安排跑步或大重量训练日——先把“动起来”解决，再谈强度。',
      action: '每坐50分钟起身2分钟；做3组靠墙静蹲（每组45秒），缓解腰椎压力。',
      nutrition: '正常饮食；晚饭后散步，顺便补步数。',
      key: '今天最该做：每50分钟站起来2分钟。' },
    { id: 8,  sedentary: 'gt6',  sleep: '6to7',  hr: 'normal', steps: '3000to5999', risk: '黄灯（久坐偏多）', riskLevel: 'yellow',
      advice: '久坐偏多：今天安排20—30分钟低强度活动（快走，心率控制在110左右或说话不喘），定时起身。',
      taboo: '今天不加跑量、不加重量，先活动后观察。',
      action: '每坐50分钟起身2分钟；做3组靠墙静蹲（每组45秒）。',
      nutrition: '正常饮食；午后咖啡因正常量即可，别过量。',
      key: '今天最该做：每50分钟站起来2分钟。' },
    { id: 9,  sedentary: 'gt6',  sleep: '6to7',  hr: 'normal', steps: 'gte6000',    risk: '黄灯（久坐偏多）', riskLevel: 'yellow',
      advice: '步数达标，久坐偏多：今天可安排20—30分钟低强度活动；注意每坐50分钟站起来一次，别连续坐满两小时。',
      taboo: '避免长时间连续静坐；不做超出习惯的高强度训练。',
      action: '每坐50分钟起身2分钟；做3组靠墙静蹲（每组45秒）。',
      nutrition: '正常饮食即可。',
      key: '今天最该做：保持节奏，别连续坐满两小时。' },
    { id: 10, sedentary: 'gt6',  sleep: 'gte7',  hr: 'normal', steps: 'lt3000',     risk: '黄灯（久坐偏多）', riskLevel: 'yellow',
      advice: '睡眠充足，久坐偏多、步数偏少：晚饭后快走或散步20分钟补步数，今天可正常安排中低强度活动。',
      taboo: '避免连续久坐；不因“今天状态好”突然上大强度，循序渐进。',
      action: '每坐50分钟起身2分钟；做3组靠墙静蹲（每组45秒），缓解腰椎压力。',
      nutrition: '正常饮食即可。',
      key: '今天最该做：每50分钟站起来2分钟。' },
    { id: 11, sedentary: 'gt6',  sleep: 'gte7',  hr: 'normal', steps: '3000to5999', risk: '黄灯（久坐偏多）', riskLevel: 'yellow',
      advice: '睡眠充足，久坐偏多、活动一般：今天可安排30分钟中低强度活动（快走或慢跑），记得定时起身。',
      taboo: '避免连续静坐超过2小时。',
      action: '每坐50分钟起身2分钟；做3组靠墙静蹲（每组45秒）。',
      nutrition: '正常饮食即可。',
      key: '今天最该做：每50分钟站起来2分钟。' },
    { id: 12, sedentary: 'gt6',  sleep: 'gte7',  hr: 'normal', steps: 'gte6000',    risk: '黄灯（久坐偏多）', riskLevel: 'yellow',
      advice: '睡眠充足、步数达标：保持今天的活动节奏，可安排30分钟中低强度活动；注意每坐50分钟站起来一次，别连续坐满两小时。',
      taboo: '避免连续久坐；不需要额外加练，维持现状即可。',
      action: '每坐50分钟起身2分钟；久坐累计多时补2分钟髋屈肌拉伸。',
      nutrition: '正常饮食即可。',
      key: '今天最该做：保持节奏，别连续坐满两小时。' },
    { id: 13, sedentary: 'lt4',  sleep: 'lt6',   hr: 'high',   steps: 'any',        risk: '红灯（恢复不足）', riskLevel: 'red',
      advice: '久坐控制得不错，但睡眠不足、心率偏高：今天只做轻度活动（20分钟慢走），白天加一次10分钟闭眼休息，优先补觉。',
      taboo: '禁止HIIT、大重量抗阻和剧烈有氧；静息心率经常超过100次/分，或伴有不适，请就医。',
      action: '久坐不多，保持每小时起身活动几分钟即可；睡前做5分钟放松拉伸（大腿后侧加肩颈）。',
      nutrition: '下午2点后不再摄入咖啡因；晚餐加富含镁的食物（菠菜、南瓜子），帮助放松。',
      key: '今天最该做：中午闭眼休息10分钟，不安排高强度。' },
    { id: 14, sedentary: 'lt4',  sleep: 'lt6',   hr: 'normal', steps: 'any',        risk: '黄灯（睡眠不足）', riskLevel: 'yellow',
      advice: '久坐控制得不错，睡眠不足：步数够就保持，不用额外加运动；步数少就晚饭后散步15分钟。避开高强度训练。',
      taboo: '不做高强度训练；午后不再喝咖啡，保证今晚能早睡。',
      action: '保持每小时起身活动几分钟；睡前做5分钟放松拉伸。',
      nutrition: '晚餐加富含镁的食物（菠菜、南瓜子）。',
      key: '今天最该做：每50分钟站起来2分钟。' },
    { id: 15, sedentary: 'lt4',  sleep: '6to7',  hr: 'normal', steps: 'any',        risk: '绿灯（状态良好）', riskLevel: 'green',
      advice: '久坐少、睡眠和心率都正常：步数够就保持，不用额外加运动；步数少就晚饭后散步15分钟。可安排20—30分钟中低强度活动。',
      taboo: '没有特别禁忌；只是别在睡前2小时内做剧烈运动。',
      action: '久坐不多，保持定时起身即可；久坐累计多时补2分钟髋屈肌拉伸。',
      nutrition: '正常饮食即可。',
      key: '今天最该做：保持节奏，别连续坐满两小时。' },
    { id: 16, sedentary: 'lt4',  sleep: 'gte7',  hr: 'normal', steps: 'any',        risk: '绿灯（状态良好）', riskLevel: 'green',
      advice: '睡眠充足、久坐少：状态良好，今天可以正常安排活动（30分钟中低强度均可）；步数少就晚饭后散步20分钟。',
      taboo: '没有特别禁忌；只是别连续静坐超过2小时。',
      action: '保持定时起身；久坐累计多时补2分钟髋屈肌拉伸。',
      nutrition: '正常饮食即可。',
      key: '今天最该做：保持节奏，别连续坐满两小时。' },
    { id: 17, sedentary: '4to6', sleep: 'lt6',   hr: 'high',   steps: 'any',        risk: '红灯（恢复不足）', riskLevel: 'red',
      advice: '睡眠不足且心率偏高：今天只做轻度主动恢复（20分钟慢走），白天加一次10分钟闭眼休息，优先补觉。',
      taboo: '禁止HIIT、大重量抗阻和剧烈有氧；静息心率经常超过100次/分请就医。',
      action: '每小时起身活动几分钟；做2分钟髋屈肌弓步拉伸，缓解久坐紧绷。',
      nutrition: '下午2点后不再摄入咖啡因；晚餐加菠菜或南瓜子补镁。',
      key: '今天最该做：中午闭眼休息10分钟，不安排高强度。' },
    { id: 18, sedentary: '4to6', sleep: 'lt6',   hr: 'normal', steps: 'any',        risk: '黄灯（睡眠不足）', riskLevel: 'yellow',
      advice: '睡眠不足：今天不安排剧烈运动，可做20—30分钟低强度活动（快走），每隔一小时起身活动几分钟。',
      taboo: '不做高强度训练；午后不再喝咖啡。',
      action: '每小时起身活动几分钟；睡前做5分钟放松拉伸。',
      nutrition: '晚餐加富含镁的食物（菠菜、南瓜子）。',
      key: '今天最该做：每50分钟站起来2分钟。' },
    { id: 19, sedentary: '4to6', sleep: '6to7',  hr: 'normal', steps: 'any',        risk: '绿灯（状态良好）', riskLevel: 'green',
      advice: '睡眠、心率、久坐都在可接受范围：今天可安排20—30分钟中低强度活动（快走或慢跑），记得定时起身。',
      taboo: '没有特别禁忌；睡前2小时内不做剧烈运动。',
      action: '保持定时起身；久坐累计多时补2分钟髋屈肌拉伸。',
      nutrition: '正常饮食即可。',
      key: '今天最该做：保持节奏，别连续坐满两小时。' },
    { id: 20, sedentary: '4to6', sleep: 'gte7',  hr: 'normal', steps: 'any',        risk: '绿灯（状态良好）', riskLevel: 'green',
      advice: '睡眠充足、状态良好：今天可以正常安排活动（30分钟中低强度均可），不要长时间连续坐着。',
      taboo: '没有特别禁忌；只是别连续静坐超过2小时。',
      action: '保持定时起身；久坐累计多时补2分钟髋屈肌拉伸。',
      nutrition: '正常饮食即可。',
      key: '今天最该做：保持节奏，别连续坐满两小时。' }
  ];

  /* ================= 红黄绿灯：把规则表的判定换成「昨日因、今日果」的说法 =================
     规则表里的 risk 原文保留不动（它是规则验收基线），这里只做展示层的语义映射。 */
  var RISK_LABEL = {
    red: '🔴 红灯 · 恢复赤字',
    yellow: '🟡 黄灯 · 需要微调',
    green: '🟢 绿灯 · 良性循环'
  };

  function riskLabelOf(level) {
    return RISK_LABEL[level] || '';
  }

  /* 用昨日数据解释「为什么是这个灯」，让用户看懂因果，而不是只接一个结论 */
  function explainCause(sedentaryHours, sleepHours, hrInput, steps, mode) {
    var reasons = [];
    var sleep = Number(sleepHours);
    var sedentary = Number(sedentaryHours);
    var st = Number(steps);
    var hr = (hrInput === null || hrInput === '' || typeof hrInput === 'undefined') ? null : Number(hrInput);

    if (mode === 'night') {
      if (sleep < 5) reasons.push('昨晚只睡 ' + sleep + ' 小时，夜班后的睡眠债已经很明显');
      else if (sleep < 7) reasons.push('昨晚睡了 ' + sleep + ' 小时，还没补够');
      else reasons.push('昨晚睡了 ' + sleep + ' 小时，恢复得不错');
    } else {
      if (sleep < 6) {
        var debt = (7 - sleep).toFixed(1).replace(/\.0$/, '');
        reasons.push('昨晚只睡 ' + sleep + ' 小时，欠了 ' + debt + ' 小时睡眠债');
      } else if (sleep < 7) {
        reasons.push('昨晚睡了 ' + sleep + ' 小时，刚过及格线');
      } else {
        reasons.push('昨晚睡了 ' + sleep + ' 小时，睡眠充足');
      }

      if (sedentary > 6) reasons.push('昨天坐了 ' + sedentary + ' 小时');
      else if (sedentary >= 4) reasons.push('昨天坐了 ' + sedentary + ' 小时，属中等');
      else reasons.push('昨天只坐 ' + sedentary + ' 小时，起身还算频繁');
    }

    if (st < 3000) reasons.push('只走了 ' + st + ' 步');
    else if (st < 6000) reasons.push('走了 ' + st + ' 步，没到 6000');
    else reasons.push('走了 ' + st + ' 步，步数达标');

    if (hr !== null && hr >= 80) reasons.push('今晨静息心率 ' + hr + ' 偏高');

    return '昨日账单：' + reasons.join('，') + '。';
  }

  /* ================= 匹配 ================= */
  function matchRule(rule, sBin, slBin, hBin, stBin) {
    if (rule.sedentary !== sBin) return false;
    if (rule.sleep !== slBin) return false;
    if (rule.hr !== hBin) return false;
    if (rule.steps !== 'any' && rule.steps !== stBin) return false;
    return true;
  }

  function getAdvice(sedentaryHours, sleepHours, hrInput, steps) {
    var sBin = sedentaryBin(sedentaryHours);
    var slBin = sleepBin(sleepHours);
    var hBin = hrBin(hrInput);
    var stBin = stepsBin(steps);

    /* 优先精准匹配 */
    for (var i = 0; i < RULES.length; i++) {
      if (matchRule(RULES[i], sBin, slBin, hBin, stBin)) {
        var m = RULES[i];
        return {
          row: m.id,
          risk: m.risk, riskLevel: m.riskLevel,
          advice: m.advice, taboo: m.taboo,
          action: m.action, nutrition: m.nutrition,
          key: m.key, fallback: false
        };
      }
    }

    /* 兜底：表内没有的组合（主要是心率偏高且睡眠≥6小时）→ 统一走黄灯兜底文案 */
    for (var j = 0; j < RULES.length; j++) {
      var r = RULES[j];
      if (r.sedentary === sBin && r.sleep === slBin && r.hr === 'normal' && (r.steps === 'any' || r.steps === stBin)) {
        return {
          row: r.id,
          risk: FALLBACK.risk, riskLevel: FALLBACK.riskLevel,
          advice: FALLBACK.advice, taboo: FALLBACK.taboo,
          action: FALLBACK.action, nutrition: FALLBACK.nutrition,
          key: FALLBACK.key, fallback: true
        };
      }
    }

    return null;
  }

  /* ================= 今日活力值（独立于规则表的第二套输出） ================= */
  function computeVitality(sedentary, sleep, hr, steps) {
    var score = 100;
    if (sleep < 6) score -= 20;
    if (sedentary !== null && sedentary > 6) score -= 20;
    if (steps < 3000) score -= 20;
    if (hr !== null && hr > 70) score -= 20;
    if (score < 20) score = 20;
    return score;
  }

  /* ================= 今日饮水目标（根据步数与久坐时长给出固定建议） ================= */
  function fmtAmount(a) {
    return (a === Math.floor(a)) ? String(a) : a.toFixed(1);
  }

  function computeHydration(steps, sedentary, mode) {
    var amount;
    if (steps >= 10000) amount = 2.5;
    else if (steps >= 6000) amount = 2.0;
    else if (steps >= 3000) amount = 1.8;
    else amount = 1.5;

    if (mode === 'night') {
      return '今日饮水目标：' + fmtAmount(amount) + ' 升。夜班补水别在睡前猛灌，白天分次小口喝，起床后先喝一杯温水。';
    }
    if (sedentary !== null && sedentary > 6) {
      var need = Math.max(amount, 2.0);
      return '今日饮水目标：' + fmtAmount(need) + ' 升。久坐超过6小时，工位上放一杯水，每坐满50分钟起身时喝几口。';
    }
    if (sedentary !== null && sedentary >= 4) {
      return '今日饮水目标：' + fmtAmount(amount) + ' 升。坐着工作容易忘记喝水，每小时起身时顺便喝几口。';
    }
    return '今日饮水目标：' + fmtAmount(amount) + ' 升。平时喝水少就分次补足，别等渴了才喝。';
  }

  /* ================= 微动作建议（一个具体拉伸动作，根据久坐与睡眠给出） ================= */
  function computeMicroAction(sedentary, sleep, mode) {
    if (mode === 'night') {
      return '醒后肩颈放松：起床站立，耸肩—绕肩各10次，侧头拉伸每侧15秒，帮身体从夜班状态缓过来。';
    }
    if (sleep !== null && sleep < 6) {
      return '肩颈放松（睡眠不足，别做费力拉伸）：耸肩—绕肩各10次，侧头拉伸每侧15秒，做2轮。';
    }
    if (sedentary !== null && sedentary > 6) {
      return '颈部米字操：坐直，头缓慢写“米”字，每个方向停顿2秒，重复3轮，缓解久坐颈椎压力。';
    }
    if (sedentary !== null && sedentary >= 4) {
      return '扩胸运动：双手背后交握，挺胸后仰，保持15秒，做3组，打开胸廓、缓解圆肩。';
    }
    return '髋屈肌拉伸：弓步下压，前腿弯曲、后膝着地，每侧保持30秒，左右各2组，唤醒久坐僵硬的髋部。';
  }

  /* ================= 夜班/倒时差规则（独立于久坐规则表） ================= */
  function getNightAdvice(sleep, hr, steps) {
    var hrHigh = hr !== null && hr > 70;
    if (sleep < 5 && hrHigh) {
      return {
        risk: '红灯（恢复不足）', riskLevel: 'red',
        advice: '夜班后睡眠严重不足且心率偏高：今天必须优先补觉，白天拉窗帘避光，只做轻度活动（慢走15分钟），不安排任何高强度活动。',
        taboo: '禁止HIIT、大重量抗阻和剧烈有氧；静息心率经常超过100次/分，或伴有胸痛、头晕、气短，请就医。',
        action: '醒后见光10分钟帮助校准生物钟；久坐时每小时起身活动几分钟。',
        nutrition: '下午2点后不再摄入咖啡因；晚餐加富含镁的食物（菠菜、南瓜子）。',
        key: '今天最该做：白天避光补觉，不安排高强度。'
      };
    }
    if (sleep < 5) {
      return {
        risk: '黄灯（睡眠不足）', riskLevel: 'yellow',
        advice: '睡眠不足5小时：今天优先补觉，白天避光，只做轻度活动（慢走15分钟）。',
        taboo: '不做高强度训练；午后不再喝咖啡。',
        action: '白天避光休息；醒后见光10分钟。',
        nutrition: '晚餐加富含镁的食物（菠菜、南瓜子）；下午2点后不摄入咖啡因。',
        key: '今天最该做：补觉，不安排高强度。'
      };
    }
    if (sleep < 7) {
      if (steps < 3000) {
        return {
          risk: '黄灯（夜班正常现象）', riskLevel: 'yellow',
          advice: '夜班后睡眠5—7小时是正常现象，不用焦虑：醒后见光10分钟，散步20分钟补活动量。',
          taboo: '不需要“补练”——夜班后不做高强度训练，先把作息调稳。',
          action: '醒后见光10分钟；散步20分钟，强度以说话不喘为准。',
          nutrition: '醒来后先吃一顿规律正餐，别空腹灌咖啡；全天咖啡因控制在1杯以内。',
          key: '今天最该做：醒后见光10分钟，散步20分钟。'
        };
      }
      return {
        risk: '绿灯（状态良好）', riskLevel: 'green',
        advice: '睡眠和活动量都够：保持现状，醒后见光10分钟，今天可安排20—30分钟中低强度活动。',
        taboo: '不做高强度训练——夜班后身体仍在恢复；晚间不喝咖啡。',
        action: '醒后见光10分钟；保持定时起身。',
        nutrition: '正常饮食；下午2点后不摄入咖啡因。',
        key: '今天最该做：保持节奏，醒后见光10分钟。'
      };
    }
    return {
      risk: '绿灯（状态良好）', riskLevel: 'green',
      advice: '补觉充足：今天可以正常安排活动（30分钟中低强度均可），但避免在晚间喝咖啡。',
      taboo: '晚间不摄入咖啡因——睡前6小时摄入仍会明显缩短睡眠；不做超出习惯的高强度训练。',
      action: '正常活动即可；久坐时每小时起身几分钟。',
      nutrition: '晚餐后不再摄入咖啡因；正常饮食即可。',
      key: '今天最该做：保持正常活动，晚上不喝咖啡。'
    };
  }

  /* ================= 历史记录（localStorage，最多保留 7 条） ================= */
  var HISTORY_KEY = 'shiftHealthHistory';
  var HISTORY_MAX = 7;

  function loadHistory() {
    try {
      var raw = localStorage.getItem(HISTORY_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function saveHistory(rec) {
    try {
      var arr = loadHistory();
      arr.unshift(rec);
      if (arr.length > HISTORY_MAX) arr = arr.slice(0, HISTORY_MAX);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(arr));
      return arr;
    } catch (e) {
      return loadHistory();
    }
  }

  function clearHistory() {
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch (e) {
      /* 忽略隐私模式下的写入异常 */
    }
  }

  /* 时间戳 → “10月29日 12:51” */
  function formatStamp(ts) {
    var d = new Date(ts);
    var hh = d.getHours();
    var mm = d.getMinutes();
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' +
      (hh < 10 ? '0' + hh : hh) + ':' + (mm < 10 ? '0' + mm : mm);
  }

  /* ================= 最近一次测试（保留旧接口，供自动验收使用） ================= */
  function formatMonthDay(dateStr) {
    var parts = String(dateStr).split('-');
    if (parts.length === 3) {
      return parseInt(parts[1], 10) + '月' + parseInt(parts[2], 10) + '日';
    }
    return dateStr;
  }

  function getLastTestText(rec) {
    if (!rec || !rec.date || typeof rec.vitality !== 'number') return null;
    return '你上次测试是在：' + formatMonthDay(rec.date) + '，当时活力值：' + rec.vitality + '分';
  }

  /* ================= 页面逻辑 ================= */
  function parseNum(v) {
    var s = String(v).trim();
    if (s === '') return null;
    var n = Number(s);
    if (isNaN(n) || n < 0) return null;
    return n;
  }

  /* 输入范围校验：一天只有24小时，心率、步数都有合理范围；久坐+睡眠不能超过24小时 */
  function validateInputs(sedentary, sleep, hr, steps, mode) {
    if (mode !== 'night') {
      if (sedentary === null) return '请填写久坐时长（小时），填不小于 0 的数字。';
      if (sedentary > 24) return '久坐时长不能超过 24 小时，一天只有 24 小时。';
    }
    if (sleep === null) return '请填写睡眠时长（小时），填不小于 0 的数字。';
    if (sleep > 24) return '睡眠时长不能超过 24 小时，一天只有 24 小时。';
    if (hr !== null && (hr < 30 || hr > 250)) return '静息心率要填 30—250 之间的数字，不知道就留空。';
    if (steps === null) return '请填写每日步数，填不小于 0 的数字。';
    if (steps > 100000) return '每日步数不能超过 100000，请核对。';
    if (mode !== 'night' && sedentary + sleep > 24) return '久坐和睡眠加起来超过 24 小时了，请核对。';
    return null;
  }

  /* ================= 昼夜主题：6:00—18:00 白天，其余时间夜间 ================= */
  function themeForHour(h) {
    return (h >= 6 && h < 18) ? 'day' : 'night';
  }

  function applyThemeByClock() {
    var next = themeForHour(new Date().getHours());
    if (document.documentElement.getAttribute('data-theme') !== next) {
      document.documentElement.setAttribute('data-theme', next);
    }
    return next;
  }

  function init() {
    /* --- 元素引用 --- */
    var generateBtn = document.getElementById('generateBtn');
    var activityEl = document.getElementById('activityAdvice');
    var hydrationEl = document.getElementById('hydrationAdvice');
    var microEl = document.getElementById('microAdvice');
    var tabooEl = document.getElementById('tabooAdvice');
    var actionEl = document.getElementById('actionAdvice');
    var nutritionEl = document.getElementById('nutritionAdvice');
    var riskBadge = document.getElementById('riskBadge');
    var causeEl = document.getElementById('causeExplain');
    var keyEl = document.getElementById('keyAdvice');
    var errEl = document.getElementById('formError');
    var vitalityScore = document.getElementById('vitalityScore');
    var ringBar = document.getElementById('ringBar');
    var ringTip = document.getElementById('ringTip');
    var modeSwitchBtn = document.getElementById('modeSwitchBtn');
    var modeStatus = document.getElementById('modeStatus');
    var fieldSedentary = document.getElementById('fieldSedentary');
    var appDesc = document.getElementById('appDesc');
    var appSub = document.getElementById('appSub');
    var aiBtn = document.getElementById('aiBtn');
    var aiCard = document.getElementById('ai-card');
    var aiReply = document.getElementById('aiReply');
    var aiRetryBtn = document.getElementById('aiRetryBtn');
    var aiAskForm = document.getElementById('aiAskForm');
    var aiQuestion = document.getElementById('aiQuestion');
    var aiAskBtn = document.getElementById('aiAskBtn');
    var historyList = document.getElementById('historyList');
    var lastTestEl = document.getElementById('lastTest');

    /* 🆕 App Shell：底部导航 / 金句盲盒 / 番茄钟 / 打卡 / AI 限额 */
    var tabbar = document.getElementById('tabbar');
    var appScroll = document.getElementById('appScroll');
    var quoteText = document.getElementById('quoteText');
    var quoteRefresh = document.getElementById('quoteRefresh');
    var streakDays = document.getElementById('streakDays');
    var pomoCard = document.getElementById('pomoCard');
    var pomoTime = document.getElementById('pomoTime');
    var pomoBar = document.getElementById('pomoBar');
    var pomoBtn = document.getElementById('pomoBtn');
    var pomoReset = document.getElementById('pomoReset');
    var pomoState = document.getElementById('pomoState');
    var pomodoroOverlay = document.getElementById('pomodoroOverlay');
    var pomodoroOk = document.getElementById('pomodoroOk');
    var aiQuotaEl = document.getElementById('aiQuota');

    /* 🆕 v23：语音朗读 / 成就勋章 / 屏幕常亮 */
    var aiSpeakBtn = document.getElementById('aiSpeakBtn');
    var aiSpeakTxt = document.getElementById('aiSpeakTxt');
    var badgeGrid = document.getElementById('badgeGrid');
    var badgeCount = document.getElementById('badgeCount');
    var pomoWake = document.getElementById('pomoWake');

    /* 🆕 v21：启动屏 + 环形扫描（纯视觉，不碰任何逻辑） */
    var splashEl = document.getElementById('splash');
    var ringScan = document.getElementById('ringScan');

    /* 🆕 v20：喝水打卡 / 首页呼吸入口 / 趋势图 / 目标设置 */
    var waterCount = document.getElementById('waterCount');
    var waterBtn = document.getElementById('waterBtn');
    var waterHint = document.getElementById('waterHint');
    var homeBreatheBtn = document.getElementById('homeBreatheBtn');
    var trendBars = document.getElementById('trendBars');
    var goalStepsInput = document.getElementById('goalSteps');
    var goalSedentaryInput = document.getElementById('goalSedentary');
    var saveGoalsBtn = document.getElementById('saveGoalsBtn');
    var goalTip = document.getElementById('goalTip');
    var ringEmoji = document.getElementById('ringEmoji');
    var breatheBtn = document.getElementById('breatheBtn');
    var breatheOverlay = document.getElementById('breatheOverlay');
    var breatheBall = document.getElementById('breatheBall');
    var breathePhase = document.getElementById('breathePhase');
    var breatheTime = document.getElementById('breatheTime');
    var breatheClose = document.getElementById('breatheClose');
    var fortuneBtn = document.getElementById('fortuneBtn');
    var fortuneText = document.getElementById('fortuneText');

    /* 结果抽屉 */
    var resultOverlay = document.getElementById('resultOverlay');
    var resultSheet = document.getElementById('result');
    var sheetBody = document.getElementById('sheetBody');
    var resultClose = document.getElementById('resultClose');
    var sheetGrip = document.getElementById('sheetGrip');
    var sheetTimer = null;

    /* 底部两个平行入口 + AI 私教二级抽屉 */
    var aiEntryBtn = document.getElementById('aiEntryBtn');
    var aiOverlay = document.getElementById('aiOverlay');
    var aiSheet = document.getElementById('aiSheet');
    var aiClose = document.getElementById('aiClose');
    var aiGrip = document.getElementById('aiGrip');
    var aiTimer = null;
    var aiHasReply = false;   /* 已经拿到过回复就不再自动重发请求 */

    var currentMode = 'day';
    var lastOut = null;
    var lastVitality = 0;
    var lastMicro = '';
    var lastHydration = '';

    var RING_C = 2 * Math.PI * 92; /* 与 SVG 中 r=92 对应 */
    var AI_BTN_TEXT = '🤖 听听AI私教怎么说';
    var AI_BTN_LOADING = '教练正在思考中…';
    var AI_ERROR_TEXT = '教练正在忙，请稍后再试';

    /* --- 环形活力值 --- */
    function animateScore(target) {
      var start = 0;
      var t0 = 0;
      var dur = 900;
      function step(now) {
        if (!t0) t0 = now;
        var p = Math.min(1, (now - t0) / dur);
        var eased = 1 - Math.pow(1 - p, 3);
        vitalityScore.textContent = Math.round(start + (target - start) * eased);
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    function renderVitality(score) {
      var pct = Math.max(0, Math.min(100, score));
      /* 先归零再设置目标值，保证每次生成都有“生长”动画 */
      ringBar.style.transition = 'none';
      ringBar.style.strokeDashoffset = String(RING_C);
      void ringBar.getBoundingClientRect();
      ringBar.style.transition = '';

      ringBar.classList.remove('ring-red', 'ring-yellow', 'ring-green');
      if (pct < 60) ringBar.classList.add('ring-red');
      else if (pct <= 80) ringBar.classList.add('ring-yellow');
      else ringBar.classList.add('ring-green');

      ringBar.style.strokeDashoffset = String(RING_C * (1 - pct / 100));
      animateScore(pct);

      if (pct < 60) ringTip.textContent = '恢复不足：今天优先休息，别加练';
      else if (pct <= 80) ringTip.textContent = '还有提升空间：补觉、补步数都算加分';
      else ringTip.textContent = '状态不错：保持今天的节奏就好';

      /* 情绪小精灵：分数决定表情和动画，重复生成时重播一次 */
      var mood;
      if (pct < 60) mood = { icon: '🪫', cls: 'emoji-low' };
      else if (pct <= 80) mood = { icon: '🔋', cls: 'emoji-mid' };
      else mood = { icon: '🚀', cls: 'emoji-high' };

      ringEmoji.textContent = mood.icon;
      ringEmoji.className = 'ring-emoji ' + mood.cls;
      ringEmoji.style.animation = 'none';
      void ringEmoji.offsetWidth;   /* 强制重排，让同分数重复生成也能重新播动画 */
      ringEmoji.style.animation = '';
    }

    /* --- 手机震动反馈：红灯提醒休息，绿灯轻快两下，黄灯不打扰 --- */
    function haptic(level) {
      if (!navigator.vibrate) return;   /* iOS Safari 不支持，静默跳过 */
      try {
        if (level === 'red') navigator.vibrate(200);
        else if (level === 'green') navigator.vibrate([100, 50, 100]);
      } catch (e) { /* 部分浏览器在无用户手势时抛错，忽略 */ }
    }

    /* --- 结果抽屉：从底部滑出 / 收起 --- */
    function openResultSheet() {
      if (sheetTimer) { clearTimeout(sheetTimer); sheetTimer = null; }

      resultOverlay.hidden = false;
      resultOverlay.setAttribute('aria-hidden', 'false');
      document.body.classList.add('sheet-open');
      if (sheetBody) sheetBody.scrollTop = 0;

      /* 下一帧再加 is-open，保证 translateY(100%) → 0 的过渡真的跑起来 */
      requestAnimationFrame(function () {
        resultOverlay.classList.add('is-open');
        /* 滑出过程中把焦点交给面板，键盘/读屏用户不会继续留在背景表单上 */
        resultSheet.focus({ preventScroll: true });
      });
    }

    function closeResultSheet() {
      if (resultOverlay.hidden || sheetTimer) return;

      /* 上层还开着的话先收掉，否则遮罩会残留在半空 */
      closeAiSheet();

      resultOverlay.classList.remove('is-open');
      resultOverlay.setAttribute('aria-hidden', 'true');

      /* 等滑出动画走完再 display:none 并解锁背景，否则会出现闪断或滚动条闪一下 */
      sheetTimer = setTimeout(function () {
        sheetTimer = null;
        if (resultOverlay.classList.contains('is-open')) return;
        resultOverlay.hidden = true;
        document.body.classList.remove('sheet-open');
      }, 480);
    }

    /* --- AI 私教抽屉：叠在结果抽屉上滑出的第二层 --- */
    function openAiSheet() {
      if (!aiOverlay) return;
      if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; }

      aiOverlay.hidden = false;
      aiOverlay.setAttribute('aria-hidden', 'false');
      document.body.classList.add('sheet-open');

      requestAnimationFrame(function () {
        aiOverlay.classList.add('is-open');
        if (aiSheet) aiSheet.focus({ preventScroll: true });
      });
    }

    function closeAiSheet() {
      stopSpeak();      /* 🆕 抽屉关了就别再念了（放最前面，任何关闭路径都生效） */

      if (!aiOverlay || aiOverlay.hidden || aiTimer) return;

      aiOverlay.classList.remove('is-open');
      aiOverlay.setAttribute('aria-hidden', 'true');

      aiTimer = setTimeout(function () {
        aiTimer = null;
        if (aiOverlay.classList.contains('is-open')) return;
        aiOverlay.hidden = true;
      }, 420);
    }

    if (aiClose) aiClose.addEventListener('click', closeAiSheet);
    if (aiGrip) aiGrip.addEventListener('click', closeAiSheet);

    if (aiOverlay) {
      aiOverlay.addEventListener('click', function (e) {
        if (e.target.getAttribute && e.target.getAttribute('data-ai-close') === '1') {
          closeAiSheet();
        }
      });
    }

    /* 底部入口：先滑出 AI 抽屉；还没聊过就顺手发起一次请求，省一次点击 */
    if (aiEntryBtn) {
      aiEntryBtn.addEventListener('click', function () {
        if (!lastOut) {
          showToast('还没有结果，先点“生成今天的建议”');
          return;
        }
        openAiSheet();
        if (!aiHasReply && !aiBtn.disabled && aiReply.textContent === '') {
          aiBtn.click();
        }
      });
    }

    resultClose.addEventListener('click', closeResultSheet);
    if (sheetGrip) sheetGrip.addEventListener('click', closeResultSheet);

    resultOverlay.addEventListener('click', function (e) {
      /* 点遮罩关闭；点面板内部不关 */
      if (e.target.getAttribute && e.target.getAttribute('data-sheet-close') === '1') {
        closeResultSheet();
      }
    });

    /* --- 历史记录渲染 --- */
    function historyDataText(rec) {
      var parts = [];
      if (rec.sedentary !== null && rec.sedentary !== undefined && rec.sedentary !== '') {
        parts.push('久坐 ' + rec.sedentary + 'h');
      } else if (rec.mode === 'night') {
        parts.push('夜班模式');
      }
      if (rec.sleep !== null && rec.sleep !== undefined) parts.push('睡眠 ' + rec.sleep + 'h');
      if (rec.hr !== null && rec.hr !== undefined && rec.hr !== '') parts.push('心率 ' + rec.hr);
      if (rec.steps !== null && rec.steps !== undefined) parts.push('步数 ' + rec.steps);
      return parts.join(' · ');
    }

    function renderHistory() {
      var arr = loadHistory();
      historyList.innerHTML = '';

      if (!arr.length) {
        var empty = document.createElement('p');
        empty.className = 'history-empty';
        empty.textContent = '还没有记录，先生成一次今日建议吧。';
        historyList.appendChild(empty);
        return;
      }

      arr.forEach(function (rec) {
        var card = document.createElement('div');
        card.className = 'h-card';

        var main = document.createElement('div');
        main.className = 'h-main';

        var date = document.createElement('p');
        date.className = 'h-date';
        date.textContent = formatStamp(rec.ts) + (rec.mode === 'night' ? ' · 夜班' : '');

        var data = document.createElement('p');
        data.className = 'h-data';
        data.textContent = historyDataText(rec);

        main.appendChild(date);
        main.appendChild(data);

        /* 小环形活力分 */
        var ring = document.createElement('div');
        ring.className = 'h-ring ' + (rec.vitality < 60 ? 'red' : (rec.vitality <= 80 ? 'yellow' : 'green'));
        ring.style.setProperty('--p', rec.vitality);
        var ringText = document.createElement('span');
        ringText.textContent = rec.vitality;
        ring.appendChild(ringText);

        var restore = document.createElement('button');
        restore.type = 'button';
        restore.className = 'h-restore';
        restore.textContent = '↩️ 回填';
        restore.addEventListener('click', function () {
          restoreRecord(rec);
        });

        card.appendChild(main);
        card.appendChild(ring);
        card.appendChild(restore);
        historyList.appendChild(card);
      });
    }

    function restoreRecord(rec) {
      /* 只接受合法模式值，避免脏数据把 currentMode 写成 undefined */
      if ((rec.mode === 'day' || rec.mode === 'night') && rec.mode !== currentMode) {
        setMode(rec.mode);
      }
      document.getElementById('sedentary').value = (rec.sedentary === null || rec.sedentary === undefined) ? '' : rec.sedentary;
      document.getElementById('sleep').value = (rec.sleep === null || rec.sleep === undefined) ? '' : rec.sleep;
      document.getElementById('hr').value = (rec.hr === null || rec.hr === undefined) ? '' : rec.hr;
      document.getElementById('steps').value = (rec.steps === null || rec.steps === undefined) ? '' : rec.steps;
      /* 🆕 PWA 版：历史记录直接放在「记录」页，回填后跳回首页并自动生成 */
      switchTab('home');
      runGenerate();
      showToast('已回填历史数据');
    }

    /* 清空记录：历史与打卡日期一起清，两处入口共用 */
    function clearHealthData() {
      clearHistory();
      try { localStorage.removeItem(CHECKIN_KEY); } catch (e) {}
      renderHistory();
      renderStreak();
      renderBadges();
      updateLastTestLabel();
      showToast('记录已清空');
    }

    document.getElementById('historyClear').addEventListener('click', clearHealthData);
    var clearHistoryBtn = document.getElementById('clearHistoryBtn');
    if (clearHistoryBtn) clearHistoryBtn.addEventListener('click', clearHealthData);

    /* ================= 🆕 底部 Tab 导航：三个页面切换 ================= */
    function switchTab(name) {
      var pages = { home: 'pageHome', history: 'pageHistory', me: 'pageMe' };
      Object.keys(pages).forEach(function (key) {
        var page = document.getElementById(pages[key]);
        if (page) page.classList.toggle('is-active', key === name);
      });
      if (tabbar) {
        Array.prototype.forEach.call(tabbar.querySelectorAll('.tab-btn'), function (btn) {
          btn.classList.toggle('is-active', btn.getAttribute('data-tab') === name);
        });
      }
      /* 记录页每次进入都刷新，保证刚生成的记录立刻看得到 */
      if (name === 'history') {
        renderHistory();
        renderStreak();
        renderTrend();
        renderBadges();
      }
      if (appScroll) appScroll.scrollTop = 0;
    }

    if (tabbar) {
      tabbar.addEventListener('click', function (e) {
        var btn = e.target.closest ? e.target.closest('.tab-btn') : null;
        if (btn) switchTab(btn.getAttribute('data-tab'));
      });
    }

    /* ================= 🆕 喝水打卡：一杯一记，跨天自动清零 ================= */
    var WATER_KEY = 'shiftHealthWater';
    var WATER_GOAL = 8;

    function getWater() {
      var today = dayStamp(new Date());
      var w = null;
      try { w = JSON.parse(localStorage.getItem(WATER_KEY) || 'null'); } catch (e) {}
      if (!w || w.date !== today) w = { date: today, count: 0 };
      return w;
    }

    function renderWater() {
      var w = getWater();
      if (waterCount) waterCount.textContent = w.count;
      if (waterHint) {
        waterHint.textContent = w.count >= WATER_GOAL
          ? '今日目标已达成，很棒！继续保持 💧'
          : '再喝 ' + (WATER_GOAL - w.count) + ' 杯就达标啦';
      }
    }

    if (waterBtn) {
      waterBtn.addEventListener('click', function () {
        var w = getWater();
        w.count += 1;
        try { localStorage.setItem(WATER_KEY, JSON.stringify(w)); } catch (e) {}
        renderWater();
        var justBadges = renderBadges(true);   /* 🆕 第 8 杯刚好点亮「水元素使者」 */
        if (navigator.vibrate) { try { navigator.vibrate(30); } catch (e) {} }
        if (w.count === WATER_GOAL) {
          showToast(justBadges.length
            ? '今日喝水目标达成 💧 同时点亮「' + justBadges.join('、') + '」'
            : '今日喝水目标达成 💧');
        } else if (justBadges.length) {
          showToast('🏅 解锁成就：' + justBadges.join('、'));
        }
      });
    }

    /* ================= 🆕 每日目标设置：步数目标 + 久坐上限 ================= */
    var GOALS_KEY = 'shiftHealthGoals';
    var DEFAULT_GOALS = { steps: 6000, sedentary: 6 };

    function loadGoals() {
      try {
        var g = JSON.parse(localStorage.getItem(GOALS_KEY) || 'null');
        if (g && g.steps > 0 && g.sedentary > 0) return g;
      } catch (e) {}
      return { steps: DEFAULT_GOALS.steps, sedentary: DEFAULT_GOALS.sedentary };
    }

    function renderGoalInputs() {
      var g = loadGoals();
      if (goalStepsInput && goalStepsInput.value === '') goalStepsInput.value = g.steps;
      if (goalSedentaryInput && goalSedentaryInput.value === '') goalSedentaryInput.value = g.sedentary;
    }

    if (saveGoalsBtn) {
      saveGoalsBtn.addEventListener('click', function () {
        var sSteps = parseInt(goalStepsInput.value, 10);
        var sH = parseFloat(goalSedentaryInput.value);
        if (isNaN(sSteps) || sSteps < 1000 || sSteps > 50000) { showToast('步数目标请在 1000–50000 之间'); return; }
        if (isNaN(sH) || sH < 1 || sH > 16) { showToast('久坐上限请在 1–16 小时之间'); return; }
        try { localStorage.setItem(GOALS_KEY, JSON.stringify({ steps: sSteps, sedentary: sH })); } catch (e) {}
        showToast('目标已保存，生成建议时生效');
      });
    }

    /* 生成建议后对照目标给鼓励提示：只有未达标才显示 */
    function updateGoalTip(stepsVal, sedentaryVal) {
      if (!goalTip) return;
      var g = loadGoals();
      var tips = [];
      if (stepsVal !== null && stepsVal !== undefined && stepsVal !== '' && stepsVal < g.steps) {
        tips.push('🎯 昨天走了 ' + stepsVal + ' 步，离你 ' + g.steps + ' 步的小目标还差 ' + (g.steps - stepsVal) + ' 步——今天多遛个弯就补上了。');
      }
      if (sedentaryVal !== null && sedentaryVal !== undefined && sedentaryVal !== '' && sedentaryVal > g.sedentary) {
        tips.push('🪑 昨天坐了 ' + sedentaryVal + ' 小时，超出了你定的 ' + g.sedentary + ' 小时上限，今天每 50 分钟记得起来晃一晃。');
      }
      if (tips.length) {
        goalTip.textContent = tips.join(' ');
        goalTip.hidden = false;
      } else {
        goalTip.hidden = true;
      }
    }

    /* ================= 🆕 近 7 日活力值趋势：纯 CSS 柱状图 ================= */
    function renderTrend() {
      if (!trendBars) return;
      var arr = loadHistory();
      trendBars.innerHTML = '';

      /* 按天聚合：每天取最后一次记录的活力分 */
      var byDay = {};
      arr.forEach(function (rec) {
        var d = dayStamp(new Date(rec.ts));
        if (!byDay[d] || rec.ts > byDay[d].ts) byDay[d] = rec;
      });

      /* 从 6 天前到今天，共 7 天 */
      var days = [];
      for (var i = 6; i >= 0; i--) {
        var dt = new Date();
        dt.setDate(dt.getDate() - i);
        days.push(dayStamp(dt));
      }

      days.forEach(function (d) {
        var rec = byDay[d];
        var col = document.createElement('div');
        col.className = 'trend-col';

        var score = document.createElement('span');
        score.className = 'trend-score';
        score.textContent = rec ? rec.vitality : '–';

        var barWrap = document.createElement('div');
        barWrap.className = 'trend-bar';
        var fill = document.createElement('span');
        if (rec) {
          fill.className = 'trend-fill ' + (rec.vitality < 60 ? 't-low' : (rec.vitality <= 80 ? 't-mid' : 't-high'));
          fill.style.height = Math.max(8, rec.vitality) + '%';
          barWrap.title = d + '：活力值 ' + rec.vitality;
        } else {
          fill.className = 'trend-fill t-none';
          fill.style.height = '5%';
          barWrap.title = d + '：没有记录';
        }
        barWrap.appendChild(fill);

        var label = document.createElement('span');
        label.className = 'trend-day';
        var pd = d.split('-');
        label.textContent = parseInt(pd[1], 10) + '/' + parseInt(pd[2], 10);

        col.appendChild(score);
        col.appendChild(barWrap);
        col.appendChild(label);
        trendBars.appendChild(col);
      });
    }

    /* ================= 🆕 连续打卡天数 ================= */
    var CHECKIN_KEY = 'shiftHealthCheckins';

    function loadCheckins() {
      try {
        var arr = JSON.parse(localStorage.getItem(CHECKIN_KEY) || '[]');
        return Array.isArray(arr) ? arr : [];
      } catch (e) { return []; }
    }

    function dayStamp(d) {
      return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    }

    /* 每次成功生成建议都记一笔当天打卡（去重，最多留 90 天） */
    function addCheckin() {
      var arr = loadCheckins();
      var today = dayStamp(new Date());
      if (arr.indexOf(today) === -1) {
        arr.push(today);
        if (arr.length > 90) arr = arr.slice(-90);
        try { localStorage.setItem(CHECKIN_KEY, JSON.stringify(arr)); } catch (e) {}
      }
    }

    function renderStreak() {
      var arr = loadCheckins();
      var n = 0;
      if (arr.length) {
        var set = {};
        arr.forEach(function (d) { set[d] = true; });
        /* 从今天往回数连续天数；今天还没打卡就从昨天起算，不打击积极性 */
        var cursor = new Date();
        if (!set[dayStamp(cursor)]) cursor.setDate(cursor.getDate() - 1);
        while (set[dayStamp(cursor)]) {
          n++;
          cursor.setDate(cursor.getDate() - 1);
        }
      }
      if (streakDays) streakDays.textContent = n;
      var inline = document.getElementById('streakDaysInline');
      if (inline) inline.textContent = n;
    }

    /* ================= 🆕 v23：健康成就勋章 =================
       全部按本地数据实时判定，不额外存「已解锁」标记：
       · 连续打卡看「历史最长连续」——断签后勋章也不会又变灰
       · AI 次数看累计值，跨天不清零
       · 喝水看今天打卡的杯数 */
    var BADGES = [
      { id: 'sprout', icon: '🌱', name: '健康萌芽', cond: '连续打卡 3 天', type: 'streak', need: 3, unit: '天' },
      { id: 'neck', icon: '🛡️', name: '颈椎守护者', cond: '连续打卡 7 天', type: 'streak', need: 7, unit: '天' },
      { id: 'cyber', icon: '🤖', name: '赛博病友', cond: '累计咨询 AI 5 次', type: 'ai', need: 5, unit: '次' },
      { id: 'water', icon: '🌊', name: '水元素使者', cond: '单日喝水满 8 杯', type: 'water', need: 8, unit: '杯' }
    ];

    var badgePrev = {};   /* 上一次的解锁状态，用来识别「刚刚点亮」 */

    /* 历史最长连续打卡天数（不是当前连续，避免断签后勋章熄灭） */
    function bestStreakDays() {
      var arr = loadCheckins().slice().sort();
      var best = 0;
      var run = 0;
      var prev = 0;

      for (var i = 0; i < arr.length; i++) {
        var p = String(arr[i]).split('-');
        var t = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10)).getTime();
        if (!isFinite(t)) continue;
        run = (prev && Math.round((t - prev) / 86400000) === 1) ? run + 1 : 1;
        prev = t;
        if (run > best) best = run;
      }

      return best;
    }

    function badgeHaveValue(type) {
      if (type === 'streak') return bestStreakDays();
      if (type === 'ai') return aiTotalUses();
      return getWater().count;
    }

    function renderBadges(quiet) {
      if (!badgeGrid) return [];

      var unlockedTotal = 0;
      var html = '';
      var justUnlocked = [];

      BADGES.forEach(function (b) {
        var have = badgeHaveValue(b.type);
        var unlocked = have >= b.need;
        if (unlocked) unlockedTotal += 1;

        var justNow = unlocked && badgePrev[b.id] === false;   /* 从暗到亮的那一下 */
        if (justNow) justUnlocked.push(b.name);
        badgePrev[b.id] = unlocked;

        var prog = unlocked ? '已点亮' : (Math.min(have, b.need) + ' / ' + b.need + ' ' + b.unit);

        html += '<div class="badge-item ' + (unlocked ? 'is-unlocked' : 'is-locked') +
          (justNow ? ' just-unlocked' : '') + '" data-badge="' + b.id + '">' +
          '<span class="badge-icon" aria-hidden="true">' + b.icon + '</span>' +
          '<span class="badge-name">' + b.name + '</span>' +
          '<span class="badge-cond">' + b.cond + '</span>' +
          '<span class="badge-prog">' + prog + '</span>' +
          '</div>';
      });

      badgeGrid.innerHTML = html;
      if (badgeCount) badgeCount.textContent = unlockedTotal;

      /* 刚点亮：即时给一句反馈，用户在首页也能感知到（去记录页能看到发光）。
         quiet = true 时由调用方自己拼提示，避免两条 toast 打架 */
      if (justUnlocked.length && !quiet) {
        showToast('🏅 解锁成就：' + justUnlocked.join('、'));
      }

      return justUnlocked;
    }

    /* ================= 🆕 久坐番茄钟：50 分钟专注 + 到点提醒 =================
       运行状态存 localStorage：离开页面 / 刷新后计时继续，到点照常提醒 */
    var POMO_TOTAL_MS = 50 * 60 * 1000;
    var POMO_KEY = 'shiftHealthPomo';
    var pomoEndAt = 0;        /* 运行中：结束时间戳 */
    var pomoRemaining = POMO_TOTAL_MS;
    var pomoRunning = false;
    var pomoTick = null;

    function fmtPomo(ms) {
      var total = Math.max(0, Math.ceil(ms / 1000));
      var m = Math.floor(total / 60);
      var r = total % 60;
      return ('0' + m).slice(-2) + ':' + ('0' + r).slice(-2);
    }

    function savePomoState() {
      try {
        localStorage.setItem(POMO_KEY, JSON.stringify({
          running: pomoRunning,
          endAt: pomoRunning ? pomoEndAt : 0,
          remaining: pomoRemaining
        }));
      } catch (e) {}
    }

    function loadPomoState() {
      try { return JSON.parse(localStorage.getItem(POMO_KEY) || 'null'); } catch (e) { return null; }
    }

    function renderPomo() {
      if (!pomoTime) return;
      var left = pomoRunning ? Math.max(0, pomoEndAt - Date.now()) : pomoRemaining;
      pomoTime.textContent = fmtPomo(left);
      if (pomoBar) {
        pomoBar.style.width = Math.round(((POMO_TOTAL_MS - left) / POMO_TOTAL_MS) * 100) + '%';
      }
    }

    function setPomoCard(cls) {
      if (!pomoCard) return;
      pomoCard.classList.remove('is-running', 'is-done');
      if (cls) pomoCard.classList.add(cls);
    }

    function stopPomoTick() {
      if (pomoTick) { clearInterval(pomoTick); pomoTick = null; }
    }

    /* 到点提示音：WebAudio 短促两声，失败静默（有的浏览器要求用户先交互过） */
    function pomoBeep() {
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        var ctx = new AC();
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.9);
      } catch (e) {}
    }

    function openPomodoro() {
      if (!pomodoroOverlay) return;
      pomodoroOverlay.classList.add('show');
      pomodoroOverlay.setAttribute('aria-hidden', 'false');
    }

    function closePomodoro() {
      if (!pomodoroOverlay) return;
      pomodoroOverlay.classList.remove('show');
      pomodoroOverlay.setAttribute('aria-hidden', 'true');
    }

    function pomoFinish() {
      stopPomoTick();
      pomoRunning = false;
      releaseWake();      /* 🆕 到点结束，把屏幕交给系统 */
      pomoRemaining = POMO_TOTAL_MS;
      setPomoCard('is-done');
      if (pomoBtn) pomoBtn.textContent = '再来一轮';
      if (pomoState) pomoState.textContent = '完成了！起来活动 2 分钟吧';
      renderPomo();
      savePomoState();
      /* 震动 + 提示音 + 弹窗三连提醒 */
      if (navigator.vibrate) { try { navigator.vibrate([300, 120, 300]); } catch (e) {} }
      pomoBeep();
      openPomodoro();
    }

    /* ================= 🆕 v23：屏幕常亮（Wake Lock API） =================
       番茄钟一开就申请锁屏常亮，到点提醒才听得见；
       暂停 / 重置 / 结束立刻释放。只在 https 或 localhost 生效，
       浏览器不支持或被系统拒绝时静默跳过，完全不影响计时本身。 */
    var wakeLock = null;

    function wakeSupported() {
      return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
    }

    function updateWakeTip() {
      if (!pomoWake) return;
      pomoWake.hidden = !(wakeLock && !wakeLock.released);
    }

    function requestWake() {
      if (!wakeSupported()) return;
      if (wakeLock && !wakeLock.released) { updateWakeTip(); return; }

      try {
        navigator.wakeLock.request('screen').then(function (lock) {
          wakeLock = lock;
          updateWakeTip();
          /* 系统主动回收（切后台、低电量、省电模式）时同步状态，
             回到前台会自动重新申请 */
          if (lock.addEventListener) {
            lock.addEventListener('release', function () {
              if (wakeLock === lock) wakeLock = null;
              updateWakeTip();
            });
          }
        }).catch(function () {
          wakeLock = null;     /* 被拒绝也不能影响倒计时 */
          updateWakeTip();
        });
      } catch (e) {
        wakeLock = null;
        updateWakeTip();
      }
    }

    function releaseWake() {
      var lock = wakeLock;
      wakeLock = null;
      if (lock) {
        try {
          var p = lock.release();
          if (p && p.catch) p.catch(function () {});
        } catch (e) {}
      }
      updateWakeTip();
    }

    /* 切回前台且番茄钟还在跑：把锁补回来 */
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && pomoRunning) requestWake();
    });

    function startPomo() {
      pomoRunning = true;
      pomoEndAt = Date.now() + pomoRemaining;
      setPomoCard('is-running');
      if (pomoBtn) pomoBtn.textContent = '暂停';
      if (pomoState) pomoState.textContent = '专注中 · 到点会提醒你起来活动';
      stopPomoTick();
      pomoTick = setInterval(function () {
        if (pomoEndAt - Date.now() <= 0) { pomoFinish(); return; }
        renderPomo();
      }, 250);
      renderPomo();
      savePomoState();
      requestWake();      /* 🆕 开始专注就锁住屏幕常亮 */
    }

    function pausePomo() {
      pomoRunning = false;
      pomoRemaining = Math.max(0, pomoEndAt - Date.now());
      stopPomoTick();
      releaseWake();      /* 🆕 暂停就不再占用常亮 */
      setPomoCard(null);
      if (pomoBtn) pomoBtn.textContent = '继续专注';
      if (pomoState) pomoState.textContent = '已暂停 · 随时可以继续';
      renderPomo();
      savePomoState();
    }

    function resetPomo() {
      pomoRunning = false;
      pomoRemaining = POMO_TOTAL_MS;
      stopPomoTick();
      releaseWake();      /* 🆕 重置就释放 */
      setPomoCard(null);
      if (pomoBtn) pomoBtn.textContent = '开始专注';
      if (pomoState) pomoState.textContent = '还没开始 · 计时期间离开页面也会继续';
      renderPomo();
      savePomoState();
    }

    if (pomoBtn) {
      pomoBtn.addEventListener('click', function () {
        if (pomoRunning) pausePomo(); else startPomo();
      });
    }
    if (pomoReset) pomoReset.addEventListener('click', resetPomo);
    if (pomodoroOk) pomodoroOk.addEventListener('click', closePomodoro);
    if (pomodoroOverlay) {
      pomodoroOverlay.addEventListener('click', function (e) {
        if (e.target.getAttribute && e.target.getAttribute('data-pomo-close') === '1') closePomodoro();
      });
    }

    /* 恢复计时：刷新 / 关闭页面再进来，运行中的番茄钟继续走 */
    (function restorePomo() {
      if (!pomoTime) return;
      var st = loadPomoState();
      if (!st) { renderPomo(); return; }
      if (st.running && st.endAt > Date.now()) {
        pomoEndAt = st.endAt;
        pomoRunning = true;
        setPomoCard('is-running');
        if (pomoBtn) pomoBtn.textContent = '暂停';
        if (pomoState) pomoState.textContent = '专注中 · 到点会提醒你起来活动';
        pomoTick = setInterval(function () {
          if (pomoEndAt - Date.now() <= 0) { pomoFinish(); return; }
          renderPomo();
        }, 250);
        renderPomo();
        requestWake();      /* 🆕 刷新后恢复运行中的番茄钟，常亮也要补上 */
      } else if (st.running && st.endAt <= Date.now()) {
        /* 页面关着的时候时间就到了：不再打扰，呈现完成态 */
        pomoRunning = false;
        pomoRemaining = POMO_TOTAL_MS;
        setPomoCard('is-done');
        if (pomoBtn) pomoBtn.textContent = '再来一轮';
        if (pomoState) pomoState.textContent = '上次专注已完成';
        renderPomo();
      } else if (st.remaining && st.remaining < POMO_TOTAL_MS) {
        pomoRemaining = st.remaining;
        if (pomoBtn) pomoBtn.textContent = '继续专注';
        if (pomoState) pomoState.textContent = '已暂停 · 随时可以继续';
        renderPomo();
      } else {
        renderPomo();
      }
    })();

    /* ================= 情绪价值：60 秒深呼吸 ================= */
    var BREATHE_TOTAL_MS = 60000;   /* 总共 60 秒 */
    var BREATHE_CYCLE_MS = 12000;   /* 一轮 = 吸 4s + 憋 4s + 呼 4s */
    var breatheTick = null;
    var breatheStartAt = 0;

    /* 与 CSS 的 breatheCycle 关键帧一一对应 */
    function breathePhaseOf(elapsed) {
      var t = elapsed % BREATHE_CYCLE_MS;
      if (t < 4000) return '吸气';
      if (t < 8000) return '憋气';
      return '呼气';
    }

    function stopBreathe() {
      if (breatheTick) { clearInterval(breatheTick); breatheTick = null; }
      breatheOverlay.classList.remove('is-open');
      breatheOverlay.setAttribute('aria-hidden', 'true');
      /* 等淡出动画走完再隐藏，否则会被 hidden 直接掐断 */
      setTimeout(function () {
        if (!breatheOverlay.classList.contains('is-open')) breatheOverlay.hidden = true;
      }, 420);
    }

    function openBreathe() {
      if (breatheTick) { clearInterval(breatheTick); breatheTick = null; }

      breatheOverlay.hidden = false;
      breatheOverlay.setAttribute('aria-hidden', 'false');
      breathePhase.textContent = '吸气';
      breatheTime.textContent = '还剩 ' + Math.round(BREATHE_TOTAL_MS / 1000) + ' 秒';

      /* 下一帧再加 is-open，保证 opacity 淡入生效 */
      requestAnimationFrame(function () {
        if (!breatheOverlay.hidden) breatheOverlay.classList.add('is-open');
      });

      breatheStartAt = Date.now();
      breatheTick = setInterval(function () {
        var elapsed = Date.now() - breatheStartAt;
        var left = Math.max(0, Math.ceil((BREATHE_TOTAL_MS - elapsed) / 1000));
        breathePhase.textContent = breathePhaseOf(elapsed);
        breatheTime.textContent = left > 0 ? '还剩 ' + left + ' 秒' : '完成了，感觉好些了吗？';
        if (elapsed >= BREATHE_TOTAL_MS) stopBreathe();   /* 60 秒到点自动关闭 */
      }, 200);
    }

    breatheBtn.addEventListener('click', openBreathe);
    if (homeBreatheBtn) homeBreatheBtn.addEventListener('click', openBreathe);
    breatheClose.addEventListener('click', stopBreathe);
    breatheOverlay.addEventListener('click', function (e) {
      if (e.target === breatheOverlay) stopBreathe();   /* 点空白处也能退出 */
    });

    /* ================= 情绪彩蛋：每日能量签（纯本地数组，不烧 token） ================= */
    var FORTUNES = [
      '今天不练，是为了明天更强。身体也需要收利息。',
      '好好睡觉，是你对这个世界最温柔的反抗。',
      '别把放松当偷懒，恢复本身就是训练的一部分。',
      '你不需要每天都满分，及格就够了。',
      '起来走两分钟，比在椅子上纠结半小时有用。',
      '心跳快不是你的错，先呼吸，再决定。',
      '今天的步数不用赢过谁，赢过昨天的自己就行。',
      '水杯放在手边，比在心里提醒自己八遍都管用。',
      '疲惫不是意志力问题，是身体在提需求。',
      '最好的补剂是睡眠，最贵的药是熬夜。',
      '坐久了起来一次，比下班硬撑着去健身房更值。',
      '今天先做一件小事：把背挺直，把气吸满。',
      '状态差的时候，只做最低限度的那件事就好。',
      '别用咖啡还睡眠的债，利率太高了。',
      '你已经比昨天的你，多懂了一点身体的规则。',
      '散步不是浪费时间，是把时间还给自己。',
      '心里的结，常常几次深呼吸就能松一点。',
      '运动不用等状态好，状态是做出来的。',
      '把屏幕放低一点，把下巴收回来，肩膀就松了。',
      '今天没做到的，明天还在，真的不用焦虑。'
    ];

    var fortuneTimer = null;
    var lastFortune = -1;

    /* ================= 🆕 首页金句盲盒：每次刷新随机一句，打字机效果 ================= */
    var quoteTimer = null;

    function typeQuote(text) {
      if (!quoteText) return;
      if (quoteTimer) { clearInterval(quoteTimer); quoteTimer = null; }
      quoteText.textContent = '';
      quoteText.classList.add('typing');
      var i = 0;
      quoteTimer = setInterval(function () {
        i += 1;
        quoteText.textContent = text.slice(0, i);
        if (i >= text.length) {
          clearInterval(quoteTimer);
          quoteTimer = null;
          quoteText.classList.remove('typing');
        }
      }, 45);
    }

    function playQuote() {
      var idx = Math.floor(Math.random() * FORTUNES.length);
      typeQuote(FORTUNES[idx]);
    }

    /* 页面加载即开盲盒 */
    playQuote();
    if (quoteRefresh) {
      var flipQuote = function () { playQuote(); };
      quoteRefresh.addEventListener('click', flipQuote);
      quoteRefresh.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flipQuote(); }
      });
    }

    /* 打字机效果：逐字吐出来，打完收起光标 */
    function typeFortune(text) {
      if (fortuneTimer) { clearInterval(fortuneTimer); fortuneTimer = null; }
      fortuneText.textContent = '';
      fortuneText.classList.add('typing');
      var i = 0;
      fortuneTimer = setInterval(function () {
        i += 1;
        fortuneText.textContent = text.slice(0, i);
        if (i >= text.length) {
          clearInterval(fortuneTimer);
          fortuneTimer = null;
          fortuneText.classList.remove('typing');
        }
      }, 55);
    }

    fortuneBtn.addEventListener('click', function () {
      var idx = Math.floor(Math.random() * FORTUNES.length);
      if (FORTUNES.length > 1 && idx === lastFortune) idx = (idx + 1) % FORTUNES.length;   /* 不连着给同一句 */
      lastFortune = idx;
      typeFortune(FORTUNES[idx]);
    });

    /* ESC 关闭弹窗/分享预览/深呼吸 */
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      /* 只关最上面那一层，避免一次 ESC 把所有浮层一起关掉 */
      if (aiOverlay && !aiOverlay.hidden) { closeAiSheet(); return; }
      if (pomodoroOverlay && pomodoroOverlay.classList.contains('show')) { closePomodoro(); return; }
      closeResultSheet();
      if (!breatheOverlay.hidden) stopBreathe();
      var overlay = document.getElementById('shareOverlay');
      if (overlay) overlay.classList.remove('show');
    });

    /* --- 生成建议 --- */
    /* ================= 🆕 v21 三个纯视觉动效（不碰任何业务逻辑） ================= */

    /* --- 1. 启动屏：2 秒后向上滑出 --- */
    if (splashEl) {
      setTimeout(function () {
        splashEl.classList.add('is-leaving');
        setTimeout(function () { splashEl.hidden = true; }, 700);
      }, 2000);
    }

    /* --- 2. 生成时的环形扫描光环 --- */
    function startRingScan() {
      if (ringScan) ringScan.classList.add('is-on');
    }

    function stopRingScan() {
      if (ringScan) ringScan.classList.remove('is-on');
    }

    /* --- 3. 环形充满瞬间的高光脉冲（一次性，播完自动摘掉） --- */
    function flashRing() {
      if (!ringBar) return;
      ringBar.classList.remove('is-flash');
      void ringBar.getBoundingClientRect();   /* 强制重排，同分重生成也能重播 */
      ringBar.classList.add('is-flash');
      setTimeout(function () { ringBar.classList.remove('is-flash'); }, 1100);
    }

    /* --- 4. 毛玻璃卡片的光晕跟随：指到哪亮到哪，移出即灭 ---
       用事件委托挂一个监听，避免十几个卡片各绑一套 */
    var lastGlowCard = null;

    function moveGlow(e) {
      var card = e.target && e.target.closest ? e.target.closest('.glow-card') : null;
      if (lastGlowCard && lastGlowCard !== card) lastGlowCard.classList.remove('is-glowing');
      if (!card) { lastGlowCard = null; return; }
      var rect = card.getBoundingClientRect();
      card.style.setProperty('--mx', Math.round(e.clientX - rect.left) + 'px');
      card.style.setProperty('--my', Math.round(e.clientY - rect.top) + 'px');
      card.classList.add('is-glowing');
      lastGlowCard = card;
    }

    document.addEventListener('pointermove', moveGlow, { passive: true });
    document.addEventListener('pointerdown', moveGlow, { passive: true });   /* 触屏按下也点亮 */

    /* 手指抬起后熄灭（鼠标靠 pointermove 换目标自然熄灭） */
    document.addEventListener('pointerup', function (e) {
      if (e.pointerType !== 'mouse' && lastGlowCard) {
        lastGlowCard.classList.remove('is-glowing');
        lastGlowCard = null;
      }
    }, { passive: true });
    document.addEventListener('pointercancel', function () {
      if (lastGlowCard) { lastGlowCard.classList.remove('is-glowing'); lastGlowCard = null; }
    }, { passive: true });

    function runGenerate() {
      errEl.hidden = true;

      var sedentaryRaw = document.getElementById('sedentary').value.trim();
      var sedentary = parseNum(sedentaryRaw);
      var sleep = parseNum(document.getElementById('sleep').value);
      var hrRaw = document.getElementById('hr').value.trim();
      var steps = parseNum(document.getElementById('steps').value);
      var hr = hrRaw === '' ? null : parseNum(hrRaw);

      if (hrRaw !== '' && hr === null) {
        showError(errEl, '心率请填不小于 0 的数字，不知道就留空。');
        return;
      }

      var errMsg = validateInputs(sedentary, sleep, hr, steps, currentMode);
      if (errMsg) {
        showError(errEl, errMsg);
        return;
      }

      generateBtn.disabled = true;
      generateBtn.textContent = '分析中…';
      startRingScan();           /* 🆕 视觉：环形区域旋转扫描光环 */

      setTimeout(function () {
        var out = currentMode === 'night'
          ? getNightAdvice(sleep, hr, steps)
          : getAdvice(sedentary, sleep, hr, steps);

        if (!out) {
          stopRingScan();
          showError(errEl, '没有匹配到规则，请检查输入。');
        } else {
          var vitality = computeVitality(sedentary, sleep, hr, steps);
          var micro = computeMicroAction(sedentary, sleep, currentMode);
          var hydration = computeHydration(steps, sedentary, currentMode);

          /* 模块一：状态诊断（红黄绿灯 + 昨日账单解释） */
          riskBadge.textContent = riskLabelOf(out.riskLevel) || out.risk;
          riskBadge.className = 'risk-badge risk-' + out.riskLevel;
          if (causeEl) causeEl.textContent = explainCause(sedentary, sleep, hr, steps, currentMode);
          activityEl.textContent = out.advice;
          tabooEl.textContent = '⚠️ 绝对禁忌：' + out.taboo;

          /* 手机物理反馈：结果一出来就震一下 */
          haptic(out.riskLevel);

          /* 模块二：运动与拉伸处方 */
          actionEl.textContent = out.action;
          microEl.textContent = '微动作：' + micro;

          /* 模块三：饮食与营养干预 */
          nutritionEl.textContent = out.nutrition;
          hydrationEl.textContent = hydration;

          keyEl.textContent = out.key;

          lastOut = out;
          lastVitality = vitality;
          lastMicro = micro;
          lastHydration = hydration;

          /* 存历史（最多 7 条） */
          var record = {
            ts: Date.now(),
            mode: currentMode,
            sedentary: sedentary,
            sleep: sleep,
            hr: hr,
            steps: steps,
            vitality: vitality
          };
          saveHistory(record);
          saveTrendDay(record);      /* 🆕 同步写进「每日趋势日志」，喂给 AI 长记忆 */
          updateLastTestLabel();
          addCheckin();              /* 🆕 记一笔当天打卡（供「记录」页算连续天数） */
          renderBadges();            /* 🆕 打卡可能推进/点亮连续天数徽章 */
          updateGoalTip(steps, sedentary);   /* 🆕 对照个人目标给鼓励提示 */

          /* 新结果出来，旧 AI 建议作废，下次点入口会重新问一次 */
          aiCard.hidden = true;
          aiReply.textContent = '';
          aiHasReply = false;
          stopSpeak();                                            /* 🆕 新结果，旧朗读作废 */
          if (aiSpeakBtn) aiSpeakBtn.hidden = true;

          /* 先滑出抽屉，再让环形生长：扫描收掉，进度条带强光充满 */
          stopRingScan();
          openResultSheet();
          setTimeout(function () {
            renderVitality(vitality);
            flashRing();           /* 🆕 视觉：环形充满瞬间的高光脉冲 */
          }, 160);
        }

        generateBtn.disabled = false;
        generateBtn.textContent = '生成今天的建议';
      }, 450);
    }

    generateBtn.addEventListener('click', runGenerate);

    /* 一键填入示例：填入后立即生成 */
    document.getElementById('demoBtn').addEventListener('click', function () {
      document.getElementById('sedentary').value = '8';
      document.getElementById('sleep').value = '6';
      document.getElementById('hr').value = '75';
      document.getElementById('steps').value = '2500';
      runGenerate();
    });

    /* 回车即生成 */
    document.querySelector('.form-card').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
        e.preventDefault();
        runGenerate();
      }
    });

    /* --- AI 私教 --- */
    var lastAiPayload = null;   /* 记住最近一次请求，失败后可原地重试 */
    var lastAiWaiting = '';

    /* ================= 🆕 AI 每日限额：每天 3 次完整咨询 =================
       计次规则：主回答「成功拿到回复」才 +1；失败重试与追问不额外扣次数 */
    var AI_DAILY_LIMIT = 3;
    var AI_QUOTA_KEY = 'shiftHealthAiQuota';
    var AI_TOTAL_KEY = 'shiftHealthAiTotal';   /* 🆕 累计使用次数（成就用，不清零） */

    function aiTotalUses() {
      var n = parseInt(localStorage.getItem(AI_TOTAL_KEY) || '0', 10);
      return isFinite(n) && n > 0 ? n : 0;
    }

    function bumpAiTotal() {
      try { localStorage.setItem(AI_TOTAL_KEY, String(aiTotalUses() + 1)); } catch (e) {}
    }

    function getAiQuota() {
      var today = dayStamp(new Date());
      var q = null;
      try { q = JSON.parse(localStorage.getItem(AI_QUOTA_KEY) || 'null'); } catch (e) {}
      if (!q || q.date !== today) q = { date: today, used: 0 };   /* 跨天自动清零 */
      return q;
    }

    function consumeAiQuota() {
      var q = getAiQuota();
      q.used += 1;
      try { localStorage.setItem(AI_QUOTA_KEY, JSON.stringify(q)); } catch (e) {}
      bumpAiTotal();      /* 🆕 累计次数单独记，跨天也不清零 */
    }

    function aiQuotaLeft() {
      return Math.max(0, AI_DAILY_LIMIT - getAiQuota().used);
    }

    function updateAiQuotaUi() {
      if (!aiQuotaEl || !aiBtn) return;
      var left = aiQuotaLeft();
      if (left <= 0) {
        aiQuotaEl.innerHTML = '今天的 ' + AI_DAILY_LIMIT + ' 次咨询已用完，<em>明天再来</em>';
        aiBtn.disabled = true;
        aiBtn.textContent = '今日次数已用完';
      } else {
        aiQuotaEl.innerHTML = '今日剩余咨询次数：<em>' + left + '</em> / ' + AI_DAILY_LIMIT;
        aiBtn.disabled = false;
        aiBtn.textContent = AI_BTN_TEXT;
      }
    }

    function setAiBusy(busy) {
      aiBtn.disabled = busy;
      aiAskBtn.disabled = busy;
      aiRetryBtn.disabled = busy;
      aiBtn.textContent = busy ? AI_BTN_LOADING : AI_BTN_TEXT;
    }

    /* ================= 🆕 v23：AI 语音朗读（Web Speech API，纯前端免费） =================
       点一次开始读，再点一次立刻停；换了新回复、关抽屉、重新提问都会自动停，
       不会出现「页面关了声音还在念」的尴尬 */
    var SPEAK_OFF_TEXT = '语音朗读';
    var SPEAK_ON_TEXT = '停止朗读';
    var speaking = false;

    function speechSupported() {
      return typeof window !== 'undefined' &&
        'speechSynthesis' in window &&
        typeof window.SpeechSynthesisUtterance === 'function';
    }

    /* 优先挑中文音色，挑不到就用系统默认（不影响使用） */
    function pickZhVoice() {
      var list = [];
      try { list = window.speechSynthesis.getVoices() || []; } catch (e) { return null; }
      var fallback = null;
      for (var i = 0; i < list.length; i++) {
        var lang = String(list[i].lang || '').toLowerCase();
        if (lang.indexOf('zh-cn') === 0 || lang.indexOf('zh_cn') === 0) return list[i];
        if (!fallback && lang.indexOf('zh') === 0) fallback = list[i];
      }
      return fallback;
    }

    function setSpeakUi(on) {
      speaking = !!on;
      if (!aiSpeakBtn) return;
      aiSpeakBtn.classList.toggle('is-speaking', !!on);
      aiSpeakBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (aiSpeakTxt) aiSpeakTxt.textContent = on ? SPEAK_ON_TEXT : SPEAK_OFF_TEXT;
    }

    function stopSpeak() {
      if (speaking && speechSupported()) {
        try { window.speechSynthesis.cancel(); } catch (e) {}
      }
      setSpeakUi(false);
    }

    function speakAiReply() {
      if (!speechSupported()) {
        showToast('这个浏览器不支持语音朗读，换个浏览器试试');
        return;
      }
      /* 正在读：再点一次就是停止 */
      if (speaking) { stopSpeak(); return; }

      var text = String(aiReply.textContent || '').trim();
      if (!text) {
        showToast('还没有可以朗读的内容');
        return;
      }

      try { window.speechSynthesis.cancel(); } catch (e) {}   /* 清掉可能排队的旧任务 */

      var utt = new window.SpeechSynthesisUtterance(text);
      utt.lang = 'zh-CN';
      utt.rate = 1.0;      /* 正常语速，太快听不清 */
      utt.pitch = 1.0;
      utt.volume = 1;
      var voice = pickZhVoice();
      if (voice) utt.voice = voice;

      utt.onend = function () { setSpeakUi(false); };
      utt.onerror = function () { setSpeakUi(false); };

      setSpeakUi(true);
      try {
        window.speechSynthesis.speak(utt);
      } catch (e) {
        setSpeakUi(false);
        showToast('朗读启动失败，稍后再试');
      }
    }

    if (aiSpeakBtn) {
      aiSpeakBtn.addEventListener('click', speakAiReply);
      /* 有的浏览器不支持就别显示这个按钮，免得点了没反应 */
      if (!speechSupported()) aiSpeakBtn.hidden = true;
    }

    function askCoach(payload, waitingText) {
      lastAiPayload = payload;
      lastAiWaiting = waitingText || '';

      setAiBusy(true);
      aiCard.hidden = false;
      aiRetryBtn.hidden = true;
      stopSpeak();                       /* 🆕 重新问就别再念旧的了 */
      if (aiSpeakBtn) aiSpeakBtn.hidden = true;
      aiReply.textContent = waitingText || '教练正在翻你这几天的档案…';

      var startedAt = Date.now();
      var timer = null;
      var ticker = null;
      var streaming = false;   /* 已经开始逐字输出后，就不再算超时 */
      var controller = (typeof AbortController === 'function') ? new AbortController() : null;

      function clearTimers() {
        if (ticker) { clearInterval(ticker); ticker = null; }
        if (timer) { clearTimeout(timer); timer = null; }
      }

      /* 每秒刷新等待时长：手机上长时间没有反馈，很容易让人以为页面卡死了 */
      ticker = setInterval(function () {
        if (!aiBtn.disabled || streaming) return;
        var sec = Math.round((Date.now() - startedAt) / 1000);
        if (sec < 3) return;
        aiReply.textContent = sec >= AI_SLOW_TIP_SEC
          ? '网络有点慢，教练还在想（已等 ' + sec + ' 秒）…'
          : '教练正在思考…（已等 ' + sec + ' 秒）';
      }, 1000);

      /* 首字节超时：接口迟迟不开始返回就主动中断，而不是无限转圈 */
      if (controller) {
        timer = setTimeout(function () { controller.abort(); }, AI_TIMEOUT_MS);
      }

      function finish() {
        clearTimers();
        setAiBusy(false);
        updateAiQuotaUi();         /* 🆕 请求结束后刷新剩余次数显示 */
      }

      /* 拿到完整文字（老版 Worker 走这里，或浏览器不支持流） */
      function settle(reply) {
        var text = String(reply || '').trim();
        if (!text) throw new Error('EMPTY_REPLY');
        clearTimers();
        aiReply.textContent = text;
        aiRetryBtn.hidden = true;
        aiHasReply = true;
        consumeAiQuota();          /* 🆕 拿到完整回复才算消耗一次 */
        /* 🆕 文字齐了才把朗读按钮放出来，避免读到半截 */
        if (aiSpeakBtn && speechSupported()) aiSpeakBtn.hidden = false;
        renderBadges();            /* 🆕 第 5 次咨询可能刚好点亮「赛博病友」 */
      }

      return fetch(AI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller ? controller.signal : undefined
      }).then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);

        var ctype = (res.headers && res.headers.get) ? (res.headers.get('content-type') || '') : '';

        /* 兼容老版 Worker：返回 { reply: "..." } 的 JSON */
        if (ctype.indexOf('application/json') !== -1) {
          return res.json().then(function (data) {
            return settle(data && data.reply);
          });
        }

        /* 浏览器不支持流式读取（老内核），退化为整段文本 */
        if (!res.body || typeof res.body.getReader !== 'function' || typeof TextDecoder === 'undefined') {
          return res.text().then(settle);
        }

        /* 新版 Worker：逐字返回，边收边显示 */
        var reader = res.body.getReader();
        var decoder = new TextDecoder('utf-8');
        var text = '';

        return (function pump() {
          return reader.read().then(function (chunk) {
            if (chunk.done) {
              return settle(text);
            }
            if (!streaming) {
              streaming = true;
              clearTimers();   /* 已经出字了，后面只是生成速度，不再计时 */
            }
            text += decoder.decode(chunk.value, { stream: true });
            aiReply.textContent = text;
            return pump();
          });
        })();
      }).catch(function (err) {
        /* 按失败原因分开提示，手机上没有控制台也能看出大概问题 */
        var name = (err && err.name) || '';
        var msg = (err && err.message) || '';

        if (name === 'AbortError' || /abort/i.test(msg)) {
          aiReply.textContent = '等了 ' + Math.round(AI_TIMEOUT_MS / 1000) +
            ' 秒教练还没开始回复，网络可能不太稳定。点下面「↻ 再试一次」。';
        } else if (/^HTTP 5/.test(msg)) {
          aiReply.textContent = 'AI 服务暂时不可用（' + msg + '），过一会儿再试。';
        } else if (/^HTTP /.test(msg)) {
          aiReply.textContent = 'AI 接口返回异常（' + msg + '），点下面「↻ 再试一次」。';
        } else if (msg === 'EMPTY_REPLY') {
          aiReply.textContent = 'AI 这次没给出内容，点下面「↻ 再试一次」。';
        } else {
          /* 断网、DNS 失败、跨域被拦，fetch 会直接 reject */
          aiReply.textContent = AI_ERROR_TEXT + '（网络没连通，请检查手机网络再重试）';
        }
        aiRetryBtn.hidden = false;
      }).then(function () {
        finish();
      });
    }

    aiRetryBtn.addEventListener('click', function () {
      if (!lastAiPayload || aiBtn.disabled) return;
      askCoach(lastAiPayload, lastAiWaiting);
    });

    /* 四项数据拼成一句话，例如：久坐8小时，睡眠6小时，心率75，步数2500 */
    function buildUserData() {
      var parts = [];
      var sedentaryVal = document.getElementById('sedentary').value.trim();
      var sleepVal = document.getElementById('sleep').value.trim();
      var hrVal = document.getElementById('hr').value.trim();
      var stepsVal = document.getElementById('steps').value.trim();

      if (sedentaryVal !== '') {
        parts.push('久坐' + sedentaryVal + '小时');
      } else if (currentMode === 'night') {
        parts.push('夜班/倒时差模式');
      }
      if (sleepVal !== '') parts.push('睡眠' + sleepVal + '小时');
      if (hrVal !== '') parts.push('心率' + hrVal);
      if (stepsVal !== '') parts.push('步数' + stepsVal);

      return parts.join('，');
    }

    /* ================= 🆕 AI 长记忆：把近 7 天历史整理成「趋势档案」 =================
       两个数据源合并：
       ① 每日趋势日志（一天一条，同一天重复测试只留最后一次，这才撑得起「近 7 天」）
       ② 历史记录兜底（老用户之前只存了这个，按天去重后并进来，不丢数据）
       今天的数据走 buildUserData 单独传，这里排除掉，避免重复喂给模型。 */
    var TREND_MAX_DAYS = 7;
    var TREND_KEY = 'shiftHealthTrendLog';

    function loadTrendLog() {
      try {
        var arr = JSON.parse(localStorage.getItem(TREND_KEY) || '[]');
        return Array.isArray(arr) ? arr : [];
      } catch (e) {
        return [];
      }
    }

    /* 每天只保留一条，最多 7 天：用户一天测 5 次也不会把历史挤爆 */
    function saveTrendDay(rec) {
      if (!rec || !rec.ts) return;
      var key = dayStamp(new Date(rec.ts));
      var arr = loadTrendLog().filter(function (x) { return x && x.date !== key; });
      arr.unshift({
        date: key, ts: rec.ts, mode: rec.mode,
        sleep: rec.sleep, sedentary: rec.sedentary,
        steps: rec.steps, vitality: rec.vitality
      });
      if (arr.length > TREND_MAX_DAYS) arr = arr.slice(0, TREND_MAX_DAYS);
      try { localStorage.setItem(TREND_KEY, JSON.stringify(arr)); } catch (e) {}
    }

    function trendDays() {
      var today = dayStamp(new Date());
      var map = {};
      var keys = [];

      function put(key, rec) {
        if (!key || map[key]) return;
        map[key] = rec;
        keys.push(key);
      }

      loadTrendLog().forEach(function (r) {
        if (r && r.date) put(r.date, r);
      });

      loadHistory().forEach(function (r) {
        if (!r || !r.ts) return;
        var key = dayStamp(new Date(r.ts));
        put(key, {
          date: key, ts: r.ts, mode: r.mode,
          sleep: r.sleep, sedentary: r.sedentary,
          steps: r.steps, vitality: r.vitality
        });
      });

      /* 'YYYY-MM-DD' 字典序即时间序，升序 = 由旧到新 */
      var days = keys.filter(function (k) { return k !== today; }).sort();
      if (days.length > TREND_MAX_DAYS - 1) {
        days = days.slice(days.length - (TREND_MAX_DAYS - 1));
      }

      return days.map(function (k) { return { key: k, rec: map[k] }; });
    }

    function trendNum(v) {
      var n = parseFloat(v);
      return isFinite(n) ? n : null;
    }

    function trendDayLabel(key) {
      var p = String(key).split('-');
      return parseInt(p[1], 10) + '月' + parseInt(p[2], 10) + '日';
    }

    /* 返回一段纯文本：数据 + 趋势信号（信号由本地判定，省得模型自己算错） */
    function buildTrendBrief() {
      var days = trendDays();
      if (!days.length) return '';

      var lines = [];
      var sleeps = [];      /* 旧 → 新 */
      var sedentarys = [];
      var stepsArr = [];
      var vitals = [];
      var nightCount = 0;

      days.forEach(function (d) {
        var r = d.rec;
        var seg = [];
        var sleep = trendNum(r.sleep);
        var sed = trendNum(r.sedentary);
        var steps = trendNum(r.steps);
        var vit = trendNum(r.vitality);

        if (sleep !== null) { seg.push('睡眠' + sleep + 'h'); sleeps.push(sleep); }
        if (sed !== null) { seg.push('久坐' + sed + 'h'); sedentarys.push(sed); }
        if (steps !== null) { seg.push('步数' + steps); stepsArr.push(steps); }
        if (vit !== null) { seg.push('活力' + vit); vitals.push(vit); }
        if (r.mode === 'night') { seg.push('夜班'); nightCount++; }

        if (seg.length) lines.push(trendDayLabel(d.key) + ' ' + seg.join('、'));
      });

      if (!lines.length) return '';

      var signals = [];

      /* ① 连续熬夜：从最近一天往回数，睡眠 < 6 小时 */
      var shortRun = 0;
      for (var i = days.length - 1; i >= 0; i--) {
        var s = trendNum(days[i].rec.sleep);
        if (s !== null && s < 6) shortRun += 1;
        else break;
      }
      if (shortRun >= 2) {
        signals.push('已连续 ' + shortRun + ' 天睡眠不足 6 小时，正在透支');
      }

      /* ② 活力值走势（首尾对比，差值 ≥6 才算趋势） */
      if (vitals.length >= 2) {
        var vFirst = vitals[0];
        var vLast = vitals[vitals.length - 1];
        var vDiff = vLast - vFirst;
        if (vDiff >= 6) signals.push('活力值从 ' + vFirst + ' 涨到 ' + vLast + '，在稳步进步');
        else if (vDiff <= -6) signals.push('活力值从 ' + vFirst + ' 掉到 ' + vLast + '，状态在下滑');
      }

      /* ③ 久坐均值 */
      if (sedentarys.length >= 2) {
        var sedSum = 0;
        sedentarys.forEach(function (v) { sedSum += v; });
        var sedAvg = Math.round((sedSum / sedentarys.length) * 10) / 10;
        if (sedAvg >= 8) signals.push('日均久坐 ' + sedAvg + ' 小时，偏高');
      }

      /* ④ 步数走势 */
      if (stepsArr.length >= 2) {
        var stFirst = stepsArr[0];
        var stLast = stepsArr[stepsArr.length - 1];
        if (stLast - stFirst >= 1500) signals.push('步数从 ' + stFirst + ' 涨到 ' + stLast + '，动起来了');
        else if (stFirst - stLast >= 1500) signals.push('步数从 ' + stFirst + ' 掉到 ' + stLast + '，越走越少');
      }

      var text = '【近 ' + (days.length + 1) + ' 天档案（不含今天，由旧到新）】' +
        lines.join('；') + '。';

      if (days.length === 1) {
        text += '（历史仅 1 天，趋势仅供参考）';
      }
      if (nightCount >= 2) {
        text += '【夜班】近 ' + days.length + ' 天里有 ' + nightCount + ' 天是夜班/倒时差。';
      }
      if (signals.length) {
        text += '【趋势信号】' + signals.join('；') + '。';
      }

      return text;
    }

    /* 完整投喂内容：今日数据 + 近 7 天档案 */
    function buildAiUserData() {
      var today = buildUserData();
      var trend = buildTrendBrief();
      return trend ? (today + '\n' + trend) : today;
    }

    aiBtn.addEventListener('click', function () {
      if (!lastOut) {
        showToast('还没有结果，先点“生成今天的建议”');
        return;
      }
      if (aiBtn.disabled) return;
      /* 🆕 每日 3 次限额：用完就不再发请求 */
      if (aiQuotaLeft() <= 0) {
        showToast('今天的 ' + AI_DAILY_LIMIT + ' 次咨询已用完，明天再来吧');
        updateAiQuotaUi();
        return;
      }
      askCoach({
        userData: buildAiUserData(),
        baseAdvice: activityEl.textContent,
        status: riskBadge.textContent
      });
    });

    /* 追问：沿用同一接口，把问题附在基础建议后面 */
    aiAskForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!lastOut) {
        showToast('还没有结果，先点“生成今天的建议”');
        return;
      }
      var q = aiQuestion.value.trim();
      if (!q) {
        showToast('先写一句想问的话');
        return;
      }
      if (aiBtn.disabled) return;

      askCoach({
        userData: buildAiUserData(),
        baseAdvice: activityEl.textContent + '\n【我的追问】' + q,
        status: riskBadge.textContent
      }, '教练正在回答你的追问…').then(function () {
        aiQuestion.value = '';
      });
    });

    /* --- 复制建议 --- */
    document.getElementById('copyBtn').addEventListener('click', function () {
      if (!lastOut) {
        showToast('还没有结果，先点“生成今天的建议”');
        return;
      }
      /* 用规则表原始字段拼文本，避免和页面上的前缀（⚠️ 绝对禁忌：/ 微动作：）重复 */
      var text = '【状态诊断】' + riskBadge.textContent +
        '\n【活动建议】' + lastOut.advice +
        '\n【绝对禁忌】' + lastOut.taboo +
        '\n【运动与拉伸处方】' + lastOut.action +
        '\n【微动作】' + lastMicro +
        '\n【饮食与营养干预】' + lastOut.nutrition +
        '\n【饮水目标】' + lastHydration +
        '\n【今天最该做的一件事】' + lastOut.key +
        '\n【今日活力值】' + lastVitality + ' / 100';
      copyText(text).then(
        function () { showToast('已复制'); },
        function () { showToast('复制失败，请手动选中文字复制'); }
      );
    });

    /* --- 生成数据卡片（html2canvas 截图下载） --- */
    var shareOverlay = document.getElementById('shareOverlay');
    var shareCard = document.getElementById('shareCard');
    var shareBtn = document.getElementById('shareBtn');
    var shareRoast = document.getElementById('shareRoast');

    /* 🆕 传播文案：按活力值分档，越极端越好转发（炫耀 or 自嘲） */
    function shareRoastOf(score) {
      var s = parseFloat(score);
      if (!isFinite(s)) s = 0;
      if (s >= 80) {
        return { text: '超人状态！今天打败了 85% 的久坐打工人', cls: 'roast-high' };
      }
      if (s >= 60) {
        return { text: '中规中矩，今天打败了 60% 的打工人', cls: 'roast-mid' };
      }
      return { text: '电量告急！已击败 10% 的熬夜党，今天必须躺平', cls: 'roast-low' };
    }

    function renderShareRoast(score) {
      if (!shareRoast) return;
      var r = shareRoastOf(score);
      shareRoast.textContent = r.text;
      shareRoast.className = 'share-roast ' + r.cls;
      shareRoast.hidden = false;
    }

    shareBtn.addEventListener('click', function () {
      if (!lastOut) {
        showToast('还没有结果，先点“生成今天的建议”');
        return;
      }
      if (typeof html2canvas === 'undefined') {
        showToast('分享功能需要联网加载，请检查网络后重试');
        return;
      }
      if (shareOverlay.classList.contains('show')) return;

      shareBtn.disabled = true;
      shareBtn.textContent = '生成中…';
      document.getElementById('shareMode').textContent = currentMode === 'day' ? '久坐上班族' : '夜班/倒时差';
      document.getElementById('shareScore').textContent = lastVitality;
      renderShareRoast(lastVitality);      /* 🆕 分数下方的金句 */
      document.getElementById('shareRisk').textContent = lastOut.risk;
      document.getElementById('shareAdvice').textContent = lastOut.advice;
      document.getElementById('shareKey').textContent = lastOut.key;
      var now = new Date();
      document.getElementById('shareDate').textContent = now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日';
      document.getElementById('shareUrl').textContent = SITE_URL;

      /* 先显示再截图，离屏元素 html2canvas 会截失败 */
      shareOverlay.classList.add('show');
      html2canvas(shareCard, { scale: 2, backgroundColor: '#16352a' }).then(function (canvas) {
        var rounded = roundRectCanvas(canvas, 48);
        var a = document.createElement('a');
        a.download = '今日活动建议卡片.png';
        a.href = rounded.toDataURL('image/png');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        shareBtn.disabled = false;
        shareBtn.textContent = '生成今日数据卡片';
        showToast('图片已下载，点 × 关闭预览');
      }).catch(function () {
        shareBtn.disabled = false;
        shareBtn.textContent = '生成今日数据卡片';
        showToast('自动生成失败，可直接截图预览卡片保存');
      });
    });

    document.getElementById('shareClose').addEventListener('click', function () {
      shareOverlay.classList.remove('show');
    });
    shareOverlay.addEventListener('click', function (e) {
      if (e.target === shareOverlay) shareOverlay.classList.remove('show');
    });

    /* --- 人群模式切换：两个模式各自记忆输入 --- */
    var modeInputs = { day: {}, night: {} };

    function readInputs() {
      return {
        sedentary: document.getElementById('sedentary').value,
        sleep: document.getElementById('sleep').value,
        hr: document.getElementById('hr').value,
        steps: document.getElementById('steps').value
      };
    }

    function writeInputs(vals) {
      document.getElementById('sedentary').value = vals.sedentary || '';
      document.getElementById('sleep').value = vals.sleep || '';
      document.getElementById('hr').value = vals.hr || '';
      document.getElementById('steps').value = vals.steps || '';
    }

    function setMode(mode) {
      if (mode === currentMode) return;
      modeInputs[currentMode] = readInputs();
      currentMode = mode;
      modeStatus.textContent = mode === 'day' ? '当前模式：久坐上班族' : '当前模式：夜班/倒时差';
      fieldSedentary.style.display = mode === 'day' ? '' : 'none';
      appDesc.textContent = mode === 'day'
        ? '输入昨日作息数据，为你生成今日最合适的行动安排。'
        : '输入昨日睡眠、今晨心率和昨日步数，为你生成今日的行动安排。';
      appSub.textContent = mode === 'day'
        ? '用昨日的账单，定今日的预算：昨晚怎么睡、昨天坐多久，决定今天怎么动。'
        : '用昨日的账单，定今日的预算：夜班后睡够没、走了多少步，决定今天补什么。';
      writeInputs(modeInputs[mode] || {});
      closeResultSheet();
      errEl.hidden = true;
      aiCard.hidden = true; /* 切换模式后旧 AI 建议已不适用 */
    }

    modeSwitchBtn.addEventListener('click', function () {
      setMode(currentMode === 'day' ? 'night' : 'day');
    });

    /* --- 时间驱动的昼夜主题 --- */
    applyThemeByClock();
    setInterval(applyThemeByClock, 10 * 60 * 1000);

    /* --- 接口预热：页面加载后先做一次 DNS/TLS 握手，手机弱网下首次点击会快一些 --- */
    setTimeout(function () {
      try {
        fetch(AI_ENDPOINT, { method: 'GET', mode: 'no-cors', cache: 'no-store' })
          .catch(function () { /* 预热失败不影响正常使用 */ });
      } catch (e) {}
    }, 2500);

    /* 清理旧版手动主题留下的缓存键（本版已改为按时间自动切换） */
    try { localStorage.removeItem('shiftHealthTheme'); } catch (e) {}

    /* --- 页脚“上次测试”摘要：取历史里最新的一条 --- */
    function updateLastTestLabel() {
      if (!lastTestEl) return;
      var arr = loadHistory();
      if (!arr.length) {
        lastTestEl.hidden = true;
        return;
      }
      var rec = arr[0];
      var d = new Date(rec.ts);
      var text = getLastTestText({
        date: d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(),
        vitality: rec.vitality
      });
      if (!text) {
        lastTestEl.hidden = true;
        return;
      }
      lastTestEl.textContent = text;
      lastTestEl.hidden = false;
    }

    updateLastTestLabel();

    /* 🆕 初始化 AI 剩余次数显示 */
    updateAiQuotaUi();

    /* 🆕 初始化喝水打卡与目标输入框 */
    renderWater();
    renderGoalInputs();

    /* 🆕 v23：成就勋章首次渲染 + 屏幕常亮状态 */
    renderBadges();
    updateWakeTip();

    /* ================= 🆕 PWA：注册 Service Worker =================
       仅在 https 或 localhost 下生效；file:// 双击打开时自动跳过 */
    if ('serviceWorker' in navigator &&
        (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('./service-worker.js')
          .catch(function () { /* 注册失败不影响页面正常使用 */ });
      });
    }
  }

  function showError(errEl, msg) {
    errEl.textContent = msg;
    errEl.hidden = false;
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (ok) { resolve(); } else { reject(new Error('copy failed')); }
      } catch (e) {
        document.body.removeChild(ta);
        reject(e);
      }
    });
  }

  /* 把截图裁成圆角（PNG 四角透明，任何背景都好看） */
  function roundRectCanvas(canvas, radius) {
    var out = document.createElement('canvas');
    out.width = canvas.width;
    out.height = canvas.height;
    var ctx = out.getContext('2d');
    ctx.drawImage(canvas, 0, 0);
    var w = out.width;
    var h = out.height;
    var r = Math.min(radius, w / 2, h / 2);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(w - r, 0);
    ctx.quadraticCurveTo(w, 0, w, r);
    ctx.lineTo(w, h - r);
    ctx.quadraticCurveTo(w, h, w - r, h);
    ctx.lineTo(r, h);
    ctx.quadraticCurveTo(0, h, 0, h - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.fill();
    return out;
  }

  function showToast(msg) {
    var toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () {
      toast.classList.remove('show');
    }, 1800);
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  /* ================= Node 导出（供本地自动验收） ================= */
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      getAdvice: getAdvice,
      getNightAdvice: getNightAdvice,
      computeVitality: computeVitality,
      computeHydration: computeHydration,
      computeMicroAction: computeMicroAction,
      formatMonthDay: formatMonthDay,
      getLastTestText: getLastTestText,
      formatStamp: formatStamp,
      themeForHour: themeForHour,
      loadHistory: loadHistory,
      saveHistory: saveHistory,
      clearHistory: clearHistory,
      RULES: RULES,
      FALLBACK: FALLBACK,
      FALLBACK_KEY: FALLBACK_KEY,
      validateInputs: validateInputs,
      bins: { sedentaryBin: sedentaryBin, sleepBin: sleepBin, stepsBin: stepsBin, hrBin: hrBin }
    };
  }
})();
