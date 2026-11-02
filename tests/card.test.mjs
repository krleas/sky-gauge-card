import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../sky-gauge-card.js',import.meta.url),'utf8');
function runtime(){
 class Element{constructor(){this.events=[];}attachShadow(){this.shadowRoot={innerHTML:'',querySelector:()=>null,querySelectorAll:()=>[]};}dispatchEvent(event){this.events.push(event);}}
 const registry=new Map(),memory=new Map();
 const context=vm.createContext({HTMLElement:Element,customElements:{get:k=>registry.get(k),define:(k,v)=>{assert.ok(!registry.has(k));registry.set(k,v);}},window:{},requestAnimationFrame:()=>{},document:{createElement:tag=>new (registry.get(tag)||Element)()},CustomEvent:class{constructor(type,options){this.type=type;Object.assign(this,options);}},localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)}});
 vm.runInContext(source,context);
 return {registry,context,Card:registry.get('sky-gauge-card'),Editor:registry.get('sky-gauge-card-editor')};
}
test('module registers once, even when evaluated twice',()=>{const r=runtime();vm.runInContext(source,r.context);assert.equal(r.registry.size,2);assert.equal(r.context.window.customCards.length,1);});
test('Single/Dual across every arc and color mode',()=>{const {Card}=runtime();let count=0;
 for(const mode of ['single','dual'])for(const arc_style of ['full','progress','indicator'])for(const color_mode of ['ranges','fixed','gradient'])for(const state of ['0','50','100','-20','unavailable']){
 const card=new Card();card.setConfig({entity:'sensor.demo',mode,secondary_entity:mode==='dual'?'sensor.second':'',secondary_unit:'',min:0,max:100,secondary_min:-100,secondary_max:100,arc_style,color_mode,secondary_color_mode:color_mode});
 card.hass={states:{'sensor.demo':{state},'sensor.second':{state:'-30'}}};
 assert.ok(!card.shadowRoot.innerHTML.includes('NaN'));assert.ok(card.shadowRoot.innerHTML.includes('ha-card'));count++;
 }assert.equal(count,90);
});
test('Dual defaults and explicit overrides',()=>{const {Card}=runtime();const card=new Card();card.setConfig({entity:'sensor.a',mode:'dual',secondary_entity:'sensor.b'});assert.equal(card._config.secondary_font_size,32);card.setConfig({entity:'sensor.a',mode:'dual',secondary_entity:'sensor.b',secondary_font_size:28});assert.equal(card._config.secondary_font_size,28);});
test('Dot size and outline work on Single and Dual',()=>{const {Card}=runtime();for(const mode of ['single','dual']){const card=new Card();card.setConfig({entity:'sensor.a',mode,secondary_entity:mode==='dual'?'sensor.b':'',indicator_style:'dot',indicator_width:20,indicator_outline_width:5.5,indicator_outline_color:'#abcdef',secondary_unit:''});card.hass={states:{'sensor.a':{state:'25'},'sensor.b':{state:'-15'}}};const dots=card.shadowRoot.innerHTML.match(/<circle class="gauge-indicator-dot"[^>]+>/g)||[];assert.equal(dots.length,mode==='dual'?2:1);assert.ok(dots.every(dot=>dot.includes('r="10"')&&dot.includes('stroke-width="5.5"')));}});
test('Fixed has hard boundaries and correct indicator colors',()=>{const {Card}=runtime();for(const [value,color]of [[49,'#00ff00'],[50,'#ff0000']]){const card=new Card();card.setConfig({entity:'sensor.a',min:0,max:100,color_intensity:1,color_mode:'fixed',arc_style:'indicator',segments:[{from:0,to:.5,color:'#00ff00'},{from:.5,to:1,color:'#ff0000'}]});card.hass={states:{'sensor.a':{state:String(value)}}};assert.ok(card.shadowRoot.innerHTML.includes('stroke="'+color+'"'));}});
test('minimum grid and proportional composition bounds',()=>{const {Card}=runtime();const card=new Card();assert.equal(card.getGridOptions().min_columns,3);assert.equal(card.getGridOptions().min_rows,2);const stage={style:{}},box={};card.shadowRoot.querySelector=s=>s==='ha-card'?box:s==='.composition'?stage:null;card._fitSecondary=()=>{};for(const [w,h]of [[112,120],[160,120],[160,184],[240,248]]){box.clientWidth=w;box.clientHeight=h;card._layoutComposition();const scale=Number(stage.style.transform.match(/scale\(([^)]+)\)/)[1]);assert.ok(160*scale<=w+.01&&184*scale<=h+.01);}});
test('missing entity and unsafe label text',()=>{const {Card}=runtime();const card=new Card();card.setConfig({entity:'sensor.missing',name:'<img src=x onerror=alert(1)>'});card.hass={states:{}};assert.ok(card.shadowRoot.innerHTML.includes('—'));assert.ok(!card.shadowRoot.innerHTML.includes('<img src=x'));});
test('invalid configuration rejected',()=>{const {Card}=runtime();const card=new Card();assert.throws(()=>card.setConfig({entity:'sensor.a',min:10,max:5}));assert.throws(()=>card.setConfig({entity:'sensor.a',decimals:100}));assert.throws(()=>card.setConfig({entity:'sensor.a',mode:'dual'}));});
test('presets: style only preserves data, full restores, reset restores defaults',()=>{const {Editor}=runtime();const editor=new Editor();editor._render=()=>{};editor._config={entity:'sensor.first',name:'First',min:0,max:14000,unit:'kW',scale:.001,value_font_size:55};editor._savePreset('Demo');assert.throws(()=>editor._savePreset('Demo'));editor._config={entity:'sensor.second',name:'Second',min:-6000,max:6000,unit:'W',scale:1,value_font_size:30};editor._loadPreset('Demo','style');assert.equal(editor._config.entity,'sensor.second');assert.equal(editor._config.value_font_size,55);editor._resetAppearance();assert.equal(editor._config.value_font_size,undefined);assert.equal(editor._config.entity,'sensor.second');editor._loadPreset('Demo','full');assert.equal(editor._config.entity,'sensor.first');});


test('card click and keyboard open the current primary entity after live updates',()=>{
 const {Card}=runtime();const card=new Card();const surface={style:{setProperty(){}}};
 card.shadowRoot.querySelector=s=>s==='ha-card'?surface:null;
 card.setConfig({entity:'sensor.first',name:'First'});card.hass={states:{'sensor.first':{state:'10'}}};
 surface.onclick();assert.equal(card.events.at(-1).type,'hass-more-info');assert.equal(card.events.at(-1).detail.entityId,'sensor.first');assert.equal(card.events.at(-1).bubbles,true);assert.equal(card.events.at(-1).composed,true);
 card.setConfig({entity:'sensor.second',mode:'dual',secondary_entity:'sensor.other'});card.hass={states:{'sensor.second':{state:'20'},'sensor.other':{state:'30'}}};
 for(const key of ['Enter',' ']){let prevented=false;surface.onkeydown({key,preventDefault(){prevented=true;}});assert.ok(prevented);assert.equal(card.events.at(-1).detail.entityId,'sensor.second');}
 const count=card.events.length;surface.onkeydown({key:'Escape'});assert.equal(card.events.length,count);
 card.hass={states:{'sensor.second':{state:'21'},'sensor.other':{state:'31'}}};surface.onclick();assert.equal(card.events.length,count+1);
});
