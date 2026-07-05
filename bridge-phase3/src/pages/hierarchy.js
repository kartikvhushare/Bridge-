
/* ===== HIERARCHY ===== */
/* §9 — Org chart as a real top-down tree (pure HTML/CSS connector lines, no libraries).
   Scope: Super Admin / everyone-scope sees the whole org (roots = users with no manager);
   everyone else sees their own subtree (root = me) via scopeOf('hierarchy'). Built from managerId
   (reuses subTree for scope membership). Branches expand/collapse via COLL; "Center on me" scrolls. */
function hierarchyPage(){
  if(!can('hierarchy','view'))return`<div class="fade">${hdr('Hierarchy','Reporting structure')}${empty('tree','Not available','You don\'t have access to the org chart.')}</div>`;
  const sc=scopeOf('hierarchy');
  let roots;
  // UI-3: a user is a root when they have no manager OR their managerId points to a deleted/missing
  // user (dangling pointer). Without this, such users are neither a root nor any node's child and
  // vanish from the chart entirely. (_orgNode's _seen cycle guard still handles A→B→A loops.)
  if(sc==='everyone'){roots=DB.users.filter(u=>!u.managerId||!uById(u.managerId));}
  else{roots=[me()].filter(Boolean);}
  const wide=sc==='everyone';
  const title=wide?'Organisation':'My Team';
  return`<div class="fade">${hdr(title,'Reporting structure — who reports to whom',btnG('Center on me','App._orgCenter()','search'))}
  <div style="background:var(--c-surface);border-radius:var(--r-lg);border:1px solid var(--c-border);box-shadow:var(--sh-sm);padding:16px">
    <div id="org-scroll" class="org-scroll" style="max-height:72vh">
      <div style="min-width:max-content;padding:8px 20px 20px;margin:0 auto">
        <ul class="org-tree org-tree-root" style="justify-content:center">${(()=>{const _seenTop=new Set();const nodes=roots.map(r=>_orgNode(r,_seenTop)).join('');return nodes||empty('tree','No reporting structure yet','Assign managers to build the org chart.');})()}</ul>
      </div>
    </div>
  </div></div>`;
}
App._orgCenter=()=>{
  // UI-4: my node is only in the DOM if every ancestor branch is expanded. Walk up the manager
  // chain and clear COLL[ancestorId] for each ancestor, re-render, THEN scroll to the node.
  const u=me();
  if(u){let cur=u.managerId,guard=new Set([u.id]);while(cur&&!guard.has(cur)){guard.add(cur);if(COLL[cur])COLL[cur]=false;const m=uById(cur);cur=m?m.managerId:null;}rr();}
  const scrollToMe=()=>{const el=document.getElementById('node-'+S.uid);const sc=document.getElementById('org-scroll');if(el&&sc&&el.scrollIntoView){el.scrollIntoView({behavior:'smooth',block:'center',inline:'center'});el.animate?el.animate([{boxShadow:'0 0 0 0 rgba(14,159,110,.5)'},{boxShadow:'0 0 0 6px rgba(14,159,110,0)'}],{duration:900}):0;}else toast('Your card isn\'t in the current view','err');};
  if(window.requestAnimationFrame)requestAnimationFrame(scrollToMe);else scrollToMe();
};
// One node card + (optionally) its children row. Card shows avatar, name, position, role badge.
function _orgNode(u,_seen=new Set()){
  if(!u||_seen.has(u.id))return'';
  _seen.add(u.id);
  const kids=DB.users.filter(x=>x.managerId===u.id&&x.id!==u.id&&!_seen.has(x.id));
  const col=COLL[u.id];
  const isMe=u.id===S.uid;
  const badge=u.role==='Admin'?`<span style="font-size:9px;font-weight:700;padding:1px 5px;border-radius:4px;background:var(--c-ink);color:#fff">SUPER ADMIN</span>`:u.role==='SubAdmin'?`<span style="font-size:9px;font-weight:700;padding:1px 5px;border-radius:4px;background:var(--c-info-soft);color:var(--c-info-ink)">ADMIN</span>`:'';
  const card=`<div id="node-${u.id}" class="org-card" style="display:flex;flex-direction:column;align-items:center;gap:6px;background:${isMe?'var(--c-brand-soft)':'var(--c-surface)'};border:1px solid ${isMe?'var(--c-brand)':'var(--c-border)'};border-radius:var(--r-md);padding:10px 14px 12px;min-width:148px;max-width:200px;box-shadow:var(--sh-sm)">
    ${avatar(u,'w-11 h-11','text-sm')}
    <div style="text-align:center;min-width:0">
      <div style="font-size:14px;font-weight:600;color:var(--c-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:172px">${esc(fullName(u))}</div>
      <div style="font-size:11px;color:var(--c-text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:172px">${esc(u.position||'—')}${u.department?' · '+esc(u.department):''}</div>
      ${badge?`<div style="margin-top:3px">${badge}</div>`:''}
    </div>
    ${kids.length?`<button type="button" onclick="COLL['${u.id}']=!COLL['${u.id}'];rr()" style="margin-top:2px;display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;color:var(--c-brand-ink);background:var(--c-brand-soft);border:none;border-radius:99px;padding:3px 10px;cursor:pointer">${ic(col?'chevR':'chevD','w-3 h-3')}${kids.length} report${kids.length!==1?'s':''}</button>`:''}
  </div>`;
  const childRow=(kids.length&&!col)?`<div class="org-children"><ul class="org-tree">${kids.map(k=>_orgNode(k,_seen)).join('')}</ul></div>`:'';
  return`<li class="${kids.length&&!col?'org-parent':''}">${card}${childRow}</li>`;
}

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window.hierarchyPage=hierarchyPage;window._orgNode=_orgNode;
