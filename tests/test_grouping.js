const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'reading_journal', 'web', 'report-ui.js'), 'utf8');
const setup = source.slice(0, source.indexOf('function renderVisibleRange()'));
const context = vm.createContext({
  document: {querySelectorAll:()=>[],getElementById:()=>({addEventListener:()=>{}})},
  data: {
    range: {from:'2026-10-01',to:'2026-10-14'},
    default_groupers: ['status', 'paper', 'category'],
    status_roles: {
      to_read: {label: 'To read'}, reading: {label: 'Reading'},
      read: {label: 'Read'}, revisit: {label: 'Revisit'},
    },
  },
});
vm.runInContext(setup, context);
const legendHost={children:[],replaceChildren(){this.children=[];},append(node){this.children.push(node);}};
context.document.getElementById=id=>id==='color-legend'?legendHost:{addEventListener:()=>{}};
context.document.createElement=tag=>({tag,children:[],style:{setProperty(){}},append(...nodes){this.children.push(...nodes);},setAttribute(name,value){this[name]=value;},addEventListener(_name,listener){this.listener=listener;}});
context.data.color_legend=[{color:'#ffd400',label:'Important',description:'Keep'}];
vm.runInContext('drawLegend();drawLegend()',context);
assert.equal(legendHost.children.length,1);
assert.equal(vm.runInContext('sourceTextPreview("Short source text")',context),null);
context.longSource='A long highlighted passage '.repeat(20);
const preview=vm.runInContext('sourceTextPreview(longSource)',context);
assert.ok(Array.from(preview).length<=361);
assert.ok(preview.endsWith('…'));
context.sourceCard={children:[],append(...nodes){this.children.push(...nodes);}};
context.sourceEntry={key:'ANNOT1',text:context.longSource};
vm.runInContext('appendOriginalText(sourceCard,sourceEntry)',context);
assert.equal(context.sourceCard.children.length,3);
assert.equal(context.sourceCard.children[1].textContent,preview);
assert.equal(context.sourceCard.children[2].textContent,'Show more');
context.sourceCard.children[2].listener();
assert.equal(context.sourceCard.children[1].textContent,context.longSource);
assert.equal(context.sourceCard.children[2].textContent,'Show less');
assert.equal(vm.runInContext("isUnassignedPaper({status:{label:'Unassigned',revisit:false}})",context),true);
assert.equal(vm.runInContext("isUnassignedPaper({status:{label:'Unassigned',revisit:true}})",context),false);
assert.equal(vm.runInContext("isUnassignedPaper({status:{label:'Read',revisit:true}})",context),false);
context.pageEntries=[{page:'10',key:'a'},{page:'2',key:'b'},{page:'2',key:'c'}];
assert.deepEqual(Array.from(vm.runInContext('paperPageGroups(pageEntries)',context),group=>[group[0],group[1].length]),[['2',2],['10',1]]);
context.testingEntries=[1,3,8,15,24,18,9,5,3,2,1,1].flatMap((count,page)=>
  Array.from({length:count},(_,index)=>({page:String(page+1),category:index%3===0?'Important':'Methods',color:index%3===0?'#ffd400':'#f19837'})));
assert.deepEqual(Array.from(vm.runInContext('paperPageGroups(testingEntries)',context),group=>group[1].length),[1,3,8,15,24,18,9,5,3,2,1,1]);
context.testingPage=context.testingEntries.filter(entry=>entry.page==='5');
assert.deepEqual(Array.from(vm.runInContext('paperPageColorCounts(testingPage)',context),item=>[item.category,item.count]),[['Important',8],['Methods',16]]);
context.rows = [
  {key:'A',status_group:'Read',paper_key:'P1',paper_title:'Paper 1',category:'Important',collection_group:'02 + 04',periods:{day:'2026-10-14',week:'2026-W42',month:'2026-10'}},
  {key:'B',status_group:'Read',paper_key:'P1',paper_title:'Paper 1',category:'Question',collection_group:'02 + 04',periods:{day:'2026-10-15',week:'2026-W42',month:'2026-10'}},
  {key:'C',status_group:'To read',paper_key:'P2',paper_title:'Paper 2',category:'Question',collection_group:'03',periods:{day:'2026-09-30',week:'2026-W40',month:'2026-09'}},
];
context.data.timezone='Asia/Shanghai';
context.timestampEntry={event_at:'2026-10-14T09:15:30Z'};
assert.deepEqual(Array.from(vm.runInContext("groupValue(timestampEntry,'timestamp')",context)),['2026-10-14 17:15:30','2026-10-14 17:15:30']);
context.timestampRows=[{key:'older',event_at:'2026-10-14T09:15:30Z'},{key:'newer',event_at:'2026-10-14T09:16:30Z'}];
assert.deepEqual(Array.from(vm.runInContext("buildGroupTree(timestampRows,['timestamp']).groups",context),group=>group.child.entries[0].key),['newer','older']);

