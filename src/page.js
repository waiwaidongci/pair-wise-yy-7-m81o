// 页面渲染模块：拆装许可与索具更换追踪台的前端界面。
export function page() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>古船模型拆装许可与索具更换追踪台</title>
  <style>
    :root { --bg:#eef1ea; --panel:#fff; --ink:#20241f; --muted:#687066; --line:#d4ddd0; --accent:#526f43; --warn:#9b4937; --info:#3d5f7a; }
    * { box-sizing:border-box; } body { margin:0; background:var(--bg); color:var(--ink); font-family:Arial,"PingFang SC",sans-serif; }
    header { padding:22px 28px; background:#fff; border-bottom:1px solid var(--line); display:flex; justify-content:space-between; gap:16px; align-items:center; }
    h1 { margin:0; font-size:24px; } h2 { margin:0 0 12px; font-size:17px; } h3 { margin:0; font-size:16px; }
    main { display:grid; grid-template-columns:360px 1fr; gap:22px; padding:22px 28px; }
    form,.panel,.card,.stat,.permit-box { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:16px; }
    form + form { margin-top:14px; }
    label { display:block; margin:10px 0 5px; color:var(--muted); font-size:13px; } input,select,textarea { width:100%; border:1px solid var(--line); border-radius:6px; padding:9px; font:inherit; background:#fff; }
    button { border:0; border-radius:6px; background:var(--accent); color:#fff; padding:9px 13px; font-weight:700; cursor:pointer; } button.secondary { background:#69736a; } button.info { background:var(--info); } button.danger { background:var(--warn); } button.row { width:100%; margin-top:8px; }
    .btnrow { display:flex; gap:8px; flex-wrap:wrap; margin-top:8px; } .btnrow button { flex:1; padding:8px 6px; font-size:13px; }
    .stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(108px,1fr)); gap:10px; margin-bottom:14px; } .stat strong { display:block; font-size:22px; } .stat span { font-size:12px; color:var(--muted); }
    .toolbar { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:14px; } .toolbar select,.toolbar input { width:auto; min-width:150px; }
    .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(310px,1fr)); gap:12px; }
    .card { display:grid; gap:6px; } .meta { color:var(--muted); font-size:13px; }
    .pill { display:inline-block; border:1px solid var(--line); border-radius:999px; padding:3px 9px; font-size:12px; margin:2px 4px 2px 0; }
    .pill.ok { background:#e6efe0; border-color:#b7cda8; color:#3c5a2c; } .pill.bad { background:#f6e4df; border-color:#d9b0a5; color:var(--warn); } .pill.hold { background:#e5ecf2; border-color:#aebfce; color:var(--info); }
    .logs { border-top:1px solid var(--line); padding-top:8px; max-height:96px; overflow:auto; font-size:12px; } .warn { color:var(--warn); font-weight:700; } .ok-text { color:var(--accent); font-weight:700; }
    .permit-box { padding:10px; margin-top:8px; background:#f8faf6; }
    .modal-mask { position:fixed; inset:0; background:rgba(25,30,22,.45); display:none; align-items:flex-start; justify-content:center; padding:40px 16px; overflow:auto; z-index:20; }
    .modal-mask.show { display:flex; } .modal { background:#fff; border-radius:10px; border:1px solid var(--line); width:min(640px,100%); padding:20px; }
    .modal-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
    .kv { display:grid; grid-template-columns:130px 1fr; gap:4px 10px; font-size:14px; } .kv dt { color:var(--muted); } .kv dd { margin:0; }
    .err { color:var(--warn); font-weight:700; font-size:13px; margin-top:8px; white-space:pre-wrap; }
    table { border-collapse:collapse; width:100%; font-size:13px; } td,th { border:1px solid var(--line); padding:5px 8px; text-align:left; }
    @media (max-width:900px){ header{display:block;padding:18px 16px;} main{grid-template-columns:1fr;padding:16px;} }
  </style>
</head>
<body>
  <header>
    <div><h1>古船模型拆装许可与索具更换追踪台</h1><div class="meta">拆桅许可 · 卷号索位占用 · 完工判定 · 返修与独立复核 · 交付资格</div></div>
    <button id="reload">刷新</button>
  </header>
  <main>
    <section>
      <form id="createForm"><h2>新增模型</h2><div id="fields"></div><label>初始状态</label><select name="status" id="newStatus"></select><button class="row">保存模型</button></form>
      <form id="permitForm"><h2>签发拆装单（拆桅前）</h2><div id="permitFields"></div><button class="row">签发许可</button></form>
    </section>
    <section>
      <div class="stats" id="stats"></div>
      <div class="toolbar">
        <select id="statusFilter"><option value="">全部模型状态</option></select>
        <select id="permitFilter"><option value="">全部拆装状态</option></select>
        <input id="search" placeholder="搜索编号 / 卷号 / 索位 / 人员">
      </div>
      <div class="panel">
        <h2>每个模型同时只能有一张拆装单；复核合格后才释放索位并恢复交付资格。</h2>
        <div class="grid" id="cards"></div>
      </div>
    </section>
  </main>
  <div class="modal-mask" id="modalMask"><div class="modal" id="modalBox"></div></div>
  <script>
    const fields = [["code","模型编号","text"],["shipType","船型","text"],["scale","比例","text"],["mastCount","桅杆数量","number"],["riggingMaterial","帆索材料","text"],["owner","负责人","text"],["dueDate","交付日期","date"]];
    const itemStages = ["待检查","校准中","待复核","已交付"];
    const permitStages = ["待拆桅","待复核","返修中","已完工"];
    let items = [], permits = [], specs = [], statData = {};
    const $ = sel => document.querySelector(sel);
    const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","'":"&#39;"}[c]));
    async function api(path, options) {
      const res = await fetch(path, options && options.body ? { ...options, headers:{ "Content-Type":"application/json" } } : options);
      const data = await res.json();
      if (!res.ok) throw Object.assign(new Error((data.error||"请求失败") + (data.details ? "\\n" + JSON.stringify(data.details) : "")), { data });
      return data;
    }
    function specOf(pos) { return specs.find(s => s.position === pos); }
    function renderForms() {
      $("#fields").innerHTML = fields.map(([key,label,type]) => '<label>'+label+'</label><input name="'+key+'" type="'+type+'" '+(key==="code"?"required":"")+'>').join("");
      $("#newStatus").innerHTML = itemStages.map(s => "<option>"+s+"</option>").join("");
      $("#permitFields").innerHTML =
        '<label>选择模型</label><select name="itemCode" id="permitItem"></select>' +
        '<label>目标索位 *</label><select name="targetPosition" id="targetPos"></select>' +
        '<label>该索位标准（索径/绕向/张力）</label><input id="specHint" readonly>' +
        '<label>替代卷号 *</label><input name="reelNo" placeholder="如 R-2026-07">' +
        '<label>索具批次</label><input name="batchNo" placeholder="如 B-14">' +
        '<label>监护人 *</label><input name="guardian">' +
        '<label>拆装人 *</label><input name="worker">' +
        '<label>拆装时间</label><input name="disassembleAt" type="datetime-local">';
      $("#targetPos").onchange = () => { const s = specOf($("#targetPos").value); $("#specHint").value = s ? (s.diameter+" / "+s.lay+" / "+s.tension) : ""; };
    }
    function render() {
      $("#permitItem").innerHTML = items.map(i => '<option value="'+esc(i.code)+'">'+esc(i.code)+' · '+esc(i.shipType)+'</option>').join("");
      $("#targetPos").innerHTML = specs.map(s => '<option>'+esc(s.position)+'</option>').join("");
      $("#targetPos").dispatchEvent(new Event("change"));
      $("#statusFilter").options.length = 1; itemStages.forEach(s => $("#statusFilter").add(new Option(s, s)));
      $("#permitFilter").options.length = 1; permitStages.forEach(s => $("#permitFilter").add(new Option(s, s)));
      const s0 = $("#statusFilter").value, s1 = $("#permitFilter").value, q = $("#search").value.trim();
      const visible = items.filter(i => (!s0 || i.status === s0) && (!s1 || (permits.find(p => p.id === i.activePermitId)||{}).status === s1) && (!q || JSON.stringify(i).includes(q) || JSON.stringify(permits.filter(p=>p.itemCode===i.code)).includes(q)));
      renderStats();
      $("#cards").innerHTML = visible.map(cardHtml).join("");
      bindCards();
    }
    function renderStats() {
      const cells = [["模型总数", statData.totalItems], ["可交付", statData.deliveryEligible], ["占用卷号", statData.occupiedReels], ["占用索位", statData.occupiedPositions]];
      for (const s of permitStages) cells.push([s, statData.permits?.[s] ?? 0]);
      $("#stats").innerHTML = cells.map(([k,v]) => '<div class="stat"><span>'+k+'</span><strong>'+(v??0)+'</strong></div>').join("");
    }
    function statusPill(p) {
      if (!p) return '<span class="pill ok">无在执行单</span>';
      const cls = p.status === "已完工" ? "ok" : (p.status === "返修中" ? "bad" : "hold");
      return '<span class="pill '+cls+'">拆装单 '+esc(p.id)+' · '+esc(p.status)+(p.conclusion ? " · "+esc(p.conclusion) : "")+'</span>';
    }
    function cardHtml(item) {
      const p = permits.find(x => x.id === item.activePermitId);
      const main = [["shipType","船型"],["scale","比例"],["mastCount","桅杆"],["riggingMaterial","帆索材料"],["owner","负责人"],["dueDate","交付日期"]]
        .map(([k,l]) => '<div class="meta">'+l+'：'+esc(item[k])+'</div>').join("");
      const deliver = item.deliveryEligible ? '<span class="ok-text">交付资格：正常</span>' : '<span class="warn">交付资格：暂停（有未完工拆装单）</span>';
      let permitBlock = "";
      if (p) {
        const s = specOf(p.targetPosition) || {};
        permitBlock = '<div class="permit-box"><b>在执行拆装单</b>' +
          '<div class="meta">索位：'+esc(p.targetPosition)+'（标准 '+esc(s.diameter)+'/'+esc(s.lay)+'/'+esc(s.tension)+'）</div>' +
          '<div class="meta">替代卷号：'+esc(p.reelNo)+'　批次：'+esc(p.batchNo||"—")+'　拆装人：'+esc(p.worker)+'　监护人：'+esc(p.guardian)+'</div>' +
          '<div class="meta">版本 v'+p.version+'　拆装时间：'+esc(p.disassembleAt)+'</div>' +
          actionsFor(p) +
          (p.conclusion ? '<div class="meta">当前结论：<b>'+esc(p.conclusion)+'</b></div>' : "") +
          '</div>';
      }
      const logs = (item.logs || []).slice(-4).map(l => '<div>'+esc(l.step)+'：'+esc(l.note)+'</div>').join("");
      return '<article class="card"><h3>'+esc(item.code)+'</h3><div>'+statusPill(p)+'<span class="pill">模型：'+esc(item.status)+'</span></div>' +
        main + deliver + permitBlock +
        '<div class="btnrow"><button class="info" data-detail="'+esc(item.code)+'">模型详情 / 旧单</button><button class="secondary" data-note="'+esc(item.code)+'">追加备注</button></div>' +
        '<div class="logs meta">'+(logs || "暂无记录")+'</div></article>';
    }
    function actionsFor(p) {
      const btns = [];
      if (p.status === "待拆桅") btns.push('<button data-act="complete" data-id="'+esc(p.id)+'">完工登记</button>');
      if (p.status === "返修中") btns.push('<button data-act="rework" data-id="'+esc(p.id)+'">返修登记</button>');
      if (p.status === "待复核") btns.push('<button data-act="review" data-id="'+esc(p.id)+'">复核</button>');
      if (p.status !== "已完工") btns.push('<button class="secondary" data-act="edit" data-id="'+esc(p.id)+'">改批次/时间</button>');
      return '<div class="btnrow">'+btns.join("")+'</div>';
    }
    function bindCards() {
      document.querySelectorAll("[data-detail]").forEach(b => b.onclick = () => openDetail(b.dataset.detail));
      document.querySelectorAll("[data-note]").forEach(b => b.onclick = async () => {
        const note = prompt("记录备注"); if (note === null) return;
        try { await api("/api/items/"+encodeURIComponent(b.dataset.note)+"/logs", { method:"POST", body: JSON.stringify({ step:"备注", note }) }); await load(); } catch(e){ alert(e.message); }
      });
      document.querySelectorAll("[data-act]").forEach(b => b.onclick = () => openAction(b.dataset.act, b.dataset.id));
    }
    function modal(title, body) {
      $("#modalBox").innerHTML = '<div class="modal-head"><h3>'+esc(title)+'</h3><button class="secondary" id="modalClose">关闭</button></div>'+body;
      $("#modalMask").classList.add("show");
      $("#modalClose").onclick = closeModal;
    }
    function closeModal() { $("#modalMask").classList.remove("show"); }
    $("#modalMask").onclick = e => { if (e.target.id === "modalMask") closeModal(); };
    function formHtml(fieldsHtml, submitLabel) {
      return '<form id="actForm">'+fieldsHtml+'<button class="row" style="margin-top:12px">'+esc(submitLabel)+'</button><div class="err" id="actErr"></div></form>';
    }
    const inp = (name,label,type="text",val="") => '<label>'+esc(label)+'</label><input name="'+name+'" type="'+type+'" value="'+esc(val)+'">';
    async function openAction(act, id) {
      const p = permits.find(x => x.id === id);
      const s = specOf(p.targetPosition) || {};
      if (act === "complete") {
        modal("完工登记 · "+id, formHtml(
          inp("originalDiameter","原索径（标准 "+s.diameter+"）","text",s.diameter)+
          inp("actualDiameter","实际索径","text",s.diameter)+
          '<label>实际绕向</label><select name="lay"><option>S捻</option><option>Z捻</option></select>'+
          '<label>实际张力</label><select name="tension"><option>中等</option><option>偏紧</option><option>偏松</option></select>'+
          inp("by","登记人（默认拆装人 "+p.worker+"）")+
          inp("note","备注"), "提交完工判定"));
        $("#actForm").onsubmit = async e => { e.preventDefault(); await submit("/api/permits/"+encodeURIComponent(id)+"/complete"); };
      } else if (act === "rework") {
        modal("返修登记 · "+id, formHtml(
          '<div class="meta warn">返修人不能与拆装人（'+esc(p.worker)+'）相同</div>'+
          inp("by","返修人")+inp("note","返修内容"), "提交返修"));
        $("#actForm").onsubmit = async e => { e.preventDefault(); await submit("/api/permits/"+encodeURIComponent(id)+"/rework"); };
      } else if (act === "review") {
        modal("复核 · "+id, formHtml(
          '<div class="meta">复核人须未参与本单（拆装/监护/返修/已复核均不可）</div>'+
          inp("by","复核人")+
          '<label>复核结论</label><select name="pass"><option value="true">合格：释放索位、恢复交付资格</option><option value="false">不合格：退回返修</option></select>'+
          inp("note","复核意见"), "提交复核"));
        $("#actForm").onsubmit = async e => { e.preventDefault();
          const fd = new FormData($("#actForm"));
          const body = Object.fromEntries(fd.entries()); body.pass = body.pass === "true";
          await submit("/api/permits/"+encodeURIComponent(id)+"/review", body);
        };
      } else if (act === "edit") {
        modal("更换批次 / 修改拆装时间 · "+id, formHtml(
          '<div class="meta warn">未交付结论将立即失效并重算，旧版本仍可在详情中查阅。</div>'+
          inp("batchNo","新索具批次（留空表示改为未登记）","text",p.batchNo||"")+
          inp("disassembleAt","新拆装时间","datetime-local",p.disassembleAt && p.disassembleAt.includes("T") ? p.disassembleAt.slice(0,16) : "")+
          inp("by","修改人"), "提交修改"));
        $("#actForm").onsubmit = async e => { e.preventDefault(); await submit("/api/permits/"+encodeURIComponent(id)); };
      }
    }
    async function submit(url, override) {
      try {
        const body = override || Object.fromEntries(new FormData($("#actForm")).entries());
        await api(url, { method: /\\/review|\\/rework|\\/complete/.test(url) ? "POST" : "PATCH", body: JSON.stringify(body) });
        closeModal(); await load();
      } catch (e) { $("#actErr").textContent = e.message; }
    }
    function kv(k,v) { return "<dt>"+esc(k)+"</dt><dd>"+v+"</dd>"; }
    function openDetail(code) {
      const item = items.find(i => i.code === code);
      const ps = permits.filter(p => p.itemCode === code);
      const head = '<dl class="kv">' +
        kv("编号", esc(item.code)) + kv("船型/比例", esc(item.shipType)+" / "+esc(item.scale)) +
        kv("帆索/负责人", esc(item.riggingMaterial)+" / "+esc(item.owner)) +
        kv("交付日期/状态", esc(item.dueDate)+" · "+esc(item.status)) +
        kv("交付资格", item.deliveryEligible ? '<span class="ok-text">正常</span>' : '<span class="warn">暂停</span>') +
        kv("占用索位", (item.occupiedPositions||[]).map(esc).join("、") || "—") + "</dl>";
      const rows = ps.map(p => {
        const c = p.completion;
        const hist = (p.history||[]).map(h => '<tr><td>v'+h.version+'</td><td>'+esc(h.reason)+'</td><td>'+esc(h.at)+'</td><td>'+esc(h.snapshot.status)+(h.snapshot.conclusion?" / "+esc(h.snapshot.conclusion):"")+'</td></tr>').join("");
        return '<div class="permit-box"><b>'+esc(p.id)+'</b>（v'+p.version+' · '+esc(p.status)+' · '+esc(p.conclusion||"暂无结论")+'）' +
          '<dl class="kv" style="margin-top:6px">' +
          kv("目标索位", esc(p.targetPosition)) + kv("替代卷号 / 批次", esc(p.reelNo)+" / "+esc(p.batchNo||"—")) +
          kv("拆装人 / 监护人", esc(p.worker)+" / "+esc(p.guardian)) + kv("拆装时间", esc(p.disassembleAt)) +
          kv("完工登记", c ? (esc(c.originalDiameter)+"→"+esc(c.actualDiameter)+"，"+esc(c.lay)+"，"+esc(c.tension)+"，登记人 "+esc(c.by)) : "—") +
          kv("返修记录", (p.reworks||[]).map(r=>esc(r.at)+" "+esc(r.by)+" "+esc(r.note)).join("<br>") || "—") +
          kv("复核记录", (p.reviews||[]).map(r=>esc(r.at)+" "+esc(r.by)+(r.pass?" 合格":" 不合格")+" "+esc(r.note)).join("<br>") || "—") +
          kv("索位释放", p.releasedAt ? esc(p.releasedAt)+" 已释放" : "未释放") +
          "</dl>" +
          ((p.history||[]).length ? '<table><tr><th>版本</th><th>失效原因</th><th>时间</th><th>旧状态/结论</th></tr>'+hist+'</table>' : "") +
          '<details style="margin-top:6px"><summary class="meta">事件流水（'+p.events.length+'）</summary>' +
            p.events.map(e=>'<div class="meta">'+esc(e.at)+' '+esc(e.type)+' '+esc(e.by)+'：'+esc(e.note)+'</div>').join("") +
          '</details></div>';
      }).join("") || '<div class="meta">暂无拆装单</div>';
      const logs = '<details><summary class="meta" style="margin-top:8px">模型日志（'+(item.logs||[]).length+'）</summary>' +
        (item.logs||[]).map(l=>'<div class="meta">'+esc(l.at)+' '+esc(l.step)+'：'+esc(l.note)+'</div>').join("") + '</details>';
      modal("模型详情 · "+esc(code), head + '<h3 style="margin:12px 0 6px">拆装单（含旧单与历史版本）</h3>' + rows + logs);
    }
    async function load() {
      [items, permits, specs, statData] = await Promise.all([api("/api/items"), api("/api/permits"), api("/api/specs"), api("/api/stats")]);
      render();
    }
    $("#createForm").onsubmit = async e => { e.preventDefault();
      try { await api("/api/items", { method:"POST", body: JSON.stringify(Object.fromEntries(new FormData($("#createForm")).entries())) }); $("#createForm").reset(); renderForms(); await load(); }
      catch(err){ alert(err.message); }
    };
    $("#permitForm").onsubmit = async e => { e.preventDefault();
      try { await api("/api/permits", { method:"POST", body: JSON.stringify(Object.fromEntries(new FormData($("#permitForm")).entries())) }); $("#permitForm").reset(); await load(); alert("拆装单已签发"); }
      catch(err){ alert(err.message); }
    };
    $("#statusFilter").onchange = render; $("#permitFilter").onchange = render; $("#search").oninput = render; $("#reload").onclick = load;
    renderForms(); load();
  </script>
</body>
</html>`;
}
