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
const paperOverviewTitle = (title,key) => {const button=el('button','paper-title',title);button.type='button';button.title='Open paper overview';button.addEventListener('click',()=>openPaperOverview(key));return button;};
const zoteroButton = (url,label='Open in Zotero',caption='Zotero') => {if(!appConfig||!url)return null;const link=el('a','zotero-button',caption);link.href=url;link.title=label;link.setAttribute('aria-label',label);return link;};
function eventAction(url,label,kind){
  if(!appConfig||!url)return null;
  const link=el('a',`event-action event-action-${kind}`);link.href=url;link.title=label;link.setAttribute('aria-label',label);
  if(kind==='paper'){const img=el('img');img.src=zoteroIcon;img.alt='';link.append(img);}
  else {const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
    const page=document.createElementNS('http://www.w3.org/2000/svg','path');page.setAttribute('d','M5 2.5h10l4 4V21H5z M15 2.5v4h4 M8 10h8 M8 13h7');page.setAttribute('fill','none');page.setAttribute('stroke','currentColor');page.setAttribute('stroke-width','1.7');page.setAttribute('stroke-linejoin','round');page.setAttribute('stroke-linecap','round');
    const mark=document.createElementNS('http://www.w3.org/2000/svg','rect');mark.setAttribute('x','8');mark.setAttribute('y','16');mark.setAttribute('width','8');mark.setAttribute('height','2.5');mark.setAttribute('rx','1');mark.setAttribute('fill','#e7b62b');svg.append(page,mark);link.append(svg);}
  return link;
}
const palette = ['#1e7464','#e1a64b','#5878b9','#af718f','#86a85d','#b88258','#708d9a','#b8aa64','#7d79b1','#c2706f'];
const allGroupers = ['status','paper','category','collection','day','week','month'];
let groupOrder = [...data.default_groupers,...allGroupers.filter(group=>!data.default_groupers.includes(group))];
let activeGroupers = new Set(data.default_groupers);
let visibleRange = {...data.range};
let visibleData;
let journalMode='feed';
let selectedJournalDay=null;
let paperOverviewKey=null;
let paperOverviewPage=null;
let paperOverviewLayout='plot';
let selectedSizeDate = data.range.to;
let selectedSizeMonth = data.range.to.slice(0,7);
function monthLastDay(month){const [year,number]=month.split('-').map(Number);return new Date(Date.UTC(year,number,0)).toISOString().slice(0,10);}
function monthName(month){return new Intl.DateTimeFormat('en-GB',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(month+'-01T12:00:00Z'));}
function sizeSelectionCutoff(){return $('growth-resolution').value==='month'?monthLastDay(selectedSizeMonth):selectedSizeDate;}
function sizeSelectionLabel(){return $('growth-resolution').value==='month'?`end of ${monthName(selectedSizeMonth)}`:selectedSizeDate;}
function syncSizeControls(){const monthly=$('growth-resolution').value==='month';$('growth-month-control').hidden=!monthly;$('growth-date-control').hidden=monthly;$('growth-month').value=selectedSizeMonth;$('growth-date').value=selectedSizeDate;}
function renderSizeCharts(){syncSizeControls();drawGrowth();const distribution=sizePieAt(sizeSelectionCutoff());drawPie(distribution.pie,distribution.multiMembership);}
const filterSelections=new Map();
function matchesFilterSelection(id,values){const selection=filterSelections.get(id);return selection==null||values.some(value=>selection.has(value));}
function tagChip(tag){const chip=el('span','status-tag tag-chip',tag),style=data.tag_styles?.[tag];if(style){chip.title=style.category+' · '+style.label;chip.style.setProperty('--category-color',style.category_color);chip.style.setProperty('--tag-color',style.color);chip.style.setProperty('--tag-bg',style.color+'18');}return chip;}
function renderFilterPicker(id,nodes,keys,labels,render){
  const host=$(id),wasOpen=Boolean(host.querySelector('details.tag-filter[open]'));
  const openBranches=new Map([...host.querySelectorAll('details.choice-branch')].map(branch=>[branch.dataset.key,branch.open]));
  const details=el('details','tag-filter'),summary=el('summary'),summaryText=el('span','filter-summary-text'),body=el('div','tag-filter-popover'),tree=el('div');host.replaceChildren();details.open=wasOpen;summary.append(summaryText);
  let selected=filterSelections.get(id);if(selected)selected=new Set([...selected].filter(key=>keys.has(key)));if(selected?.size===keys.size)selected=null;filterSelections.set(id,selected);
  const all=el('button','filter-all'),allText=el('span','filter-all-label');all.type='button';all.disabled=!keys.size;
  const updateLabel=()=>{const current=filterSelections.get(id),everything=current==null;
    summaryText.textContent=everything?labels.all:current.size===0?`No ${labels.plural}`:current.size===1?(nodes.find(node=>current.has(node.key))?.label||`1 ${labels.singular} selected`):`${current.size} ${labels.plural} selected`;
    allText.textContent=everything?'Deselect all':'Select all';all.title=`${allText.textContent} ${labels.plural}`;all.setAttribute('aria-pressed',String(everything));};
  all.append(el('span','filter-all-mark','✓'),allText,el('span','filter-all-count',String(keys.size)));
  all.addEventListener('click',()=>{filterSelections.set(id,filterSelections.get(id)==null?new Set():null);renderFilterPicker(id,nodes,keys,labels,render);render();});body.append(all,tree);
  renderChoiceTree(tree,nodes,selected||new Set(nodes.map(node=>node.key)),chosen=>{const picked=new Set([...chosen].filter(key=>keys.has(key)));filterSelections.set(id,picked.size===keys.size?null:picked);updateLabel();render();});
  tree.querySelectorAll('details.choice-branch').forEach(branch=>{if(openBranches.has(branch.dataset.key))branch.open=openBranches.get(branch.dataset.key);});
  if(!keys.size)tree.append(el('p','small',`No ${labels.plural} in this range.`));details.append(summary,body);host.append(details);updateLabel();
}
function renderTagFilter(id,names,render){
  const nodes=tagTreeNodes([...names]).map(node=>{const style=data.tag_styles?.[node.key]||Object.entries(data.tag_styles||{}).find(([name])=>node.key.startsWith('@')&&name.startsWith(node.key.slice(1)+'/'))?.[1];return {...node,color:node.key.startsWith('@')?style?.category_color:style?.color};});
  renderFilterPicker(id,nodes,names,{all:'All tags',singular:'tag',plural:'tags'},render);
}

