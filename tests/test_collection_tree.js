const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'tree-picker.js'), 'utf8');
const context = vm.createContext({appConfig:null});
vm.runInContext(source, context);
context.collections = [
  {key:'ROOT',parent_key:null},
  {key:'CHILD',parent_key:'ROOT'},
  {key:'GRAND',parent_key:'CHILD'},
  {key:'SIBLING',parent_key:'ROOT'},
];
const selected = expression => [...vm.runInContext(expression,context)].sort();
assert.deepEqual(selected("cascadeTreeSelection(new Set(),collections,'ROOT',true)"),['CHILD','GRAND','ROOT','SIBLING']);
assert.deepEqual(selected("cascadeTreeSelection(new Set(['ROOT','CHILD','GRAND','SIBLING']),collections,'CHILD',false)"),['GRAND','ROOT','SIBLING']);
assert.deepEqual(selected("cascadeTreeSelection(new Set(['GRAND']),collections,'CHILD',true)"),['CHILD','GRAND']);
console.log('Collection tree selection checks passed');
