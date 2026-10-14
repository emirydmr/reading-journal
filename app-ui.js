if (appConfig) {
  const dialog=$('settings-dialog');
  const checkbox=(host,value,label,checked)=>{const row=el('label'),input=el('input');input.type='checkbox';input.value=value;input.checked=checked;row.append(input,el('span','',label));host.append(row);};
  const field=(label,value,type='text')=>{const wrap=el('label','',label),input=el('input');input.type=type;input.value=value;wrap.append(input);return [wrap,input];};
  const dismiss=()=>dialog.close();
  function trashButton(label,remove) {
    const button=el('button','icon-button');button.type='button';button.title=label;button.setAttribute('aria-label',label);
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
    const path=document.createElementNS(ns,'path');path.setAttribute('d','M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7');path.setAttribute('fill','none');path.setAttribute('stroke','currentColor');path.setAttribute('stroke-width','1.6');path.setAttribute('stroke-linecap','round');svg.append(path);button.append(svg);button.addEventListener('click',remove);return button;
  }
  function swatch(hex,label) {const input=el('input','editor-swatch');input.type='color';input.value=validColor(hex)?hex:'#7b9185';input.setAttribute('aria-label',label);return input;}
  function colorRow(hex,meaning) {
    const row=el('div','editor-grid annotation-setting'),color=swatch(hex,'Annotation color');
    const [meaningWrap,meaningInput]=field('Meaning',meaning.label),[descriptionWrap,descriptionInput]=field('Description',meaning.description||'');
    row.append(color,meaningWrap,descriptionWrap,trashButton('Remove annotation color',()=>row.remove()));row.editor={color,meaningInput,descriptionInput};$('setting-colors').append(row);
  }
  function categoryRow(name,rule) {
    const card=el('details','tag-category');const summary=el('summary','tag-category-heading'),dot=el('span','category-dot'),title=el('span','',name);dot.style.background=rule.color;summary.append(dot,title);card.append(summary);
    const body=el('div','tag-category-body'),row=el('div','editor-grid'),color=swatch(rule.color,'Category color');
    const top=el('div','editor-pair'),[nameWrap,nameInput]=field('Category',name),[prefixWrap,prefixInput]=field('Prefix',rule.prefix||'');top.append(nameWrap,prefixWrap);
    const [descWrap,descInput]=field('Description',rule.description||'');row.append(color,top,descWrap,trashButton('Remove tag category',()=>card.remove()));body.append(row);
    const picker=el('details','tag-inclusion');picker.append(el('summary','','Included tags'));const tree=el('div','tag-choice-tree');picker.append(tree);
    const futureLabel=el('label','check-label'),future=el('input');future.type='checkbox';future.checked=rule.selection_mode==='prefix';futureLabel.append(future,el('span','','Include future tags with this prefix'));picker.append(futureLabel);body.append(picker);
    const definitions=el('div','tag-definitions');body.append(definitions);const removed=new Set();let chosen=new Set(rule.allowed_tags||[]),getSelected=()=>chosen;
    const matchingTags=prefix=>appCatalog.tags.filter(tag=>prefix?tag.startsWith(prefix):!Object.values(appCatalog.tag_categories).some(category=>category.prefix&&tag.startsWith(category.prefix)));
    function refreshTree(){future.disabled=!prefixInput.value;if(future.disabled)future.checked=false;const names=[...new Set([...matchingTags(prefixInput.value),...[...definitions.children].map(node=>node.editor.key.value)])];
      if(future.checked)chosen=new Set(names);removed.forEach(tag=>chosen.delete(tag));
      getSelected=renderChoiceTree(tree,tagTreeNodes(names,prefixInput.value),chosen,selected=>{chosen=selected;future.checked=false;});
    }
    function addTag(key,definition={}) {
      const tagRow=el('div','editor-grid tag-definition'),tagColor=swatch(definition.color||color.value,'Tag color');
      const first=el('div','editor-pair'),[keyWrap,keyInput]=field('Tag',key),[labelWrap,labelInput]=field('Meaning',definition.label||key.split('/').at(-1));first.append(keyWrap,labelWrap);
      const second=el('div','editor-pair'),[descriptionWrap,descriptionInput]=field('Description',definition.description||''),roleWrap=el('label','','Reading meaning'),role=el('select');
      [['','None'],['to_read','To read'],['reading','Reading'],['read','Read'],['revisit','Revisit']].forEach(([value,label])=>role.append(option(value,label)));role.value=definition.reading_role||'';roleWrap.append(role);second.append(descriptionWrap,roleWrap);
      tagRow.append(tagColor,first,second,trashButton('Remove tag definition',()=>{removed.add(keyInput.value);chosen=getSelected();chosen.delete(keyInput.value);tagRow.remove();refreshTree();}));
      tagRow.editor={key:keyInput,label:labelInput,color:tagColor,description:descriptionInput,role};definitions.append(tagRow);
      keyInput.addEventListener('change',()=>{chosen=getSelected();chosen.delete(key);chosen.add(keyInput.value);refreshTree();});
    }
    const known=[...new Set([...Object.keys(rule.tags||{}),...matchingTags(rule.prefix)])].sort();known.forEach(tag=>addTag(tag,rule.tags?.[tag]||{}));
    const add=el('button','secondary','Add tag');add.type='button';add.addEventListener('click',()=>{chosen=getSelected();let key=prefixInput.value+'new-tag',number=2;while([...definitions.children].some(node=>node.editor.key.value===key))key=prefixInput.value+'new-tag-'+number++;addTag(key);chosen.add(key);refreshTree();});body.append(add);
    nameInput.addEventListener('input',()=>title.textContent=nameInput.value);color.addEventListener('input',()=>dot.style.background=color.value);
    prefixInput.addEventListener('change',()=>{chosen=getSelected();refreshTree();});future.addEventListener('change',()=>{chosen=getSelected();refreshTree();});
    card.append(body);card.editor={name:nameInput,prefix:prefixInput,color,description:descInput,definitions,future,selected:()=>getSelected()};$('setting-categories').append(card);refreshTree();
  }
  function fillCollectionTree() {
    renderChoiceTree($('setting-collections'),appCatalog.collections.map(item=>({...item,label:item.name})),new Set(appCatalog.selected_collections||[]));
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
    appCatalog.paper_types.forEach(name=>checkbox(types,name,name.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,letter=>letter.toUpperCase()),(appConfig.paper_types||[]).includes(name)));
    $('setting-colors').replaceChildren();Object.entries(appConfig.annotation_colors||{}).forEach(([hex,meaning])=>colorRow(hex,typeof meaning==='string'?{label:meaning,description:''}:meaning));
    $('setting-categories').replaceChildren();Object.entries(appCatalog.tag_categories||{}).forEach(([name,rule])=>categoryRow(name,rule));
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
  $('add-category').addEventListener('click',()=>categoryRow('New category',{prefix:'new/',allowed_tags:[],tags:{},color:'#7b9185',selection_mode:'explicit'}));
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
    next.annotation_colors={};for(const row of $('setting-colors').children){const edit=row.editor,hex=edit.color.value.toLowerCase();if(next.annotation_colors[hex]){$('settings-error').textContent=`Duplicate annotation color: ${hex}`;return;}next.annotation_colors[hex]={label:edit.meaningInput.value.trim(),description:edit.descriptionInput.value.trim()};}
    next.tag_schema_version=2;next.tag_categories={};for(const card of $('setting-categories').children){const edit=card.editor,name=edit.name.value.trim();if(next.tag_categories[name]){$('settings-error').textContent=`Duplicate category: ${name}`;return;}
      const tags={};for(const row of edit.definitions.children){const tag=row.editor,key=tag.key.value.trim();if(tags[key]){$('settings-error').textContent=`Duplicate tag: ${key}`;return;}tags[key]={label:tag.label.value.trim(),color:tag.color.value,description:tag.description.value.trim(),reading_role:tag.role.value};}
      next.tag_categories[name]={prefix:edit.prefix.value.trim(),color:edit.color.value,description:edit.description.value.trim(),selection_mode:edit.future.checked?'prefix':'explicit',allowed_tags:[...edit.selected()].filter(key=>!key.startsWith('@')),tags};}
    try{
      const response=await fetch('/settings?token='+encodeURIComponent(appToken),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({config:next,from:$('setting-from').value,to:$('setting-to').value})});
      const answer=await response.json();if(!response.ok)throw new Error(answer.error||'Could not save settings');
      window.location.href='/?'+query();
    }catch(error){$('settings-error').textContent=error.message;}
  });
}
