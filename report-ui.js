const $ = id => document.getElementById(id);
const el = (tag, className = '', value) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
};
const option = (value, label) => { const node = el('option', '', label); node.value = value; return node; };
const fmt = iso => { if(!iso)return 'Unknown date'; try {return new Intl.DateTimeFormat('en-GB', {dateStyle:'medium', timeStyle:'short', timeZone:data.timezone}).format(new Date(iso));} catch {return 'Unknown date';} };
const validColor = value => /^#[0-9a-f]{6}$/i.test(value || '');
const paperLink = (title, url) => { const node = el(url ? 'a' : 'span', 'paper-title', title); if (url) {node.href=url;node.target='_blank';node.rel='noopener noreferrer';} return node; };
const palette = ['#1e7464','#e1a64b','#5878b9','#af718f','#86a85d','#b88258','#708d9a','#b8aa64','#7d79b1','#c2706f'];
const allGroupers = ['status','paper','category','collection','day','week','month'];
let groupOrder = [...data.default_groupers,...allGroupers.filter(group=>!data.default_groupers.includes(group))];
let activeGroupers = new Set(data.default_groupers);
let visibleRange = {...data.range};
let visibleData;
let selectedSizeDate = data.range.to;

const inRange = (day, range) => Boolean(day) && range.from <= day && day <= range.to;
function annotationInRange(entry, range) {
  const added=inRange(entry.added_periods?.day,range),modified=inRange(entry.modified_periods?.day,range);
  if(!added&&!modified)return null;
  const latestModification=modified&&(!added||entry.date_modified>entry.date_added);
  return {...entry,
    event_type:latestModification?'Annotation modified':'Annotation added',
    event_at:modified?entry.date_modified:entry.date_added,
    periods:modified?entry.modified_periods:entry.added_periods,
  };
}
function growthFor(papers) {
  const counts=new Map();
  papers.forEach(paper=>{const month=paper.date_added_day?.slice(0,7);if(month)counts.set(month,(counts.get(month)||0)+1);});
  if(!counts.size)return [];
  const months=[...counts.keys()].sort(),first=months[0],last=months.at(-1),growth=[];
  let [year,month]=first.split('-').map(Number),total=0;
  while(`${year.toString().padStart(4,'0')}-${String(month).padStart(2,'0')}`<=last){
    const key=`${year.toString().padStart(4,'0')}-${String(month).padStart(2,'0')}`;
    total+=counts.get(key)||0;growth.push({month:key,count:total,added:counts.get(key)||0});
    month++;if(month===13){year++;month=1;}
  }
  return growth;
}
function pieFor(papers,collections) {
  const paths=new Map(collections.map(collection=>[collection.key,collection.path])),counts=new Map();let multiMembership=0;
  papers.forEach(paper=>{
    const memberships=paper.collection_keys.filter(key=>paths.has(key));
    if(memberships.length>1)multiMembership++;
    const name=memberships.length>1?'Multiple collections':memberships.length?paths.get(memberships[0]):'Unfiled';
    counts.set(name,(counts.get(name)||0)+1);
  });
  return {pie:[...counts].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name)),multiMembership};
}
function subcollectionLabel(path) {
  if(path==='Multiple collections'||path==='Unfiled')return path;
  const parts=path.split(' / ');
  return parts.length>1?parts.slice(1).join(' / '):path;
}
function sizeAt(day) {
  return (data.size_events||[]).reduce((total,event)=>total+(event.day&&event.day<=day?event.count:0),0);
}
function sizePieAt(day) {
  const counts=new Map();
  (data.size_events||[]).forEach(event=>{if(event.day&&event.day<=day)counts.set(event.bucket,(counts.get(event.bucket)||0)+event.count);});
  const pie=[...counts].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));
  return {pie,multiMembership:counts.get('Multiple collections')||0};
}
function sizePoints(range,resolution) {
  const points=[];
  const before=new Date(Date.parse(range.from+'T12:00:00Z')-86400000).toISOString().slice(0,10);
  if(sizeAt(before))points.push({label:before,day:before,count:sizeAt(before)});
  if(resolution==='month') {
    let month=range.from.slice(0,7);
    while(month<=range.to.slice(0,7)){
      const [year,number]=month.split('-').map(Number);
      const monthEnd=new Date(Date.UTC(year,number,0)).toISOString().slice(0,10);
      const day=monthEnd<range.to?monthEnd:range.to;
      points.push({label:month,day,count:sizeAt(day)});
      month=new Date(Date.UTC(year,number,1)).toISOString().slice(0,7);
    }
  } else {
    let day=range.from;
    while(day<=range.to){points.push({label:day,day,count:sizeAt(day)});day=new Date(Date.parse(day+'T12:00:00Z')+86400000).toISOString().slice(0,10);}
  }
  return points;
}
function deriveRangeView(source,range) {
  const journal=source.journal.map(entry=>annotationInRange(entry,range)).filter(Boolean).sort((a,b)=>b.event_at.localeCompare(a.event_at)||b.key.localeCompare(a.key));
  const papersAdded=source.activity.filter(event=>event.type==='Paper added'&&inRange(event.day,range));
  const annotationEvents=journal.map(entry=>({paper_key:entry.paper_key,paper_title:entry.paper_title,creators:entry.creators,
    status_group:entry.status_group,collections:entry.collections,collection_group:entry.collection_group,collection_keys:entry.collection_keys,
    resource_link:entry.resource_link,key:'annotation:'+entry.key,type:entry.event_type,at:entry.event_at,category:entry.category,
    color:entry.color,tags:entry.paper_tags,annotation_tags:entry.tags}));
  const activity=[...papersAdded,...annotationEvents].sort((a,b)=>b.at.localeCompare(a.at)||b.key.localeCompare(a.key));
  const activeKeys=new Set(activity.map(event=>event.paper_key)),addedPaperKeys=new Set(papersAdded.map(event=>event.paper_key));
  const annotatedPaperKeys=new Set(journal.map(entry=>entry.paper_key)),annotationCounts=new Map(),latestAnnotationAt=new Map();
  journal.forEach(entry=>{annotationCounts.set(entry.paper_key,(annotationCounts.get(entry.paper_key)||0)+1);
    if(entry.event_at>(latestAnnotationAt.get(entry.paper_key)||''))latestAnnotationAt.set(entry.paper_key,entry.event_at);});
  const inventory=source.inventory.filter(paper=>activeKeys.has(paper.key));
  const {pie,multiMembership}=pieFor(inventory,source.collections);
  return {journal,activity,inventory,addedPaperKeys,annotatedPaperKeys,annotationCounts,latestAnnotationAt,
    growth:growthFor(inventory),pie,multiMembership};
}