const dimensions = ['status', 'paper', 'category', 'collection', 'day', 'week', 'month'];
const permutations = values => values.length ? values.flatMap((value,index)=>permutations(values.filter((_,i)=>i!==index)).map(rest=>[value,...rest])) : [[]];
const leaves = tree => tree.entries ? tree.entries.map(entry=>entry.key) : tree.groups.flatMap(group=>leaves(group.child));
let checked = 0;
for (let mask=0;mask<1<<dimensions.length;mask++) {
  const selected=dimensions.filter((_,i)=>mask&(1<<i));
  for (const order of permutations(selected)) {
    context.order=order;
    const tree=vm.runInContext('buildGroupTree(rows,order)',context);
    assert.deepEqual(Array.from(leaves(tree)).sort(),['A','B','C']);
    if(order[0]==='collection')assert.deepEqual(Array.from(tree.groups,group=>group.label),['02 + 04','03']);
    if(order[0]==='day')assert.deepEqual(Array.from(tree.groups,group=>group.key),['2026-10-15','2026-10-14','2026-09-30']);
    if(order[0]==='week')assert.deepEqual(Array.from(tree.groups,group=>group.key),['2026-W42','2026-W40']);
    if(order[0]==='month')assert.deepEqual(Array.from(tree.groups,group=>group.key),['2026-10','2026-09']);
    checked++;
  }
}
context.sampleData = {
  collections:[{key:'C01',path:'Research / 01'},{key:'C02',path:'Research / 02'}],
  inventory:[
    {key:'P1',date_added_day:'2026-10-01',collection_keys:['C01']},
    {key:'P2',date_added_day:'2026-09-20',collection_keys:['C02']},
    {key:'P3',date_added_day:'2026-10-10',collection_keys:['C01','C02']},
    {key:'P4',date_added_day:'2026-09-10',collection_keys:['C01']},
  ],
  activity:[
    {key:'paper:P1',paper_key:'P1',type:'Paper added',at:'2026-10-01T10:00:00Z',day:'2026-10-01'},
    {key:'paper:P3',paper_key:'P3',type:'Paper added',at:'2026-10-10T10:00:00Z',day:'2026-10-10'},
  ],
  journal:[
    {key:'E1',paper_key:'P1',paper_title:'Paper 1',creators:[],status_group:'Read',collections:['Research / 01'],collection_group:'01',collection_keys:['C01'],resource_link:'',category:'Question',color:'#2ea8e5',paper_tags:{},tags:[],date_added:'2026-10-05T10:00:00Z',date_modified:'2026-10-13T10:00:00Z',added_periods:{day:'2026-10-05',week:'2026-W41',month:'2026-10'},modified_periods:{day:'2026-10-13',week:'2026-W42',month:'2026-10'}},
    {key:'E2',paper_key:'P2',paper_title:'Paper 2',creators:[],status_group:'Reading',collections:['Research / 02'],collection_group:'02',collection_keys:['C02'],resource_link:'',category:'Important',color:'#ffd400',paper_tags:{},tags:[],date_added:'2026-09-20T10:00:00Z',date_modified:'2026-10-12T10:00:00Z',added_periods:{day:'2026-09-20',week:'2026-W38',month:'2026-09'},modified_periods:{day:'2026-10-12',week:'2026-W42',month:'2026-10'}},
  ],
};
const rangeView=(from,to)=>vm.runInContext(`deriveRangeView(sampleData,{from:'${from}',to:'${to}'})`,context);
const early=rangeView('2026-10-01','2026-10-07');
assert.deepEqual(Array.from(early.inventory,paper=>paper.key),['P1']);
assert.deepEqual(Array.from(early.activity,event=>event.type),['Annotation created','Paper added']);
assert.equal(early.journal[0].event_at,'2026-10-05T10:00:00Z');
assert.equal(early.pie.reduce((sum,slice)=>sum+slice.count,0),1);
const late=rangeView('2026-10-12','2026-10-14');
assert.deepEqual(Array.from(late.inventory,paper=>paper.key),['P1','P2']);
assert.deepEqual(Array.from(late.journal,entry=>entry.event_type),['Annotation updated','Annotation updated']);
context.graceEntry={date_added:'2026-10-13T23:50:00Z',date_modified:'2026-10-14T00:10:00Z',added_periods:{day:'2026-10-13'},modified_periods:{day:'2026-10-14'}};
assert.equal(vm.runInContext("annotationInRange(graceEntry,{from:'2026-10-13',to:'2026-10-13'}).event_type",context),'Annotation created');
assert.equal(vm.runInContext("annotationInRange(graceEntry,{from:'2026-10-14',to:'2026-10-14'})",context),null);
context.graceEntry.date_modified='2026-10-14T00:10:01Z';
assert.equal(vm.runInContext("annotationInRange(graceEntry,{from:'2026-10-14',to:'2026-10-14'}).event_type",context),'Annotation updated');
assert.equal(late.growth.at(-1).count,2);
const multiple=rangeView('2026-10-08','2026-10-11');
assert.deepEqual(Array.from(multiple.inventory,paper=>paper.key),['P3']);
assert.equal(multiple.pie[0].name,'Multiple collections');
assert.equal(multiple.multiMembership,1);
const empty=rangeView('2026-10-02','2026-10-04');
assert.equal(empty.inventory.length,0);
assert.equal(empty.activity.length,0);
assert.equal(empty.journal.length,0);
context.data.size_events=[
  {day:'2026-09-18',bucket:'Research / 01 Vehicle Control',count:2},
  {day:'2026-10-05',bucket:'Research / 02 Testing',count:1},
  {day:'2026-10-11',bucket:'Multiple collections',count:1},
];
assert.equal(vm.runInContext("subcollectionLabel('Research / 01 Vehicle Control')",context),'01 Vehicle Control');
assert.equal(vm.runInContext("subcollectionLabel('Research / 02 Testing / Simulation')",context),'02 Testing / Simulation');
assert.equal(vm.runInContext("sizeAt('2026-10-01')",context),2);
assert.equal(vm.runInContext("sizeAt('2026-10-10')",context),3);
assert.equal(vm.runInContext("sizeAt('2026-10-14')",context),4);
assert.equal(vm.runInContext("sizePieAt('2026-10-14').pie.reduce((sum,slice)=>sum+slice.count,0)",context),4);
assert.equal(vm.runInContext("sizePieAt('2026-10-14').multiMembership",context),1);
assert.deepEqual(Array.from(vm.runInContext("sizePoints({from:'2026-10-01',to:'2026-10-14'},'month')",context),point=>point.count),[2,4]);
assert.deepEqual(Array.from(vm.runInContext("sizePoints({from:'2026-10-01',to:'2026-10-14'},'day')",context),point=>point.count).slice(0,7),[2,2,2,2,2,3,3]);
context.data.size_events.push({day:'2026-10-25',bucket:'Research / 02 Testing',count:2});
const monthPoints=vm.runInContext("sizePoints({from:'2026-10-14',to:'2026-10-14'},'month')",context);
assert.equal(monthPoints.at(-1).day,'2026-10-31');
assert.equal(monthPoints.at(-1).count,6);
assert.equal(monthPoints[0].day,'2026-09-30');
assert.equal(vm.runInContext("sizePoints({from:'2026-10-14',to:'2026-10-14'},'day').at(-1).count",context),4);
assert.equal(vm.runInContext("monthLastDay('2024-02')",context),'2024-02-29');
assert.equal(vm.runInContext("monthLastDay('2026-12')",context),'2026-12-31');
const calendar=vm.runInContext("calendarMonths({from:'2026-10-30',to:'2026-11-02'})",context);
assert.deepEqual(Array.from(calendar,month=>[month.month,Array.from(month.days)]),[
  ['2026-10',['2026-10-30','2026-10-31']],['2026-11',['2026-11-01','2026-11-02']],
]);
assert.equal(vm.runInContext('activityLevel(0)',context),0);
assert.equal(vm.runInContext('activityLevel(1)',context),1);
assert.equal(vm.runInContext('activityLevel(8)',context),4);
assert.equal(vm.runInContext("activityCountsByDay([{day:'2026-10-14'},{day:'2026-10-14'},{day:'2026-10-13'}]).get('2026-10-14')",context),2);
assert.equal(vm.runInContext("toggleJournalDay('2026-10-14')",context),'2026-10-14');
assert.equal(vm.runInContext("matchesJournalDay('2026-10-14')",context),true);
assert.equal(vm.runInContext("matchesJournalDay('2026-10-13')",context),false);
assert.equal(vm.runInContext("toggleJournalDay('2026-10-14')",context),null);
assert.equal(vm.runInContext("matchesJournalDay('2026-10-13')",context),true);
console.log(`Grouping checks passed: ${checked} orders/subsets`);
