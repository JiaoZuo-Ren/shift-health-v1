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

    const userData = String(body.userData || '').slice(0, 500);
    const baseAdvice = String(body.baseAdvice || '').slice(0, 1500);

    if (!userData && !baseAdvice) {
      return json({ error: 'empty input' }, 400, cors);
    }

    const systemPrompt =
      '你是一位专业、耐心、说话接地气的私人健康教练，专注久坐人群和夜班人群的健康管理。';
    const userPrompt =
      '我今天的身体数据：' + userData + '\n\n' +
      '系统按固定规则给出的基础建议：' + baseAdvice + '\n\n' +
      '请基于以上内容给一段补充点评：\n' +
      '1. 用通俗中文口语，像教练当面聊天；\n' +
      '2. 先点评整体状态 2—3 句，再给 2—3 条具体可执行的补充建议（基础建议里说过的不要重复）；\n' +
      '3. 有明显风险要提醒关注，必要时建议就医；\n' +
      '4. 全文 200 字以内，纯文本，不要 Markdown 符号。';

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