function activateView(name, scroll = true) {
  for (const view of ['dashboard','feed','journal']) {
    $('view-'+view).hidden=view!==name;
    const button=document.querySelector(`[data-view="${view}"]`);
    if (view===name) button.setAttribute('aria-current','page'); else button.removeAttribute('aria-current');
  }
  if (scroll) window.scrollTo({top:0,behavior:'smooth'});
}
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>activateView(button.dataset.view)));

function drawGrowth() {
  const host=$('growth-chart');host.replaceChildren();
  const growth=sizePoints(visibleRange,$('growth-resolution').value);
  const selectedTotal=sizeAt(selectedSizeDate);
  $('growth-selected-total').textContent=`${selectedTotal} paper${selectedTotal===1?'':'s'} through ${selectedSizeDate}`;
  if (!growth.length) {host.append(el('div','chart-empty','No dates available.'));return;}
  const W=960,H=280,L=50,R=22,T=20,B=35,max=Math.max(1,...growth.map(point=>point.count));
  const ns='http://www.w3.org/2000/svg', svg=document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.setAttribute('role','img');svg.setAttribute('tabindex','0');
  svg.setAttribute('aria-label',`Collection size from ${growth[0].label} to ${growth.at(-1).label}. Click the chart or use arrow keys to select a date. ${selectedTotal} papers through ${selectedSizeDate}.`);
  const add=(kind,attributes,value)=>{const node=document.createElementNS(ns,kind);for(const [key,item] of Object.entries(attributes))node.setAttribute(key,item);if(value!==undefined)node.textContent=value;svg.append(node);};
  for(let i=0;i<=4;i++){const y=T+(H-T-B)*i/4;add('line',{x1:L,x2:W-R,y1:y,y2:y,stroke:'#dbe4de','stroke-width':1});add('text',{x:L-9,y:y+4,'text-anchor':'end',fill:'#718078','font-size':11},Math.round(max*(1-i/4)));}
  const points=growth.map((point,i)=>[L+(W-L-R)*(growth.length===1?.5:i/(growth.length-1)),T+(H-T-B)*(1-point.count/max)]);
  add('polygon',{points:`${points[0][0]},${H-B} ${points.map(point=>point.join(',')).join(' ')} ${points.at(-1)[0]},${H-B}`,fill:'#d9eee4'});
  add('polyline',{points:points.map(point=>point.join(',')).join(' '),fill:'none',stroke:'#1e7464','stroke-width':3,'stroke-linecap':'round','stroke-linejoin':'round'});
  if(points.length<=36)points.forEach(([x,y])=>add('circle',{cx:x,cy:y,r:2.8,fill:'#1e7464'}));
  const selectedIndex=growth.findIndex(point=>point.day>=selectedSizeDate);
  const markerIndex=selectedIndex<0?growth.length-1:selectedIndex;
  add('line',{x1:points[markerIndex][0],x2:points[markerIndex][0],y1:T,y2:H-B,stroke:'#ad7352','stroke-width':1.5,'stroke-dasharray':'4 4'});
  add('circle',{cx:points[markerIndex][0],cy:T+(H-T-B)*(1-selectedTotal/max),r:6,fill:'#ad7352',stroke:'white','stroke-width':2});
  add('text',{x:L,y:H-8,fill:'#718078','font-size':11},growth[0].label);
  add('text',{x:W-R,y:H-8,'text-anchor':'end',fill:'#718078','font-size':11},growth.at(-1).label);
  const selectIndex=index=>{selectedSizeDate=growth[Math.max(0,Math.min(growth.length-1,index))].day;$('growth-date').value=selectedSizeDate;drawGrowth();const distribution=sizePieAt(selectedSizeDate);drawPie(distribution.pie,distribution.multiMembership);};
  svg.addEventListener('click',event=>{const bounds=svg.getBoundingClientRect(),x=(event.clientX-bounds.left)*W/bounds.width;selectIndex(growth.length===1?0:Math.round((x-L)/(W-L-R)*(growth.length-1)));});
  svg.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();selectIndex(markerIndex+(event.key==='ArrowRight'?1:-1));}});
  host.append(svg);
}
function drawPie(pie,multiMembership) {
  const host=$('pie-chart'),legend=$('pie-legend'),total=pie.reduce((sum,slice)=>sum+slice.count,0);host.replaceChildren();legend.replaceChildren();
  $('pie-help').textContent=`Through ${selectedSizeDate} · each paper counted once${multiMembership?` · ${multiMembership} in multiple collections`:''}.`;
  if (!total) {host.append(el('div','chart-empty','No papers in scope.'));return;}
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 190 190');svg.setAttribute('role','img');svg.setAttribute('aria-label',`Distribution of ${total} papers across collections`);
  const circle=attrs=>{const node=document.createElementNS(ns,'circle');for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);svg.append(node);};
  circle({cx:95,cy:95,r:67,fill:'none',stroke:'#e7ede8','stroke-width':31});
  let offset=0;const circumference=2*Math.PI*67;
  pie.forEach((slice,i)=>{
    const fraction=slice.count/total,color=palette[i%palette.length];
    circle({cx:95,cy:95,r:67,fill:'none',stroke:color,'stroke-width':31,'stroke-dasharray':`${fraction*circumference} ${circumference}`,'stroke-dashoffset':-offset*circumference,transform:'rotate(-90 95 95)'});
    offset+=fraction;
    if(pie.length>1){const item=el('li'),dot=el('span','dot');dot.style.background=color;item.append(dot,el('span','',`${subcollectionLabel(slice.name)} · ${slice.count}`));legend.append(item);}
  });
  const center=document.createElementNS(ns,'text');for(const [key,value] of Object.entries({x:95,y:101,'text-anchor':'middle','font-size':29,'font-family':'Georgia,serif',fill:'#173d39'}))center.setAttribute(key,value);center.textContent=total;svg.append(center);host.append(svg);
}
function drawLegend() {
  data.color_legend.forEach(item=>{
    const row=el('div','color-item'),swatch=el('span','swatch'),copy=el('div');
    if(validColor(item.color))swatch.style.setProperty('--swatch',item.color);
    copy.append(el('strong','',item.label),el('p','',item.description));row.append(swatch,copy);$('color-legend').append(row);
  });
}

