

/* ===== LOCATIONS ===== */
function locsPage(){
  const sel=S.filters.locSel||null;
  const stab=S.filters.locTab||'docs';
  // ── Detail view ──
  if(sel){
    const l=DB.locations.find(x=>x.id===sel);
    if(!l){S.filters.locSel=null;return locsPage();}
    // Requirement #6: block opening a city outside the user's city scope.
    {const _mc=myCityScope();if(_mc.length&&!_mc.includes(l.id)){S.filters.locSel=null;toast('You do not have access to this city','warn');return locsPage();}}
    const lCls=DB.checklists.filter(c=>(c.locationIds||[]).includes(l.id));
    const TABS=[['docs',ic('folder','w-4 h-4')+'Documents'],['checklists',ic('check','w-4 h-4')+'Checklists'],['info',ic('info','w-4 h-4')+'Info']];
    return'<div class="fade">'
      +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">'
      +'<button onclick="App._closeLoc()" style="width:34px;height:34px;border-radius:10px;border:1.5px solid #ECEDF0;background:#fff;cursor:pointer;display:grid;place-items:center;color:#6B7280">'+ic('back','w-4 h-4')+'</button>'
      +'<div style="width:36px;height:36px;border-radius:10px;background:#EFF6FF;display:grid;place-items:center">'+ic('pin','w-4 h-4')+'</div>'
      +'<div style="flex:1"><div class="fd" style="font-size:16px;font-weight:800">'+esc(l.name)+'</div>'
      +'<div style="font-size:12px;color:#9CA3AF">'+esc(l.address||'No address')+'</div></div>'
      +chip(l.status||'Active')
      +(can('locations','edit')?'<button onclick="App.editLoc(this.dataset.id)" data-id="'+l.id+'" style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:10px;background:#F6F7F8;color:#374151;font-size:13px;font-weight:600;border:1px solid #ECEDF0;cursor:pointer">'+ic('edit','w-4 h-4')+'Edit</button>':'')
      +(can('locations','edit')?'<button onclick="App.delLoc(this.dataset.id)" data-id="'+l.id+'" style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:10px;background:#FFF1F2;color:#BE123C;font-size:13px;font-weight:600;border:1px solid #FECACA;cursor:pointer">'+ic('trash','w-4 h-4')+'Delete</button>':'')
      +'</div>'
      +'<div class="ui-tabs" style="margin-bottom:16px">'
      +TABS.map(([k,ll])=>'<button class="ui-tab'+(stab===k?' on':'')+'" onclick="App._setLocTab(this.dataset.k)" data-k="'+k+'">'+ll+'</button>').join('')
      +'</div>'
      +(stab==='docs'?_scopeDocsTab('loc',l.id):'')
      +(stab==='checklists'
        ?('<div class="space-y-2">'
          +(lCls.length
            ?lCls.map(c=>'<div style="display:flex;align-items:center;gap:12px;background:#fff;border-radius:14px;border:1px solid #ECEDF0;padding:12px 14px"><div style="width:36px;height:36px;border-radius:10px;background:#F6F7F8;display:grid;place-items:center;flex-shrink:0">'+ic('list','w-4 h-4')+'</div><div style="flex:1"><div style="font-size:14px;font-weight:600">'+esc(c.name)+'</div><div style="font-size:12px;color:#9CA3AF">'+esc(c.frequency)+'</div></div></div>').join('')
            :empty('list','No checklists','No checklists assigned to this location.')
          )+'</div>')
        :'')
      +(stab==='info'
        ?'<div class="bg-white rounded-2xl border border-ink-100 p-5 space-y-3">'
          +[['Name',l.name],['Address',l.address||'—'],['Department',l.department||'All departments'],['Status',l.status||'Active']].map(([k,v])=>'<div><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#9CA3AF;margin-bottom:2px">'+k+'</div><div style="font-size:14px;font-weight:600">'+esc(v)+'</div></div>').join('')
          +'</div>'
        :'')
      +'</div>';
  }
  // ── List view ──
  // Filter locations by user's access if not admin
  // Requirement #6: city scope. If the current user has cities selected, restrict to them (empty = all cities).
  const _myCities=myCityScope();
  const _cityOK=l=>!_myCities.length||_myCities.includes(l.id);
  const visibleLocs=(isAdmin()?DB.locations:DB.locations.filter(l=>{
    const da=(me()?.docAccess)||{};
    return Object.keys(da.locations||{}).includes(l.id);
  })).filter(_cityOK);
  return'<div class="fade">'+hdr('Locations','Physical sites & areas',can('locations','create')?btnP('Add location','App.editLoc()','plus'):'')
    +'<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">'
    +visibleLocs.map(l=>{
      const docs=(DB.documents||[]).filter(x=>x.type==='loc'&&x.scope===l.id).length;
      const folders=(DB.folders||[]).filter(x=>x.type==='loc'&&x.scope===l.id&&!x.parentId).length;
      return'<div onclick="App._openLoc(this.dataset.id)" data-id="'+l.id+'" class="loc-card" style="background:#fff;border-radius:16px;border:1.5px solid #ECEDF0;padding:16px;cursor:pointer;transition:all .15s;display:block;width:100%">'
        +'<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:12px">'
        +'<div style="width:36px;height:36px;border-radius:10px;background:#EFF6FF;display:grid;place-items:center;flex-shrink:0">'+ic('pin','w-4 h-4')+'</div>'
        +'<div style="display:flex;align-items:center;gap:6px">'+chip(l.status||'Active')
        +(can('locations','edit')?'<button onclick="event.stopPropagation();App.editLoc(this.dataset.id)" data-id="'+l.id+'" aria-label="Edit location" title="Edit location" style="width:28px;height:28px;display:grid;place-items:center;border-radius:7px;color:#6B7280;border:1px solid #ECEDF0;background:#fff;cursor:pointer">'+ic('edit','w-3.5 h-3.5')+'</button>':'')
        +(can('locations','edit')?'<button onclick="event.stopPropagation();App.delLoc(this.dataset.id)" data-id="'+l.id+'" aria-label="Delete location" title="Delete location" style="width:28px;height:28px;display:grid;place-items:center;border-radius:7px;color:#BE123C;border:1px solid #FECACA;background:#FFF1F2;cursor:pointer">'+ic('trash','w-3.5 h-3.5')+'</button>':'')
        +'</div></div>'
        +'<div class="fd" style="font-size:15px;font-weight:800;margin-bottom:4px">'+esc(l.name)+'</div>'
        +'<div style="font-size:12px;color:#9CA3AF;margin-bottom:8px">'+esc(l.address||l.department||'')+'</div>'
        +(docs||folders?'<div style="font-size:11px;font-weight:600;color:#3B82F6;margin-bottom:8px">'+folders+' folders · '+docs+' files</div>':'')
        +'<div style="font-size:11px;font-weight:600;color:#6B7280;text-align:right">Open →</div>'
        +'</div>';
    }).join('')
    +(DB.locations.length?'':empty('pin','No locations','Add locations to assign them to checklists.'))
    +'</div></div>';
}
App.editLoc=(id=null)=>{const l=id?locById(id):null;const geo=(DB.hrmConfig?.locationGeo||{})[id||'']||{};const canGeo=can('locations','manage');modalShell({title:`${l?'Edit':'New'} location`,size:'max-w-sm',
  body:`<div style="display:flex;flex-direction:column;gap:14px">${fld('Location name','ln-n',l?.name||'')}${fld('Address','ln-a',l?.address||'')}${selF('Department (optional)','ln-d',[['','All departments'],...DB.departments.map(d=>[d.name,d.name])],l?.department||'')}${selF('Status','ln-s',['Active','Inactive'],l?.status||'Active')}
  ${canGeo?`<div style="background:var(--c-surface-2);border-radius:var(--r-md);padding:14px;display:flex;flex-direction:column;gap:8px"><p style="font-size:10px;font-weight:700;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em">Geofence (clock-in & clock-out)</p>
    ${mkTog('ln-geo',geo.enabled??false,'Require staff to be on-site to clock in and out')}
    <div class="grid grid-cols-3 gap-2">${fld('Latitude','ln-lat',geo.lat??'','number')}${fld('Longitude','ln-lng',geo.lng??'','number')}${fld('Radius (m)','ln-rad',geo.radius??200,'number')}</div>
    <button type="button" onclick="App.useMyLocationLoc()" style="font-size:12px;font-weight:600;color:var(--c-brand);background:none;border:none;cursor:pointer;padding:0">📍 Use my current location</button>
    <p style="font-size:11px;color:var(--c-text-3)">Assign this location to users in their profile. When enabled, an assigned user must be inside the radius to clock in AND clock out (strict). Geofence data stays on this device only.</p>
  </div>`:''}</div>`,
  footer:btnG('Cancel','App.closeModal()')+btnP(l?'Save':'Create',`App.saveLoc('${id||''}')`)});};
