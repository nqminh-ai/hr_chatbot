"""Offline graph component; only embed an already-authorized projection."""
import json

TEMPLATE = r'''<!doctype html><html lang="vi"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box}body{margin:0;font:14px/1.5 system-ui,sans-serif;color:#18354b;background:white}
button,select{font:inherit;border:1px solid #bfced8;border-radius:6px;padding:6px 10px;background:#fff;color:#18354b}
button{cursor:pointer}button:focus-visible,select:focus-visible,[role=button]:focus-visible{outline:3px solid #048a83;outline-offset:2px}
.bar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:6px 2px}.bar label{flex:1;min-width:130px}.bar select{width:100%}
.viewport{height:345px;overflow:auto;border:1px solid #d9e2e8;border-radius:8px;background:#f8fbfd;overscroll-behavior:contain}
svg{display:block;max-width:none}.detail{margin-top:10px}.detail p{margin:4px 0;font-size:12px;color:#466375}
pre{margin:0;max-height:160px;overflow:auto;background:#f4f8fa;padding:10px;border-radius:6px;font:12px/1.5 monospace;white-space:pre-wrap;overflow-wrap:anywhere}
.legend{font-size:12px;color:#466375;padding:4px 0}.node{cursor:pointer}.node text{pointer-events:none;fill:#18354b}.link{fill:none;stroke:#a3b8c6;stroke-width:1.3}.link.selected{stroke:#027c76;stroke-width:2}
@media(prefers-color-scheme:dark){body{background:#111e2a;color:#e5eef5}button,select{background:#192d3e;color:#e5eef5;border-color:#557080}.viewport{background:#122331;border-color:#557080}.detail p,.legend{color:#b1c9d7}pre{background:#192d3e;color:#e5eef5}}
</style>
<div class="bar"><button id="minus" aria-label="Thu nhỏ">−</button><button id="reset">100%</button><button id="plus" aria-label="Phóng to">+</button><button id="fit">Toàn cảnh</button><label><select id="select" aria-label="Chọn node"></select></label></div>
<div class="legend">Tổ chức → Document → Clause → Claim · Chọn node để theo dõi nguồn · Cuộn ngang/dọc ở mức 100%</div>
<div class="viewport" id="viewport"><svg id="svg" role="group" aria-label="Knowledge graph được phân quyền"></svg></div>
<div class="detail"><p id="heading" aria-live="polite">Chọn một node để xem metadata và quan hệ.</p><pre id="metadata">Graph này chỉ chứa dữ liệu được phép cho persona và ngày tra cứu.</pre></div>
<script id="payload" type="application/json">__GRAPH_PAYLOAD__</script>
<script>(()=>{
const graph=JSON.parse(document.getElementById('payload').textContent),$=id=>document.getElementById(id),ns='http://www.w3.org/2000/svg';
let zoom=1,selected=null;const colors={unit:'#e2f3ef',persona:'#e2f3ef',document:'#e3effc',clause:'#fff1d8',claim:'#ede8fa'};
const columns=[['unit','persona'],['document'],['clause'],['claim']],positions=new Map();let height=400;
columns.forEach((kinds,col)=>graph.nodes.filter(n=>kinds.includes(n.kind)).forEach((n,row)=>{positions.set(n.id,{x:25+col*300,y:45+row*85});height=Math.max(height,140+row*85)}));
const width=1210;
function add(tag,attrs,parent){const node=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))node.setAttribute(k,v);parent.append(node);return node}
function select(id){selected=id||null;const node=graph.nodes.find(n=>n.id===id);$('select').value=id||'';if(node){const relations=graph.edges.filter(e=>e.source===id||e.target===id);$('heading').textContent=node.label+' · '+relations.length+' quan hệ trực tiếp';$('metadata').textContent=JSON.stringify({node,relations},null,2)}else{$('heading').textContent='Chọn một node để xem metadata và quan hệ.';$('metadata').textContent='Graph được phân quyền bởi backend.'}render()}
function render(){
const canvas=$('svg');canvas.replaceChildren();canvas.setAttribute('viewBox',`0 0 ${width} ${height}`);canvas.setAttribute('width',width*zoom);canvas.setAttribute('height',height*zoom);$('reset').textContent=Math.round(zoom*100)+'%';
const defs=add('defs',{},canvas),marker=add('marker',{id:'arrow',viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:7,markerHeight:7,orient:'auto'},defs);add('path',{d:'M 0 0 L 10 5 L 0 10 z',fill:'#7895a8'},marker);
['Tổ chức / Persona','Document','Clause','Claim đã resolve'].forEach((label,index)=>{add('text',{x:25+index*300,y:23,fill:'#587687','font-size':12},canvas).textContent=label});
const related=new Set(selected?[selected]:[]);if(selected)for(const edge of graph.edges)if(edge.source===selected||edge.target===selected){related.add(edge.source);related.add(edge.target)}
for(const edge of graph.edges){const a=positions.get(edge.source),b=positions.get(edge.target);if(!a||!b)continue;const active=edge.source===selected||edge.target===selected;let d;if(a.x===b.x){d=`M ${a.x} ${a.y+28} C ${a.x-25} ${a.y+28},${b.x-25} ${b.y+28},${b.x} ${b.y+28}`}else{const forward=b.x>a.x,sx=a.x+(forward?245:0),tx=b.x+(forward?0:245);d=`M ${sx} ${a.y+28} C ${(sx+tx)/2} ${a.y+28},${(sx+tx)/2} ${b.y+28},${tx} ${b.y+28}`}const path=add('path',{d,class:'link'+(active?' selected':''),'marker-end':'url(#arrow)',opacity:selected&&!active?0.18:1},canvas);add('title',{},path).textContent=edge.relation}
for(const node of graph.nodes){const p=positions.get(node.id);const g=add('g',{class:'node',transform:`translate(${p.x},${p.y})`,role:'button',tabindex:0,'aria-label':node.label,opacity:selected&&!related.has(node.id)?0.35:1},canvas);add('rect',{width:245,height:57,rx:7,fill:colors[node.kind],stroke:selected===node.id?'#027c76':'#b2c5d2','stroke-width':selected===node.id?2.5:1},g);const title=node.label.length>31?node.label.slice(0,30)+'…':node.label;add('text',{x:11,y:23,'font-size':14,'font-weight':600},g).textContent=title;add('text',{x:11,y:43,'font-size':11},g).textContent=node.kind+' · '+node.id.slice(-32);add('title',{},g).textContent=node.id;g.addEventListener('click',()=>select(node.id));g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(node.id)}})}
}
const option=document.createElement('option');option.value='';option.textContent='Chọn node…';$('select').append(option);for(const node of graph.nodes){const o=document.createElement('option');o.value=node.id;o.textContent=node.kind+' · '+node.label;$('select').append(o)}
$('select').addEventListener('change',e=>select(e.target.value));$('plus').addEventListener('click',()=>{zoom=Math.min(2,zoom+.15);render()});$('minus').addEventListener('click',()=>{zoom=Math.max(.3,zoom-.15);render()});$('reset').addEventListener('click',()=>{zoom=1;render()});$('fit').addEventListener('click',()=>{zoom=Math.min(1,($('viewport').clientWidth-20)/width);$('viewport').scrollTo(0,0);render()});render();
})();</script></html>'''


def graph_html(graph):
    payload = json.dumps(graph, ensure_ascii=False).replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")
    return TEMPLATE.replace("__GRAPH_PAYLOAD__", payload)