function statusPaint(paper) {
  if (paper.status.label==='Conflicting statuses')return ['#bc6464','#fcf1f0'];
  if (paper.status.revisit)return [data.status_roles.revisit.color,data.status_roles.revisit.background];
  const role=Object.values(data.status_roles).find(value=>value.label===paper.status.label);
  return role ? [role.color,role.background] : ['#aab5af','#f7f8f6'];
}
function paperRow(paper) {
  const row=el('div','paper-row'),paint=statusPaint(paper);row.style.setProperty('--status-color',paint[0]);row.style.setProperty('--status-bg',paint[1]);
  const count=visibleData.annotationCounts.get(paper.key)||0;
  const main=el('div');main.append(paperLink(paper.title,paper.resource_link),el('span','paper-meta',`${paper.creators.slice(0,2).join(', ')||'Unknown author'} · added ${fmt(paper.date_added)} · ${count} annotation${count===1?'':'s'} in range`));
  const tags=el('div','status-tags');(paper.status_tags.length?paper.status_tags:['No status']).forEach(tag=>tags.append(el('span','status-tag',tag)));row.append(main,tags);return row;
}
function renderStatusSummary() {
  const host=$('status-summary');host.replaceChildren();
  const roles=data.status_roles;
  const values=[
    ['new','New',paper=>visibleData.addedPaperKeys.has(paper.key),'#1e7464','#eaf4ed'],
    ...['to_read','reading','read'].map(role=>[role,roles[role].label,paper=>paper.status.label===roles[role].label,roles[role].color,roles[role].background]),
    ['revisit',roles.revisit.label,paper=>paper.status.revisit,roles.revisit.color,roles.revisit.background],
    ['unassigned','Unassigned',paper=>paper.status.label==='Unassigned','#aab5af','#f7f8f6'],
    ['conflicting','Conflicts',paper=>paper.status.label==='Conflicting statuses','#bc6464','#fcf1f0']
  ];
  values.forEach(([filter,label,matches,color,background])=>{
    const count=visibleData.inventory.filter(matches).length,button=el('button','',`${label} · ${count}`);button.type='button';button.style.setProperty('--status-color',color);button.style.setProperty('--status-bg',background);
    button.addEventListener('click',()=>{$('inventory-filter').value=filter;renderInventory();$('collection-tree').scrollIntoView({behavior:'smooth',block:'start'});});host.append(button);
  });
}
function renderInventory() {
  const query=$('inventory-search').value.toLocaleLowerCase(),filter=$('inventory-filter').value,sort=$('inventory-sort').value,tag=$('inventory-tag').value;
  const visible=visibleData.inventory.filter(paper=>{
    if(query&&![paper.title,...paper.creators].join(' ').toLocaleLowerCase().includes(query))return false;
    if(tag&&!Object.values(paper.tags).flat().includes(tag))return false;
    if(filter==='new')return visibleData.addedPaperKeys.has(paper.key);
    if(filter==='active')return visibleData.annotatedPaperKeys.has(paper.key);
    if(filter==='revisit')return paper.status.revisit;
    if(filter==='unassigned')return paper.status.label==='Unassigned';
    if(filter==='conflicting')return paper.status.label==='Conflicting statuses';
    if(['to_read','reading','read'].includes(filter))return paper.status.label===data.status_roles[filter].label;
    return true;
  });
  const compare={title:(a,b)=>a.title.localeCompare(b.title),newest:(a,b)=>b.date_added.localeCompare(a.date_added)||a.title.localeCompare(b.title),oldest:(a,b)=>a.date_added.localeCompare(b.date_added)||a.title.localeCompare(b.title),annotation:(a,b)=>(visibleData.latestAnnotationAt.get(b.key)||'').localeCompare(visibleData.latestAnnotationAt.get(a.key)||'')||a.title.localeCompare(b.title),status:(a,b)=>a.status_group.localeCompare(b.status_group)||a.title.localeCompare(b.title)};
  visible.sort(compare[sort]||compare.title);$('inventory-result').textContent=`${visible.length} of ${visibleData.inventory.length} papers visible`;
  const host=$('collection-tree'),open=new Set([...host.querySelectorAll('details.collection-node[open]')].map(node=>node.dataset.key));host.replaceChildren();
  const children=new Map();data.collections.forEach(collection=>{const parent=collection.parent_key||'';if(!children.has(parent))children.set(parent,[]);children.get(parent).push(collection);});
  const descendants=key=>[key,...(children.get(key)||[]).flatMap(child=>descendants(child.key))];
  function renderNode(collection,depth=0){
    const details=el('details','collection-node');details.dataset.key=collection.key;details.open=open.has(collection.key)||depth===0;
    const keys=new Set(descendants(collection.key)),total=visible.filter(paper=>paper.collection_keys.some(key=>keys.has(key))).length;
    const direct=visible.filter(paper=>paper.collection_keys.includes(collection.key));
    const summary=el('summary');summary.append(el('span','',collection.name),el('span','collection-count',`${total} in branch · ${direct.length} here`));details.append(summary);
    const body=el('div','collection-body');direct.forEach(paper=>body.append(paperRow(paper)));
    (children.get(collection.key)||[]).forEach(child=>body.append(renderNode(child,depth+1)));
    if(!body.childNodes.length)body.append(el('div','small','No papers here.'));
    details.append(body);return details;
  }
  const roots=children.get('')||[];
  roots.forEach(collection=>{const node=renderNode(collection);if(roots.length===1){node.classList.add('single-root');node.open=true;}host.append(node);});
  const unfiled=visible.filter(paper=>!paper.collection_keys.length);
  if(unfiled.length){const details=el('details','collection-node');details.open=true;details.append(el('summary','','Unfiled · '+unfiled.length));const body=el('div','collection-body');unfiled.forEach(paper=>body.append(paperRow(paper)));details.append(body);host.append(details);}
  if(!host.childNodes.length)host.append(el('div','panel empty','No collections in scope.'));
}
function openCollection(keys) {
  $('inventory-search').value='';$('inventory-filter').value='all';$('inventory-tag').value='';renderInventory();activateView('dashboard',false);
  const nodes=[...$('collection-tree').querySelectorAll('details.collection-node')];
  keys.forEach(key=>{let node=nodes.find(candidate=>candidate.dataset.key===key);while(node){node.open=true;node=node.parentElement?.closest('details.collection-node');}});
  const first=nodes.find(node=>node.dataset.key===keys[0]);if(first)first.scrollIntoView({behavior:'smooth',block:'start'});
}

