

/* ════════ §7 — PERSONAL DOCUMENTS ON PROFILES (frontend-only) ════════
   Metadata on u.hrm.personalDocs (rides on u.hrm → never synced). Base64 bytes held in
   memory for the session only and STRIPPED in saveDB → durable storage is a backend
   connection point (content lost on reload until backend exists). Max 3MB/file. */
const PERSONAL_DOC_MAX=3*1024*1024;
// Render the Documents area for target user `u`. Honors documentsPersonal scope/actions.
function _personalDocsSection(u){
  if(!u)return'';
  const isSelf=u.id===S.uid;
  // scope: self-edits always allowed (own profile); viewing others requires scope.
  if(!isSelf&&!scopeFilter('documentsPersonal')(u.id))return'';
  if(!can('documentsPersonal','view'))return'';
  _ensureHrm(u);
  const docs=(u.hrm.personalDocs||[]).slice().sort((a,b)=>(b.uploadedAt||'').localeCompare(a.uploadedAt||''));
  const canUpload=can('documentsPersonal','create');
  const canDl=can('documentsPersonal','download');
  const canDel=can('documentsPersonal','delete');
  const rows=docs.length?docs.map(d=>{
    const ext=(d.name.split('.').pop()||'').toLowerCase();
    const icon=_fileIcon(ext);
    const gone=!d.dataUrl; // bytes stripped on reload → metadata-only
    return'<div style="display:flex;align-items:center;gap:10px;background:#F6F7F8;border-radius:10px;padding:10px">'
      +'<span style="display:grid;place-items:center;color:#6B7280;flex-shrink:0">'+icon+'</span>'
      +'<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">'+esc(d.name)+'</div>'
      +'<div style="font-size:11px;color:#9CA3AF">'+esc((d.type||'file').split('/').pop()||'file')+' · '+_fmtSize(d.size)+' · '+fmtD((d.uploadedAt||'').slice(0,10))+(gone?' · <span style="color:#B45309">not on this device</span>':'')+'</div></div>'
      +'<input type="date" title="Expiry date (visa / passport / contract) — reminders fire ahead of it" value="'+esc(d.expiry||'')+'" onchange="App._pdExpiry(\''+u.id+'\',\''+d.id+'\',this.value)" style="font-size:11px;border:1px solid '+((d.expiry&&d.expiry<todayISO())?'#FCA5A5':'#E5E7EB')+';border-radius:8px;padding:4px 6px;background:#fff;color:'+((d.expiry&&d.expiry<todayISO())?'#DC2626':'#374151')+';flex-shrink:0"/>'
      +(canDl&&!gone?'<button type="button" onclick="App._openPersonalDoc(\''+u.id+'\',\''+d.id+'\')" style="padding:5px 10px;border-radius:8px;border:1px solid #E5E7EB;background:#fff;font-size:12px;font-weight:600;cursor:pointer">Open</button>':'')
      +(canDel?'<button type="button" onclick="App._delPersonalDoc(\''+u.id+'\',\''+d.id+'\')" style="width:28px;height:28px;display:grid;place-items:center;border-radius:8px;border:none;background:#FEF2F2;color:#DC2626;cursor:pointer;flex-shrink:0">'+ic('trash','w-3.5 h-3.5')+'</button>':'')
      +'</div>';
  }).join(''):'<p style="font-size:12px;color:#9CA3AF;text-align:center;padding:10px">No documents yet.</p>';
  return'<div style="border-top:1px solid #ECEDF0;margin-top:14px;padding-top:14px">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">'
    +'<p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#9CA3AF">Documents</p>'
    +(canUpload?'<label style="font-size:12px;font-weight:600;color:#0E7A4F;cursor:pointer">+ Upload<input type="file" style="display:none" onchange="App._uploadPersonalDoc(\''+u.id+'\',this)"></label>':'')
    +'</div>'
    +'<div style="display:flex;flex-direction:column;gap:6px">'+rows+'</div>'
    +'<p style="font-size:10px;color:#B8B5AC;margin-top:8px">Files under 3MB are held for this session. Durable storage connects when the backend is added — content may be lost on reload until then.</p>'
    +'</div>';
}
App._uploadPersonalDoc=(userId,input)=>{
  const u=uById(userId);if(!u)return;
  const isSelf=userId===S.uid;
  if(!can('documentsPersonal','create')||(!isSelf&&!scopeFilter('documentsPersonal')(userId))){toast('Not allowed','err');return;}
  const file=(input.files||[])[0];if(!file)return;
  if(file.size>PERSONAL_DOC_MAX){toast('File too large — max 3MB','err');input.value='';return;}
  const reader=new FileReader();
  reader.onload=()=>{
    _ensureHrm(u);
    u.hrm.personalDocs.push({id:uid('pd'),name:file.name,type:file.type||'',size:file.size,uploadedAt:new Date().toISOString(),uploadedBy:S.uid,dataUrl:reader.result});
    saveDB();
    toast('Uploaded');
    // Re-render the open user-edit modal (or profile page) in place.
    if(document.getElementById('u-role'))App.editUser(userId);else rr();
  };
  reader.onerror=()=>toast('Could not read file','err');
  reader.readAsDataURL(file);
};
App._openPersonalDoc=(userId,docId)=>{
  const u=uById(userId);if(!u)return;
  if(!can('documentsPersonal','download')){toast('Not allowed','err');return;}
  const d=(u.hrm?.personalDocs||[]).find(x=>x.id===docId);
  if(!d||!d.dataUrl){toast('File not available on this device','warn');return;}
  if((d.type||'').startsWith('image/')){App._bigImg(d.dataUrl);return;}
  const w=window.open();
  if(w){if((d.type||'')==='application/pdf'||d.dataUrl.startsWith('data:application/pdf')){w.document.write('<iframe src="'+d.dataUrl+'" style="border:0;width:100%;height:100%"></iframe>');}else{const a=w.document.createElement('a');a.href=d.dataUrl;a.download=d.name;w.document.body.appendChild(a);a.click();}}
  else toast('Allow pop-ups to open the file','warn');
};
App._delPersonalDoc=(userId,docId)=>{
  const u=uById(userId);if(!u)return;
  const isSelf=userId===S.uid;
  if(!can('documentsPersonal','delete')||(!isSelf&&!scopeFilter('documentsPersonal')(userId))){toast('Not allowed','err');return;}
  if(!confirm('Delete this document?'))return;
  u.hrm.personalDocs=(u.hrm.personalDocs||[]).filter(x=>x.id!==docId);
  saveDB();toast('Deleted');
  if(document.getElementById('u-role'))App.editUser(userId);else rr();
};