const inRange = (day, range) => Boolean(day) && range.from <= day && day <= range.to;
function annotationInRange(entry, range) {
  const added=inRange(entry.added_periods?.day,range),modified=inRange(entry.modified_periods?.day,range);
  const addedTime=Date.parse(entry.date_added),modifiedTime=Date.parse(entry.date_modified);
  const creationEdit=Number.isFinite(addedTime)&&Number.isFinite(modifiedTime)&&modifiedTime>=addedTime&&modifiedTime-addedTime<=20*60*1000;
  if(creationEdit&&!added)return null;
  if(!added&&!modified)return null;
  const latestModification=!creationEdit&&modified&&(!added||entry.date_modified>entry.date_added);
  return {...entry,
    event_type:latestModification?'Annotation updated':'Annotation created',
    event_at:latestModification?entry.date_modified:entry.date_added,
    periods:latestModification?entry.modified_periods:entry.added_periods,
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
  const start=resolution==='month'?range.from.slice(0,7)+'-01':range.from;
  const before=new Date(Date.parse(start+'T12:00:00Z')-86400000).toISOString().slice(0,10);
  if(sizeAt(before))points.push({label:resolution==='month'?before.slice(0,7):before,day:before,count:sizeAt(before)});
  if(resolution==='month') {
    let month=range.from.slice(0,7);
    while(month<=range.to.slice(0,7)){
      const [year,number]=month.split('-').map(Number);
      const day=monthLastDay(month);
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
    resource_link:entry.resource_link,zotero_link:entry.zotero_link,paper_zotero_link:entry.paper_zotero_link,key:'annotation:'+entry.key,type:entry.event_type,at:entry.event_at,category:entry.category,
    color:entry.color,tags:entry.paper_tags,annotation_tags:entry.tags,text:entry.text,comment:entry.comment,day:entry.periods?.day}));
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
  for (const view of ['dashboard','journal']) {
    $('view-'+view).hidden=view!==name;
    const button=document.querySelector(`[data-view="${view}"]`);
    if (view===name) button.setAttribute('aria-current','page'); else button.removeAttribute('aria-current');
  }
  if (scroll) window.scrollTo({top:0,behavior:'smooth'});
}
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>activateView(button.dataset.view)));
function setJournalMode(mode){
  journalMode=mode;
  $('journal-mode-feed').setAttribute('aria-pressed',String(mode==='feed'));
  $('journal-mode-annotations').setAttribute('aria-pressed',String(mode==='annotations'));
  $('journal-feed-panel').hidden=mode!=='feed';$('journal-annotations-panel').hidden=mode!=='annotations';
  $('feed-type-control').hidden=mode!=='feed';$('journal-category-control').hidden=mode!=='annotations';
}
$('journal-mode-feed').addEventListener('click',()=>setJournalMode('feed'));
$('journal-mode-annotations').addEventListener('click',()=>setJournalMode('annotations'));
function activityCountsByDay(events){
  const counts=new Map();events.forEach(event=>{if(event.day)counts.set(event.day,(counts.get(event.day)||0)+1);});return counts;
}
function toggleJournalDay(day){selectedJournalDay=selectedJournalDay===day?null:day;return selectedJournalDay;}
function matchesJournalDay(day){return !selectedJournalDay||selectedJournalDay===day;}
function activityLevel(count){return count===0?0:count===1?1:count<=3?2:count<=7?3:4;}
function calendarMonths(range){
  const months=[];let month=range.from.slice(0,7);
  while(month<=range.to.slice(0,7)){
    const [year,number]=month.split('-').map(Number),first=month===range.from.slice(0,7)?Number(range.from.slice(-2)):1;
    const last=month===range.to.slice(0,7)?Number(range.to.slice(-2)):new Date(Date.UTC(year,number,0)).getUTCDate();
    months.push({month,leading:(new Date(Date.UTC(year,number-1,first)).getUTCDay()+6)%7,days:Array.from({length:last-first+1},(_,index)=>`${month}-${String(first+index).padStart(2,'0')}`)});
    month=new Date(Date.UTC(year,number,1)).toISOString().slice(0,7);
  }
  return months;
}
function renderActivityCalendar(){
  const host=$('activity-calendar'),counts=activityCountsByDay(visibleData.activity);host.replaceChildren();
  const allCount=visibleData.activity.length,chosenCount=counts.get(selectedJournalDay)||0;
  $('activity-day-label').textContent=selectedJournalDay?`${selectedJournalDay} · ${chosenCount} event${chosenCount===1?'':'s'} · click again to clear`:`${allCount} event${allCount===1?'':'s'} in range`;
  calendarMonths(visibleRange).forEach(({month,leading,days})=>{
    const section=el('section','activity-month'),heading=el('div','activity-month-title',monthName(month)),grid=el('div','activity-month-days');
    grid.setAttribute('aria-label',monthName(month));
    ['M','T','W','T','F','S','S'].forEach(day=>grid.append(el('span','activity-weekday',day)));
    for(let index=0;index<leading;index++)grid.append(el('span','activity-blank'));
    days.forEach(day=>{const count=counts.get(day)||0,button=el('button','activity-day',String(Number(day.slice(-2))));button.type='button';button.dataset.day=day;button.dataset.level=String(activityLevel(count));button.setAttribute('aria-pressed',String(selectedJournalDay===day));
      button.setAttribute('aria-label',`${day}: ${count} event${count===1?'':'s'}${selectedJournalDay===day?', selected':''}`);
      button.title=`${day} · ${count} event${count===1?'':'s'}`;
      button.addEventListener('click',()=>{toggleJournalDay(day);renderActivityCalendar();renderFeed();renderJournal();const selected=host.querySelector(`[data-day="${day}"]`);if(selected)selected.focus({preventScroll:true});});grid.append(button);
    });section.append(heading,grid);host.append(section);
  });
}