function renderFeed() {
  const query=$('feed-search').value.toLocaleLowerCase(),type=$('feed-type').value,collection=$('feed-collection').value,tag=$('feed-tag').value;
  const visible=visibleData.activity.filter(event=>(!type||event.type===type)&&(!collection||event.collections.includes(collection))&&(!tag||Object.values(event.tags).flat().includes(tag)||(event.annotation_tags||[]).includes(tag))&&(!query||[event.paper_title,...event.creators,event.category||''].join(' ').toLocaleLowerCase().includes(query)));
  $('feed-result').textContent=`${visible.length} of ${visibleData.activity.length} events visible`;const host=$('feed-list');host.replaceChildren();
  if(!visible.length){host.append(el('div','panel empty','No activity matches these filters.'));return;}
  const groups=new Map();visible.forEach(event=>{const key=event.collection_group;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(event);});
  [...groups.entries()].sort((a,b)=>a[0].localeCompare(b[0])).forEach(([name,events])=>{
    const section=el('section','feed-collection');
    if(groups.size>1){const jump=el('button','collection-jump',`${name} · ${events.length}`);jump.type='button';jump.addEventListener('click',()=>openCollection(events[0].collection_keys));section.append(jump);}
    const list=el('div','panel');events.forEach(event=>{
      const row=el('div','event-row'),time=el('div','event-time',fmt(event.at)),main=el('div','event-main');
      main.append(paperLink(event.paper_title,event.resource_link),el('span','badge',event.type));
      if(event.category)main.append(el('span','badge',event.category));
      const state=el('span','small',`Now: ${event.status_group}`);row.append(time,main,state);list.append(row);
    });section.append(list);host.append(section);
  });
}