function _fmtSize(b){if(!b)return'';if(b<1024)return b+'B';if(b<1048576)return Math.round(b/1024)+'KB';return(b/1048576).toFixed(1)+'MB';}

App._docNav=(id)=>{S.filters.docFolder=id;rr();};  // alias kept for compatibility

App._delFolder=(id)=>{
  const f=(DB.folders||[]).find(x=>x.id===id);
  if(!f)return;
  // Referential-integrity guard: a folder with sub-folders or files can't be deleted (no cascade).
  if(!guardDelete('folder',id,'folder "'+f.name+'"'))return;
  if(!confirm('Delete folder "'+f.name+'"?'))return;
  // Collect all folder IDs (recursive) and doc IDs BEFORE modifying DB
  const toDelete=[];
  function collectRec(fid){toDelete.push(fid);(DB.folders||[]).filter(x=>x.parentId===fid).forEach(c=>collectRec(c.id));}
  collectRec(id);
  const docIds=(DB.documents||[]).filter(x=>toDelete.includes(x.folderId)).map(x=>x.id);
  // Track deleted IDs (tombstones) so a Supabase refresh can never resurrect them.
  if(!DB.folders_deleted)DB.folders_deleted=[];
  if(!DB.documents_deleted)DB.documents_deleted=[];
  toDelete.forEach(fid=>{if(!DB.folders_deleted.includes(fid))DB.folders_deleted.push(fid);});
  // Tombstone every contained document too — otherwise an orphaned doc reappears on reload
  // because _applyDocuments only filters by documents_deleted (the folder gate is gone).
  docIds.forEach(d=>{if(!DB.documents_deleted.includes(d))DB.documents_deleted.push(d);});
  DB.folders=(DB.folders||[]).filter(x=>!toDelete.includes(x.id));
  DB.documents=(DB.documents||[]).filter(x=>!toDelete.includes(x.folderId||''));
  log(fullName(me()),'Deleted folder',f.name);
  toast('Deleted','warn');saveDB();render();
  // Sync to Supabase in background
  const delOps=toDelete.map(fid=>sb.from('doc_folders').delete().eq('id',fid).then(({error})=>{if(error)console.error('delFolder sync:',error.message);}));
  if(docIds.length)delOps.push(sb.from('documents').delete().in('id',docIds).then(({error})=>{if(error)console.error('delDoc sync:',error.message);}));
  Promise.all(delOps).catch(e=>console.error('delFolder:',e));
};