function drawGrowth() {
  const host=$('growth-chart');host.replaceChildren();
  const growth=sizePoints(visibleRange,$('growth-resolution').value);
  const cutoff=sizeSelectionCutoff(),selectedTotal=sizeAt(cutoff),selectionLabel=sizeSelectionLabel();
  $('growth-selected-total').textContent=`${selectedTotal} paper${selectedTotal===1?'':'s'} through ${selectionLabel}`;
  if (!growth.length) {host.append(el('div','chart-empty','No dates available.'));return;}
  const W=960,H=280,L=50,R=22,T=20,B=35,max=Math.max(1,...growth.map(point=>point.count));
  const ns='http://www.w3.org/2000/svg', svg=document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.setAttribute('role','img');svg.setAttribute('tabindex','0');
  svg.setAttribute('aria-label',`Collection size from ${growth[0].label} to ${growth.at(-1).label}. Click the chart or use arrow keys to select a ${$('growth-resolution').value==='month'?'month':'date'}. ${selectedTotal} papers through ${selectionLabel}.`);
  const add=(kind,attributes,value)=>{const node=document.createElementNS(ns,kind);for(const [key,item] of Object.entries(attributes))node.setAttribute(key,item);if(value!==undefined)node.textContent=value;svg.append(node);};
  for(let i=0;i<=4;i++){const y=T+(H-T-B)*i/4;add('line',{x1:L,x2:W-R,y1:y,y2:y,stroke:'#dbe4de','stroke-width':1});add('text',{x:L-9,y:y+4,'text-anchor':'end',fill:'#718078','font-size':11},Math.round(max*(1-i/4)));}
  const points=growth.map((point,i)=>[L+(W-L-R)*(growth.length===1?.5:i/(growth.length-1)),T+(H-T-B)*(1-point.count/max)]);
  add('polygon',{points:`${points[0][0]},${H-B} ${points.map(point=>point.join(',')).join(' ')} ${points.at(-1)[0]},${H-B}`,fill:'#d9eee4'});
  add('polyline',{points:points.map(point=>point.join(',')).join(' '),fill:'none',stroke:'#1e7464','stroke-width':3,'stroke-linecap':'round','stroke-linejoin':'round'});
  if(points.length<=36)points.forEach(([x,y])=>add('circle',{cx:x,cy:y,r:2.8,fill:'#1e7464'}));
  const selectedIndex=growth.findIndex(point=>point.day>=cutoff);
  const markerIndex=selectedIndex<0?growth.length-1:selectedIndex;
  add('line',{x1:points[markerIndex][0],x2:points[markerIndex][0],y1:T,y2:H-B,stroke:'#ad7352','stroke-width':1.5,'stroke-dasharray':'4 4'});
  add('circle',{cx:points[markerIndex][0],cy:T+(H-T-B)*(1-selectedTotal/max),r:6,fill:'#ad7352',stroke:'white','stroke-width':2});
  add('text',{x:L,y:H-8,fill:'#718078','font-size':11},growth[0].label);
  add('text',{x:W-R,y:H-8,'text-anchor':'end',fill:'#718078','font-size':11},growth.at(-1).label);
  const selectIndex=index=>{const point=growth[Math.max(0,Math.min(growth.length-1,index))];if($('growth-resolution').value==='month')selectedSizeMonth=point.day.slice(0,7);else selectedSizeDate=point.day<visibleRange.from?visibleRange.from:point.day;renderSizeCharts();};
  svg.addEventListener('click',event=>{const bounds=svg.getBoundingClientRect(),x=(event.clientX-bounds.left)*W/bounds.width;selectIndex(growth.length===1?0:Math.round((x-L)/(W-L-R)*(growth.length-1)));});
  svg.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();selectIndex(markerIndex+(event.key==='ArrowRight'?1:-1));}});
  host.append(svg);
}
function drawPie(pie,multiMembership) {
  const host=$('pie-chart'),legend=$('pie-legend'),total=pie.reduce((sum,slice)=>sum+slice.count,0);host.replaceChildren();legend.replaceChildren();
  $('pie-help').textContent=`Through ${sizeSelectionLabel()} · each paper counted once${multiMembership?` · ${multiMembership} in multiple collections`:''}.`;
  if (!total) {host.append(el('div','chart-empty','No papers in scope.'));return;}
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 190 190');svg.setAttribute('role','img');svg.setAttribute('aria-label',`Distribution of ${total} papers across collections`);
  const circle=attrs=>{const node=document.createElementNS(ns,'circle');for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);svg.append(node);};
  circle({cx:95,cy:95,r:67,fill:'none',stroke:'#e7ede8','stroke-width':31});
  let offset=0;const circumference=2*Math.PI*67,legendEntries=[];
  pie.forEach((slice,i)=>{
    const fraction=slice.count/total,color=palette[i%palette.length];
    circle({cx:95,cy:95,r:67,fill:'none',stroke:color,'stroke-width':31,'stroke-dasharray':`${fraction*circumference} ${circumference}`,'stroke-dashoffset':-offset*circumference,transform:'rotate(-90 95 95)'});
    offset+=fraction;
    if(pie.length>1)legendEntries.push({slice,color,label:subcollectionLabel(slice.name)});
  });
  legendEntries.sort((a,b)=>a.label.localeCompare(b.label,undefined,{numeric:true,sensitivity:'base'})).forEach(({slice,color,label})=>{const item=el('li'),dot=el('span','dot');dot.style.background=color;item.append(dot,el('span','',`${label} · ${slice.count}`));legend.append(item);});
  const center=document.createElementNS(ns,'text');for(const [key,value] of Object.entries({x:95,y:101,'text-anchor':'middle','font-size':29,'font-family':'Georgia,serif',fill:'#173d39'}))center.setAttribute(key,value);center.textContent=total;svg.append(center);host.append(svg);
}
function drawLegend() {
  const host=$('color-legend');host.replaceChildren();
  data.color_legend.forEach(item=>{
    const row=el('div','color-item'),swatch=el('span','swatch'),copy=el('div');
    if(validColor(item.color))swatch.style.setProperty('--swatch',item.color);
    copy.append(el('strong','',item.label),el('p','',item.description));row.append(swatch,copy);host.append(row);
  });
}