function annotationCard(entry) {
  const card=el('article','journal-entry');if(validColor(entry.color))card.style.setProperty('--annotation-color',entry.color);
  const top=el('div','journal-top'),title=el('div');title.append(paperLink(entry.paper_title,entry.resource_link),el('span','badge',entry.category));
  top.append(title,el('span','small',`${entry.event_type} · ${fmt(entry.event_at)}`));card.append(top);
  card.append(el('div','paper-meta',`Current status: ${entry.status_group} · Current collection: ${entry.collection_group} · p. ${entry.page}`));
  if(entry.text){card.append(el('div','paper-meta','Highlighted source text'),el('blockquote','',entry.text));}
  if(entry.comment){card.append(el('div','paper-meta','Annotation comment'),el('p','comment',entry.comment));}
  if(entry.tags.length)card.append(el('div','paper-meta',`Annotation tags: ${entry.tags.join(', ')}`));
  return card;
}
function groupValue(entry,dimension) {
  if(dimension==='paper')return [entry.paper_key,entry.paper_title];
  if(dimension==='status')return [entry.status_group,entry.status_group];
  if(dimension==='category')return [entry.category,entry.category];
  if(dimension==='collection')return [entry.collection_group,entry.collection_group];
  const key=entry.periods?.[dimension]||'';
  if(!key)return ['',`Unknown ${dimension}`];
  if(dimension==='week')return [key,`Week ${Number(key.slice(-2))} · ${key.slice(0,4)}`];
  const date=new Date(`${key}${dimension==='month'?'-01':''}T12:00:00Z`);
  const options=dimension==='day'?{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}:{month:'long',year:'numeric',timeZone:'UTC'};
  return [key,new Intl.DateTimeFormat('en-GB',options).format(date)];
}
function buildGroupTree(items,dimensions,depth=0) {
  if(depth===dimensions.length)return {entries:items};
  const dimension=dimensions[depth],groups=new Map();
  items.forEach(entry=>{const [key,label]=groupValue(entry,dimension);if(!groups.has(key))groups.set(key,{key,label,items:[]});groups.get(key).items.push(entry);});
  const nodes=[...groups.values()].sort((a,b)=>{
    if(['day','week','month'].includes(dimension))return b.key.localeCompare(a.key);
    if(dimension==='status'){
      const order=[data.status_roles.to_read.label,data.status_roles.reading.label,data.status_roles.read.label,data.status_roles.revisit.label,'Unassigned','Conflicting statuses'];
      return order.indexOf(a.key)-order.indexOf(b.key);
    }
    return a.label.localeCompare(b.label);
  });
  return {groups:nodes.map(group=>({key:group.key,label:group.label,count:group.items.length,child:buildGroupTree(group.items,dimensions,depth+1)}))};
}
function renderGroupers() {
  const host=$('groupers');host.replaceChildren();
  const labels={status:'Status',paper:'Paper',category:'Annotation category',collection:'Collection',day:'Day',week:'Week',month:'Month'};
  groupOrder.forEach((dimension,index)=>{
    const chip=el('div',`grouper${activeGroupers.has(dimension)?'':' inactive'}`);chip.draggable=true;chip.dataset.group=dimension;
    const toggle=el('button','',labels[dimension]);toggle.type='button';toggle.setAttribute('aria-pressed',String(activeGroupers.has(dimension)));toggle.addEventListener('click',()=>{if(activeGroupers.has(dimension))activeGroupers.delete(dimension);else activeGroupers.add(dimension);renderGroupers();renderJournal();});chip.append(toggle);
    for(const [symbol,delta,label] of [['←',-1,'Move left'],['→',1,'Move right']]){
      const move=el('button','move',symbol);move.type='button';move.title=`${label}: ${labels[dimension]}`;move.setAttribute('aria-label',move.title);move.disabled=index+delta<0||index+delta>=groupOrder.length;move.addEventListener('click',()=>{const other=index+delta;[groupOrder[index],groupOrder[other]]=[groupOrder[other],groupOrder[index]];renderGroupers();renderJournal();});chip.append(move);
    }
    chip.addEventListener('dragstart',event=>event.dataTransfer.setData('text/plain',dimension));
    chip.addEventListener('dragover',event=>event.preventDefault());
    chip.addEventListener('drop',event=>{event.preventDefault();const source=event.dataTransfer.getData('text/plain');if(!groupOrder.includes(source)||source===dimension)return;groupOrder=groupOrder.filter(group=>group!==source);groupOrder.splice(groupOrder.indexOf(dimension),0,source);renderGroupers();renderJournal();});
    host.append(chip);
  });
}
function renderJournal() {
  const query=$('journal-search').value.toLocaleLowerCase(),category=$('journal-category').value,collection=$('journal-collection').value,tag=$('journal-tag').value;
  const visible=visibleData.journal.filter(entry=>(!category||entry.category===category)&&(!collection||entry.collections.includes(collection))&&(!tag||entry.tags.includes(tag)||Object.values(entry.paper_tags).flat().includes(tag))&&(!query||[entry.paper_title,entry.text,entry.comment,...entry.creators].join(' ').toLocaleLowerCase().includes(query)));
  $('journal-result').textContent=`${visible.length} of ${visibleData.journal.length} annotations visible`;const host=$('journal-list');host.replaceChildren();
  if(!visible.length){host.append(el('div','panel empty','No annotations match these filters.'));return;}
  const dimensions=groupOrder.filter(group=>activeGroupers.has(group));
  function level(tree){
    if(tree.entries){const leaf=el('div');tree.entries.forEach(entry=>leaf.append(annotationCard(entry)));return leaf;}
    const wrapper=el('div');
    tree.groups.forEach(group=>{
      const details=el('details','journal-group');details.open=true;
      details.append(el('summary','',`${group.label} · ${group.count}`));
      const body=el('div','journal-group-body');body.append(level(group.child));details.append(body);wrapper.append(details);
    });return wrapper;
  }
  host.append(level(buildGroupTree(visible,dimensions)));
}