// ── Upload file ──
App._uploadDoc=()=>{
  const scopeTab=S.filters.docScope||'dept';
  // Read scope key from the right filter key based on scope tab
  const scopeKey=S.filters.docScopeKey||(scopeTab==='dept'?S.filters.docDeptKey:S.filters.docLocKey)||null;
  const folderId=S.filters.docFolder||null;
  if(!scopeKey){toast('Select a department or location first','warn');return;}
  modalShell({title:'Upload file',size:'max-w-md',
    body:'<div id="ud-dropzone" style="border:2px dashed var(--c-border);border-radius:var(--r-lg);padding:32px;text-align:center;cursor:pointer;transition:all .2s;margin-bottom:14px" onclick="document.getElementById(\'ud-file\').click()" ondragover="event.preventDefault();this.style.borderColor=\'var(--c-brand)\';this.style.background=\'var(--c-brand-soft)\'" ondragleave="this.style.borderColor=\'var(--c-border)\';this.style.background=\'transparent\'" ondrop="App._handleFileDrop(event)">'
    +'<div style="display:flex;justify-content:center;margin-bottom:8px;color:var(--c-text-3)">'+ic('paperclip','w-8 h-8')+'</div>'
    +'<div style="font-size:14px;font-weight:600;color:var(--c-text)">Click to browse or drag & drop</div>'
    +'<div style="font-size:12px;color:var(--c-text-3);margin-top:4px">PDF, Word, Excel, PowerPoint, Images — max 50MB</div>'
    +'<input type="file" id="ud-file" style="display:none" onchange="App._previewUpload(this)" multiple>'
    +'</div>'
    +'<div id="ud-preview" style="display:none;margin-bottom:14px"></div>'
    +'<div id="ud-progress" style="display:none;margin-bottom:14px">'
    +'<div style="font-size:13px;font-weight:600;color:var(--c-text);margin-bottom:6px">Uploading…</div>'
    +'<div style="height:6px;background:var(--c-surface-2);border-radius:3px;overflow:hidden"><div id="ud-bar" style="height:100%;background:var(--c-brand);border-radius:3px;width:0%;transition:width .3s"></div></div>'
    +'</div>'
    +'<label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--c-text);cursor:pointer"><input type="checkbox" id="ud-approval" style="width:16px;height:16px;cursor:pointer"> Require approval before this file is official</label>',
    footer:'<button type="button" id="ud-btn" onclick="App._doUpload()" class="ui-btn ui-btn-primary" style="width:100%;display:none">Upload</button>'});
  App._pendingFiles=null;
};

App._handleFileDrop=(e)=>{
  e.preventDefault();
  document.getElementById('ud-dropzone').style.borderColor='var(--c-border)';
  document.getElementById('ud-dropzone').style.background='transparent';
  App._previewUpload({files:e.dataTransfer.files});
};

