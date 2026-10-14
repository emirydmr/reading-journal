const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'reading_journal', 'web', 'report-ui.js'), 'utf8');
const setup = source.slice(0, source.indexOf('function renderVisibleRange()'));
const context = vm.createContext({
  document: {querySelectorAll:()=>[]},
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
assert.equal(vm.runInContext("isUnassignedPaper({status:{label:'Unassigned',revisit:false}})",context),true);
assert.equal(vm.runInContext("isUnassignedPaper({status:{label:'Unassigned',revisit:true}})",context),false);
assert.equal(vm.runInContext("isUnassignedPaper({status:{label:'Read',revisit:true}})",context),false);
context.rows = [
  {key:'A',status_group:'Read',paper_key:'P1',paper_title:'Paper 1',category:'Important',collection_group:'02 + 04',periods:{day:'2026-10-14',week:'2026-W42',month:'2026-10'}},
  {key:'B',status_group:'Read',paper_key:'P1',paper_title:'Paper 1',category:'Question',collection_group:'02 + 04',periods:{day:'2026-10-15',week:'2026-W42',month:'2026-10'}},
  {key:'C',status_group:'To read',paper_key:'P2',paper_title:'Paper 2',category:'Question',collection_group:'03',periods:{day:'2026-09-30',week:'2026-W40',month:'2026-09'}},
];

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
console.log(`Grouping checks passed: ${checked} orders/subsets`);
