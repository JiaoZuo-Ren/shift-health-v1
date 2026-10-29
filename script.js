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
    var result = document.getElementById('result');
    var activityEl = document.getElementById('activityAdvice');
    var hydrationEl = document.getElementById('hydrationAdvice');
    var microEl = document.getElementById('microAdvice');
    var tabooEl = document.getElementById('tabooAdvice');
    var actionEl = document.getElementById('actionAdvice');
    var nutritionEl = document.getElementById('nutritionAdvice');
    var riskBadge = document.getElementById('riskBadge');
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
    var aiAskForm = document.getElementById('aiAskForm');
    var aiQuestion = document.getElementById('aiQuestion');
    var aiAskBtn = document.getElementById('aiAskBtn');
    var historyModal = document.getElementById('historyModal');
    var historyList = document.getElementById('historyList');
    var lastTestEl = document.getElementById('lastTest');

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
    }

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
      closeHistory();
      runGenerate();
      showToast('已回填历史数据');
    }

    function openHistory() {
      renderHistory();
      historyModal.classList.add('show');
      historyModal.setAttribute('aria-hidden', 'false');
    }

    function closeHistory() {
      historyModal.classList.remove('show');
      historyModal.setAttribute('aria-hidden', 'true');
    }

    document.getElementById('historyBtn').addEventListener('click', openHistory);
    document.getElementById('historyClose').addEventListener('click', closeHistory);
    historyModal.addEventListener('click', function (e) {
      if (e.target.getAttribute('data-close') === '1') closeHistory();
    });
    document.getElementById('historyClear').addEventListener('click', function () {
      clearHistory();
      renderHistory();
      updateLastTestLabel();
      showToast('历史记录已清空');
    });

    /* ESC 关闭弹窗/分享预览 */
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      closeHistory();
      var overlay = document.getElementById('shareOverlay');
      if (overlay) overlay.classList.remove('show');
    });

    /* --- 生成建议 --- */
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

      setTimeout(function () {
        var out = currentMode === 'night'
          ? getNightAdvice(sleep, hr, steps)
          : getAdvice(sedentary, sleep, hr, steps);

        if (!out) {
          showError(errEl, '没有匹配到规则，请检查输入。');
        } else {
          var vitality = computeVitality(sedentary, sleep, hr, steps);
          var micro = computeMicroAction(sedentary, sleep, currentMode);
          var hydration = computeHydration(steps, sedentary, currentMode);

          /* 模块一：状态诊断 */
          riskBadge.textContent = out.risk;
          riskBadge.className = 'risk-badge risk-' + out.riskLevel;
          activityEl.textContent = out.advice;
          tabooEl.textContent = '⚠️ 绝对禁忌：' + out.taboo;

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
          saveHistory({
            ts: Date.now(),
            mode: currentMode,
            sedentary: sedentary,
            sleep: sleep,
            hr: hr,
            steps: steps,
            vitality: vitality
          });
          updateLastTestLabel();

          /* 新结果出来，旧 AI 建议作废 */
          aiCard.hidden = true;
          aiReply.textContent = '';

          /* 先显示结果区，再在下一帧渲染环形——否则首次生成时元素还是 display:none，
             生长动画会被浏览器直接跳过 */
          result.hidden = false;
          requestAnimationFrame(function () { renderVitality(vitality); });
          result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
    function setAiBusy(busy) {
      aiBtn.disabled = busy;
      aiAskBtn.disabled = busy;
      aiBtn.textContent = busy ? AI_BTN_LOADING : AI_BTN_TEXT;
    }

    function askCoach(payload, waitingText) {
      setAiBusy(true);
      aiCard.hidden = false;
      aiReply.textContent = waitingText || '教练正在阅读你的数据…';

      return fetch(AI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      }).then(function (data) {
        var reply = data && data.reply ? String(data.reply).trim() : '';
        if (!reply) throw new Error('empty reply');
        aiReply.textContent = reply;
      }).catch(function () {
        /* 网络异常、非 2xx、缺 reply 字段，统一友好提示 */
        aiReply.textContent = AI_ERROR_TEXT;
      }).then(function () {
        setAiBusy(false);
      });
    }

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

    aiBtn.addEventListener('click', function () {
      if (!lastOut) {
        showToast('还没有结果，先点“生成今天的建议”');
        return;
      }
      if (aiBtn.disabled) return;
      askCoach({
        userData: buildUserData(),
        baseAdvice: activityEl.textContent
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
        userData: buildUserData(),
        baseAdvice: activityEl.textContent + '\n【我的追问】' + q
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
      var text = '【状态诊断】' + lastOut.risk +
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
        ? '输入久坐、睡眠、心率、步数，按固定规则给出今天最合适的活动安排。'
        : '输入睡眠、心率、步数，按夜班专属规则给出今天的建议。';
      appSub.textContent = mode === 'day'
        ? '专为久坐上班族、学生设计。只需填入今日数据，获取你的专属活动建议。'
        : '专为夜班、倒时差人群设计。只需填入今日数据，获取你的专属活动建议。';
      writeInputs(modeInputs[mode] || {});
      result.hidden = true;
      errEl.hidden = true;
      aiCard.hidden = true; /* 切换模式后旧 AI 建议已不适用 */
    }

    modeSwitchBtn.addEventListener('click', function () {
      setMode(currentMode === 'day' ? 'night' : 'day');
    });

    /* --- 时间驱动的昼夜主题 --- */
    applyThemeByClock();
    setInterval(applyThemeByClock, 10 * 60 * 1000);

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