function isUnassignedPaper(paper) {
  return paper.status.label === 'Unassigned' && !paper.status.revisit;
}

function statusPaint(paper) {
  if (paper.status.label==='Conflicting statuses')return ['#bc6464','#fcf1f0'];
  if (paper.status.revisit)return [data.status_roles.revisit.color,data.status_roles.revisit.background];
  const role=Object.values(data.status_roles).find(value=>value.label===paper.status.label);
  return role ? [role.color,role.background] : ['#aab5af','#f7f8f6'];
}
function paperRow(paper) {
  const row=el('div','paper-row'),paint=statusPaint(paper);row.dataset.refreshKey=`paper:${paper.key}`;row.style.setProperty('--status-color',paint[0]);row.style.setProperty('--status-bg',paint[1]);
  const count=visibleData.annotationCounts.get(paper.key)||0;
  const main=el('div');main.append(paperOverviewTitle(paper.title,paper.key));const open=zoteroButton(paper.zotero_link,`Open ${paper.title} in Zotero`);if(open)main.append(open);main.append(el('span','paper-meta',`${paper.creators.slice(0,2).join(', ')||'Unknown author'} · added ${fmt(paper.date_added)} · ${count} annotation${count===1?'':'s'} in range`));
  const tags=el('div','status-tags'),names=[...new Set(Object.values(paper.tags).flat())];if(appConfig){(names.length?names:['No tags']).forEach(name=>{const trigger=el('button','status-tag tag-chip',name);trigger.type='button';trigger.title='Edit paper tags';const style=data.tag_styles?.[name];if(style){trigger.style.setProperty('--category-color',style.category_color);trigger.style.setProperty('--tag-color',style.color);trigger.style.setProperty('--tag-bg',style.color+'18');}trigger.addEventListener('click',()=>window.openPaperTagEditor(paper.key,paper.title));tags.append(trigger);});}else if(names.length)names.forEach(tag=>tags.append(tagChip(tag)));else tags.append(el('span','status-tag','No tags'));row.append(main,tags);row.addEventListener('click',event=>{if(!event.target.closest('button,a'))openPaperOverview(paper.key);});return row;
}
function paperPageOrder(a,b){const x=Number.parseFloat(a),y=Number.parseFloat(b);if(Number.isFinite(x)!==Number.isFinite(y))return Number.isFinite(x)?-1:1;return Number.isFinite(x)?x-y||a.localeCompare(b):a.localeCompare(b,undefined,{numeric:true});}
function paperPageGroups(entries){const pages=new Map();entries.forEach(entry=>{const page=String(entry.page||'?');if(!pages.has(page))pages.set(page,[]);pages.get(page).push(entry);});return [...pages].sort((a,b)=>paperPageOrder(a[0],b[0]));}
function paperPageColorCounts(entries){const counts=new Map();entries.forEach(entry=>{const color=validColor(entry.color)?entry.color.toLowerCase():'#aab3af',key=`${color}\u0000${entry.category}`;counts.set(key,(counts.get(key)||0)+1);});const order=new Map((data.color_legend||[]).map((item,index)=>[item.color.toLowerCase(),index]));return [...counts].map(([key,count])=>{const [color,category]=key.split('\u0000');return {color,category,count};}).sort((a,b)=>(order.get(a.color)??99)-(order.get(b.color)??99)||a.category.localeCompare(b.category));}
function overviewLink(label,url){const node=el(url?'a':'span','',`${label}${url?'':' · unavailable'}`);if(url){node.href=url;node.target='_blank';node.rel='noopener noreferrer';}return node;}
function selectOverviewPage(page,host){const scroll=host.scrollTop;paperOverviewPage=page;renderPaperOverview();host.scrollTop=scroll;}
function renderPageTiles(groups,maxCount,host){
  const grid=el('div','paper-page-grid');
  groups.forEach(([page,items])=>{const button=el('button','paper-page');button.type='button';button.setAttribute('aria-pressed',String(page===paperOverviewPage));button.setAttribute('aria-label',`Page ${page}, ${items.length} annotations`);button.append(el('span','paper-page-label',`Page ${page}`));const bar=el('span','paper-page-bar');bar.style.width=`${Math.max(20,100*items.length/maxCount)}%`;items.forEach(entry=>{const segment=el('i');segment.style.flex='1';if(validColor(entry.color))segment.style.setProperty('--segment-color',entry.color);segment.title=entry.category;bar.append(segment);});button.append(bar,el('span','paper-page-count',`${items.length} annotation${items.length===1?'':'s'}`));button.addEventListener('click',()=>selectOverviewPage(page,host));grid.append(button);});
  return grid;
}
function renderPagePlot(groups,maxCount,host){
  const chart=el('div','paper-page-plot');chart.setAttribute('role','group');chart.setAttribute('aria-label','Annotations by paper page');
  const scale=el('div','paper-plot-scale');scale.append(el('span','',String(maxCount)),el('span','',String(Math.round(maxCount/2))),el('span','','0'));chart.append(scale);
  const bars=el('div','paper-plot-bars');chart.append(bars);
  groups.forEach(([page,items])=>{const categories=paperPageColorCounts(items),button=el('button','paper-plot-page');button.type='button';button.setAttribute('aria-pressed',String(page===paperOverviewPage));button.setAttribute('aria-label',`Page ${page}, ${items.length} annotations: ${categories.map(item=>`${item.count} ${item.category}`).join(', ')}`);
    const count=el('span','paper-plot-count',String(items.length)),track=el('span','paper-plot-track'),stack=el('span','paper-plot-stack');stack.style.height=`${Math.max(3,160*items.length/maxCount)}px`;
    categories.forEach(item=>{const segment=el('i');segment.style.flex=String(item.count);segment.style.backgroundColor=item.color;segment.title=`${item.category}: ${item.count}`;stack.append(segment);});track.append(stack);button.append(count,track,el('span','paper-plot-label',`p. ${page}`));button.addEventListener('click',()=>selectOverviewPage(page,host));bars.append(button);});
  return chart;
}
function renderPaperOverview(){
  const host=$('paper-overview-content');host.replaceChildren();
  const paper=data.inventory.find(item=>item.key===paperOverviewKey);
  if(!paper){host.append(el('p','help','This paper is no longer in the report.'));return;}
  const entries=visibleData.journal.filter(entry=>entry.paper_key===paper.key);
  const head=el('div','paper-overview-head'),copy=el('div');copy.append(el('h2','',paper.title),el('p','paper-meta',`${paper.creators.join(', ')||'Unknown author'} · added ${fmt(paper.date_added)} · ${paper.status_group}`));head.append(copy);host.append(head);
  host.append(el('p','help',paper.collections.join(' · ')));
  const actions=el('div','paper-overview-actions');actions.append(eventAction(paper.zotero_link,'Open paper in Zotero','paper')||overviewLink('Zotero',null),overviewLink('DOI',paper.doi_link),overviewLink('Website',paper.url_link));host.append(actions);
  const tags=el('section','paper-overview-section');tags.append(el('h3','','Tags'));const tagList=el('div','status-tags');tagList.style.justifyContent='flex-start';const names=[...new Set(Object.values(paper.tags).flat())];if(names.length)names.forEach(name=>tagList.append(tagChip(name)));else tagList.append(el('span','small','No tags'));tags.append(tagList);host.append(tags);
  {const abstract=el('section','paper-overview-section');abstract.append(el('h3','','Abstract'),el('p',paper.abstract?'paper-overview-abstract':'small',paper.abstract||'No abstract available for this paper.'));host.append(abstract);}
  const section=el('section','paper-overview-section');section.append(el('h3','','Annotations by page'),el('p','help',`${entries.length} annotation${entries.length===1?'':'s'} in the selected report range · select a page to inspect its annotations.`));host.append(section);
  const categoryCounts=new Map();entries.forEach(entry=>{const key=entry.category+'\u0000'+entry.color;categoryCounts.set(key,(categoryCounts.get(key)||0)+1);});
  if(categoryCounts.size){const summary=el('div','paper-color-summary');[...categoryCounts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).forEach(([key,count])=>{const [label,color]=key.split('\u0000'),badge=el('span','badge event-category',`${label} · ${count}`);if(validColor(color))badge.style.setProperty('--annotation-color',color);summary.append(badge);});section.append(summary);}
  const groups=paperPageGroups(entries);
  if(!groups.length){section.append(el('p','small','No annotations for this paper in the selected range.'));paperOverviewPage=null;return;}
  if(!groups.some(([page])=>page===paperOverviewPage))paperOverviewPage=groups[0][0];
  const maxCount=Math.max(...groups.map(([,items])=>items.length));
  const layout=el('div','paper-layout-switch');[['plot','Bar plot'],['tiles','Page tiles']].forEach(([mode,label])=>{const button=el('button','',label);button.type='button';button.setAttribute('aria-pressed',String(paperOverviewLayout===mode));button.addEventListener('click',()=>{if(paperOverviewLayout===mode)return;const scroll=host.scrollTop;paperOverviewLayout=mode;renderPaperOverview();host.scrollTop=scroll;});layout.append(button);});section.append(layout);
  section.append(paperOverviewLayout==='plot'?renderPagePlot(groups,maxCount,host):renderPageTiles(groups,maxCount,host));
  const selected=groups.find(([page])=>page===paperOverviewPage)[1],list=el('div','paper-overview-list');section.append(el('h3','',`Page ${paperOverviewPage}`),list);
  selected.forEach(entry=>{const card=el('article','journal-entry');if(validColor(entry.color))card.style.setProperty('--annotation-color',entry.color);const top=el('div','journal-top'),heading=el('div');heading.append(el('strong','',entry.category),el('span','paper-meta',`${entry.event_type} · ${fmt(entry.event_at)}`));const actions=el('div','event-actions');const open=eventAction(entry.zotero_link,'Open annotation in Zotero’s PDF reader','annotation');if(open)actions.append(open);top.append(heading,actions);card.append(top);if(entry.text)card.append(el('div','paper-meta','Highlighted source text'),el('blockquote','',entry.text));if(entry.comment)card.append(el('div','paper-meta','Annotation comment'),el('p','comment',entry.comment));list.append(card);});
}
function openPaperOverview(key){paperOverviewKey=key;paperOverviewPage=null;renderPaperOverview();$('paper-overview-dialog').showModal();}
$('paper-overview-close').addEventListener('click',()=>$('paper-overview-dialog').close());
function renderStatusSummary() {
  const host=$('status-summary');host.replaceChildren();
  const roles=data.status_roles;
  const values=[
    ['new','New',paper=>visibleData.addedPaperKeys.has(paper.key),'#1e7464','#eaf4ed'],
    ...['to_read','reading','read'].filter(role=>roles[role].tag).map(role=>[role,roles[role].label,paper=>paper.status.label===roles[role].label,roles[role].color,roles[role].background]),
    ...(roles.revisit.tag?[['revisit',roles.revisit.label,paper=>paper.status.revisit,roles.revisit.color,roles.revisit.background]]:[]),
    ['unassigned','Unassigned',isUnassignedPaper,'#aab5af','#f7f8f6'],
    ['conflicting','Conflicts',paper=>paper.status.label==='Conflicting statuses','#bc6464','#fcf1f0']
  ];
  values.forEach(([filter,label,matches,color,background])=>{
    const count=visibleData.inventory.filter(matches).length,button=el('button','',`${label} · ${count}`);button.type='button';button.style.setProperty('--status-color',color);button.style.setProperty('--status-bg',background);
    button.addEventListener('click',()=>{$('inventory-filter').value=filter;renderInventory();$('collection-tree').scrollIntoView({behavior:'smooth',block:'start'});});host.append(button);
  });
}
function renderInventory() {
  const query=$('inventory-search').value.toLocaleLowerCase(),filter=$('inventory-filter').value,sort=$('inventory-sort').value;
  const visible=visibleData.inventory.filter(paper=>{
    if(query&&![paper.title,...paper.creators].join(' ').toLocaleLowerCase().includes(query))return false;
    if(!matchesFilterSelection('inventory-tag',Object.values(paper.tags).flat()))return false;
    if(filter==='new')return visibleData.addedPaperKeys.has(paper.key);
    if(filter==='active')return visibleData.annotatedPaperKeys.has(paper.key);
    if(filter==='revisit')return paper.status.revisit;
    if(filter==='unassigned')return isUnassignedPaper(paper);
    if(filter==='conflicting')return paper.status.label==='Conflicting statuses';
    if(['to_read','reading','read'].includes(filter))return paper.status.label===data.status_roles[filter].label;
    return true;
  });
  const compare={title:(a,b)=>a.title.localeCompare(b.title),newest:(a,b)=>b.date_added.localeCompare(a.date_added)||a.title.localeCompare(b.title),oldest:(a,b)=>a.date_added.localeCompare(b.date_added)||a.title.localeCompare(b.title),annotation:(a,b)=>(visibleData.latestAnnotationAt.get(b.key)||'').localeCompare(visibleData.latestAnnotationAt.get(a.key)||'')||a.title.localeCompare(b.title),status:(a,b)=>a.status_group.localeCompare(b.status_group)||a.title.localeCompare(b.title)};
  visible.sort(compare[sort]||compare.title);$('inventory-result').textContent=`${visible.length} of ${visibleData.inventory.length} papers visible`;
  const host=$('collection-tree'),previous=host.querySelector('details.collection-node'),open=new Set([...host.querySelectorAll('details.collection-node[open]')].map(node=>node.dataset.key));host.replaceChildren();
  const children=new Map();data.collections.forEach(collection=>{const parent=collection.parent_key||'';if(!children.has(parent))children.set(parent,[]);children.get(parent).push(collection);});
  const descendants=key=>[key,...(children.get(key)||[]).flatMap(child=>descendants(child.key))];
  function renderNode(collection,depth=0){
    const details=el('details','collection-node');details.dataset.key=collection.key;details.open=previous?open.has(collection.key):depth===0;
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
  if(unfiled.length){const details=el('details','collection-node');details.dataset.key='unfiled';details.open=previous?open.has('unfiled'):true;details.append(el('summary','','Unfiled · '+unfiled.length));const body=el('div','collection-body');unfiled.forEach(paper=>body.append(paperRow(paper)));details.append(body);host.append(details);}
  if(!host.childNodes.length)host.append(el('div','panel empty','No collections in scope.'));
}
function openCollection(keys) {
  $('inventory-search').value='';$('inventory-filter').value='all';filterSelections.set('inventory-tag',null);refreshFilterOptions();renderInventory();activateView('dashboard',false);
  const nodes=[...$('collection-tree').querySelectorAll('details.collection-node')];
  keys.forEach(key=>{let node=nodes.find(candidate=>candidate.dataset.key===key);while(node){node.open=true;node=node.parentElement?.closest('details.collection-node');}});
  const first=nodes.find(node=>node.dataset.key===keys[0]);if(first)first.scrollIntoView({behavior:'smooth',block:'start'});
}

function renderFeed() {
  const query=$('journal-search').value.trim().toLocaleLowerCase();
  const visible=visibleData.activity.filter(event=>matchesJournalDay(event.day)&&matchesFilterSelection('feed-type',[event.type])&&matchesFilterSelection('journal-collection',event.collection_keys.length?event.collection_keys:['__unfiled__'])&&matchesFilterSelection('journal-tag',[...Object.values(event.tags).flat(),...(event.annotation_tags||[])])&&(!query||[event.paper_title,...event.creators,event.category||'',event.text||'',event.comment||''].join(' ').toLocaleLowerCase().includes(query)));
  $('feed-result').textContent=`${visible.length} of ${visibleData.activity.length} events visible`;const host=$('feed-list');host.replaceChildren();
  if(!visible.length){host.append(el('div','panel empty','No activity matches these filters.'));return;}
  const groups=new Map();visible.forEach(event=>{const key=event.collection_group;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(event);});
  [...groups.entries()].sort((a,b)=>a[0].localeCompare(b[0])).forEach(([name,events])=>{
    const section=el('section','feed-collection');
    if(groups.size>1){const jump=el('button','collection-jump',`${name} · ${events.length}`);jump.type='button';jump.addEventListener('click',()=>openCollection(events[0].collection_keys));section.append(jump);}
    const list=el('div','panel');events.forEach(event=>{
      const row=el('div','event-row'),time=el('div','event-time',fmt(event.at)),main=el('div','event-main');row.dataset.refreshKey=`event:${event.key}`;
      const kind=el('strong','event-kind',event.type);kind.dataset.type=event.type;
      const subject=el('div','event-subject');subject.append(paperOverviewTitle(event.paper_title,event.paper_key));main.append(kind,subject);
      if(event.category){const category=el('span','badge event-category',event.category);if(validColor(event.color))category.style.setProperty('--annotation-color',event.color);main.append(category);}
      const side=el('div','event-side'),state=el('span','small',`Now: ${event.status_group}`),actions=el('div','event-actions');
      if(event.type!=='Paper added'){
        const annotationOpen=eventAction(event.zotero_link,'Open annotation in Zotero’s PDF reader · right-click for journal entry','annotation');
        if(annotationOpen){annotationOpen.addEventListener('contextmenu',rightClick=>{rightClick.preventDefault();openJournalEntry(event.key.slice('annotation:'.length));});actions.append(annotationOpen);}
      }
      const paperOpen=eventAction(event.paper_zotero_link||event.zotero_link,'Open paper in Zotero','paper');if(paperOpen)actions.append(paperOpen);
      side.append(state);if(actions.childNodes.length)side.append(actions);row.append(time,main,side);list.append(row);
    });section.append(list);host.append(section);
  });
}

function annotationCard(entry) {
  const card=el('article','journal-entry');card.dataset.refreshKey=`annotation:${entry.key}`;card.tabIndex=-1;if(validColor(entry.color))card.style.setProperty('--annotation-color',entry.color);
  const top=el('div','journal-top'),heading=el('div','journal-heading'),category=el('span','badge event-category',entry.category),actions=el('div','event-actions journal-actions');
  heading.append(paperOverviewTitle(entry.paper_title,entry.paper_key));if(validColor(entry.color))category.style.setProperty('--annotation-color',entry.color);
  const categoryLine=el('div');categoryLine.append(category);heading.append(categoryLine);
  const annotationOpen=eventAction(entry.zotero_link,'Open annotation in Zotero’s PDF reader','annotation');if(annotationOpen)actions.append(annotationOpen);
  const paperOpen=eventAction(entry.paper_zotero_link,'Open paper in Zotero','paper');if(paperOpen)actions.append(paperOpen);
  top.append(heading,actions);card.append(top,el('div','paper-meta',`${entry.event_type} · ${fmt(entry.event_at)}`));
  card.append(el('div','paper-meta',`Current status: ${entry.status_group} · Current collection: ${entry.collection_group} · p. ${entry.page}`));
  if(entry.text){card.append(el('div','paper-meta','Highlighted source text'),el('blockquote','',entry.text));}
  if(entry.comment){card.append(el('div','paper-meta','Annotation comment'),el('p','comment',entry.comment));}
  if(entry.tags.length){const tags=el('div','status-tags');entry.tags.forEach(tag=>tags.append(tagChip(tag)));card.append(tags);}
  return card;
}
function openJournalEntry(key){
  const findCard=()=>[...$('journal-list').querySelectorAll('.journal-entry')].find(node=>node.dataset.refreshKey===`annotation:${key}`);
  if(!findCard()){
    selectedJournalDay=null;$('journal-search').value='';for(const id of ['journal-category','journal-collection','journal-tag'])filterSelections.set(id,null);
    refreshFilterOptions();
    renderActivityCalendar();renderFeed();renderJournal();
  }
  const card=findCard();
  if(!card)return;
  for(let parent=card.parentElement;parent;parent=parent.parentElement)if(parent.matches('details.journal-group'))parent.open=true;
  setJournalMode('annotations');activateView('journal',false);card.scrollIntoView({block:'center',behavior:'auto'});card.focus({preventScroll:true});
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
  const query=$('journal-search').value.trim().toLocaleLowerCase();
  const visible=visibleData.journal.filter(entry=>matchesJournalDay(entry.periods?.day)&&matchesFilterSelection('journal-category',[entry.category])&&matchesFilterSelection('journal-collection',entry.collection_keys.length?entry.collection_keys:['__unfiled__'])&&matchesFilterSelection('journal-tag',[...entry.tags,...Object.values(entry.paper_tags).flat()])&&(!query||[entry.paper_title,entry.text,entry.comment,...entry.creators].join(' ').toLocaleLowerCase().includes(query)));
  $('journal-result').textContent=`${visible.length} of ${visibleData.journal.length} annotations visible`;const host=$('journal-list'),closed=new Set([...host.querySelectorAll('details.journal-group:not([open])')].map(node=>node.dataset.groupKey));host.replaceChildren();
  if(!visible.length){host.append(el('div','panel empty','No annotations match these filters.'));return;}
  const dimensions=groupOrder.filter(group=>activeGroupers.has(group));
  function level(tree,path=[]){
    if(tree.entries){const leaf=el('div');tree.entries.forEach(entry=>leaf.append(annotationCard(entry)));return leaf;}
    const wrapper=el('div');
    tree.groups.forEach(group=>{
      const details=el('details','journal-group'),nextPath=[...path,`${dimensions[path.length]}:${group.key}`];details.dataset.groupKey=JSON.stringify(nextPath);details.open=!closed.has(details.dataset.groupKey);
      details.append(el('summary','',`${group.label} · ${group.count}`));
      const body=el('div','journal-group-body');body.append(level(group.child,nextPath));details.append(body);wrapper.append(details);
    });return wrapper;
  }
  host.append(level(buildGroupTree(visible,dimensions)));
}

function refreshFilterOptions() {
  const paperTags=new Set(),annotationTags=new Set(),categories=new Set();
  visibleData.inventory.forEach(paper=>Object.values(paper.tags).flat().forEach(tag=>paperTags.add(tag)));
  visibleData.journal.forEach(entry=>{categories.add(entry.category);entry.tags.forEach(tag=>annotationTags.add(tag));});
  const collectionNodes=data.collections.map(item=>({key:item.key,parent_key:item.parent_key,label:item.name}));
  if([...visibleData.inventory,...visibleData.journal].some(item=>!item.collection_keys.length))collectionNodes.push({key:'__unfiled__',parent_key:null,label:'Unfiled'});
  const collectionKeys=new Set(collectionNodes.map(node=>node.key)),collectionLabels={all:'All collections',singular:'collection',plural:'collections'};
  const renderBoth=()=>{renderFeed();renderJournal();};
  renderFilterPicker('journal-collection',collectionNodes,collectionKeys,collectionLabels,renderBoth);
  const eventNodes=[['Paper added','#486ca2'],['Annotation created','#17645d'],['Annotation updated','#976029']].map(([key,color])=>({key,label:key,parent_key:null,color}));
  renderFilterPicker('feed-type',eventNodes,new Set(eventNodes.map(node=>node.key)),{all:'All events',singular:'event',plural:'events'},renderFeed);
  renderTagFilter('inventory-tag',paperTags,renderInventory);
  renderTagFilter('journal-tag',new Set([...paperTags,...annotationTags]),renderBoth);
  const categoryNodes=[...categories].sort((a,b)=>a.localeCompare(b)).map(key=>({key,label:key,parent_key:null,color:data.color_legend.find(entry=>entry.label===key)?.color}));
  renderFilterPicker('journal-category',categoryNodes,categories,{all:'All categories',singular:'category',plural:'categories'},renderJournal);
}

function renderVisibleRange() {
  visibleData=deriveRangeView(data,visibleRange);
  if(selectedJournalDay&&!inRange(selectedJournalDay,visibleRange))selectedJournalDay=null;
  if(selectedSizeDate<visibleRange.from||selectedSizeDate>visibleRange.to)selectedSizeDate=visibleRange.to;
  if(selectedSizeMonth<visibleRange.from.slice(0,7)||selectedSizeMonth>visibleRange.to.slice(0,7))selectedSizeMonth=visibleRange.to.slice(0,7);
  $('growth-month').replaceChildren(...sizePoints(visibleRange,'month').map(point=>option(point.label,monthName(point.label))));
  $('growth-date').min=visibleRange.from;$('growth-date').max=visibleRange.to;$('growth-date').value=selectedSizeDate;
  $('range-label').textContent=`${visibleRange.from} – ${visibleRange.to} ▾`;
  $('stat-scope').textContent=visibleData.inventory.length;
  $('stat-active').textContent=visibleData.addedPaperKeys.size;
  $('stat-journal').textContent=visibleData.journal.length;
  renderSizeCharts();
  refreshFilterOptions();
  renderStatusSummary();renderInventory();renderActivityCalendar();renderFeed();renderJournal();
  if($('paper-overview-dialog').open)renderPaperOverview();
}
function refreshPosition(){
  const active=document.querySelector('.view:not([hidden])'),top=$('site-header').getBoundingClientRect().bottom;
  const anchor=[...active.querySelectorAll('[data-refresh-key]')].find(node=>{const box=node.getBoundingClientRect();return box.bottom>top&&box.top<innerHeight;});
  return {scrollY:window.scrollY,key:anchor?.dataset.refreshKey,top:anchor?.getBoundingClientRect().top,view:active.id};
}
function updateJournalReport(nextReport,nextCatalog){
  const position=refreshPosition();data=nextReport;appCatalog=nextCatalog;visibleRange={...data.range};
  drawLegend();renderVisibleRange();
  const active=$(position.view),anchor=[...active.querySelectorAll('[data-refresh-key]')].find(node=>node.dataset.refreshKey===position.key);
  const delta=anchor?anchor.getBoundingClientRect().top-position.top:0;
  window.scrollTo({top:Math.max(0,position.scrollY+delta),behavior:'instant'});
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
  visibleRange={from,to};selectedSizeMonth=to.slice(0,7);rangeDialog.close();renderVisibleRange();
}
$('range-label').addEventListener('click',openRangeDialog);
$('range-close').addEventListener('click',()=>rangeDialog.close());
$('range-cancel').addEventListener('click',()=>rangeDialog.close());
$('range-reset').addEventListener('click',()=>applyRange(data.range.from,data.range.to));
$('range-form').addEventListener('submit',event=>{event.preventDefault();applyRange($('range-from').value,$('range-to').value);});
for(const role of ['to_read','reading','read','revisit']){const item=$('inventory-filter').querySelector(`option[value="${role}"]`);item.textContent=data.status_roles[role].label;item.hidden=!data.status_roles[role].tag;}
drawLegend();renderGroupers();renderVisibleRange();
$('growth-resolution').addEventListener('change',()=>{if($('growth-resolution').value==='month')selectedSizeMonth=visibleRange.to.slice(0,7);renderSizeCharts();});
$('growth-month').addEventListener('change',()=>{selectedSizeMonth=$('growth-month').value;renderSizeCharts();});
$('growth-date').addEventListener('change',()=>{const chosen=$('growth-date').value;if(chosen<visibleRange.from||chosen>visibleRange.to)return;selectedSizeDate=chosen;renderSizeCharts();});
['inventory-search','inventory-filter','inventory-sort'].forEach(id=>$(id).addEventListener(id==='inventory-search'?'input':'change',renderInventory));
$('journal-search').addEventListener('input',()=>{renderFeed();renderJournal();});
