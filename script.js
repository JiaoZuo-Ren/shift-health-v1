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

  /* ================= 夜班/倒时差规则（独立于久坐规则表） ================= */
  function getNightAdvice(sleep, hr, steps) {
    var hrHigh = hr !== null && hr > 70;
    if (sleep < 5 && hrHigh) {
      return { advice: '建议今天必须优先补觉，白天避光，不安排任何高强度活动。', key: '今天最该做：白天避光补觉，不安排高强度。' };
    }
    if (sleep < 5) {
      return { advice: '睡眠不足5小时，今天优先补觉，白天避光，不安排高强度活动。', key: '今天最该做：补觉，不安排高强度。' };
    }
    if (sleep < 7) {
      if (steps < 3000) {
        return { advice: '建议这是正常现象，不用焦虑，醒后见光10分钟，散步20分钟。', key: '今天最该做：醒后见光10分钟，散步20分钟。' };
      }
      return { advice: '睡眠和活动量都够，保持现状，醒后见光10分钟。', key: '今天最该做：保持节奏，醒后见光10分钟。' };
    }
    return { advice: '说明补觉充足，今天可以正常安排活动，但避免在晚间喝咖啡。', key: '今天最该做：保持正常活动，晚上不喝咖啡。' };
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

  function init() {
    var btn = document.getElementById('generateBtn');
    var result = document.getElementById('result');
    var activityEl = document.getElementById('activityAdvice');
    var keyEl = document.getElementById('keyAdvice');
    var errEl = document.getElementById('formError');
    var vitalityTrack = document.getElementById('vitalityTrack');
    var vitalityFill = document.getElementById('vitalityFill');
    var vitalityScore = document.getElementById('vitalityScore');
    var tabDay = document.getElementById('tabDay');
    var tabNight = document.getElementById('tabNight');
    var fieldSedentary = document.getElementById('fieldSedentary');
    var appDesc = document.getElementById('appDesc');
    var appSub = document.getElementById('appSub');
    var currentMode = 'day';

    btn.addEventListener('click', function () {
      errEl.hidden = true;

      var sedentaryRaw = document.getElementById('sedentary').value.trim();
      var sedentary = parseNum(sedentaryRaw);
      var sleep = parseNum(document.getElementById('sleep').value);
      var hrRaw = document.getElementById('hr').value.trim();
      var steps = parseNum(document.getElementById('steps').value);

      if (currentMode === 'day' && sedentary === null) {
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
          activityEl.textContent = out.advice;
          keyEl.textContent = out.key;
          var vitality = computeVitality(sedentary, sleep, hr, steps);
          vitalityFill.style.width = vitality + '%';
          vitalityScore.textContent = vitality + ' / 100';
          vitalityTrack.setAttribute('aria-valuenow', vitality);
          saveLastTest(sedentary, sleep, hr, steps, vitality, currentMode);
          updateLastTestDisplay();
          result.hidden = false;
          result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        btn.disabled = false;
        btn.classList.remove('is-loading');
        btn.textContent = '生成今天的建议';
      }, 500);
    });

    /* 一键复制：把两段建议复制到剪贴板 */
    document.getElementById('copyBtn').addEventListener('click', function () {
      var advice = activityEl.textContent;
      var key = keyEl.textContent;
      if (!advice && !key) {
        showToast('还没有结果，先点“生成今天的建议”');
        return;
      }
      var text = '【活动建议】' + advice + '\n【今天最该做的一件事】' + key;
      copyText(text).then(
        function () { showToast('已复制'); },
        function () { showToast('复制失败，请手动选中文字复制'); }
      );
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
      tabDay.classList.toggle('is-active', mode === 'day');
      tabDay.setAttribute('aria-selected', mode === 'day');
      tabNight.classList.toggle('is-active', mode === 'night');
      tabNight.setAttribute('aria-selected', mode === 'night');
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
    }

    tabDay.addEventListener('click', function () { setMode('day'); });
    tabNight.addEventListener('click', function () { setMode('night'); });

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
      formatMonthDay: formatMonthDay,
      getLastTestText: getLastTestText,
      RULES: RULES,
      FALLBACK_KEY: FALLBACK_KEY,
      bins: { sedentaryBin: sedentaryBin, sleepBin: sleepBin, stepsBin: stepsBin, hrBin: hrBin }
    };
  }
})();
