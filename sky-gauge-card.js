/* Sky Gauge Card v0.1.2 · by Kopterworx · MIT License */
(()=>{
'use strict';

const SKY_GAUGE_VERSION='0.1.2';
const SKY_ADV_GROUPS={
  arc:{title:'Arc geometry',fields:[
    ['arc_radius','Radius',89,45,95,1],['arc_width','Arc thickness',10,2,20,1],
    ['arc_start','Start angle',-135,-180,180,1],['arc_sweep','Arc sweep',270,30,359,1],
    ['dual_gap','Dual ring spacing',10,5,30,1],['inactive_color','Inactive color','#808080','color'],
    ['inactive_opacity','Inactive opacity',.2,0,1,.01],['color_intensity','Color intensity',.8,0,1,.01]]},
  indicator:{title:'Indicator',fields:[
    ['indicator_style','Shape','line',['line','dot']],['indicator_width','Thickness',6,1,12,1],
    ['indicator_length','Length',6,4,40,1],['indicator_color','Color','#ffffff','color'],
    ['indicator_outline_width','Outline thickness',3.25,0,8,.25],
    ['indicator_outline_color','Outline color','#202020','color'],['indicator_hidden','Hide indicator',false,'check']]},
  value:{title:'Main value',fields:[
    ['font_family','Font family','Montserrat',['Montserrat','Roboto','Arial','sans-serif']],
    ['value_font_size','Font size',49,8,80,1],['value_font_weight','Font weight',600,100,900,100],
    ['value_letter_spacing','Letter spacing',.5,-5,10,.1],['value_color','Color','#ffffff','color'],
    ['value_x','Horizontal position',110,20,200,1],['value_y','Vertical position',113,20,180,1]]},
  secondary:{title:'Secondary value',fields:[
    ['secondary_font_size','Font size',16,8,80,1],['secondary_font_weight','Font weight',400,100,900,100],
    ['secondary_letter_spacing','Letter spacing',0,-5,10,.1],['secondary_color','Color','#ffffff','color'],
    ['secondary_x','Horizontal position',110,20,200,1],['secondary_y','Vertical position',143,20,180,1],
    ['secondary_text','Fallback text','','text'],['secondary_attribute','Entity attribute','','text']]},
  unit:{title:'Units',fields:[
    ['unit_font_size','Main unit size',16,8,40,1],['unit_font_weight','Main unit weight',500,100,900,100],
    ['unit_color','Main unit color','#ffffff','color'],['unit_x','Main unit horizontal',110,20,200,1],
    ['unit_y','Main unit vertical',47,20,180,1],['secondary_unit_font_size','Ring 2 unit size',12,8,30,1],
    ['secondary_unit_color','Ring 2 unit color','#ffffff','color']]},
  icon:{title:'Icon & name',fields:[
    ['icon_size','Icon size',26,8,60,1],['icon_color','Icon color','#53a9df','color'],
    ['icon_x','Icon horizontal',0,-80,80,1],['icon_y','Icon vertical',-8,-40,40,1],
    ['icon_hidden','Hide icon',false,'check'],['name_font_size','Name size',15,8,32,1],
    ['name_font_weight','Name weight',500,100,900,100],['name_letter_spacing','Name letter spacing',0,-3,8,.1],
    ['name_color','Name color','#ffffff','color'],['name_x','Name horizontal',0,-80,80,1],
    ['name_y','Name vertical',0,-40,40,1],['name_hidden','Hide name',false,'check']]},
  card:{title:'Card appearance',fields:[
    ['background_color','Background','#000000','color'],['background_opacity','Background opacity',.7,0,1,.01],
    ['border_width','Border thickness',1,0,8,1],['border_color','Border color','#444444','color'],
    ['border_radius','Corner radius',13,0,50,1],['card_shadow','Shadow','none',['none','soft','glow']],['glow_intensity','Glow intensity',40,0,100,1],['glow_color','Glow color','#53a9df','color'],['shadow_intensity','Shadow intensity',40,0,100,1],['shadow_color','Shadow color','#000000','color'],['shadow_blur','Shadow blur',16,0,60,1],['shadow_offset','Shadow offset',4,0,30,1]]}
};

class SkyGaugeCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode:'open'});
    this._config = {};
    this._lastKey = '';
  }
  connectedCallback() {
    if(typeof ResizeObserver!=='undefined'){
      this._sizeObserver?.disconnect();
      this._sizeObserver=new ResizeObserver(()=>this._layoutComposition());
      this._sizeObserver.observe(this);
    }
    requestAnimationFrame(()=>this._layoutComposition());
    // Load the complete Montserrat weight range once; the dashboard's
    // existing font link provides only weight 500.
    if (!document.getElementById('sky-gauge-montserrat-weights')) {
      const link=document.createElement('link');
      link.id='sky-gauge-montserrat-weights';
      link.rel='stylesheet';
      link.href='https://fonts.googleapis.com/css2?family=Montserrat:wght@100;200;300;400;500;600;700;800;900&display=swap';
      document.head.appendChild(link);
    }
  }
  disconnectedCallback(){this._sizeObserver?.disconnect();}
  _showMoreInfo(){
    if(this._config.entity)this.dispatchEvent(new CustomEvent('hass-more-info',{
      detail:{entityId:this._config.entity},bubbles:true,composed:true
    }));
  }
  _layoutComposition(){
    const card=this.shadowRoot.querySelector('ha-card'),stage=this.shadowRoot.querySelector('.composition');
    if(!card||!stage)return;
    const width=card.clientWidth,height=card.clientHeight;
    if(width<=0||height<=0)return;
    // Preserve the approved 160 × 184 reference composition at standard 4 × 3.
    // Its original SVG letterboxing and footer already include the required clearance.
    const scale=Math.max(.01,Math.min(width/160,height/184));
    stage.style.transform='translate(-50%,-50%) scale('+scale+')';
    stage.style.visibility='visible';
    this._fitSecondary();
  }
  static getConfigElement(){return document.createElement('sky-gauge-card-editor');}
  static getStubConfig(hass){
    const entity=Object.keys(hass?.states||{}).find(id=>id.startsWith('sensor.') && Number.isFinite(Number(hass.states[id].state)));
    return {type:'custom:sky-gauge-card',entity:entity||'',name:'Sky Gauge Card',min:0,max:100,scale:1,unit:'',decimals:1,mode:'single'};
  }
  setConfig(config) {
    for(const [lo,hi] of [['min','max'],...(config.mode==='dual'?[['secondary_min','secondary_max']]:[])]){
      const a=Number(config[lo]??(lo==='min'?0:-6000)),b=Number(config[hi]??(hi==='max'?16000:6000));
      if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a)throw new Error('Sky Gauge Card: maximum must be greater than minimum.');
    }
    for(const key of ['decimals','secondary_decimals']){
      if(config[key]!=null&&(!Number.isInteger(Number(config[key]))||Number(config[key])<0||Number(config[key])>6))throw new Error('Sky Gauge Card: decimal places must be an integer from 0 to 6.');
    }
    for(const key of ['scale','secondary_scale']){
      if(config[key]!=null&&!Number.isFinite(Number(config[key])))throw new Error('Sky Gauge Card: scale must be a valid number.');
    }
    if(config.mode==='dual'&&!config.secondary_entity)throw new Error('Sky Gauge Card: Dual mode requires a secondary entity.');

    if (!config.entity) throw new Error('sky-gauge-card: entity is required');
    this._config = {
      min:0, max:16000, scale:0.001, decimals:1,
      unit:'kW', name:'Peak', icon:'mdi:transmission-tower',
      indicator_style:'line', indicator_color:'#ffffff', indicator_width:6, indicator_length:6,
      mode:'single', color_intensity:0.8,
      secondary_min:-6000, secondary_max:6000,
      secondary_entity:'', secondary_attribute:'', secondary_text:'',
      secondary_scale:1, secondary_decimals:null, secondary_unit:null,
      secondary_font_size:config.mode==='dual'?32:16, secondary_font_weight:config.mode==='dual'?600:400,
      value_font_weight:600, value_letter_spacing:0.5,
      unit_font_weight:500, unit_letter_spacing:0,
      name_font_weight:500, name_letter_spacing:0,
      segments:[
        {from:0,to:0.85,color:'#109d20'},
        {from:0.85,to:0.94,color:'#e4a00a'},
        {from:0.94,to:1,color:'#df2626'}
      ],
      ...config
    };
    this._lastKey='';
    if(this._hass)this.hass=this._hass;
  }
  set hass(hass) {
    this._hass=hass;
    const c=this._config, st=hass.states[c.entity];
    const raw=st && st.state!=='' && st.state!==null ? Number(st.state) : NaN;
    const secondaryState=c.secondary_entity?hass.states[c.secondary_entity]:null;
    const secondaryRaw=secondaryState?(c.secondary_attribute?secondaryState.attributes?.[c.secondary_attribute]:secondaryState.state):null;
    const key=[st?.state,secondaryRaw,c.secondary_entity,c.secondary_attribute,c.secondary_text,c.secondary_scale,c.secondary_decimals,c.secondary_unit,c.secondary_font_size,c.secondary_font_weight,c.dual_negative_color,c.dual_positive_color,c.icon,c.mode,c.secondary_min,c.secondary_max,c.name,c.min,c.max,c.unit,c.decimals,c.scale,c.value_font_weight,c.value_letter_spacing,c.unit_font_weight,c.unit_letter_spacing,c.name_font_weight,c.name_letter_spacing,c.indicator_style,c.indicator_color,c.indicator_width,c.indicator_length,c.color_intensity,c.arc_style,c.color_mode,c.secondary_color_mode,JSON.stringify(c.gradient_stops),JSON.stringify(c.secondary_gradient_stops),JSON.stringify(c.secondary_segments),JSON.stringify(c.segments)].join('|');
    if (this._lastKey===key) return;
    this._lastKey=key;
    const min=Number(c.min), max=Number(c.max);
    const f=Number.isFinite(raw)&&max>min?Math.max(0,Math.min(1,(raw-min)/(max-min))):0;
    // Degrees from top, clockwise; 270° open at bottom.
    const num=(key,fallback,min=-500,max=500)=>Number.isFinite(Number(c[key]))&&c[key]!=null?Math.max(min,Math.min(max,Number(c[key]))):fallback;
    const start=num('arc_start',-135,-180,180),sweep=num('arc_sweep',270,30,359.9),cx=110,cy=99,radius=num('arc_radius',89,45,95);
    const polar=a=>{const t=a*Math.PI/180;return [cx+radius*Math.sin(t),cy-radius*Math.cos(t)];};
    const path=(a,b)=>{const [x1,y1]=polar(a),[x2,y2]=polar(b);return 'M '+x1.toFixed(3)+' '+y1.toFixed(3)+' A '+radius+' '+radius+' 0 '+((b-a)>180?1:0)+' 1 '+x2.toFixed(3)+' '+y2.toFixed(3);};
    const colorIntensity=Math.max(0,Math.min(1,Number.isFinite(Number(c.color_intensity))?Number(c.color_intensity):0.8));
    const toneColor=color=>{
      const hex=String(color||'#ffffff').replace('#','');
      const full=hex.length===3?hex.split('').map(x=>x+x).join(''):hex;
      if(!/^[0-9a-fA-F]{6}$/.test(full))return color;
      return '#'+[0,2,4].map(i=>Math.round(parseInt(full.slice(i,i+2),16)*colorIntensity).toString(16).padStart(2,'0')).join('');
    };
    const segs=(Array.isArray(c.segments)?c.segments:[])
      .filter(s=>Number(s.to)>Number(s.from))
      .sort((a,b)=>Number(a.from)-Number(b.from));
    // Render continuous paths. Only the short color transitions use native SVG gradients.
    // No dozens of individual strokes: those caused visible striped raster artifacts.
    const clamp=n=>Math.max(0,Math.min(1,n));
    const stops=segs.length
      ? [{p:clamp(Number(segs[0].from)),color:toneColor(segs[0].color)}]
      : [];
    for(let i=1;i<segs.length;i++){
      const boundary=clamp(Number(segs[i].from));
      const previous=stops[stops.length-1];
      const transitionStart=c.color_mode==='fixed'?boundary:Math.max(previous.p,boundary-0.10);
      stops.push({p:transitionStart,color:previous.color});
      stops.push({p:boundary,color:toneColor(segs[i].color)});
    }
    if(segs.length) stops.push({
      p:clamp(Number(segs[segs.length-1].to)),
      color:toneColor(segs[segs.length-1].color)
    });
    const arcAt=(a,b)=>path(start+sweep*a,start+sweep*b);
    let gradients='', arcs='';
    for(let i=1;i<stops.length;i++){
      const a=stops[i-1],b=stops[i];
      if(b.p-a.p<0.00001) continue;
      if(a.color===b.color){
        arcs+='<path d="'+arcAt(a.p,b.p)+'" fill="none" stroke="'+a.color+'" stroke-width="10" stroke-linecap="butt"/>';
      }else{
        const [x1,y1]=polar(start+sweep*a.p);
        const [x2,y2]=polar(start+sweep*b.p);
        const id='sky-gauge-grad-'+i;
        gradients+='<linearGradient id="'+id+'" gradientUnits="userSpaceOnUse" x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'">'
          +'<stop offset="0%" stop-color="'+a.color+'"/><stop offset="100%" stop-color="'+b.color+'"/></linearGradient>';
        arcs+='<path d="'+arcAt(a.p,b.p)+'" fill="none" stroke="url(#'+id+')" stroke-width="10" stroke-linecap="butt"/>';
      }
    }
    if(stops.length){
      const a=stops[0],b=stops[stops.length-1];
      for(const cap of [a,b]){
        const [x,y]=polar(start+sweep*cap.p);
        arcs+='<circle cx="'+x+'" cy="'+y+'" r="5" fill="'+cap.color+'"/>';
      }
    }
    const gradientStops=secondary=>{
      const list=c[secondary?'secondary_gradient_stops':'gradient_stops'];
      return (Array.isArray(list)&&list.length>=2?list:[{position:0,color:'#109d20'},{position:1,color:'#df2626'}])
        .map(x=>({p:clamp(Number(x.position)),color:toneColor(x.color)})).sort((a,b)=>a.p-b.p);
    };
    const blend=(a,b,t)=>/^#[0-9a-f]{6}$/i.test(a)&&/^#[0-9a-f]{6}$/i.test(b)
      ? '#'+[1,3,5].map(j=>Math.round(parseInt(a.slice(j,j+2),16)*(1-t)+parseInt(b.slice(j,j+2),16)*t).toString(16).padStart(2,'0')).join(''):a;
    const gradientColor=(list,p)=>{
      if(p<=list[0].p)return list[0].color;
      for(let i=1;i<list.length;i++)if(p<=list[i].p)return blend(list[i-1].color,list[i].color,(p-list[i-1].p)/(list[i].p-list[i-1].p||1));
      return list[list.length-1].color;
    };
    const paintGradient=(r,width,id,secondary)=>{
      const list=gradientStops(secondary),point=p=>{const t=(start+sweep*p)*Math.PI/180;return [cx+r*Math.sin(t),cy-r*Math.cos(t)]};
      const positions=[0,...list.map(x=>x.p),1].sort((a,b)=>a-b).filter((x,i,a)=>!i||x>a[i-1]);
      let gradient='',arcs='',n=0;
      for(let k=1;k<positions.length;k++){
        const from=positions[k-1],to=positions[k],steps=Math.max(1,Math.ceil((to-from)*24));
        for(let j=0;j<steps;j++){
          const a=from+(to-from)*j/steps,b=from+(to-from)*(j+1)/steps;
          const [x1,y1]=point(a),[x2,y2]=point(b),gid=id+'-'+n++;
          gradient+='<linearGradient id="'+gid+'" gradientUnits="userSpaceOnUse" x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'"><stop offset="0%" stop-color="'+gradientColor(list,a)+'"/><stop offset="100%" stop-color="'+gradientColor(list,b)+'"/></linearGradient>';
          const [ex,ey]=point(Math.min(1,b+.00015));
          arcs+='<path d="M '+x1+' '+y1+' A '+r+' '+r+' 0 0 1 '+ex+' '+ey+'" fill="none" stroke="url(#'+gid+')" stroke-width="'+width+'"/>';
        }
      }
      for(const p of [0,1]){const [x,y]=point(p);arcs+='<circle cx="'+x+'" cy="'+y+'" r="'+width/2+'" fill="'+gradientColor(list,p)+'"/>';}
      return {gradient,arcs};
    };
    if(c.color_mode==='gradient'){const g=paintGradient(radius,10,'sky-gradient-single',false);gradients=g.gradient;arcs=g.arcs;}
    const angle=start+sweep*f;
    const dualMode=c.mode==='dual'&&Boolean(c.secondary_entity);
    const dualRaw=Number(secondaryRaw);
    const dualMin=Number(c.secondary_min), dualMax=Number(c.secondary_max);
    const dualF=Number.isFinite(dualRaw)&&dualMax>dualMin
      ? Math.max(0,Math.min(1,(dualRaw-dualMin)/(dualMax-dualMin))):0;
    const dualRadius=radius-num('dual_gap',10,5,30);
    const dualRingPath=(r,a,b)=>{
      const point=deg=>{const t=deg*Math.PI/180;return [cx+r*Math.sin(t),cy-r*Math.cos(t)]};
      const [x1,y1]=point(start+sweep*a),[x2,y2]=point(start+sweep*b);
      return 'M '+x1.toFixed(3)+' '+y1.toFixed(3)+' A '+r+' '+r+' 0 '+((b-a)*sweep>180?1:0)+' 1 '+x2.toFixed(3)+' '+y2.toFixed(3);
    };
    const dualDefaults=[
      {from:0,to:.5,color:c.dual_negative_color||'#159d1c'},
      {from:.5,to:1,color:c.dual_positive_color||'#d72323'}
    ];
    const dualRing=(r,id,segments)=>{
      const secondary=id==='sky-dual-inner';
      if(c[secondary?'secondary_color_mode':'color_mode']==='gradient')return paintGradient(r,8,id+'-gradient',secondary);
      const point=p=>{const t=(start+sweep*p)*Math.PI/180;return [cx+r*Math.sin(t),cy-r*Math.cos(t)]};
      const ranges=(Array.isArray(segments)?segments:dualDefaults).filter(s=>Number(s.to)>Number(s.from)).slice().sort((a,b)=>a.from-b.from);
      const stops=[];
      if(ranges.length)stops.push({p:clamp(Number(ranges[0].from)),color:toneColor(ranges[0].color)});
      for(let i=1;i<ranges.length;i++){
        const boundary=clamp(Number(ranges[i].from)),previous=stops[stops.length-1];
        stops.push({p:c[secondary?'secondary_color_mode':'color_mode']==='fixed'?boundary:Math.max(previous.p,boundary-.10),color:previous.color});
        stops.push({p:boundary,color:toneColor(ranges[i].color)});
      }
      if(ranges.length)stops.push({p:clamp(Number(ranges[ranges.length-1].to)),color:toneColor(ranges[ranges.length-1].color)});
      let gradient='',arcs='';
      for(let i=1;i<stops.length;i++){
        const a=stops[i-1],b=stops[i];if(b.p-a.p<.00001)continue;
        let stroke=a.color;
        if(a.color!==b.color){
          const [x1,y1]=point(a.p),[x2,y2]=point(b.p),gid=id+'-'+i;
          gradient+='<linearGradient id="'+gid+'" gradientUnits="userSpaceOnUse" x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'"><stop offset="0%" stop-color="'+a.color+'"/><stop offset="100%" stop-color="'+b.color+'"/></linearGradient>';
          stroke='url(#'+gid+')';
        }
        arcs+='<path d="'+dualRingPath(r,a.p,b.p)+'" fill="none" stroke="'+stroke+'" stroke-width="8" stroke-linecap="butt"/>';
      }
      if(stops.length)for(const cap of [stops[0],stops[stops.length-1]]){
        const [x,y]=point(cap.p);arcs+='<circle cx="'+x+'" cy="'+y+'" r="4" fill="'+cap.color+'"/>';
      }
      return {gradient,arcs};
    };
    const outerDual=dualRing(radius,'sky-dual-outer',c.segments);
    const innerDual=dualRing(dualRadius,'sky-dual-inner',c.secondary_segments);
    const arcStyle=['progress','indicator'].includes(c.arc_style)?c.arc_style:'full';
    const colorAt=(ranges,p,secondary=false)=>{
      if(c[secondary?'secondary_color_mode':'color_mode']==='gradient')return gradientColor(gradientStops(secondary),p);
      const list=(Array.isArray(ranges)?ranges:dualDefaults).filter(s=>s.to>s.from).slice().sort((a,b)=>a.from-b.from);
      if(!list.length)return '#ffffff';
      let color=toneColor(list[0].color);
      for(let i=1;i<list.length;i++){
        const boundary=clamp(Number(list[i].from)),next=toneColor(list[i].color);
        const begin=c[secondary?'secondary_color_mode':'color_mode']==='fixed'?boundary:Math.max(Number(list[i-1].from),boundary-.10);
        if(p>=boundary){color=next;continue;}
        if(p>begin&&/^#[0-9a-f]{6}$/i.test(color)&&/^#[0-9a-f]{6}$/i.test(next)){
          const t=(p-begin)/(boundary-begin);
          color='#'+[1,3,5].map(j=>Math.round(parseInt(color.slice(j,j+2),16)*(1-t)+parseInt(next.slice(j,j+2),16)*t).toString(16).padStart(2,'0')).join('');
        }
        break;
      }
      return color;
    };
    const arcLayer=(markup,r,p,id)=>{
      if(arcStyle==='indicator')return '';
      if(arcStyle!=='progress'||p>=1)return markup;
      if(p<=0)return '';
      const t=start*Math.PI/180,sx=cx+r*Math.sin(t),sy=cy-r*Math.cos(t);
      // Reveal the original rounded start cap without extending the progress endpoint.
      return '<defs><mask id="'+id+'" maskUnits="userSpaceOnUse" x="0" y="0" width="220" height="200"><circle cx="'+sx+'" cy="'+sy+'" r="'+(num('arc_width',10,2,20)/2+1)+'" fill="white"/><path d="'+dualRingPath(r,0,1)+'" pathLength="1" stroke="white" stroke-width="24" fill="none" stroke-dasharray="'+p+' 1" stroke-linecap="butt"/></mask></defs><g mask="url(#'+id+')">'+markup+'</g>';
    };
    const dualPointer=(r,p,ranges)=>{
      const t=(start+sweep*p)*Math.PI/180;
      const pos=rr=>[cx+rr*Math.sin(t),cy-rr*Math.cos(t)];
      const half=num('indicator_length',6,4,40)/2;
      const [x1,y1]=pos(r-half),[x2,y2]=pos(r+half);
      const coords='x1="'+x1.toFixed(3)+'" y1="'+y1.toFixed(3)+'" x2="'+x2.toFixed(3)+'" y2="'+y2.toFixed(3)+'"';
      if(c.indicator_hidden)return '';
      if(c.indicator_style==='dot'){
        const [x,y]=pos(r),dotColor=arcStyle==='indicator'?colorAt(ranges,p,r===dualRadius):(c.indicator_color||'#ffffff');
        return '<circle class="gauge-indicator-dot" cx="'+x+'" cy="'+y+'" r="'+num('indicator_width',8,5,20)/2+'" fill="'+dotColor+'" stroke="'+(c.indicator_outline_color||'#202020')+'" stroke-width="'+num('indicator_outline_width',2,0,8)+'"/>';
      }
      return '<line '+coords+' stroke="#202020" stroke-width="11" stroke-linecap="round"/>'
        +'<line '+coords+' stroke="'+(arcStyle==='indicator'?colorAt(ranges,p,r===dualRadius):(c.indicator_color||'#ffffff'))+'" stroke-width="6" stroke-linecap="round"/>';
    };
    const dualSvg=dualMode
      ? '<defs>'+outerDual.gradient+innerDual.gradient+'</defs>'
        +'<path d="'+dualRingPath(radius,0,1)+'" fill="none" stroke="rgba(128,128,128,.20)" stroke-width="8" stroke-linecap="round"/>'
        +'<path d="'+dualRingPath(dualRadius,0,1)+'" fill="none" stroke="rgba(128,128,128,.20)" stroke-width="8" stroke-linecap="round"/>'
        +arcLayer(outerDual.arcs,radius,f,'sky-progress-outer')+arcLayer(innerDual.arcs,dualRadius,dualF,'sky-progress-inner')+dualPointer(dualRadius,dualF,c.secondary_segments)+dualPointer(radius,f,c.segments)
      : '';
    const [dx,dy]=polar(angle);
    const indicatorStyle=c.indicator_style==='dot'?'dot':'line';
    const indicatorWidth=c.indicator_style==='dot'?num('indicator_width',8,5,20):num('indicator_width',6,1,12);
    const indicatorLength=Math.max(4,Math.min(40,Number(c.indicator_length)||6));
    const coordAt=rr=>{
      const t=angle*Math.PI/180;
      return [cx+rr*Math.sin(t),cy-rr*Math.cos(t)];
    };
    const [ix1,iy1]=coordAt(radius-indicatorLength/2);
    const [ix2,iy2]=coordAt(radius+indicatorLength/2);
    const indicatorColor=arcStyle==='indicator'?colorAt(c.segments,f):(/^#[0-9a-fA-F]{3,8}$/.test(c.indicator_color)?c.indicator_color:'#ffffff');
    const indicator=c.indicator_hidden?'':indicatorStyle==='dot'
      ? '<circle class="gauge-indicator-dot" cx="'+dx.toFixed(3)+'" cy="'+dy.toFixed(3)+'" r="'+indicatorWidth/2+'" fill="'+indicatorColor+'" stroke="'+(c.indicator_outline_color||'#202020')+'" stroke-width="'+num('indicator_outline_width',2,0,8)+'"/>'
      : '<line x1="'+ix1.toFixed(3)+'" y1="'+iy1.toFixed(3)+'" x2="'+ix2.toFixed(3)+'" y2="'+iy2.toFixed(3)+'" stroke="#202020" stroke-width="'+(indicatorWidth+6.5)+'" stroke-linecap="round"/>'
        +'<line x1="'+ix1.toFixed(3)+'" y1="'+iy1.toFixed(3)+'" x2="'+ix2.toFixed(3)+'" y2="'+iy2.toFixed(3)+'" stroke="'+indicatorColor+'" stroke-width="'+indicatorWidth+'" stroke-linecap="round"/>';
    const shown=Number.isFinite(raw)?(raw*Number(c.scale)).toFixed(Number(c.decimals)):'—';
    const label=String(c.name||''); const unit=String(c.unit||'');
    const secondaryEnabled=Boolean(c.secondary_entity||c.secondary_text);
    const secondaryNumeric=secondaryRaw!==null&&secondaryRaw!==''&&Number.isFinite(Number(secondaryRaw));
    const secondaryPrecision=c.secondary_decimals===null?null:Math.max(0,Math.min(6,Number(c.secondary_decimals)||0));
    const secondaryValue=secondaryNumeric
      ? (secondaryPrecision===null?String(Number(secondaryRaw)*Number(c.secondary_scale)): (Number(secondaryRaw)*Number(c.secondary_scale)).toFixed(secondaryPrecision))
      : (secondaryRaw===null||secondaryRaw===undefined||secondaryRaw===''?'—':String(secondaryRaw));
    const secondaryUnit=c.secondary_unit==null?'':String(c.secondary_unit);
    const dualUnit=dualMode&&typeof c.secondary_unit==='string'?c.secondary_unit.trim():'';
    const secondaryLabel=c.secondary_entity?secondaryValue+(secondaryUnit&&!dualMode?' '+secondaryUnit:''):String(c.secondary_text||'');
    const secondaryFontSize=Math.max(10,Math.min(26,Number(c.secondary_font_size)||16));
    const safe=s=>s.replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    const weight=(v,fallback)=>[100,200,300,400,500,600,700,800,900].includes(Number(v))?Number(v):fallback;
    const spacing=(v,fallback)=>Number.isFinite(Number(v))?Math.max(-5,Math.min(10,Number(v))):fallback;
    // Center the numeric value independently; measure its glyphs before placing the unit.
    const secondaryMarkup=secondaryEnabled
      ? '<g class="secondary-layout"><text x="110" y="'+(dualMode?136:143)+'" text-anchor="middle" class="secondary-reading">'+safe(dualUnit?secondaryValue:secondaryLabel)+'</text>'
        +(dualUnit?'<text x="110" y="136" text-anchor="start" class="secondary-unit">'+safe(dualUnit)+'</text>':'')+'</g>'
      : '';
    this.shadowRoot.innerHTML=`
      <style>
        :host{display:block;min-width:0;min-height:0;height:100%}
        ha-card{width:100%;height:100%;min-height:0;aspect-ratio:160 / 184;box-sizing:border-box;overflow:hidden;position:relative;
          --ha-card-background:rgba(0,0,0,0.7);--ha-card-box-shadow:none;
          background:rgba(0,0,0,0.7) !important;border:1px solid rgba(255,255,255,0.12);
          border-radius:13px;box-shadow:none !important;cursor:pointer;
          color:var(--primary-text-color,#fff);font-family:Montserrat,Arial,sans-serif}
        .composition{position:absolute;left:50%;top:50%;width:160px;height:184px;transform-origin:center;visibility:hidden}
        svg{display:block;width:160px;height:158px;overflow:visible}
        .reading{font-family:Montserrat,Arial,sans-serif;font-weight:${weight(c.value_font_weight,600)};font-size:${dualMode?44:49}px;fill:currentColor;letter-spacing:${spacing(c.value_letter_spacing,0.5)}px}
        .secondary-reading{font-family:Montserrat,Arial,sans-serif;font-size:${dualMode?32:secondaryFontSize}px;font-weight:${dualMode?weight(c.value_font_weight,600):weight(c.secondary_font_weight,400)};letter-spacing:${dualMode?spacing(c.value_letter_spacing,0.5):0}px;fill:currentColor;opacity:${dualMode?1:.78}}
        .secondary-unit{font-family:Montserrat,Arial,sans-serif;fill:currentColor;font-size:12px;font-weight:500;letter-spacing:0;opacity:.75}
        .unit-center{font-family:Montserrat,Arial,sans-serif;font-size:16px;font-weight:${weight(c.unit_font_weight,500)};letter-spacing:${spacing(c.unit_letter_spacing,0)}px;fill:currentColor;opacity:.75}
        .bottom{position:absolute;left:0;right:0;bottom:14px;text-align:center;
          display:flex;flex-direction:column;align-items:center;gap:0}
        ha-icon{--mdc-icon-size:${secondaryEnabled?21:26}px;color:#53a9df;height:${secondaryEnabled?21:26}px;transform:translateY(-8px)}
        .name{max-width:calc(100% - 12px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:15px;line-height:18px;font-weight:${weight(c.name_font_weight,500)};letter-spacing:${spacing(c.name_letter_spacing,0)}px}
      </style>
      <ha-card role="button" tabindex="0" aria-label="${safe(label)}: More info">
        <div class="composition">
        <svg viewBox="0 0 220 188" preserveAspectRatio="xMidYMid meet" aria-label="${safe(label)} ${safe(shown)} ${safe(unit)}">
          ${dualMode?dualSvg:`<path d="${path(start,start+sweep)}" fill="none" stroke="rgba(128,128,128,.20)" stroke-width="10" stroke-linecap="round"/>`}
          ${dualMode?"":`<defs>${gradients}</defs>${arcLayer(arcs,radius,f,'sky-progress-single')}`}
          ${dualMode?"":indicator}
          <text x="110" y="47" text-anchor="middle" class="unit-center">${safe(unit)}</text>
          <text x="110" y="${dualMode?101:113}" text-anchor="middle" class="reading">${safe(shown)}</text>
          ${secondaryMarkup}
        </svg>
        <div class="bottom"><ha-icon icon="${safe(c.icon)}"></ha-icon><div class="name" title="${safe(label)}">${safe(label)}</div></div>
        </div>
      </ha-card>`;
    const interactiveCard=this.shadowRoot.querySelector('ha-card');
    if(interactiveCard){
      interactiveCard.onclick=()=>this._showMoreInfo();
      interactiveCard.onkeydown=event=>{
        if(event.key==='Enter'||event.key===' '){event.preventDefault();this._showMoreInfo();}
      };
    }
    this._applyAdvanced(num,dualMode);
    this._layoutComposition();
    requestAnimationFrame(()=>this._layoutComposition());
    if(dualUnit){
      this._fitSecondary();
      requestAnimationFrame(()=>this._fitSecondary());
      document.fonts?.ready.then(()=>this._fitSecondary());
    }
  }
  _applyAdvanced(num,dualMode){
    const root=this.shadowRoot,c=this._config;
    const color=(key,fallback)=>/^#[0-9a-f]{6}$/i.test(c[key]||'')?c[key]:fallback;
    const applyText=(selector,prefix,defaults)=>{
      const el=root.querySelector(selector);if(!el)return;
      el.style.fontSize=num(prefix+'_font_size',defaults.size,8,80)+'px';
      el.style.fontWeight=num(prefix+'_font_weight',defaults.weight,100,900);
      el.style.letterSpacing=num(prefix+'_letter_spacing',defaults.spacing??0,-5,10)+'px';
      el.style.fill=color(prefix+'_color','currentColor');
      if(el.hasAttribute('x'))el.setAttribute('x',num(prefix+'_x',110,20,200));
      if(el.hasAttribute('y'))el.setAttribute('y',num(prefix+'_y',defaults.y,20,180));
    };
    applyText('.reading','value',{size:dualMode?44:49,weight:600,spacing:.5,y:dualMode?101:113});
    applyText('.secondary-reading','secondary',{size:dualMode?32:(c.secondary_font_size||16),weight:dualMode?600:400,y:dualMode?136:143});
    applyText('.unit-center','unit',{size:16,weight:500,y:47});
    applyText('.secondary-unit','secondary_unit',{size:12,weight:500,y:136});
    const card=root.querySelector('ha-card');
    if(card){
      const hex=color('background_color','#000000');
      card.style.setProperty('background','rgba('+[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(',')+','+num('background_opacity',.7,0,1)+')','important');
      card.style.border=num('border_width',1,0,8)+'px solid '+color('border_color','rgba(255,255,255,.12)');
      card.style.borderRadius=num('border_radius',13,0,50)+'px';
      card.style.setProperty('box-shadow',c.card_shadow==='soft'?'0 '+num('shadow_offset',4,0,30)+'px '+num('shadow_blur',16,0,60)+'px rgba('+[1,3,5].map(i=>parseInt(color('shadow_color','#000000').slice(i,i+2),16)).join(',')+','+(num('shadow_intensity',40,0,100)/100)+')':c.card_shadow==='glow'?'0 0 18px rgba('+[1,3,5].map(i=>parseInt(color('glow_color','#53a9df').slice(i,i+2),16)).join(',')+','+(num('glow_intensity',40,0,100)/100)+')':'none','important');
    }
    const icon=root.querySelector('ha-icon'),name=root.querySelector('.name');
    if(icon){const size=num('icon_size',c.secondary_entity||c.secondary_text?21:26,8,60);icon.style.setProperty('--mdc-icon-size',size+'px');icon.style.height=size+'px';icon.style.color=color('icon_color','#53a9df');icon.style.transform='translate('+num('icon_x',0,-80,80)+'px,'+num('icon_y',-8,-40,40)+'px)';icon.style.display=c.icon_hidden?'none':'';}
    if(name){name.style.fontSize=num('name_font_size',15,8,32)+'px';name.style.fontWeight=num('name_font_weight',500,100,900);name.style.letterSpacing=num('name_letter_spacing',0,-3,8)+'px';name.style.color=color('name_color','inherit');name.style.transform='translate('+num('name_x',0,-80,80)+'px,'+num('name_y',0,-40,40)+'px)';name.style.display=c.name_hidden?'none':'';}
    const family=['Montserrat','Roboto','Arial','sans-serif'].includes(c.font_family)?c.font_family:'Montserrat';
    for(const el of root.querySelectorAll('text,.name'))el.style.fontFamily=family+',Arial,sans-serif';
    for(const el of root.querySelectorAll('svg path,svg circle')){
      if(el.closest('defs')||el.classList.contains('gauge-indicator-dot'))continue;
      const stroke=el.getAttribute('stroke'),width=Number(el.getAttribute('stroke-width'));
      if(stroke==='rgba(128,128,128,.20)'){el.setAttribute('stroke',color('inactive_color','#808080'));el.setAttribute('stroke-opacity',num('inactive_opacity',.2,0,1));}
      if(width===8||width===10)el.setAttribute('stroke-width',num('arc_width',dualMode?8:10,2,20));
      if(el.tagName.toLowerCase()==='circle'&&!stroke)el.setAttribute('r',num('arc_width',dualMode?8:10,2,20)/2);
    }
    for(const el of root.querySelectorAll('svg line')){
      const width=Number(el.getAttribute('stroke-width'));
      if(width===6||width===Number(c.indicator_width||6))el.setAttribute('stroke-width',num('indicator_width',6,1,12));
      else el.setAttribute('stroke-width',num('indicator_width',6,1,12)+2*num('indicator_outline_width',dualMode?2.5:3.25,0,8));
      if(el.getAttribute('stroke')==='#202020')el.setAttribute('stroke',color('indicator_outline_color','#202020'));
      el.style.display=c.indicator_hidden?'none':'';
    }
  }
  _fitSecondary(){
    const group=this.shadowRoot.querySelector('.secondary-layout');
    const value=group?.querySelector('.secondary-reading'),unit=group?.querySelector('.secondary-unit');
    if(!value||!unit)return;
    group.removeAttribute('transform');
    // SVG coordinates stay constant at every card size. Leave clearance from the inner arc.
    const valueBox=value.getBBox(),unitBox=unit.getBBox();
    if(!valueBox.width||!unitBox.width)return;
    const gap=5,center=Number(value.getAttribute('x')||110),baseline=Number(value.getAttribute('y')||136),left=54,right=166;
    const unitX=valueBox.x+valueBox.width+gap;
    unit.setAttribute('x',unitX);unit.setAttribute('y',baseline);
    const extentRight=unitX+unitBox.width-center,extentLeft=center-valueBox.x;
    const scale=Math.min(1,(right-center)/extentRight,(center-left)/extentLeft);
    group.setAttribute('transform','translate('+center+' '+baseline+') scale('+scale+') translate(-'+center+' -'+baseline+')');
  }
  getCardSize(){return 3;}
  getGridOptions(){return {columns:4,rows:3,min_columns:3,min_rows:2};}
}

class SkyGaugeCardEditor extends HTMLElement {
  constructor(){super();this.attachShadow({mode:'open'});}
  connectedCallback(){this._ensurePickers();}
  _ensurePickers(){
    if(customElements.get('ha-selector')||this._pickersLoading)return;
    this._pickersLoading=true;
    // Use HA's own editor loader to register native selectors, with plain-input fallback.
    Promise.resolve().then(async()=>{
      if(window.loadCardHelpers){
        const helpers=await window.loadCardHelpers();
        const card=helpers.createCardElement({type:'entities',entities:[]});
        if(card.constructor.getConfigElement)await card.constructor.getConfigElement();
      }
      if(customElements.get('ha-selector')&&this.isConnected)this._render();
      else customElements.whenDefined('ha-selector').then(()=>{if(this.isConnected)this._render();});
    }).catch(()=>{this._pickersLoading=false;});
  }
  _refreshPickers(){
    for(const picker of this.shadowRoot.querySelectorAll('ha-selector'))picker.hass=this._hass;
  }
  _pickerField(parent,label,key,fallback){
    const row=document.createElement('label');row.className='native-field';
    const picker=document.createElement('ha-selector');
    picker.selector=key==='icon'?{icon:{}}:{entity:{}};
    picker.label=label;picker.hass=this._hass;picker.value=this._config[key]??fallback??'';
    picker.required=key==='entity';
    picker.style.cssText='display:block;width:100%;min-width:0';
    picker.addEventListener('value-changed',event=>{
      event.stopPropagation();
      const value=typeof event.detail?.value==='string'?event.detail.value.trim():'';
      if(value===(this._config[key]??fallback??''))return;
      const next={...this._config};
      if(value)next[key]=value;else delete next[key];
      picker.invalid=!this._commit(next);
      if(picker.invalid)picker.helper=key==='entity'?'Select a main entity.':'Check this value.';
      else picker.helper='';
    });
    row.append(picker);parent.append(row);
  }
  set hass(value){this._hass=value;this._entities();this._refreshPickers();this._updatePreview();}
  setConfig(value){
    const next=JSON.stringify(value);
    if(next===JSON.stringify(this._config))return;
    this._config=JSON.parse(next);this._render();
  }
  _entities(){
    const list=this.shadowRoot.querySelector('datalist');if(!list||!this._hass)return;
    const ids=Object.keys(this._hass.states).filter(id=>/^(sensor|number|input_number)\./.test(id));
    if(this._entityKey===ids.join('|'))return;this._entityKey=ids.join('|');
    list.replaceChildren(...ids.map(id=>{const o=document.createElement('option');o.value=id;return o;}));
  }
  _field(parent,label,key,type='text',fallback='',index=null,segmentKey='segments'){
    if(index===null&&['entity','secondary_entity','icon'].includes(key)&&customElements.get('ha-selector')){this._pickerField(parent,label,key,fallback);return;}
    const row=document.createElement('label');row.append(document.createTextNode(label));
    const input=document.createElement('input');input.type=type;
    const value=index===null?this._config[key]:this._config[segmentKey]?.[index]?.[key];
    const boundary=index!==null&&(key==='from'||key==='to'||key==='position');
    const secondary=segmentKey.startsWith('secondary_');
    const min=Number(this._config[secondary?'secondary_min':'min']??(secondary?-6000:0)),max=Number(this._config[secondary?'secondary_max':'max']??(secondary?6000:16000));
    // Keep normalized segments in saved config; expose source values in the editor.
    input.value=boundary?Number((min+Number(value??fallback)*(max-min)).toPrecision(12)):(value??fallback);
    if(type==='number')input.step='any';
    if(key.includes('entity'))input.setAttribute('list','sky-dev-entities');
    input.addEventListener('change',()=>{
      const next=JSON.parse(JSON.stringify(this._config));
      const v=type==='number'?Number(input.value):input.value.trim();
      if(type==='number'&&(input.value===''||!Number.isFinite(v))){input.setCustomValidity('Enter a valid number.');input.reportValidity();return;}
      input.setCustomValidity('');
      if(index===null){if(v===''&&key!=='secondary_unit')delete next[key];else next[key]=v;}
      else if(boundary){
        const lo=Number(next[secondary?'secondary_min':'min']??(secondary?-6000:0)),hi=Number(next[secondary?'secondary_max':'max']??(secondary?6000:16000));
        if(v<lo||v>hi){input.setCustomValidity('Enter a value between '+lo+' and '+hi+'.');input.reportValidity();return;}
        next[segmentKey][index][key]=(v-lo)/(hi-lo);
      }else next[segmentKey][index][key]=v;
      if(this._commit(next,input)&&(['min','max','secondary_min','secondary_max'].includes(key)))this._render();
    });
    row.append(input);
    if(key==='scale'&&index===null){
      const help=document.createElement('small');
      help.textContent='Multiplies the displayed value: 0.001 shows 6000 W as 6 kW. Set Unit to kW. Limits and color ranges use source values.';
      const details=document.createElement('details');details.className='field-help';
      const summary=document.createElement('summary');summary.textContent='ⓘ How scaling works';details.append(summary,help);row.append(details);
    }
    parent.append(row);
  }
  _commit(next,input){
    const min=Number(next.min??0),max=Number(next.max??16000);
    let error='';
    if(max<=min)error='Maximum must be greater than minimum.';
    if(next.mode==='dual'&&Number(next.secondary_max??6000)<=Number(next.secondary_min??-6000))error='Check the secondary entity range.';
    if([...(next.segments||[]),...(next.secondary_segments||[])].some(s=>!Number.isFinite(Number(s.from))||!Number.isFinite(Number(s.to))||s.from<0||s.to>1||s.to<=s.from))error='Color ranges must stay within the gauge limits, with From less than To.';
    for(const key of ['gradient_stops','secondary_gradient_stops'])if(next[key]&&(next[key].length<2||next[key].some(x=>!Number.isFinite(Number(x.position))||x.position<0||x.position>1)||new Set(next[key].map(x=>Number(x.position))).size!==next[key].length))error='Use at least two color points with different values inside the gauge limits.';
    if(!next.entity)error='Select an entity.';
    for(const key of ['decimals','secondary_decimals'])if(next[key]!=null&&(!Number.isInteger(Number(next[key]))||Number(next[key])<0||Number(next[key])>6))error='Decimal places must be an integer from 0 to 6.';
    if(error){if(input){input.setCustomValidity(error);input.reportValidity();}return false;}
    this._config=next;
    this._updatePreview();
    this.dispatchEvent(new CustomEvent('config-changed',{detail:{config:JSON.parse(JSON.stringify(next))},bubbles:true,composed:true}));
    return true;
  }
  _addColor(segmentKey='segments'){
    const next=JSON.parse(JSON.stringify(this._config));
    const segments=next[segmentKey]||(next[segmentKey]=[]);
    if(!segments.length)segments.push({from:0,to:1,color:'#109d20'});
    else{
      // Split the widest range so adding a color keeps full coverage.
      let index=0;
      segments.forEach((s,i)=>{if(Number(s.to)-Number(s.from)>Number(segments[index].to)-Number(segments[index].from))index=i;});
      const s=segments[index],mid=(Number(s.from)+Number(s.to))/2;
      const palette=['#109d20','#e4a00a','#df2626','#2196f3','#ab47bc'];
      const color=palette.find(color=>!segments.some(s=>s.color===color))||'#2196f3';
      segments.splice(index,1,{...s,to:mid},{...s,from:mid,color});
    }
    if(this._commit(next))this._render();
  }
  _removeColor(index,segmentKey='segments'){
    const next=JSON.parse(JSON.stringify(this._config)),segments=next[segmentKey]||[];
    if(segments.length<=1||index<0||index>=segments.length)return;
    const removed=segments[index];
    if(index>0)segments[index-1].to=removed.to;
    else segments[1].from=removed.from;
    segments.splice(index,1);
    if(this._commit(next))this._render();
  }
  _gradientRanges(title,segmentKey,target=this.shadowRoot){
    const c=this._config,key=segmentKey==='secondary_segments'?'secondary_gradient_stops':'gradient_stops';
    const points=c[key]||(c[key]=[{position:0,color:'#109d20'},{position:1,color:'#df2626'}]);
    const legend=document.createElement('div');legend.className='color-head gradient-head';for(const text of ['Value','Color','']){const span=document.createElement('span');span.textContent=text;legend.append(span);}target.append(legend);
    points.forEach((point,i)=>{
      const row=document.createElement('div');row.className='segment gradient-row';
      this._field(row,'Value','position','number',0,i,key);this._field(row,'Color','color','color','#109d20',i,key);
      const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label','Remove color');remove.disabled=points.length<=2;
      remove.addEventListener('click',()=>{const next=JSON.parse(JSON.stringify(this._config));next[key].splice(i,1);if(this._commit(next))this._render();});
      row.append(remove);target.append(row);
    });
    const add=document.createElement('button');add.type='button';add.textContent='Add color';
    add.addEventListener('click',()=>{
      const next=JSON.parse(JSON.stringify(this._config)),list=next[key];list.sort((a,b)=>a.position-b.position);
      let index=0;for(let i=1;i<list.length-1;i++)if(list[i+1].position-list[i].position>list[index+1].position-list[index].position)index=i;
      list.splice(index+1,0,{position:(list[index].position+list[index+1].position)/2,color:'#e4a00a'});
      if(this._commit(next))this._render();
    });target.append(add);
  }
  _colorRanges(title,segmentKey,target=this.shadowRoot){
    const c=this._config,h=document.createElement('h3');h.textContent=title;if(title)target.append(h);
    const modeKey=segmentKey==='secondary_segments'?'secondary_color_mode':'color_mode';
    const select=document.createElement('select');
    for(const [value,text] of [['ranges','Ranges'],['fixed','Fixed'],['gradient','Gradient']]){const o=document.createElement('option');o.value=value;o.textContent=text;select.append(o);}
    select.value=c[modeKey]||'ranges';select.setAttribute('aria-label',(title||'Colors')+' color mode');
    select.addEventListener('change',()=>{if(this._commit({...this._config,[modeKey]:select.value}))this._render();});target.append(select);
    if(c[modeKey]==='gradient'){this._gradientRanges(title,segmentKey,target);return;}

    const defaults=c.mode==='dual'
      ?[{from:0,to:.5,color:c.dual_negative_color||'#159d1c'},{from:.5,to:1,color:c.dual_positive_color||'#d72323'}]
      :[{from:0,to:.85,color:'#109d20'},{from:.85,to:.94,color:'#e4a00a'},{from:.94,to:1,color:'#df2626'}];
    const segments=c[segmentKey]||(c[segmentKey]=defaults.map(s=>({...s})));
    const legend=document.createElement('div');legend.className='color-head';for(const text of ['From','To','Color','']){const span=document.createElement('span');span.textContent=text;legend.append(span);}target.append(legend);
    segments.forEach((s,i)=>{
      const row=document.createElement('div');row.className='segment';
      this._field(row,'From','from','number',0,i,segmentKey);this._field(row,'To','to','number',1,i,segmentKey);this._field(row,'Color','color','color','#109d20',i,segmentKey);
      const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label','Remove color');remove.disabled=segments.length<=1;
      remove.setAttribute('aria-label','Remove '+title+' range '+(i+1));
      remove.addEventListener('click',()=>this._removeColor(i,segmentKey));row.append(remove);target.append(row);
    });
    const add=document.createElement('button');add.type='button';add.textContent='Add color';add.addEventListener('click',()=>this._addColor(segmentKey));target.append(add);
  }
  _styleKeys(){
    const keys=new Set(Object.values(SKY_ADV_GROUPS).flatMap(group=>group.fields.map(field=>field[0])));
    for(const key of ['secondary_text','secondary_attribute'])keys.delete(key);
    for(const key of ['segments','secondary_segments','gradient_stops','secondary_gradient_stops','color_mode','secondary_color_mode','arc_style','dual_negative_color','dual_positive_color','value_show_plus','secondary_show_plus'])keys.add(key);
    return [...keys];
  }
  _readPresets(){
    const raw=localStorage.getItem('sky-gauge-card-presets-v1');
    if(!raw)return [];
    const data=JSON.parse(raw);
    if(!Array.isArray(data))throw new Error('The local preset library is invalid.');
    return data.filter(p=>p&&typeof p.name==='string'&&p.config&&typeof p.config==='object'&&!Array.isArray(p.config)).slice(0,50);
  }
  _savePreset(name){
    name=String(name||'').trim();
    if(!name)throw new Error('Enter a preset name.');
    if(name.length>80)throw new Error('Use a name of up to 80 characters.');
    const presets=this._readPresets();
    if(presets.some(p=>p.name.toLowerCase()===name.toLowerCase()))throw new Error('That name already exists. Use a new name.');
    if(presets.length>=50)throw new Error('The local library is full (50 presets).');
    presets.push({name,version:1,config:JSON.parse(JSON.stringify(this._config))});
    localStorage.setItem('sky-gauge-card-presets-v1',JSON.stringify(presets));
    return name;
  }
  _loadPreset(name,scope){
    const preset=this._readPresets().find(p=>p.name===name);
    if(!preset)throw new Error('Select a saved preset.');
    let next;
    if(scope==='full')next={...JSON.parse(JSON.stringify(preset.config)),type:this._config.type||'custom:sky-gauge-card'};
    else{
      next={...this._config};
      for(const key of this._styleKeys()){
        delete next[key];
        if(Object.prototype.hasOwnProperty.call(preset.config,key))next[key]=JSON.parse(JSON.stringify(preset.config[key]));
      }
    }
    // Validate before publishing to HA so a bad full preset cannot break its preview.
    const card=document.createElement('sky-gauge-card');card.setConfig(next);
    if(!this._commit(next))throw new Error('The preset contains invalid settings.');
  }
  _resetAppearance(){
    const next={...this._config};
    for(const key of this._styleKeys())delete next[key];
    if(this._commit(next))this._render();
  }
  _presetToolbar(){
    const box=document.createElement('div');
    box.style.cssText='padding:12px;margin-bottom:16px;border:1px solid var(--divider-color,#555);border-radius:12px';
    const title=document.createElement('strong');title.textContent='Presets & reset';box.append(title);
    const grid=document.createElement('div');grid.style.cssText='display:flex;flex-wrap:wrap;gap:8px;margin-top:10px';box.append(grid);
    const name=document.createElement('input');name.type='text';name.placeholder='Preset name';name.setAttribute('aria-label','Preset name');name.style.cssText='min-width:120px;flex:1;padding:8px';
    const select=document.createElement('select');select.setAttribute('aria-label','Saved preset');select.style.cssText='min-width:120px;flex:1;padding:8px';
    const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Saved presets';select.append(placeholder);
    let presets=[];try{presets=this._readPresets();}catch(error){this._presetMessage=error.message;}
    for(const p of presets){const option=document.createElement('option');option.value=p.name;option.textContent=p.name;select.append(option);}
    select.value=this._lastPreset||'';
    const scope=document.createElement('select');scope.setAttribute('aria-label','Preset load scope');scope.style.cssText='padding:8px';
    for(const [value,text] of [['style','Style only'],['full','Full configuration']]){const option=document.createElement('option');option.value=value;option.textContent=text;scope.append(option);}
    const message=document.createElement('p');message.style.cssText='font-size:12px;margin:9px 0 0;color:var(--secondary-text-color,#aaa)';
    message.textContent=this._presetMessage||'Saved in this browser. Style only keeps entities, ranges, scaling, units and names. Reset all restores appearance defaults and keeps your data settings.';
    const button=(label,action)=>{
      const b=document.createElement('button');b.type='button';b.textContent=label;b.style.cssText='padding:8px 12px;border:1px solid var(--divider-color,#555);border-radius:7px;background:transparent;color:var(--primary-text-color,#fff);cursor:pointer';
      b.addEventListener('click',()=>{try{action();}catch(error){message.textContent=error.message;message.style.color='var(--error-color,#f66)';}});return b;
    };
    grid.append(name,button('Save preset',()=>{
      const saved=this._savePreset(name.value);this._lastPreset=saved;this._presetMessage='Saved “'+saved+'” in this browser.';this._render();
    }),select,scope,button('Load preset',()=>{
      this._loadPreset(select.value,scope.value);this._lastPreset=select.value;this._presetMessage='Loaded “'+select.value+'” · '+(scope.value==='full'?'Full configuration':'Style only');this._render();
    }),button('Reset all',()=>{this._presetMessage='Appearance reset. Entities and data settings were kept.';this._resetAppearance();}));
    box.append(message);return box;
  }
  _advancedDefault(field){
    const [key,,fallback]=field,c=this._config;
    const dual=c.mode==='dual';
    const dynamic={arc_width:dual?8:10,value_font_size:dual?44:49,value_y:dual?101:113,secondary_font_size:dual?32:16,secondary_font_weight:dual?600:400,secondary_y:dual?136:143,icon_size:c.secondary_entity||c.secondary_text?21:26,indicator_outline_width:dual?2.5:3.25};
    return c[key]??dynamic[key]??fallback;
  }
  _advancedRender(){
    this.shadowRoot.innerHTML='<style>:host{display:block}.studio{display:grid;grid-template-columns:minmax(180px,.9fr) minmax(190px,1.1fr);gap:16px}.preview-panel{position:sticky;top:8px;align-self:start;padding:14px;border:1px solid var(--divider-color,#444);border-radius:14px;background:var(--secondary-background-color,#181818)}.preview{max-width:300px;margin:0 auto}.hint{font-size:12px;line-height:1.5;color:var(--secondary-text-color,#aaa)}.parts{display:flex;flex-wrap:wrap;gap:6px;margin:14px 0}.parts button{font-size:12px;padding:7px 10px}button{background:transparent;color:var(--primary-text-color,#fff);border:1px solid var(--divider-color,#555);border-radius:8px;padding:9px 12px;cursor:pointer}.active{background:var(--primary-color,#168ccc);color:white}h3{margin:0 0 14px;font-size:17px}.control{display:block;margin-bottom:15px;font-size:13px}.control>span{display:block;margin-bottom:6px}.inputs{display:flex;align-items:center;gap:9px}input[type=range]{width:100%;min-width:40px;accent-color:var(--primary-color,#168ccc)}input[type=number]{width:67px}input,select{box-sizing:border-box;padding:8px;border:1px solid var(--divider-color,#555);border-radius:6px;background:var(--card-background-color,#222);color:var(--primary-text-color,#fff)}input[type=color]{width:100%;height:38px;padding:3px}select,input[type=text]{width:100%}.inspector{min-width:0}.status{font-size:12px;color:var(--error-color,#f66)}@media(max-width:520px){.studio{grid-template-columns:1fr}.preview-panel{position:static}.preview{max-width:230px}}</style><div class="studio"><div class="preview-panel"><h3>Sky Gauge Studio</h3><div class="preview"></div><p class="hint">Click the value, unit, arc, indicator, icon or name to edit it. Changes update the live preview.</p><div class="parts"></div><p class="hint">Live preview · Sky Gauge Card v0.1.1</p></div><div class="inspector"></div></div>';
    const preview=document.createElement('sky-gauge-card');this.shadowRoot.querySelector('.preview').append(preview);
    this._preview=preview;this._updatePreview();
    this._selectedPart=this._selectedPart||'value';
    const parts=this.shadowRoot.querySelector('.parts');
    for(const [id,group] of Object.entries(SKY_ADV_GROUPS)){
      const b=document.createElement('button');b.type='button';b.textContent=group.title;b.dataset.part=id;
      b.addEventListener('click',()=>this._selectPart(id));parts.append(b);
    }
    preview.shadowRoot.addEventListener('click',event=>{
      const path=event.composedPath();
      const el=path.find(el=>el.classList?.contains('secondary-unit')||el.classList?.contains('unit-center')||el.classList?.contains('secondary-reading')||el.classList?.contains('reading')||el.classList?.contains('name')||['ha-icon','line','path','circle','ha-card'].includes(el.tagName?.toLowerCase()));
      if(!el)return;
      const cls=el.classList,tag=el.tagName.toLowerCase();
      const part=cls.contains('secondary-unit')||cls.contains('unit-center')?'unit':cls.contains('secondary-reading')?'secondary':cls.contains('reading')?'value':tag==='ha-icon'||cls.contains('name')?'icon':tag==='line'?'indicator':tag==='path'||tag==='circle'?'arc':'card';
      this._selectPart(part);
    });
    this._selectPart(this._selectedPart);
  }
  _updatePreview(){
    if(!this._preview||this._editorMode!=='advanced')return;
    try{
      this._preview.setConfig(this._config);
      if(this._hass)this._preview.hass=this._hass;
    }catch(error){const status=this.shadowRoot.querySelector('.status');if(status)status.textContent=error.message;}
  }
  _selectPart(part){
    this._selectedPart=part;
    const panel=this.shadowRoot.querySelector('.inspector');if(!panel)return;
    panel.replaceChildren();
    for(const b of this.shadowRoot.querySelectorAll('[data-part]'))b.classList.toggle('active',b.dataset.part===part);
    const group=SKY_ADV_GROUPS[part],heading=document.createElement('h3');heading.textContent=group.title;panel.append(heading);
    if(part==='arc'){
      const hint=document.createElement('p');hint.className='hint';hint.textContent='Open gap = 360° − sweep. Geometry uses the card viewBox and scales with card width.';panel.append(hint);
    }
    for(const field of group.fields)this._advancedControl(panel,field);
    const status=document.createElement('p');status.className='status';panel.append(status);
    const root=this._preview?.shadowRoot;
    if(root){
      root.querySelectorAll('[data-selected]').forEach(el=>{el.removeAttribute('data-selected');el.style.filter='';});
      const selector={value:'.reading',secondary:'.secondary-reading',unit:'.unit-center,.secondary-unit',icon:'ha-icon,.name'}[part];
      if(selector)root.querySelectorAll(selector).forEach(el=>{el.dataset.selected='true';el.style.filter='drop-shadow(0 0 3px #55bfff)';});
    }
  }
  _advancedControl(panel,field){
    if(['shadow_intensity','shadow_color','shadow_blur','shadow_offset'].includes(field[0])&&this._config.card_shadow!=='soft')return;
    if(['glow_intensity','glow_color'].includes(field[0])&&this._config.card_shadow!=='glow')return;
    if(field[0]==='indicator_width'&&this._config.indicator_style==='dot')field=['indicator_width','Dot size',8,5,20,1];
    if(field[0]==='indicator_length'&&this._config.indicator_style==='dot')return;
    const [key,label,,kind,minOrMax,step]=field,value=this._advancedDefault(field);
    const row=document.createElement('label');row.className='control';const title=document.createElement('span');title.textContent=label;row.append(title);
    const wrap=document.createElement('div');wrap.className='inputs';row.append(wrap);
    let input,range;
    if(Array.isArray(kind)){input=document.createElement('select');for(const v of kind){const option=document.createElement('option');option.value=v;option.textContent=v;input.append(option);}input.value=value;}
    else{
      input=document.createElement('input');
      input.type=kind==='check'?'checkbox':kind==='color'?'color':kind==='text'?'text':'number';
      if(input.type==='checkbox')input.checked=value;else input.value=value;
      if(input.type==='number'){
        input.min=kind;input.max=minOrMax;input.step=step;
        range=document.createElement('input');range.type='range';range.min=kind;range.max=minOrMax;range.step=step;range.value=value;wrap.append(range);
      }
    }
    wrap.append(input);panel.append(row);
    if(key==='indicator_length'&&this._config.indicator_style==='dot'){
      input.disabled=true;if(range)range.disabled=true;
      title.textContent='Length · line only';row.style.opacity='.45';
    }
    if(key==='indicator_width'&&this._config.indicator_style==='dot')title.textContent='Dot size';
    const update=source=>{
      let v=input.type==='checkbox'?input.checked:input.type==='number'?Number(source.value):source.value;
      if(input.type==='number'){
        if(source.value===''||!Number.isFinite(v)||v<Number(kind)||v>Number(minOrMax)){input.setCustomValidity('Enter a value from '+kind+' to '+minOrMax+'.');return;}
        input.setCustomValidity('');input.value=v;if(range)range.value=v;
      }
      if(this._commit({...this._config,[key]:v})){
        if(key==='indicator_style')this._selectPart('indicator');
        if(key==='card_shadow')this._selectPart('card');
      }
    };
    input.addEventListener(input.type==='checkbox'||input.tagName==='SELECT'?'change':'input',()=>update(input));
    if(range)range.addEventListener('input',()=>update(range));
  }
  _render(){
    if(!this._config)return;
    if(this._editorMode==='advanced')this._advancedRender();else this._simpleRender();
    const style=document.createElement('style');style.textContent=`
      .editor-top{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:16px}.editor-top .section-reset{padding:9px 11px;font-size:12px}.editor-top button{width:auto;padding:9px 15px;border-radius:20px;border:1px solid var(--divider-color,#444);color:var(--primary-text-color,#eee);background:transparent;cursor:pointer;font:inherit}
      .editor-top .selected{background:var(--primary-color,#009ac1);border-color:transparent;color:white}.editor-top .preset-toggle{margin-left:auto}
      .preset-wrap,.reset-panel{margin-bottom:16px}.preset-wrap h3{font-size:15px}
      .section{margin-bottom:18px;padding-bottom:18px;border-bottom:1px solid var(--divider-color,#333)}.section h3{font-size:15px;margin:0 0 12px}.section:last-child{border:0}
      .ring-tabs{display:flex;gap:6px;margin-bottom:12px}.ring-tabs .active{background:var(--primary-color,#009ac1);color:white}
      .segment{grid-template-columns:minmax(0,1fr) minmax(0,1fr) 66px 32px!important;gap:8px!important;margin:8px 0!important}.segment label{font-size:0!important;gap:0!important}.segment input{font-size:13px}.segment button{height:39px;padding:0!important;font-size:20px}.segment input[type=color]{height:39px!important}
      .segment.gradient-row{grid-template-columns:minmax(0,1fr) 66px 32px!important}
      .color-head{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) 66px 32px;gap:8px;font-size:11px;color:var(--secondary-text-color,#aaa);margin-top:12px}.color-head.gradient-head{grid-template-columns:minmax(0,1fr) 66px 32px}
      .field-help{font-size:12px;color:var(--secondary-text-color,#aaa)}.field-help summary{cursor:pointer;list-style:none}.field-help p{margin:6px 0;font-size:12px;line-height:1.4}
      .preset-wrap input,.preset-wrap select{min-width:0}.preset-wrap [hidden],[hidden]{display:none!important}
    `;this.shadowRoot.prepend(style);
    const top=document.createElement('div');top.className='editor-top';
    for(const [value,label] of [['simple','Simple'],['advanced','Advanced']]){
      const button=document.createElement('button');button.type='button';button.textContent=label;button.className=(this._editorMode||'simple')===value?'selected':'';
      button.addEventListener('click',()=>{this._editorMode=value;this._render();});top.append(button);
    }
    if(this._editorMode==='advanced'){
      const reset=document.createElement('button');reset.type='button';reset.textContent='Reset section';reset.className='section-reset';reset.title='Reset the selected Advanced section';
      reset.addEventListener('click',()=>{
        const part=this._selectedPart||'value',group=SKY_ADV_GROUPS[part],next={...this._config};
        for(const [key] of group.fields)delete next[key];
        if(this._commit(next))this._selectPart(part);
      });top.append(reset);
    }
    const presets=document.createElement('button');presets.type='button';presets.textContent='Presets ▾';presets.className='preset-toggle';presets.setAttribute('aria-expanded',Boolean(this._presetsOpen));
    presets.addEventListener('click',()=>{this._presetsOpen=!this._presetsOpen;this._resetOpen=false;this._render();});top.append(presets);
    const menu=document.createElement('button');menu.type='button';menu.textContent='⋮';menu.setAttribute('aria-label','More options');menu.setAttribute('aria-expanded',Boolean(this._resetOpen));
    menu.addEventListener('click',()=>{this._resetOpen=!this._resetOpen;this._presetsOpen=false;this._render();});top.append(menu);
    if(this._presetsOpen){
      const panel=this._presetToolbar();panel.className='preset-wrap';
      const title=panel.querySelector('strong');if(title)title.textContent='Presets';
      for(const button of panel.querySelectorAll('button')){
        if(button.textContent==='Reset all')button.remove();
        if(button.textContent==='Save preset')button.textContent='Save current style';
        if(button.textContent==='Load preset')button.textContent='Apply preset';
      }
      const selects=panel.querySelectorAll('select'),scope=selects[1];
      const load=[...panel.querySelectorAll('button')].find(b=>b.textContent==='Apply preset');
      if(scope&&selects[0]){scope.hidden=!selects[0].value;if(load)load.hidden=!selects[0].value;
        selects[0].addEventListener('change',()=>{scope.hidden=!selects[0].value;if(load)load.hidden=!selects[0].value;});
      }
      const hint=panel.querySelector('p');if(hint)hint.textContent=this._presetMessage||'Saved locally in this browser.';
      this.shadowRoot.prepend(panel);
    }
    if(this._resetOpen){
      const panel=document.createElement('div');panel.className='reset-panel';
      const reset=document.createElement('button');reset.type='button';reset.textContent='Reset appearance';
      reset.addEventListener('click',()=>{this._resetOpen=false;this._resetAppearance();});
      const hint=document.createElement('p');hint.textContent='Restore default styling. Your entities and data settings are kept.';panel.append(reset,hint);this.shadowRoot.prepend(panel);
    }
    this.shadowRoot.prepend(top);
  }
  _simpleRender(){
    if(!this._config)return;
    this.shadowRoot.innerHTML='<style>:host{display:block} .fields{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}small{font-size:11px;line-height:1.4;color:var(--secondary-text-color,#aaa)}label{display:flex;flex-direction:column;gap:6px;font-size:13px}input,select{box-sizing:border-box;min-width:0;width:100%;padding:10px;border:1px solid var(--divider-color,#666);border-radius:7px;background:var(--card-background-color,#222);color:var(--primary-text-color,#fff);font:inherit}input[type=color]{height:42px;padding:4px}h3{margin:18px 0 10px}p{color:var(--secondary-text-color);font-size:12px}.segment{display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:10px;margin:10px 0;align-items:end}button{padding:10px;border:1px solid var(--divider-color,#666);border-radius:7px;background:var(--card-background-color,#222);color:var(--primary-text-color,#fff);font:inherit;cursor:pointer}button:disabled{opacity:.4;cursor:default}</style><datalist id="sky-dev-entities"></datalist><div class="fields"></div>';
    const root=this.shadowRoot.querySelector('.fields'),c=this._config;
    for(const args of [['Entity','entity'],['Name','name'],['Icon','icon','text','mdi:gauge'],['Display scale','scale','number',0.001],['Minimum (source unit)','min','number',0],['Maximum (source unit)','max','number',16000],['Unit','unit','text','kW'],['Decimal places','decimals','number',1]])this._field(root,...args);
    const label=document.createElement('label');label.textContent='Mode';
    const select=document.createElement('select');
    for(const value of ['single','dual']){const o=document.createElement('option');o.value=value;o.textContent=value==='single'?'Single':'Dual';select.append(o);}
    select.value=c.mode||'single';
    select.addEventListener('change',()=>{
      const next={...this._config,mode:select.value};
      // A valid initial secondary entity keeps HA live preview usable while editing.
      if(next.mode==='dual'&&!next.secondary_entity)next.secondary_entity=next.entity;
      this._commit(next);this._render();
    });label.append(select);root.append(label);
    const arcLabel=document.createElement('label');arcLabel.textContent='Arc style';
    const arcSelect=document.createElement('select');
    for(const [value,text] of [['full','Full color'],['progress','Progress'],['indicator','Indicator only']]){
      const option=document.createElement('option');option.value=value;option.textContent=text;arcSelect.append(option);
    }
    arcSelect.value=c.arc_style||'full';
    arcSelect.addEventListener('change',()=>this._commit({...this._config,arc_style:arcSelect.value}));
    arcLabel.append(arcSelect);root.append(arcLabel);
    if(c.mode==='dual'){
      for(const args of [['Ring 2 entity','secondary_entity'],['Ring 2 scale','secondary_scale','number',1],['Ring 2 minimum','secondary_min','number',-6000],['Ring 2 maximum','secondary_max','number',6000],['Ring 2 unit','secondary_unit'],['Ring 2 decimal places','secondary_decimals','number',2]])this._field(root,...args);

    }else{
      const heading=document.createElement('h3');heading.textContent='Secondary value (optional)';this.shadowRoot.append(heading);
      const secondary=document.createElement('div');secondary.className='fields';this.shadowRoot.append(secondary);
      for(const args of [['Secondary entity','secondary_entity'],['Secondary scale','secondary_scale','number',1],['Secondary unit','secondary_unit'],['Secondary decimal places','secondary_decimals','number',2]])this._field(secondary,...args);
      const remove=document.createElement('button');remove.type='button';remove.textContent='Remove secondary value';
      remove.addEventListener('click',()=>{
        const next={...this._config};
        for(const key of ['secondary_entity','secondary_attribute','secondary_text'])delete next[key];
        if(this._commit(next))this._render();
      });this.shadowRoot.append(remove);

    }
    // Group controls without changing any field bindings.
    const labels=[...root.children],sections=[];
    const section=(title,items)=>{
      const box=document.createElement('section');box.className='section';
      const h=document.createElement('h3');h.textContent=title;
      const fields=document.createElement('div');fields.className='fields';fields.append(...items);box.append(h,fields);sections.push(box);return box;
    };
    section('General',labels.slice(0,4));
    section('Main value',labels.slice(4,10));
    if(c.mode==='dual')section('Second value · Ring 2',labels.slice(10));
    else{
      const heading=[...this.shadowRoot.querySelectorAll('h3')].find(h=>h.textContent==='Secondary value (optional)');
      if(heading){
        const secondaryFields=heading.nextElementSibling,remove=secondaryFields?.nextElementSibling;
        const box=section('Second value · Optional',[]);box.querySelector('.fields').remove();
        if(secondaryFields)box.append(secondaryFields);if(remove)box.append(remove);heading.remove();
      }
    }
    root.replaceWith(...sections);
    const colors=document.createElement('section');colors.className='section';
    const heading=document.createElement('h3');heading.textContent='Colors';colors.append(heading);
    if(c.mode==='dual'){
      const tabs=document.createElement('div');tabs.className='ring-tabs';
      for(const [id,text] of [['segments','Ring 1 · Outer'],['secondary_segments','Ring 2 · Inner']]){
        const button=document.createElement('button');button.type='button';button.textContent=text;button.className=(this._colorRing||'segments')===id?'active':'';
        button.addEventListener('click',()=>{this._colorRing=id;this._render();});tabs.append(button);
      }colors.append(tabs);
    }
    const panel=document.createElement('div');colors.append(panel);this.shadowRoot.append(colors);
    this._colorRanges('',c.mode==='dual'?(this._colorRing||'segments'):'segments',panel);
    this._entities();
  }
}
if(!customElements.get('sky-gauge-card'))customElements.define('sky-gauge-card',SkyGaugeCard);
if(!customElements.get('sky-gauge-card-editor'))customElements.define('sky-gauge-card-editor',SkyGaugeCardEditor);
window.customCards=window.customCards||[];
if(!window.customCards.some(c=>c.type==='sky-gauge-card'))window.customCards.push({type:'sky-gauge-card',name:'Sky Gauge Card',description:'Single and dual gauges with visual editing · by Kopterworx',preview:true});
})();