function refreshFilterOptions() {
  const setOptions=(id,names,allLabel)=>{
    const select=$(id),previous=select.value,values=[...names].sort();
    select.replaceChildren(option('',allLabel),...values.map(name=>option(name,name)));
    select.value=values.includes(previous)?previous:'';
  };
  const collections=new Set(),paperTags=new Set(),annotationTags=new Set(),categories=new Set();
  visibleData.inventory.forEach(paper=>{paper.collections.forEach(name=>collections.add(name));Object.values(paper.tags).flat().forEach(tag=>paperTags.add(tag));});
  visibleData.journal.forEach(entry=>{categories.add(entry.category);entry.tags.forEach(tag=>annotationTags.add(tag));});
  setOptions('feed-collection',collections,'All collections');setOptions('journal-collection',collections,'All collections');
  setOptions('inventory-tag',paperTags,'All tags');
  setOptions('feed-tag',new Set([...paperTags,...annotationTags]),'All tags');
  setOptions('journal-tag',new Set([...paperTags,...annotationTags]),'All tags');
  setOptions('journal-category',categories,'All categories');
}

function renderVisibleRange() {
  visibleData=deriveRangeView(data,visibleRange);
  if(selectedSizeDate<visibleRange.from||selectedSizeDate>visibleRange.to)selectedSizeDate=visibleRange.to;
  $('growth-date').min=visibleRange.from;$('growth-date').max=visibleRange.to;$('growth-date').value=selectedSizeDate;
  $('range-label').textContent=`${visibleRange.from} – ${visibleRange.to} ▾`;
  $('stat-scope').textContent=visibleData.inventory.length;
  $('stat-active').textContent=visibleData.addedPaperKeys.size;
  $('stat-journal').textContent=visibleData.journal.length;
  drawGrowth();const distribution=sizePieAt(selectedSizeDate);drawPie(distribution.pie,distribution.multiMembership);
  refreshFilterOptions();
  renderStatusSummary();renderInventory();renderFeed();renderJournal();
}
const rangeDialog=$('range-dialog');
function openRangeDialog() {
  $('range-error').textContent='';$('range-from').value=visibleRange.from;$('range-to').value=visibleRange.to;
  $('range-reset').style.display=appConfig?'none':'';
  for(const id of ['range-from','range-to']){
    $(id).min=appConfig?'':data.range.from;$(id).max=appConfig?'':data.range.to;
  }
  $('range-available').textContent=appConfig?'Choose a new report period.':`Available in this export: ${data.range.from} – ${data.range.to}`;
  rangeDialog.showModal();
}
function applyRange(from,to) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||from>to){$('range-error').textContent='Choose a valid From and To date.';return;}
  if(appConfig){window.location.href=`/?token=${encodeURIComponent(appToken)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;return;}
  if(from<data.range.from||to>data.range.to){$('range-error').textContent='This export only contains the dates shown above. Export a wider period from the app.';return;}
  visibleRange={from,to};rangeDialog.close();renderVisibleRange();
}
$('range-label').addEventListener('click',openRangeDialog);
$('range-close').addEventListener('click',()=>rangeDialog.close());
$('range-cancel').addEventListener('click',()=>rangeDialog.close());
$('range-reset').addEventListener('click',()=>applyRange(data.range.from,data.range.to));
$('range-form').addEventListener('submit',event=>{event.preventDefault();applyRange($('range-from').value,$('range-to').value);});
for(const role of ['to_read','reading','read','revisit'])$('inventory-filter').querySelector(`option[value="${role}"]`).textContent=data.status_roles[role].label;
drawLegend();renderGroupers();renderVisibleRange();
$('growth-resolution').addEventListener('change',drawGrowth);
$('growth-date').addEventListener('change',()=>{const chosen=$('growth-date').value;if(chosen<visibleRange.from||chosen>visibleRange.to)return;selectedSizeDate=chosen;drawGrowth();const distribution=sizePieAt(selectedSizeDate);drawPie(distribution.pie,distribution.multiMembership);});
['inventory-search','inventory-filter','inventory-sort','inventory-tag'].forEach(id=>$(id).addEventListener(id==='inventory-search'?'input':'change',renderInventory));
['feed-search','feed-type','feed-collection','feed-tag'].forEach(id=>$(id).addEventListener(id==='feed-search'?'input':'change',renderFeed));
['journal-search','journal-category','journal-collection','journal-tag'].forEach(id=>$(id).addEventListener(id==='journal-search'?'input':'change',renderJournal));