App._previewUpload=(input)=>{
  const files=Array.from(input.files||[]);if(!files.length)return;
  App._pendingFiles=files;
  const preview=document.getElementById('ud-preview');
  const btn=document.getElementById('ud-btn');
  if(preview){
    preview.style.display='block';
    preview.innerHTML='<div style="display:flex;flex-direction:column;gap:6px">'+files.map(f=>{
      const ext=(f.name.split('.').pop()||'').toLowerCase();
      const icon=_fileIcon(ext);
      return'<div style="display:flex;align-items:center;gap:10px;background:var(--c-surface-2);border-radius:10px;padding:10px">'
        +'<span style="display:grid;place-items:center;color:var(--c-text-3);flex-shrink:0">'+icon+'</span>'
        +'<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">'+esc(f.name)+'</div>'
        +'<div style="font-size:11px;color:var(--c-text-3)">'+_fmtSize(f.size)+'</div></div>'
        +'</div>';
    }).join('')+'</div>';
  }
  if(btn)btn.style.display='block';
};

App._doUpload=async()=>{
  const files=App._pendingFiles;if(!files?.length){toast('Select a file','err');return;}
  const btn=document.getElementById('ud-btn');
  const prog=document.getElementById('ud-progress');
  const bar=document.getElementById('ud-bar');
  if(btn)btn.style.display='none';
  if(prog)prog.style.display='block';
  const scopeTab=S.filters.docScope||'dept';
  const scopeKey=S.filters.docScopeKey;
  const folderId=S.filters.docFolder||null;
  const needsAppr=document.getElementById('ud-approval')?.checked;
  let done=0;
  const _flagged=[];
  for(const file of files){
    const path=scopeTab+'/'+scopeKey+'/'+(folderId||'root')+'/'+Date.now()+'_'+file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
    const{data,error}=await sb.storage.from('hr-docs').upload(path,file,{cacheControl:'3600',upsert:false});
    if(error){toast('Upload failed: '+error.message,'err');if(btn)btn.style.display='block';if(prog)prog.style.display='none';return;}
    // 'hr-docs' is a PRIVATE bucket — no public URL. Preview/download mint short-lived signed URLs from storagePath.
    if(!DB.documents)DB.documents=[];
    const docObj={id:uid('doc'),name:file.name,folderId,type:scopeTab,scope:scopeKey,url:null,storagePath:path,fileType:file.type,fileSize:file.size,uploadedBy:S.uid,uploaderName:fullName(me()),uploadedAt:new Date().toISOString(),approvalStatus:needsAppr?'pending':null,approverId:null,decidedBy:null,decidedAt:null,decisionNote:null};
    DB.documents.push(docObj);
    if(needsAppr)_flagged.push(docObj);
    // Insert directly to Supabase so refresh doesn't lose the file
    await sb.from('documents').insert({id:docObj.id,name:docObj.name,folder_id:docObj.folderId||null,type:docObj.type,scope:docObj.scope,url:docObj.url,storage_path:docObj.storagePath,file_type:docObj.fileType,file_size:docObj.fileSize,uploaded_by:docObj.uploadedBy,uploader_name:docObj.uploaderName,uploaded_at:docObj.uploadedAt,approval_status:docObj.approvalStatus||null,approver_id:null,decided_by:null,decided_at:null,decision_note:null}).then(({error})=>{if(error)console.error('doc insert:',error.message);}).catch(()=>{});
    done++;
    if(bar)bar.style.width=Math.round(done/files.length*100)+'%';
  }
  log(fullName(me()),'Uploaded '+done+' file(s)',scopeKey);
  // Notify the approver pool for each flagged doc (active org-doc approvers, not the uploader).
  if(_flagged.length){const pool=_docApprovers(S.uid);_flagged.forEach(d=>pool.forEach(a=>_hrmNotify(a.id,'📄 '+fullName(me())+' needs your approval: '+d.name,'document')));}
  toast('Uploaded '+done+' file'+(done!==1?'s':''));
  saveDB();closeModal();render();
};

