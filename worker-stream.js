/**
 * 流式版 Cloudflare Worker —— 替换你现有的 Worker 代码即可
 *
 * 作用：把 DeepSeek 的 SSE 流转成「纯文本流」返回给网页，
 *      网页收到一个字就显示一个字，手机上不用干等 20 秒。
 *
 * 部署步骤：
 * 1. Cloudflare 控制台 → Workers & Pages → 你的 Worker → 编辑代码
 * 2. 全选删掉旧代码，把本文件内容粘进去 → Deploy
 * 3. 变量名对不上就改下面标了【改这里】的那一行（见文末说明）
 */

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    };

    /* 跨域预检 */
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    /* 预热用的 GET，直接回个 200，不消耗模型额度 */
    if (request.method !== 'POST') {
      return new Response('ok', { status: 200, headers: cors });
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return json({ error: 'invalid json' }, 400, cors);
    }

    const userData = String(body.userData || '').slice(0, 900);
    const baseAdvice = String(body.baseAdvice || '').slice(0, 1500);
    /* 前端传过来的红黄绿灯判定（老版本前端没有这个字段，兜底为未判定） */
    const status = String(body.status || '未判定').slice(0, 60);

    if (!userData && !baseAdvice) {
      return json({ error: 'empty input' }, 400, cors);
    }

    const systemPrompt =
      '你是一位专业的健康教练，说话像朋友一样自然，既会严格也会鼓励。' +
      '严禁给出任何医疗诊断、疾病判断或用药建议。';

    /* 因果逻辑：昨日数据是「因」，今日安排是「果」；
       新版前端还会带上【近 N 天档案】和【趋势信号】，用于宏观评价 */
    const userPrompt =
      '用户昨日的健康账单是：' + userData + '；系统判定：' + status + '。\n' +
      '系统给出的基础建议是：' + baseAdvice + '。\n\n' +
      '请先看账单里的【近 N 天档案】和【趋势信号】，务必结合过去几天的趋势给出宏观评价：\n' +
      '① 如果他连续熬夜（连续 2 天以上睡眠不足 6 小时），用严厉但关心的语气警告他，' +
      '把代价说透（白天注意力、代谢、心血管负担），不要轻飘飘带过；\n' +
      '② 如果这周在进步（睡眠变长、久坐减少、步数变多、活力值上升），大力夸奖他，明确指出进步在哪；\n' +
      '③ 如果档案不足 2 天或看不出趋势，就只聚焦今天该怎么调整，不要硬编趋势。\n' +
      '最后给出今天最主要的一条具体行动。\n' +
      '总字数不超过 180 字，语气像朋友，严禁医疗诊断。纯文本，不要 Markdown 符号。';

    let upstream;
    try {
      upstream = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          /* 【改这里】变量名要和你 Worker 里设置的一致。
             如果你原来是直接写死的字符串，就把这一行换成：
             'Authorization': 'Bearer sk-你的Key',
             但强烈建议改用环境变量。 */
          'Authorization': 'Bearer ' + env.DEEPSEEK_API_KEY
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7,
          max_tokens: 400,
          stream: true
        })
      });
    } catch (e) {
      return json({ error: 'upstream fetch failed', detail: String(e) }, 502, cors);
    }

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '');
      return json({ error: 'upstream ' + upstream.status, detail: detail.slice(0, 300) }, 502, cors);
    }

    /* 把 SSE（data: {...}）逐行解析成纯文本，再以流的形式吐给网页 */
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    (async () => {
      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const raw of lines) {
            const line = raw.trim();
            if (!line.startsWith('data:')) continue;

            const payload = line.slice(5).trim();
            if (!payload || payload === '[DONE]') continue;

            try {
              const parsed = JSON.parse(payload);
              const delta =
                parsed.choices &&
                parsed.choices[0] &&
                parsed.choices[0].delta &&
                parsed.choices[0].delta.content;
              if (delta) await writer.write(encoder.encode(delta));
            } catch (e) {
              /* 单个分片解析失败就跳过，不影响整体输出 */
            }
          }
        }
      } catch (e) {
        /* 上游中途断开：已经输出的部分保留 */
      } finally {
        try { await writer.close(); } catch (e) {}
      }
    })();

    return new Response(readable, {
      status: 200,
      headers: {
        ...cors,
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Accel-Buffering': 'no'   /* 关键：防止中间层缓冲，否则流会被攒成一次性返回 */
      }
    });
  }
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' }
  });
}
