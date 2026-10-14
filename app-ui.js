function cascadeCollectionSelection(selected,collections,key,checked) {
  const next=new Set(selected);
  if(!checked){next.delete(key);return next;}
  const children=new Map();
  collections.forEach(item=>{if(!children.has(item.parent_key))children.set(item.parent_key,[]);children.get(item.parent_key).push(item.key);});
  const visit=current=>{next.add(current);(children.get(current)||[]).forEach(visit);};
  visit(key);return next;
}
if (appConfig) {
  const dialog=$('settings-dialog');
  const checkbox=(host,value,label,checked)=>{const row=el('label'),input=el('input');input.type='checkbox';input.value=value;input.checked=checked;row.append(input,el('span','',label));host.append(row);};
  const field=(label,value,type='text')=>{const wrap=el('label','',label),input=el('input');input.type=type;input.value=value;wrap.append(input);return [wrap,input];};
  const dismiss=()=>dialog.close();
  function colorRow(hex,meaning) {
    const row=el('div','settings-grid'),[colorWrap,colorInput]=field('Colour',hex,'color'),[labelWrap,labelInput]=field('Meaning',meaning.label),[descWrap,descInput]=field('Description',meaning.description||'');
    row.classList.add('color-setting');row.style.marginBottom='9px';row.append(colorWrap,labelWrap,descWrap);
    const remove=el('button','secondary','Remove');remove.type='button';remove.addEventListener('click',()=>row.remove());row.append(remove);
    $('setting-colors').append(row);return [colorInput,labelInput,descInput];
  }
  function categoryRow(name,rule) {
    const row=el('div','settings-grid'),[nameWrap,nameInput]=field('Category',name),[prefixWrap,prefixInput]=field('Prefix',rule.prefix||'');
    row.classList.add('category-setting');row.style.marginBottom='9px';
    const allowedWrap=el('label','','Allowed tags (one per line; blank allows every tag with this prefix)'),allowedInput=el('textarea');allowedInput.rows=3;allowedInput.value=(rule.allowed_tags||[]).join('\n');allowedWrap.append(allowedInput);
    const existing=el('div','small');const showExisting=()=>{const matches=appCatalog.tags.filter(tag=>tag.startsWith(prefixInput.value.trim()));existing.textContent=matches.length?`Existing tags: ${matches.join(', ')}`:'No matching tags currently in Zotero.';};prefixInput.addEventListener('input',showExisting);showExisting();
    const remove=el('button','secondary','Remove');remove.type='button';remove.addEventListener('click',()=>row.remove());row.append(nameWrap,prefixWrap,allowedWrap,remove);$('setting-categories').append(row);
    row.append(existing);
    return [nameInput,prefixInput,allowedInput];
  }
  function fillCollectionTree() {
    const host=$('setting-collections');host.replaceChildren();
    const byKey=new Map(appCatalog.collections.map(item=>[item.key,item]));
    const children=new Map();
    appCatalog.collections.forEach(item=>{const parent=byKey.has(item.parent_key)?item.parent_key:'';if(!children.has(parent))children.set(parent,[]);children.get(parent).push(item);});
    const selected=new Set(appCatalog.selected_collections||[]),inputs=new Map(),notes=new Map();
    const descendants=key=>(children.get(key)||[]).flatMap(child=>[child.key,...descendants(child.key)]);
    const updateNotes=()=>{for(const [key,note] of notes){const below=descendants(key),checked=below.filter(child=>inputs.get(child).checked).length;
      note.textContent=checked&&checked<below.length?' · some descendants selected':checked===below.length&&below.length&&!inputs.get(key).checked?' · descendants selected':'';
    }};
    function branch(item) {
      const li=el('li','collection-choice'),row=el('label','collection-choice-row'),input=el('input');input.type='checkbox';input.value=item.key;input.checked=selected.has(item.key);inputs.set(item.key,input);
      const name=el('span','',item.name),note=el('span','collection-choice-note');notes.set(item.key,note);row.append(input,name,note);li.append(row);
      input.addEventListener('change',()=>{const active=new Set([...inputs].filter(([,node])=>node.checked).map(([key])=>key));
        const next=cascadeCollectionSelection(active,appCatalog.collections,item.key,input.checked);
        for(const [key,node] of inputs)node.checked=next.has(key);
        updateNotes();});
      const below=children.get(item.key)||[];
      if(below.length){const list=el('ul','collection-choice-children');below.forEach(child=>list.append(branch(child)));li.append(list);}
      return li;
    }
    const tree=el('ul','collection-choice-list');(children.get('')||[]).forEach(item=>tree.append(branch(item)));host.append(tree);updateNotes();
  }
  function renderTimezones(query,selected) {
    const select=$('setting-timezone'),names=appCatalog.timezones||[selected];
    const needle=query.trim().toLocaleLowerCase();
    const matches=names.filter(name=>name.replaceAll('_',' ').toLocaleLowerCase().includes(needle)||name.toLocaleLowerCase().includes(needle));
    const displayed=[...new Set([...matches,selected])].sort((a,b)=>a.localeCompare(b));
    select.replaceChildren();
    const groups=new Map();
    displayed.forEach(name=>{const region=name.includes('/')?name.split('/')[0]:'Other';
      if(!groups.has(region)){const group=el('optgroup');group.label=region;groups.set(region,group);select.append(group);}
      groups.get(region).append(option(name,name));
    });
    select.value=selected;
    $('setting-timezone-count').textContent=`${matches.length} matching timezone${matches.length===1?'':'s'}`;
  }
  function fillSettings() {
    $('settings-error').textContent='';$('setting-from').value=data.range.from;$('setting-to').value=data.range.to;
    $('settings-diagnostics').textContent=(appCatalog.diagnostics||[]).join(' · ');
    $('setting-timezone-search').value='';renderTimezones('',appConfig.timezone||'Asia/Shanghai');$('setting-window').value=appConfig.default_window_days||30;
    $('setting-unfiled').checked=Boolean(appConfig.include_unfiled);
    fillCollectionTree();
    const types=$('setting-types');types.replaceChildren();
    appCatalog.paper_types.forEach(name=>checkbox(types,name,name,(appConfig.paper_types||[]).includes(name)));
    const statuses=$('setting-statuses');statuses.replaceChildren();
    for(const role of ['to_read','reading','read','revisit']){
      const box=el('div');box.dataset.role=role;box.append(el('h3','',role.replace('_',' ')));
      for(const property of ['tag','label','color','background']){
        const [wrap,input]=field(property[0].toUpperCase()+property.slice(1),appConfig.status_roles[role][property],property==='color'||property==='background'?'color':'text');input.dataset.property=property;box.append(wrap);
      }
      statuses.append(box);
    }
    $('setting-colors').replaceChildren();Object.entries(appConfig.annotation_colors||{}).forEach(([hex,meaning])=>colorRow(hex,typeof meaning==='string'?{label:meaning,description:''}:meaning));
    $('setting-categories').replaceChildren();Object.entries(appConfig.tag_categories||{}).forEach(([name,rule])=>categoryRow(name,rule));
  }
  $('app-settings').addEventListener('click',()=>{fillSettings();dialog.showModal();});
  $('setting-timezone-search').addEventListener('input',()=>renderTimezones($('setting-timezone-search').value,$('setting-timezone').value));
  const saveGrouping=el('button','secondary','Save grouping as default');saveGrouping.type='button';$('groupers').after(saveGrouping);
  saveGrouping.addEventListener('click',async()=>{
    const next=JSON.parse(JSON.stringify(appConfig));next.default_groupers=groupOrder.filter(group=>activeGroupers.has(group));
    try{
      const response=await fetch('/settings?token='+encodeURIComponent(appToken),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({config:next,from:data.range.from,to:data.range.to})});
      const answer=await response.json();if(!response.ok)throw new Error(answer.error||'Could not save grouping');
      saveGrouping.textContent='Grouping saved';
    }catch(error){saveGrouping.textContent=error.message;}
  });
  $('settings-close').addEventListener('click',dismiss);$('settings-cancel').addEventListener('click',dismiss);
  $('add-color').addEventListener('click',()=>colorRow('#999999',{label:'New meaning',description:''}));
  $('add-category').addEventListener('click',()=>categoryRow('New category',{prefix:'new/',allowed_tags:[]}));
  $('app-refresh').addEventListener('click',()=>window.location.reload());
  const query=()=>`token=${encodeURIComponent(appToken)}&from=${encodeURIComponent($('setting-from').value||data.range.from)}&to=${encodeURIComponent($('setting-to').value||data.range.to)}`;
  $('app-export').addEventListener('click',()=>{window.location.href='/export?'+query();});
  $('app-quit').addEventListener('click',async()=>{await fetch('/quit?token='+encodeURIComponent(appToken),{method:'POST'});document.body.replaceChildren(el('main','wrap empty','Reading Journal has closed.'));});
  $('settings-save').addEventListener('click',async()=>{
    const next=JSON.parse(JSON.stringify(appConfig));
    next.timezone=$('setting-timezone').value.trim();next.default_window_days=Number($('setting-window').value);
    next.include_descendants=false;next.include_unfiled=$('setting-unfiled').checked;
    next.included_collections=[...$('setting-collections').querySelectorAll('input:checked')].map(input=>input.value);
    next.paper_types=[...$('setting-types').querySelectorAll('input:checked')].map(input=>input.value);
    next.default_groupers=groupOrder.filter(group=>activeGroupers.has(group));
    for(const box of $('setting-statuses').children){const role=box.dataset.role;for(const input of box.querySelectorAll('input'))next.status_roles[role][input.dataset.property]=input.value.trim();}
    next.annotation_colors={};for(const row of $('setting-colors').children){const inputs=row.querySelectorAll('input');const hex=inputs[0].value.toLowerCase();if(next.annotation_colors[hex]){$('settings-error').textContent=`Duplicate annotation colour: ${hex}`;return;}next.annotation_colors[hex]={label:inputs[1].value.trim(),description:inputs[2].value.trim()};}
    next.tag_categories={};for(const row of $('setting-categories').children){const inputs=row.querySelectorAll('input'),name=inputs[0].value.trim();if(next.tag_categories[name]){$('settings-error').textContent=`Duplicate category: ${name}`;return;}next.tag_categories[name]={prefix:inputs[1].value.trim(),allowed_tags:row.querySelector('textarea').value.split('\n').map(value=>value.trim()).filter(Boolean)};}
    try{
      const response=await fetch('/settings?token='+encodeURIComponent(appToken),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({config:next,from:$('setting-from').value,to:$('setting-to').value})});
      const answer=await response.json();if(!response.ok)throw new Error(answer.error||'Could not save settings');
      window.location.href='/?'+query();
    }catch(error){$('settings-error').textContent=error.message;}
  });
}