App._downloadDoc=async(id)=>{
  const doc=(DB.documents||[]).find(x=>x.id===id);if(!doc)return;
  if(doc.url&&doc.url.startsWith('http')){
    const a=document.createElement('a');a.href=doc.url;a.download=doc.name;a.target='_blank';a.rel='noopener noreferrer';a.click();return;
  }
  // Signed URL
  const{data,error}=await sb.storage.from('hr-docs').createSignedUrl(doc.storagePath||doc.url,300);
  if(error){toast('Download failed','err');return;}
  const a=document.createElement('a');a.href=data.signedUrl;a.download=doc.name;a.click();
};

App._previewDoc=async(id)=>{
  const doc=(DB.documents||[]).find(x=>x.id===id);if(!doc)return;
  let url=doc.url;
  if(!url?.startsWith('http')){
    const{data,error}=await sb.storage.from('hr-docs').createSignedUrl(doc.storagePath||doc.url,300);
    if(error){toast('Preview failed','err');return;}
    url=data.signedUrl;
  }
  const ext=(doc.name.split('.').pop()||'').toLowerCase();
  if(ext.match(/jpe?g|png|gif|webp/)){
    modalShell({title:doc.name,size:'max-w-2xl',body:'<img src="'+url+'" alt="'+esc(doc.name)+'" style="width:100%;border-radius:12px;max-height:70vh;object-fit:contain"/>'});
  } else if(ext==='pdf'){
    window.open(url,'_blank','noopener');
  } else {
    window.open(url,'_blank','noopener');
  }
};

// ── Document approvals ──
// Active users who can approve org docs (HR/Admin/granted), excluding the given uploader.
function _docApprovers(exceptUid){
  return (DB.users||[]).filter(u=>u.id!==exceptUid&&u.status==='Active'&&_canApproveDocAs(u));
}
// Does user `u` have documentsOrg.approve? (mirror can()/_hrFloor for an arbitrary user)
function _canApproveDocAs(u){
  if(!u)return false;
  if(isSuperU(u))return true;
  if(u.hrm?.isHR)return true; // HR floor
  const pid=u.hrm?.roleProfileId;const p=pid?(DB.roleProfiles?.[pid]||null):null;
  if(p){const a=p.perms?.documentsOrg;return !!(a&&a.actions&&a.actions.approve);}
  return false;
}
// Approve/reject a flagged org document. Gated on documentsOrg.approve + not the uploader.
App._decideDoc=(id,action)=>{
  const d=(DB.documents||[]).find(x=>x.id===id);
  if(!d){toast('Doc not found','err');return;}
  if(!can('documentsOrg','approve')){toast('Not permitted','err');return;}
  if(d.uploadedBy===S.uid){toast('You cannot approve your own document','err');return;} // self-approve guard
  if(d.approvalStatus!=='pending'){toast('Already decided','warn');rr();return;}
  if(action==='reject'){
    modalShell({title:'Reject document',sub:d.name,size:'max-w-md',
      body:'<textarea id="doc-rnote" rows="3" class="ui-input rf" placeholder="Reason for rejection (sent to uploader)"></textarea>',
      footer:btnG('Cancel','App.closeModal()')+btnDanger('Reject','App._doDecideDoc(\''+esc(d.id)+'\',\'reject\')')});
    return;
  }
  App._doDecideDoc(id,'approve');
};
// Commit the decision (note read from the reject modal when present).
App._doDecideDoc=(id,action)=>{
  const d=(DB.documents||[]).find(x=>x.id===id);
  if(!d){toast('Doc not found','err');return;}
  if(!can('documentsOrg','approve')){toast('Not permitted','err');return;}
  if(d.uploadedBy===S.uid){toast('You cannot approve your own document','err');return;}
  if(d.approvalStatus!=='pending'){toast('Already decided','warn');closeModal();rr();return;}
  const note=action==='reject'?(document.getElementById('doc-rnote')?.value||'').trim():'';
  d.approvalStatus=action==='approve'?'approved':'rejected';
  d.decidedBy=S.uid;d.decidedAt=new Date().toISOString();d.decisionNote=note||null;
  saveDB();
  sb.from('documents').update({approval_status:d.approvalStatus,decided_by:d.decidedBy,decided_at:d.decidedAt,decision_note:d.decisionNote}).eq('id',id)
    .then(({error})=>{if(error)_syncErr('document decision')(error);}).catch(_syncErr('document decision'));
  // N5: send the uploader to where their document lives (dept/location page), not the
  // Approvals inbox they may not be able to open.
  const _dFdr=(DB.folders||[]).find(f=>f.id===d.folderId);
  const _dRoute=((_dFdr&&_dFdr.scope==='location')||d.scope==='location')?'locations':'departments';
  _hrmNotify(d.uploadedBy,(action==='approve'?'✅ Your document "':'❌ Your document "')+d.name+'" was '+d.approvalStatus+(note?': '+note:'.'),'document',_dRoute);
  hlog('Document '+d.approvalStatus,d.name+(note?' — '+note:''));
  closeModal();toast(action==='approve'?'Approved':'Rejected');rr();
};

