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

  /* ================= 规则表（20行，与定稿表一字不差） ================= */
  var RULES = [
    { id: 1,  sedentary: 'gt6',  sleep: 'lt6',   hr: 'high',   steps: 'lt3000',     advice: '今天久坐偏多、活动偏少。不建议直接去跑步，先每坐50分钟站起来2分钟，晚饭后散步15分钟；同时睡眠偏少、心率偏高，今天不适合高强度运动。优先补觉，白天加一次10分钟闭眼休息。', key: '今天最该做：中午闭眼休息10分钟，不安排高强度。' },
    { id: 2,  sedentary: 'gt6',  sleep: 'lt6',   hr: 'high',   steps: '3000to5999', advice: '今天久坐偏多；睡眠偏少、心率偏高，今天不适合高强度运动。优先补觉，白天加一次10分钟闭眼休息，抽空分段走动。', key: '今天最该做：中午闭眼休息10分钟，不安排高强度。' },
    { id: 3,  sedentary: 'gt6',  sleep: 'lt6',   hr: 'high',   steps: 'gte6000',    advice: '久坐多但活动量够；睡眠偏少、心率偏高，今天不适合高强度运动。优先补觉，白天加一次10分钟闭眼休息，注意每坐50分钟站起来一次，别连续坐满两小时。', key: '今天最该做：中午闭眼休息10分钟，不安排高强度。' },
    { id: 4,  sedentary: 'gt6',  sleep: 'lt6',   hr: 'normal', steps: 'lt3000',     advice: '今天久坐偏多、活动偏少。不建议直接去跑步，先每坐50分钟站起来2分钟，晚饭后散步15分钟；睡眠偏少，不要安排剧烈运动。', key: '今天最该做：每50分钟站起来2分钟。' },
    { id: 5,  sedentary: 'gt6',  sleep: 'lt6',   hr: 'normal', steps: '3000to5999', advice: '今天久坐偏多、活动一般，不要安排高强度运动，记得定时起身，有空增加短距离散步。', key: '今天最该做：每50分钟站起来2分钟。' },
    { id: 6,  sedentary: 'gt6',  sleep: 'lt6',   hr: 'normal', steps: 'gte6000',    advice: '久坐多但活动量够，保持。注意每坐50分钟站起来一次，别连续坐满两小时；睡眠偏少，避免剧烈运动。', key: '今天最该做：保持节奏，别连续坐满两小时。' },
    { id: 7,  sedentary: 'gt6',  sleep: '6to7',  hr: 'normal', steps: 'lt3000',     advice: '今天久坐偏多、活动偏少。不建议直接去跑步，先每坐50分钟站起来2分钟，晚饭后散步15分钟；睡眠和心率都在可接受范围，今天可以安排20—30分钟低强度活动。', key: '今天最该做：每50分钟站起来2分钟。' },
    { id: 8,  sedentary: 'gt6',  sleep: '6to7',  hr: 'normal', steps: '3000to5999', advice: '今天久坐偏多，睡眠和心率都在可接受范围，今天可以安排20—30分钟低强度活动，定时起身活动。', key: '今天最该做：每50分钟站起来2分钟。' },
    { id: 9,  sedentary: 'gt6',  sleep: '6to7',  hr: 'normal', steps: 'gte6000',    advice: '久坐多但活动量够，保持。注意每坐50分钟站起来一次，别连续坐满两小时；睡眠和心率都在可接受范围，今天可以安排20—30分钟低强度活动。', key: '今天最该做：保持节奏，别连续坐满两小时。' },
    { id: 10, sedentary: 'gt6',  sleep: 'gte7',  hr: 'normal', steps: 'lt3000',     advice: '今天久坐偏多、活动偏少。不建议直接去跑步，先每坐50分钟站起来2分钟，晚饭后散步15分钟；睡眠够，今天可以正常安排活动，避免连续久坐。', key: '今天最该做：每50分钟站起来2分钟。' },
    { id: 11, sedentary: 'gt6',  sleep: 'gte7',  hr: 'normal', steps: '3000to5999', advice: '今天久坐偏多、活动一般；睡眠够，今天可以正常安排活动，记得定时起身，增加散步。', key: '今天最该做：每50分钟站起来2分钟。' },
    { id: 12, sedentary: 'gt6',  sleep: 'gte7',  hr: 'normal', steps: 'gte6000',    advice: '久坐多但活动量够，保持。注意每坐50分钟站起来一次，别连续坐满两小时；睡眠够，今天可以正常安排活动，避免连续久坐。', key: '今天最该做：保持节奏，别连续坐满两小时。' },
    { id: 13, sedentary: 'lt4',  sleep: 'lt6',   hr: 'high',   steps: 'any',        advice: '今天久坐控制得不错，保持；睡眠偏少、心率偏高，今天不适合高强度运动。优先补觉，白天加一次10分钟闭眼休息。', key: '今天最该做：中午闭眼休息10分钟，不安排高强度。' },
    { id: 14, sedentary: 'lt4',  sleep: 'lt6',   hr: 'normal', steps: 'any',        advice: '今天久坐控制得不错，保持。如果步数够，不用额外加运动；如果步数少，晚饭后散步15分钟。睡眠偏少，避开高强度训练。', key: '今天最该做：每50分钟站起来2分钟。' },
    { id: 15, sedentary: 'lt4',  sleep: '6to7',  hr: 'normal', steps: 'any',        advice: '今天久坐控制得不错，保持。如果步数够，不用额外加运动；如果步数少，晚饭后散步15分钟。睡眠和心率都在可接受范围，今天可以安排20—30分钟低强度活动。', key: '今天最该做：保持节奏，别连续坐满两小时。' },
    { id: 16, sedentary: 'lt4',  sleep: 'gte7',  hr: 'normal', steps: 'any',        advice: '今天久坐控制得不错，保持。如果步数够，不用额外加运动；如果步数少，晚饭后散步15分钟。睡眠够，今天可以正常安排活动，避免连续久坐。', key: '今天最该做：保持节奏，别连续坐满两小时。' },
    { id: 17, sedentary: '4to6', sleep: 'lt6',   hr: 'high',   steps: 'any',        advice: '久坐中等；睡眠偏少、心率偏高，今天不适合高强度运动。优先补觉，白天加一次10分钟闭眼休息，有空分段起身走动。', key: '今天最该做：中午闭眼休息10分钟，不安排高强度。' },
    { id: 18, sedentary: '4to6', sleep: 'lt6',   hr: 'normal', steps: 'any',        advice: '久坐中等，睡眠偏少，不做高强度运动，每隔一小时起身活动几分钟。', key: '今天最该做：每50分钟站起来2分钟。' },
    { id: 19, sedentary: '4to6', sleep: '6to7',  hr: 'normal', steps: 'any',        advice: '久坐中等；睡眠和心率都在可接受范围，今天可以安排20—30分钟低强度活动，记得定时起身。', key: '今天最该做：保持节奏，别连续坐满两小时。' },
    { id: 20, sedentary: '4to6', sleep: 'gte7',  hr: 'normal', steps: 'any',        advice: '久坐中等；睡眠够，今天可以正常安排活动，不要长时间连续坐着。', key: '今天最该做：保持节奏，别连续坐满两小时。' }
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
        return { row: RULES[i].id, advice: RULES[i].advice, key: RULES[i].key, fallback: false };
      }
    }

    /* 兜底：表内没有的组合 → 同久坐、同睡眠、心率正常那行的活动建议 + 固定“今天最该做” */
    for (var j = 0; j < RULES.length; j++) {
      var r = RULES[j];
      if (r.sedentary === sBin && r.sleep === slBin && r.hr === 'normal' && (r.steps === 'any' || r.steps === stBin)) {
        return { row: r.id, advice: r.advice, key: FALLBACK_KEY, fallback: true };
      }
    }

    return null;
  }

  /* ================= 页面逻辑 ================= */
  function parseNum(v) {
    var s = String(v).trim();
    if (s === '') return null;
    var n = Number(s);
    if (isNaN(n) || n < 0) return null;
    return n;
  }

  function init() {
    var btn = document.getElementById('generateBtn');
    var result = document.getElementById('result');
    var activityEl = document.getElementById('activityAdvice');
    var keyEl = document.getElementById('keyAdvice');
    var matchEl = document.getElementById('matchInfo');
    var errEl = document.getElementById('formError');

    btn.addEventListener('click', function () {
      errEl.hidden = true;

      var sedentary = parseNum(document.getElementById('sedentary').value);
      var sleep = parseNum(document.getElementById('sleep').value);
      var hrRaw = document.getElementById('hr').value.trim();
      var steps = parseNum(document.getElementById('steps').value);

      if (sedentary === null) {
        showError(errEl, '请填写久坐时长（小时），填不小于 0 的数字。');
        return;
      }
      if (sleep === null) {
        showError(errEl, '请填写睡眠时长（小时），填不小于 0 的数字。');
        return;
      }
      if (steps === null) {
        showError(errEl, '请填写每日步数，填不小于 0 的数字。');
        return;
      }
      var hr = hrRaw === '' ? null : parseNum(hrRaw);
      if (hrRaw !== '' && hr === null) {
        showError(errEl, '心率请填不小于 0 的数字，不知道就留空。');
        return;
      }

      var out = getAdvice(sedentary, sleep, hr, steps);
      if (!out) {
        showError(errEl, '没有匹配到规则，请检查输入。');
        return;
      }

      activityEl.textContent = out.advice;
      keyEl.textContent = out.key;
      matchEl.textContent = out.fallback
        ? '匹配：兜底规则（同久坐、同睡眠、心率正常行的活动建议 + 固定“今天最该做”）'
        : '匹配：规则表第 ' + out.row + ' 行';
      result.hidden = false;
      result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    document.querySelector('.form-card').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
        btn.click();
      }
    });
  }

  function showError(errEl, msg) {
    errEl.textContent = msg;
    errEl.hidden = false;
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
      RULES: RULES,
      FALLBACK_KEY: FALLBACK_KEY,
      bins: { sedentaryBin: sedentaryBin, sleepBin: sleepBin, stepsBin: stepsBin, hrBin: hrBin }
    };
  }
})();
