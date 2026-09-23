import { MODEL_STAGES } from "./rules.js";

export function page() {
  const stageOptions = MODEL_STAGES.map(s => "<option>" + s + "</option>").join("");
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>古船模型拆装许可与索具更换追踪</title>
  <style>
    :root { --bg:#f1f3ef; --panel:#fff; --ink:#20241f; --muted:#687066; --line:#d4ddd0; --accent:#526f43; --warn:#9b4937; }
    * { box-sizing:border-box; } body { margin:0; background:var(--bg); color:var(--ink); font-family:Arial,"PingFang SC",sans-serif; }
    header { padding:22px 28px; background:#fff; border-bottom:1px solid var(--line); display:flex; justify-content:space-between; gap:16px; align-items:center; }
    h1 { margin:0; font-size:26px; } h2 { margin:0 0 12px; font-size:18px; } h3 { margin:14px 0 8px; font-size:16px; } h4 { margin:8px 0 6px; font-size:14px; }
    main { display:grid; grid-template-columns:380px 1fr; gap:22px; padding:22px 28px; }
    form,.panel,.card,.stat { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:16px; }
    label { display:block; margin:10px 0 5px; color:var(--muted); font-size:13px; }
    input,select,textarea { width:100%; border:1px solid var(--line); border-radius:6px; padding:9px; font:inherit; background:#fff; }
    button { border:0; border-radius:6px; background:var(--accent); color:#fff; padding:10px 13px; font-weight:700; cursor:pointer; }
    button.secondary { background:#69736a; }
    .stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(110px,1fr)); gap:10px; margin-bottom:14px; }
    .stat strong { display:block; font-size:24px; } .stat.ord { background:#f4f7f3; }
    .toolbar { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:14px; } .toolbar select,.toolbar input { width:auto; min-width:160px; }
    .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:12px; }
    .grid2 { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:6px; margin:8px 0; }
    .card { display:grid; gap:8px; align-content:start; }
    .meta { color:var(--muted); font-size:13px; }
    .pill { display:inline-block; border:1px solid var(--line); border-radius:999px; padding:3px 8px; font-size:12px; }
    .pill.ok { background:#e6f0e2; color:#3c5a34; border-color:#bfd4b6; }
    .pill.bad { background:#f6e4df; color:#8a3b2a; border-color:#e3c2b8; }
    .logs { border-top:1px solid var(--line); padding-top:8px; max-height:110px; overflow:auto; }
    .warn { color:var(--warn); font-weight:700; }
    .row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; } .spread { justify-content:space-between; }
    .order { border:1px dashed var(--line); border-radius:8px; padding:12px; margin:10px 0; }
    .inline { display:grid; gap:8px; margin:10px 0; padding:12px; }
    #msg { margin:14px 28px 0; padding:10px 14px; border-radius:6px; display:none; }
    #msg.show { display:block; } #msg.ok { background:#e6f0e2; color:#3c5a34; } #msg.err { background:#f6e4df; color:#8a3b2a; }
    #detailPanel { margin-bottom:14px; }
    @media (max-width:900px){ header{display:block;padding:18px 16px;} main{grid-template-columns:1fr;padding:16px;} }
  </style>
</head>
<body>
  <header><div><h1>古船模型拆装许可与索具更换追踪</h1><div class="meta">拆装单许可 · 索具更换 · 返修复核 · 交付资格</div></div><button id="reload">刷新</button></header>
  <div id="msg"></div>
  <main>
    <section>
      <form id="createForm"><h2>新增模型</h2><div id="fields"></div><label>初始状态</label><select name="status">${stageOptions}</select><button>保存模型</button></form>
      <form id="orderForm" style="margin-top:14px"><h2>开立拆装单</h2>
        <label>选择模型</label><select name="id" id="itemSelect"></select>
        <label>目标索位 *</label><input name="targetPosition" required>
        <label>替代卷号 *</label><input name="spoolNo" required>
        <label>监护人 *</label><input name="supervisor" required>
        <label>拆装人</label><input name="operator" placeholder="默认为模型负责人">
        <label>拆装时间</label><input name="scheduledAt" type="datetime-local">
        <label>索具批次</label><input name="riggingBatch" placeholder="如 B-2026-09">
        <label>计划索径</label><input name="planDiameter" placeholder="如 0.8mm">
        <label>计划绕向</label><select name="planWinding"><option value="">未指定</option><option>右绕</option><option>左绕</option></select>
        <label>计划张力</label><input name="planTension" placeholder="如 12N">
        <button>开立拆装单</button>
        <div class="meta">每个模型同时只能有一张未完结拆装单；卷号被其他模型占用或缺少任一项将返回 409 且不写记录。</div>
      </form>
    </section>
    <section>
      <div class="stats" id="stats"></div>
      <div class="toolbar"><select id="statusFilter"><option value="">全部状态</option>${stageOptions}</select><input id="search" placeholder="搜索编号或关键词"></div>
      <div class="panel" id="detailPanel" style="display:none"></div>
      <div class="panel"><h2>模型列表</h2><div class="grid" id="cards"></div></div>
    </section>
  </main>
  <script>
    const fields = [["code","模型编号","text"],["shipType","船型","text"],["scale","比例","text"],["mastCount","桅杆数量","number"],["riggingMaterial","帆索材料","text"],["owner","负责人","text"],["dueDate","交付日期","date"]];
    const stages = ${JSON.stringify(MODEL_STAGES)};
    const createForm = document.querySelector('#createForm');
    const orderForm = document.querySelector('#orderForm');
    const cards = document.querySelector('#cards');
    const statsEl = document.querySelector('#stats');
    const itemSelect = document.querySelector('#itemSelect');
    const detailPanel = document.querySelector('#detailPanel');
    const msgEl = document.querySelector('#msg');
    let items = [];
    let stats = { models: {}, orders: {} };
    let currentId = null;
    let detail = null;
    function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    async function api(path, options) {
      const res = await fetch(path, options && options.body ? Object.assign({}, options, { headers: { 'Content-Type': 'application/json' } }) : options);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || '请求失败');
      return data;
    }
    function showMsg(text, isErr) {
      msgEl.textContent = text || '';
      msgEl.className = text ? (isErr ? 'err show' : 'ok show') : '';
    }
    async function run(fn) { try { await fn(); } catch (e) { showMsg(e.message, true); } }
    function renderFields() {
      document.querySelector('#fields').innerHTML = fields.map(function (f) {
        return '<label>' + f[1] + '</label><input name="' + f[0] + '" type="' + f[2] + '" ' + (f[0] === 'code' ? 'required' : '') + '>';
      }).join('');
    }
    function keyOf(item) { return item.id || item.code; }
    function render() {
      itemSelect.innerHTML = items.map(function (item) { return '<option value="' + esc(keyOf(item)) + '">' + esc(item.code || item.id) + ' · ' + esc(item.shipType || '') + '</option>'; }).join('');
      const ms = Object.entries(stats.models || {}).map(function (kv) { return '<div class="stat"><span>' + esc(kv[0]) + '</span><strong>' + kv[1] + '</strong></div>'; }).join('');
      const os = Object.entries(stats.orders || {}).map(function (kv) { return '<div class="stat ord"><span>拆装单·' + esc(kv[0]) + '</span><strong>' + kv[1] + '</strong></div>'; }).join('');
      statsEl.innerHTML = ms + os;
      const status = document.querySelector('#statusFilter').value;
      const q = document.querySelector('#search').value.trim();
      const visible = items.filter(function (item) { return (!status || item.status === status) && (!q || JSON.stringify(item).indexOf(q) >= 0); });
      cards.innerHTML = visible.map(cardHtml).join('') || '<div class="meta">暂无模型</div>';
      bindCards();
    }
    function cardHtml(item) {
      const main = fields.slice(0, 4).map(function (f) { return '<div><b>' + f[1] + '</b> ' + esc(item[f[0]] == null ? '' : item[f[0]]) + '</div>'; }).join('');
      const elig = item.deliveryEligible ? '<span class="pill ok">可交付</span>' : '<span class="pill bad">交付暂停</span>';
      const active = item.activeOrder
        ? '<div class="meta">拆装单 ' + esc(item.activeOrder.id) + ' · ' + esc(item.activeOrder.status) + ' · ' + esc(item.activeOrder.targetPosition) + ' · 卷号 ' + esc(item.activeOrder.spoolNo) + '</div>'
        : '<div class="meta">暂无未完结拆装单</div>';
      const logs = (item.logs || []).slice(-4).map(function (l) { return '<div>' + esc(l.step) + '：' + esc(l.note) + '</div>'; }).join('');
      return '<article class="card"><h3>' + esc(item.code || item.id) + '</h3>' +
        '<div><span class="pill">' + esc(item.status) + '</span> ' + elig + '</div>' + main + active +
        '<label>状态</label><select data-status="' + esc(keyOf(item)) + '">' + stages.map(function (s) { return '<option ' + (s === item.status ? 'selected' : '') + '>' + s + '</option>'; }).join('') + '</select>' +
        '<div class="row"><button data-detail="' + esc(keyOf(item)) + '">详情</button><button class="secondary" data-note="' + esc(keyOf(item)) + '">追加备注</button></div>' +
        '<div class="logs meta">' + (logs || '暂无记录') + '</div></article>';
    }
    function bindCards() {
      document.querySelectorAll('[data-status]').forEach(function (sel) {
        sel.onchange = function () {
          run(async function () {
            try { await api('/api/items/' + encodeURIComponent(sel.dataset.status), { method: 'PATCH', body: JSON.stringify({ status: sel.value }) }); showMsg('状态已更新'); }
            catch (e) { showMsg(e.message, true); }
            await load();
          });
        };
      });
      document.querySelectorAll('[data-note]').forEach(function (btn) {
        btn.onclick = function () {
          run(async function () {
            const note = prompt('记录备注');
            if (note) { await api('/api/items/' + encodeURIComponent(btn.dataset.note) + '/logs', { method: 'POST', body: JSON.stringify({ step: '备注', note: note }) }); await load(); }
          });
        };
      });
      document.querySelectorAll('[data-detail]').forEach(function (btn) {
        btn.onclick = function () {
          run(async function () {
            currentId = btn.dataset.detail;
            detail = await api('/api/items/' + encodeURIComponent(currentId));
            renderDetail();
            detailPanel.scrollIntoView({ behavior: 'smooth' });
          });
        };
      });
    }
    function planText(o) {
      const p = o.plan || {};
      const parts = [];
      if (p.diameter) parts.push('索径 ' + p.diameter);
      if (p.winding) parts.push('绕向 ' + p.winding);
      if (p.tension) parts.push('张力 ' + p.tension);
      return parts.length ? parts.join(' · ') : '未设置计划值';
    }
    function orderHtml(o) {
      let h = '<div class="order"><div class="row spread"><h4>拆装单 ' + esc(o.id) + '</h4><span class="pill">' + esc(o.status) + '</span></div>';
      h += '<div class="grid2">' +
        '<div><b>目标索位</b> ' + esc(o.targetPosition) + '</div>' +
        '<div><b>替代卷号</b> ' + esc(o.spoolNo) + '</div>' +
        '<div><b>索具批次</b> ' + esc(o.riggingBatch || '—') + '</div>' +
        '<div><b>拆装时间</b> ' + esc(o.scheduledAt || '—') + '</div>' +
        '<div><b>拆装人</b> ' + esc(o.operator) + '</div>' +
        '<div><b>监护人</b> ' + esc(o.supervisor) + '</div></div>';
      h += '<div class="meta">计划：' + esc(planText(o)) + '</div>';
      if (o.completion) {
        h += '<div class="meta">完工：原索径 ' + esc(o.completion.originalDiameter) + ' · 实际索径 ' + esc(o.completion.actualDiameter) + ' · 绕向 ' + esc(o.completion.winding) + ' · 张力 ' + esc(o.completion.tension) +
          (o.completion.nonConform && o.completion.nonConform.length ? ' · <span class="warn">不符：' + esc(o.completion.nonConform.join('、')) + '</span>' : ' · 全部相符') + '</div>';
      }
      if (o.rework) h += '<div class="meta">返修人 ' + esc(o.rework.reworker) + (o.rework.doneAt ? ' · 已提交复核' : ' · 返修中') + '</div>';
      if (o.review) h += '<div class="meta">复核人 ' + esc(o.review.reviewer) + ' · ' + (o.review.pass ? '合格' : '不合格') + (o.review.note ? ' · ' + esc(o.review.note) : '') + '</div>';
      (o.history || []).forEach(function (x) {
        h += '<div class="meta">⏪ ' + esc(x.invalidatedAt) + ' 因「' + esc(x.reason) + '」未交付结论失效（原状态 ' + esc(x.previousStatus) + '），旧记录保留可查</div>';
      });
      if (o.status === '进行中') h += completeFormHtml(o);
      if (o.status === '返修中') h += '<div class="row"><button data-done="' + esc(o.id) + '">返修完成，提交复核</button></div>';
      if (o.status === '待复核') h += reviewFormHtml(o);
      h += adjustFormHtml(o);
      const logs = (o.logs || []).map(function (l) { return '<div>' + esc(l.at) + ' ' + esc(l.step) + '：' + esc(l.note) + '</div>'; }).join('');
      h += '<div class="logs meta">' + (logs || '暂无记录') + '</div></div>';
      return h;
    }
    function completeFormHtml(o) {
      const p = o.plan || {};
      return '<form data-complete="' + esc(o.id) + '" class="inline"><h4>完工登记</h4>' +
        '<input name="originalDiameter" placeholder="原索径 *" required>' +
        '<input name="actualDiameter" placeholder="实际索径 *（计划 ' + esc(p.diameter || '—') + '）" required>' +
        '<select name="winding"><option value="">绕向 *</option><option>右绕</option><option>左绕</option></select>' +
        '<input name="tension" placeholder="张力 *（计划 ' + esc(p.tension || '—') + '）" required>' +
        '<input name="reworker" placeholder="返修人（有不符项时必填，且不能与拆装人相同）">' +
        '<button>完工登记</button></form>';
    }
    function reviewFormHtml(o) {
      return '<form data-review="' + esc(o.id) + '" class="inline"><h4>复核</h4>' +
        '<input name="reviewer" placeholder="复核人（须为未参与本单人员）" required>' +
        '<select name="pass"><option value="true">合格</option><option value="false">不合格</option></select>' +
        '<input name="note" placeholder="复核备注"><button>提交复核</button></form>';
    }
    function adjustFormHtml(o) {
      return '<form data-adjust="' + esc(o.id) + '" class="inline"><h4>批次 / 拆装时间调整</h4>' +
        '<input name="riggingBatch" value="' + esc(o.riggingBatch || '') + '" placeholder="索具批次">' +
        '<input name="scheduledAt" type="datetime-local" value="' + esc(o.scheduledAt || '') + '">' +
        '<button>保存调整</button>' +
        '<div class="meta">更换索具批次或修改拆装时间会使未交付结论失效重算，旧单仍可查。</div></form>';
    }
    function renderDetail() {
      if (!detail) { detailPanel.style.display = 'none'; detailPanel.innerHTML = ''; return; }
      detailPanel.style.display = '';
      const d = detail;
      let h = '<div class="row spread"><h2>模型详情 · ' + esc(d.code || d.id) + '</h2><button class="secondary" id="closeDetail" type="button">关闭</button></div>';
      h += '<div class="grid2">' + fields.map(function (f) { return '<div><b>' + f[1] + '</b> ' + esc(d[f[0]] == null ? '' : d[f[0]]) + '</div>'; }).join('') + '</div>';
      h += '<div class="row"><span class="pill">' + esc(d.status) + '</span>' +
        (d.deliveryEligible ? '<span class="pill ok">交付资格：可交付</span>' : '<span class="pill bad">交付资格：暂停</span>') +
        '<span class="pill">锁定索位：' + (d.lockedPositions && d.lockedPositions.length ? d.lockedPositions.map(esc).join('、') : '无') + '</span></div>';
      h += '<h3>拆装单（含历史，共 ' + (d.orders ? d.orders.length : 0) + ' 张）</h3>';
      h += d.orders && d.orders.length ? d.orders.map(orderHtml).join('') : '<div class="meta">暂无拆装单</div>';
      h += '<form id="taskForm" class="inline"><h4>新增帆索任务</h4><input name="position" placeholder="索具位置"><input name="tension" placeholder="松紧状态"><input name="note" placeholder="调整备注"><button>提交记录</button></form>';
      const logs = (d.logs || []).slice(-8).map(function (l) { return '<div>' + esc(l.at) + ' ' + esc(l.step) + '：' + esc(l.note) + '</div>'; }).join('');
      h += '<h3>模型记录</h3><div class="logs meta">' + (logs || '暂无记录') + '</div>';
      detailPanel.innerHTML = h;
      bindDetail();
    }
    function bindDetail() {
      document.querySelector('#closeDetail').onclick = function () { currentId = null; detail = null; renderDetail(); };
      document.querySelectorAll('[data-complete]').forEach(function (f) {
        f.onsubmit = function (e) {
          e.preventDefault();
          run(async function () {
            const r = await api('/api/orders/' + encodeURIComponent(f.dataset.complete) + '/complete', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(f).entries())) });
            showMsg(r.outcome === '合格' ? '完工合格，已释放原索位' : '存在不符项，已转返修');
            await load();
          });
        };
      });
      document.querySelectorAll('[data-done]').forEach(function (btn) {
        btn.onclick = function () {
          run(async function () { await api('/api/orders/' + encodeURIComponent(btn.dataset.done) + '/rework-done', { method: 'POST', body: '{}' }); showMsg('已提交复核'); await load(); });
        };
      });
      document.querySelectorAll('[data-review]').forEach(function (f) {
        f.onsubmit = function (e) {
          e.preventDefault();
          run(async function () {
            const r = await api('/api/orders/' + encodeURIComponent(f.dataset.review) + '/review', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(f).entries())) });
            showMsg(r.outcome === '合格' ? '复核合格，交付资格已恢复' : '复核不合格，已退回返修');
            await load();
          });
        };
      });
      document.querySelectorAll('[data-adjust]').forEach(function (f) {
        f.onsubmit = function (e) {
          e.preventDefault();
          run(async function () {
            const r = await api('/api/orders/' + encodeURIComponent(f.dataset.adjust), { method: 'PATCH', body: JSON.stringify(Object.fromEntries(new FormData(f).entries())) });
            showMsg(r.invalidated ? '已调整，未交付结论失效重算' : '已保存调整');
            await load();
          });
        };
      });
      const taskForm = document.querySelector('#taskForm');
      if (taskForm) taskForm.onsubmit = function (e) {
        e.preventDefault();
        run(async function () {
          await api('/api/items/' + encodeURIComponent(currentId) + '/action', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(taskForm).entries())) });
          showMsg('帆索任务已记录');
          await load();
        });
      };
    }
    async function load() {
      const results = await Promise.all([api('/api/items'), api('/api/stats')]);
      items = results[0];
      stats = results[1];
      render();
      if (currentId) {
        try { detail = await api('/api/items/' + encodeURIComponent(currentId)); }
        catch (e) { detail = null; currentId = null; }
        renderDetail();
      }
    }
    createForm.onsubmit = function (e) {
      e.preventDefault();
      run(async function () {
        await api('/api/items', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(createForm).entries())) });
        createForm.reset();
        showMsg('模型已保存');
        await load();
      });
    };
    orderForm.onsubmit = function (e) {
      e.preventDefault();
      run(async function () {
        const data = Object.fromEntries(new FormData(orderForm).entries());
        const id = data.id;
        delete data.id;
        await api('/api/items/' + encodeURIComponent(id) + '/orders', { method: 'POST', body: JSON.stringify(data) });
        orderForm.reset();
        showMsg('拆装单已开立');
        await load();
      });
    };
    document.querySelector('#statusFilter').onchange = render;
    document.querySelector('#search').oninput = render;
    document.querySelector('#reload').onclick = function () { run(async function () { await load(); showMsg('已刷新，列表与详情一致'); }); };
    renderFields();
    load();
  </script>
</body>
</html>`;
}