App._setSTab=(t)=>{S.filters.stab=t;rr();};
App._setCfgTab=(t)=>{S.filters.cfgtab=t;rr();};

// W1.3/X5: replace blocking confirm() with a styled confirm dialog, then an optimistic delete with a
// toast-with-Undo (5s). The underlying delete still happens via _delDoc (id preserved for the tests);
// the dialog just routes into it. _undoDelDoc restores the locally-removed row + cancels the tombstone.
App._delDoc=(id)=>{
  const doc=(DB.documents||[]).find(x=>x.id===id);if(!doc)return;
  confirmModal({title:'Delete document',body:'Delete “'+esc(doc.name)+'”? You can undo this for a few seconds.',confirmLabel:'Delete',danger:true,onConfirm:`App._doDelDoc('${id}')`});
};
App._doDelDoc=(id)=>{
  const doc=(DB.documents||[]).find(x=>x.id===id);if(!doc)return;
  _delDocUndo={id,doc:JSON.parse(JSON.stringify(doc))};
  if(!DB.documents_deleted)DB.documents_deleted=[];
  if(!DB.documents_deleted.includes(id))DB.documents_deleted.push(id);
  DB.documents=(DB.documents||[]).filter(x=>x.id!==id);
  log(fullName(me()),'Deleted doc',doc.name);saveDB();render();
  toastAction('“'+doc.name+'” deleted','warn',{label:'Undo',fn:`App._undoDelDoc('${id}')`,ms:5000});
  // Defer the remote delete so an Undo within the window never hits the server.
  setTimeout(()=>{
    if(_delDocUndo&&_delDocUndo.id===id)return; // undone — skip
    sb.from('documents').delete().eq('id',id).then(({error})=>{if(error)console.error('delDoc sync:',error.message);}).catch(e=>console.error('delDoc:',e));
    if(doc.storagePath)sb.storage.from('hr-docs').remove([doc.storagePath]).catch(()=>{});
  },5200);
};
window._delDocUndo=null;
App._undoDelDoc=(id)=>{
  if(!_delDocUndo||_delDocUndo.id!==id)return;
  const doc=_delDocUndo.doc;_delDocUndo=null;
  DB.documents_deleted=(DB.documents_deleted||[]).filter(x=>x!==id);
  if(!(DB.documents||[]).some(x=>x.id===id)){DB.documents=DB.documents||[];DB.documents.push(doc);}
  saveDB();toast('Restored');render();
};

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window.PERSONAL_DOC_MAX=PERSONAL_DOC_MAX;window._personalDocsSection=_personalDocsSection;window._fmtSize=_fmtSize;window._docApprovers=_docApprovers;window._canApproveDocAs=_canApproveDocAs;
