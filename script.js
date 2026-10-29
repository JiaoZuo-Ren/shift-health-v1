/* 今日活动建议 - 纯固定分支判断（无AI、无后端、无数据库） */
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

  /* ================= DeepSeek AI 私教配置（仅本地测试） ================= */
  var DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
  var DEEPSEEK_MODEL = 'deepseek-chat';

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

  /* ================= 最近一次测试（localStorage） ================= */
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

  function saveLastTest(sedentary, sleep, hr, steps, vitality, mode) {
    try {
      var now = new Date();
      var record = {
        date: now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate(),
        mode: mode || 'day',
        sedentary: sedentary,
        sleep: sleep,
        hr: hr,
        steps: steps,
        vitality: vitality
      };
      localStorage.setItem('shiftHealthLastTest', JSON.stringify(record));
    } catch (e) {
      /* localStorage 不可用时静默跳过，不影响主流程 */
    }
  }

  function updateLastTestDisplay() {
    var el = document.getElementById('lastTest');
    if (!el) return;
    var text = null;
    try {
      var raw = localStorage.getItem('shiftHealthLastTest');
      if (raw) {
        text = getLastTestText(JSON.parse(raw));
      }
    } catch (e) {
      text = null;
    }
    if (!text) {
      el.hidden = true;
      return;
    }
    el.textContent = text;
    el.hidden = false;
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

  function init() {
    var btn = document.getElementById('generateBtn');
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
    var vitalityTrack = document.getElementById('vitalityTrack');
    var vitalityFill = document.getElementById('vitalityFill');
    var vitalityScore = document.getElementById('vitalityScore');
    var modeSwitchBtn = document.getElementById('modeSwitchBtn');
    var modeStatus = document.getElementById('modeStatus');
    var fieldSedentary = document.getElementById('fieldSedentary');
    var appDesc = document.getElementById('appDesc');
    var appSub = document.getElementById('appSub');
    var currentMode = 'day';
    var lastOut = null;
    var lastVitality = 0;

    document.getElementById('generateBtn').addEventListener('click', function () {
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

      /* 0.5 秒“分析中…”状态：防止连点，也让结果显得严谨 */
      btn.disabled = true;
      btn.classList.add('is-loading');
      btn.textContent = '分析中…';

      setTimeout(function () {
        var out = currentMode === 'night'
          ? getNightAdvice(sleep, hr, steps)
          : getAdvice(sedentary, sleep, hr, steps);
        if (!out) {
          showError(errEl, '没有匹配到规则，请检查输入。');
        } else {
          riskBadge.textContent = out.risk;
          riskBadge.className = 'risk-badge risk-' + out.riskLevel;
          activityEl.textContent = out.advice;
          hydrationEl.textContent = computeHydration(steps, sedentary, currentMode);
          microEl.textContent = computeMicroAction(sedentary, sleep, currentMode);
          tabooEl.textContent = out.taboo;
          actionEl.textContent = out.action;
          nutritionEl.textContent = out.nutrition;
          keyEl.textContent = out.key;
          var vitality = computeVitality(sedentary, sleep, hr, steps);
          lastOut = out;
          lastVitality = vitality;
          vitalityFill.style.width = vitality + '%';
          vitalityScore.textContent = vitality + ' / 100';
          vitalityTrack.setAttribute('aria-valuenow', vitality);
          saveLastTest(sedentary, sleep, hr, steps, vitality, currentMode);
          updateLastTestDisplay();
          aiCard.hidden = true; /* 重新生成后清掉上一次的 AI 建议 */
          result.hidden = false;
          result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        btn.disabled = false;
        btn.classList.remove('is-loading');
        btn.textContent = '生成今天的建议';
      }, 500);
    });

    /* 一键填入示例数据：填入示例并立即触发生成，降低使用门槛 */
    document.getElementById('demoBtn').addEventListener('click', function () {
      document.getElementById('sedentary').value = '8';
      document.getElementById('sleep').value = '6';
      document.getElementById('hr').value = '75';
      document.getElementById('steps').value = '2500';
      btn.click();
    });

    /* 一键复制：把两段建议复制到剪贴板 */
    document.getElementById('copyBtn').addEventListener('click', function () {
      var advice = activityEl.textContent;
      var key = keyEl.textContent;
      if (!advice && !key) {
        showToast('还没有结果，先点“生成今天的建议”');
        return;
      }
      var text = '【今日状态】' + riskBadge.textContent + '\n【活动建议】' + advice +
        '\n【今日饮水目标】' + hydrationEl.textContent + '\n【微动作建议】' + microEl.textContent +
        '\n【绝对禁忌】' + tabooEl.textContent + '\n【动作处方】' + actionEl.textContent +
        '\n【营养提示】' + nutritionEl.textContent + '\n【今天最该做的一件事】' + key;
      copyText(text).then(
        function () { showToast('已复制'); },
        function () { showToast('复制失败，请手动选中文字复制'); }
      );
    });

    /* ================= AI 私教：把当前数据 + 基础建议发给 DeepSeek ================= */
    var aiBtn = document.getElementById('aiBtn');
    var aiCard = document.getElementById('aiCard');
    var aiContent = document.getElementById('aiContent');

    function setAiLoading(loading) {
      aiBtn.disabled = loading;
      aiBtn.textContent = loading ? '🤖 AI 私教思考中…' : '🤖 听听AI私教怎么说';
    }

    aiBtn.addEventListener('click', function () {
      if (!lastOut) {
        showToast('还没有结果，先点“生成今天的建议”');
        return;
      }
      if (aiBtn.disabled) return;
      if (typeof DEEPSEEK_API_KEY === 'undefined' || !DEEPSEEK_API_KEY) {
        showToast('未配置 API Key，无法使用 AI 私教');
        return;
      }

      /* 1. 提取当前页面上的四项数据与基础建议 */
      var sedentaryVal = document.getElementById('sedentary').value.trim();
      var sleepVal = document.getElementById('sleep').value.trim();
      var hrVal = document.getElementById('hr').value.trim();
      var stepsVal = document.getElementById('steps').value.trim();

      var dataLines = [
        '当前模式：' + (currentMode === 'day' ? '久坐上班族' : '夜班/倒时差'),
        '久坐时长：' + (currentMode === 'night' ? '未填写（夜班模式不统计）' : sedentaryVal + ' 小时'),
        '睡眠时长：' + sleepVal + ' 小时',
        '静息心率：' + (hrVal === '' ? '未填写' : hrVal + ' 次/分钟'),
        '每日步数：' + stepsVal + ' 步',
        '今日活力值：' + lastVitality + ' / 100'
      ];
      var adviceLines = [
        '状态分级：' + riskBadge.textContent,
        '活动建议：' + activityEl.textContent,
        '今日饮水目标：' + hydrationEl.textContent,
        '微动作建议：' + microEl.textContent,
        '绝对禁忌：' + tabooEl.textContent,
        '动作处方：' + actionEl.textContent,
        '营养提示：' + nutritionEl.textContent,
        '今天最该做的一件事：' + keyEl.textContent
      ];

      var userPrompt =
        '我是一名久坐上班族的健康数据翻译工具用户。以下是我今天的身体数据：\n' +
        dataLines.join('\n') +
        '\n\n工具按固定规则给我的基础建议如下：\n' +
        adviceLines.join('\n') +
        '\n\n请你扮演一位专业的私人健康教练，基于以上数据和基础建议，给出一段补充点评：\n' +
        '1. 用通俗的中文口语，像教练当面聊天一样；\n' +
        '2. 先简单点评我的整体状态（2—3 句），再给出 2—3 条具体可执行的补充建议（基础建议里已经说过的内容不要重复）；\n' +
        '3. 如果数据显示有明显风险，请提醒我关注，必要时建议就医；\n' +
        '4. 全文控制在 200 字以内，不要用 Markdown 格式符号，直接输出纯文本。';

      /* 2. 展示加载状态并发起请求 */
      aiCard.hidden = false;
      aiContent.textContent = '正在连接 AI 私教，请稍候…';
      setAiLoading(true);

      fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + DEEPSEEK_API_KEY
        },
        body: JSON.stringify({
          model: DEEPSEEK_MODEL,
          messages: [
            { role: 'system', content: '你是一位专业、耐心、说话接地气的私人健康教练，专注久坐人群和夜班人群的健康管理。' },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7,
          max_tokens: 500
        })
      }).then(function (res) {
        if (!res.ok) {
          /* 按 DeepSeek 常见状态码给出友好提示 */
          if (res.status === 401) throw new Error('API Key 无效或已过期，请检查 script.js 里的 DEEPSEEK_API_KEY。');
          if (res.status === 402) throw new Error('账户余额不足，请到 DeepSeek 平台充值后重试。');
          if (res.status === 429) throw new Error('请求太频繁了，请稍等几秒再试一次。');
          throw new Error('服务返回了错误（状态码 ' + res.status + '），请稍后重试。');
        }
        return res.json();
      }).then(function (data) {
        var reply = data && data.choices && data.choices[0] &&
          data.choices[0].message && data.choices[0].message.content;
        if (!reply) throw new Error('AI 没有返回内容，请重试。');
        aiContent.textContent = reply.trim();
        setAiLoading(false);
      }).catch(function (err) {
        /* 网络异常（fetch 本身 reject）与其余错误统一兜底 */
        var msg = (err && err.message) ? err.message : '网络请求失败，请检查网络连接后重试。';
        aiContent.textContent = '⚠️ 不好意思，AI 私教暂时联系不上：' + msg;
        setAiLoading(false);
      });
    });

    /* 生成今日数据卡片：弹出预览 → 截图下载 PNG → 手动关闭 */
    var shareOverlay = document.getElementById('shareOverlay');
    var shareCard = document.getElementById('shareCard');
    document.getElementById('shareBtn').addEventListener('click', function () {
      if (!lastOut) {
        showToast('还没有结果，先点“生成今天的建议”');
        return;
      }
      if (typeof html2canvas === 'undefined') {
        showToast('分享功能需要联网加载，请检查网络后重试');
        return;
      }
      if (shareOverlay.classList.contains('show')) return;
      var shareBtn = document.getElementById('shareBtn');
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

      /* 先让卡片显示在屏幕上再截图：离屏元素 html2canvas 会截失败 */
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

    /* 预览卡片：点 × 或点空白处关闭 */
    document.getElementById('shareClose').addEventListener('click', function () {
      shareOverlay.classList.remove('show');
    });
    shareOverlay.addEventListener('click', function (e) {
      if (e.target === shareOverlay) shareOverlay.classList.remove('show');
    });

    document.querySelector('.form-card').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
        btn.click();
      }
    });

    /* 人群模式切换：输入框与判断逻辑联动，两个模式各自独立记忆输入 */
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
      aiCard.hidden = true; /* 切换模式后旧 AI 建议已不适用，一并隐藏 */
    }

    document.getElementById('modeSwitchBtn').addEventListener('click', function () {
      setMode(currentMode === 'day' ? 'night' : 'day');
    });

    /* 暗黑模式：右上角按钮切换，localStorage 记住选择 */
    var savedTheme = null;
    try { savedTheme = localStorage.getItem('shiftHealthTheme'); } catch (e) {}
    document.documentElement.setAttribute('data-theme', savedTheme === 'dark' ? 'dark' : 'light');
    document.getElementById('themeToggle').addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('shiftHealthTheme', next); } catch (e) {}
    });

    /* 页面加载时显示最近一次测试记录 */
    updateLastTestDisplay();
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
    }, 1600);
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
      RULES: RULES,
      FALLBACK: FALLBACK,
      FALLBACK_KEY: FALLBACK_KEY,
      validateInputs: validateInputs,
      bins: { sedentaryBin: sedentaryBin, sleepBin: sleepBin, stepsBin: stepsBin, hrBin: hrBin }
    };
  }
})();
