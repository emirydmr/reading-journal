function cascadeTreeSelection(selected,nodes,key,checked) {
  const next=new Set(selected);if(!checked){next.delete(key);return next;}
  const children=new Map();nodes.forEach(node=>{if(!children.has(node.parent_key))children.set(node.parent_key,[]);children.get(node.parent_key).push(node.key);});
  const visit=current=>{next.add(current);(children.get(current)||[]).forEach(visit);};visit(key);return next;
}
function tagTreeNodes(names,basePrefix='') {
  const actual=new Set(names),nodes=new Map();
  [...actual].sort().forEach(tag=>{
    if(!tag.startsWith(basePrefix))return;
    const parts=tag.slice(basePrefix.length).split('/');let parent=null,path=basePrefix;
    parts.forEach((part,index)=>{path+=(index?'/':'')+part;const key=actual.has(path)?path:'@'+path;
      if(!nodes.has(key))nodes.set(key,{key,parent_key:parent,label:part});parent=key;
    });
  });
  return [...nodes.values()];
}
function renderChoiceTree(host,nodes,selected,onChange=()=>{}) {
  host.replaceChildren();const inputs=new Map(),children=new Map(),keys=new Set(nodes.map(node=>node.key));
  nodes.forEach(node=>{const parent=keys.has(node.parent_key)?node.parent_key:null;if(!children.has(parent))children.set(parent,[]);children.get(parent).push(node);});
  const current=()=>new Set([...inputs].filter(([,input])=>input.checked).map(([key])=>key));
  function branch(node,depth=0){
    const below=children.get(node.key)||[],box=el(below.length?'details':'div',below.length?'choice-branch':'choice-leaf');
    if(below.length)box.open=depth===0;
    const row=el(below.length?'summary':'div','choice-line'),input=el('input');input.type='checkbox';input.value=node.key;input.checked=selected.has(node.key);input.className='tree-check';input.setAttribute('aria-label',node.label);inputs.set(node.key,input);
    input.addEventListener('click',event=>event.stopPropagation());
    input.addEventListener('change',()=>{const next=cascadeTreeSelection(current(),nodes,node.key,input.checked);for(const [key,control] of inputs)control.checked=next.has(key);onChange(current());});
    row.append(input);if(node.color){const dot=el('span','category-dot');dot.style.background=node.color;row.append(dot);}row.append(el('span','choice-name',node.label));if(below.length)row.append(el('span','choice-count',String(below.length)));box.append(row);
    if(below.length){const body=el('div','choice-children');below.forEach(child=>body.append(branch(child,depth+1)));box.append(body);}
    return box;
  }
  (children.get(null)||[]).forEach(node=>host.append(branch(node)));
  return current;
}