App.useMyLocationLoc=()=>{if(!navigator.geolocation){toast('Geolocation unavailable','err');return;}navigator.geolocation.getCurrentPosition(pos=>{const la=$('#ln-lat'),ln=$('#ln-lng');if(la)la.value=pos.coords.latitude;if(ln)ln.value=pos.coords.longitude;toast('Location filled');},()=>toast('Could not get location','err'),{enableHighAccuracy:true,timeout:8000});};
App.saveLoc=(id)=>{const n=$('#ln-n')?.value.trim();if(!n){toast('Name required','err');return;}const data={name:n,address:$('#ln-a')?.value.trim()||'',department:$('#ln-d')?.value||'',status:$('#ln-s')?.value||'Active'};const obj=id?locById(id):{id:uid('loc'),...data};if(id)Object.assign(obj,data);else DB.locations.push(obj);
  // Geofence stored in DB.hrmConfig.locationGeo keyed by location id — NOT part of the `locations` upsert `data`,
  //   but it IS synced separately via the hrm_config.location_geo jsonb column (HR/Admin upsert).
  // Only written when the geofence fields were rendered (user has 'locations','manage'); otherwise existing geo is preserved untouched.
  if($('#ln-rad')){
    DB.hrmConfig=DB.hrmConfig||{};DB.hrmConfig.locationGeo=DB.hrmConfig.locationGeo||{};
    const _lat=$('#ln-lat')?.value,_lng=$('#ln-lng')?.value;
    DB.hrmConfig.locationGeo[obj.id]={enabled:togV('ln-geo'),lat:(_lat!==''&&_lat!=null)?Number(_lat):null,lng:(_lng!==''&&_lng!=null)?Number(_lng):null,radius:Number($('#ln-rad')?.value)||200};
  }
  log(fullName(me()),id?'Edited location':'Created location',n);toast(id?'Updated':'Created');saveDB();closeModal();render();sb.from('locations').upsert({id:obj.id,...data},{onConflict:'id'}).then(({error})=>{if(error)_syncErr('location')(error);}).catch(_syncErr('location'));};
App.delLoc=(id)=>{const l=locById(id);if(!l)return;
// Referential-integrity guard: blocked while people are geofenced to it, checklists use it,
// upcoming shifts happen there, or announcements target it.
if(!guardDelete('location',id,'"'+l.name+'"'))return;
if(!confirm('Delete "'+l.name+'"?'))return;if(!DB.locations_deleted)DB.locations_deleted=[];if(!DB.locations_deleted.includes(id))DB.locations_deleted.push(id);DB.locations=DB.locations.filter(x=>x.id!==id);if(DB.hrmConfig?.locationGeo)delete DB.hrmConfig.locationGeo[id];
// DATA-4: clear the dangling locationId from every user pointing at the deleted location
// (mirrors the dept-clear pattern; u.hrm syncs via the user_hrm table, so cleared ids propagate on next sync).
// M4: _ensureHrm also self-heals a stale locationId on devices that haven't received this clear yet.
DB.users.forEach(u=>{if(u.hrm&&u.hrm.locationId===id)u.hrm.locationId=null;});
saveDB();render();toast('Deleted','warn');sb.from('locations').delete().eq('id',id).then(({error})=>{if(error)console.error('delLoc:',error.message);}).catch(()=>{});};

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window.locsPage=locsPage;
