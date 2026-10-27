(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const EXAMPLES={
    sine:`#include <cmath>\n#include <vector>\nusing namespace std;\n\nint main() {\n    const int N = 512;\n    const double Fs = 1000.0;\n    const double f = 50.0;\n    vector<double> signal;\n\n    for (int n = 0; n < N; n++) {\n        double t = n / Fs;\n        signal.push_back(sin(2 * M_PI * f * t));\n    }\n    return 0;\n}`,
    mixed:`#include <cmath>\n#include <vector>\nusing namespace std;\n\nint main() {\n    const int N = 800;\n    const double Fs = 2000.0;\n    vector<double> signal;\n\n    for (int n = 0; n < N; n++) {\n        double t = n / Fs;\n        double x = sin(2 * M_PI * 50 * t) + 0.5 * cos(2 * M_PI * 180 * t);\n        signal.push_back(x);\n    }\n    return 0;\n}`,
    sampling:`#include <cmath>\n#include <vector>\nusing namespace std;\n\nint main() {\n    const int N = 400;\n    const double Fs = 800.0;\n    vector<double> samples(N);\n\n    for (int n = 0; n < N; n++) {\n        double t = n / Fs;\n        samples[n] = sin(2 * M_PI * 120 * t);\n    }\n    return 0;\n}`
  };

  function lineOf(code,pos){return code.slice(0,pos).split(/\n/).length}
  function colOf(code,pos){let i=code.lastIndexOf('\n',pos-1);return pos-(i<0?-1:i)}
  function err(message,code,pos){const e=new Error(message);e.line=lineOf(code,Math.max(0,pos));e.col=colOf(code,Math.max(0,pos));throw e}
  function clean(code){return code.replace(/\/\/.*$/gm,'').replace(/\/\*[\s\S]*?\*\//g,'');}
  function diagnostics(message,code,pos){const line=lineOf(code,pos||0),col=colOf(code,pos||0),lines=code.split(/\n/),text=lines[line-1]||'';return `ERROR: ${message}\nLine ${line}, Column ${col}\n\n${String(line).padStart(4)} | ${text}\n     | ${' '.repeat(Math.max(0,col-1))}^\n\nTip: Check the highlighted line and the DSP subset supported by this lab.`}

  function validate(code){
    const c=clean(code);
    if(!/\bint\s+main\s*\(\s*\)\s*\{/.test(c)) err('main() function not found. Use: int main() { ... }',code,0);
    if(/\b(class|struct|template|new|delete|malloc|free|system|exec|popen|fstream|ifstream|ofstream|cstdio|cstdlib|windows|process|asm)\b/i.test(c)) err('Unsupported or unsafe C++ feature. This educational runner only accepts the documented DSP subset.',code,0);
    const allowedIncludes=[...c.matchAll(/#include\s*<([^>]+)>/g)].map(m=>m[1]);
    for(const inc of allowedIncludes) if(!['cmath','vector','iostream'].includes(inc)) err(`Unsupported header <${inc}>. Allowed: <cmath>, <vector>, <iostream>.`,code,c.indexOf(`#include <${inc}>`));
    const bad=c.replace(/#include\s*<[^>]+>/g,'').replace(/\busing\s+namespace\s+std\s*;/g,'').replace(/\bint\s+main\s*\(\s*\)\s*\{/g,'').replace(/[\s\n\r\t0-9a-zA-Z_+\-*/%<>=!&|.,;:'"(){}\[\]]/g,'');
    if(bad.trim()) err(`Unsupported character/token near "${bad.trim().slice(0,18)}".`,code,Math.max(0,code.indexOf(bad.trim())));
    const pairs=[['(',')'],['[',']'],['{','}']];for(const [a,b] of pairs){let n=0;for(let i=0;i<c.length;i++){if(c[i]===a)n++;if(c[i]===b)n--;if(n<0)err(`Unexpected '${b}'.`,code,i)}if(n!==0)err(`Unbalanced '${a}${b}' brackets.`,code,c.length-1)}
    return c;
  }

  function exprEval(src,env){
    let s=src.trim().replace(/\bstd::/g,'').replace(/\bM_PI\b/g,'PI').replace(/\bM_E\b/g,'E').replace(/\btrue\b/g,'1').replace(/\bfalse\b/g,'0').replace(/\b([0-9.]+)f\b/g,'$1');
    if(/[^\w\s+\-*/%().,\[\]<>!=&|?:]/.test(s)) throw new Error('Unsupported expression syntax.');
    s=s.replace(/\^/g,'**');
    s=s.replace(/\b(double|float|int|long)\s*\(/g,'Number(');
    const names=Object.keys(env); const vals=names.map(k=>env[k]);
    const funcs={sin:Math.sin,cos:Math.cos,tan:Math.tan,asin:Math.asin,acos:Math.acos,atan:Math.atan,exp:Math.exp,sqrt:Math.sqrt,abs:Math.abs,fabs:Math.abs,log:Math.log,log10:Math.log10,pow:Math.pow,floor:Math.floor,ceil:Math.ceil,round:Math.round};
    const fNames=Object.keys(funcs),fVals=fNames.map(k=>funcs[k]);
    if(/\b(?:constructor|prototype|__proto__|globalThis|window|document|Function|eval|fetch|import)\b/.test(s)) throw new Error('Unsafe expression.');
    return Function(...names,...fNames,'PI','E',`"use strict"; return (${s});`)(...vals,...fVals,Math.PI,Math.E);
  }

  function evalAt(src,env,code,pos){
    try{return exprEval(src,env)}catch(e){err(e.message||'Invalid expression.',code,pos)}
  }

  function findMatching(s,open){let depth=0;for(let i=open;i<s.length;i++){if(s[i]==='{')depth++;else if(s[i]==='}'&&--depth===0)return i}return -1}
  function splitStatements(body){let out=[],start=0,depth=0;for(let i=0;i<body.length;i++){let ch=body[i];if(ch==='{'||ch==='('||ch==='[')depth++;else if(ch==='}'||ch===')'||ch===']')depth--;else if(ch===';'&&depth===0){out.push({text:body.slice(start,i+1),start});start=i+1}}if(body.slice(start).trim())out.push({text:body.slice(start),start});return out}

  function execute(code){
    const c=validate(code),mainPos=c.search(/\bint\s+main\s*\(\s*\)\s*\{/),open=c.indexOf('{',mainPos),close=findMatching(c,open);
    if(close<0) err('Could not find the closing brace of main().',code,c.length-1);
    const body=c.slice(open+1,close); const env={}; const arrays={}; const vectors={}; let fs=1000,N=0,output=[];
    const declRe=/^(?:const\s+)?(?:double|float|int|long)\s+([A-Za-z_]\w*)\s*(?:=\s*(.*))?;$/;
    function execBlock(text,base){
      let i=0;
      while(i<text.length){while(i<text.length&&/\s/.test(text[i]))i++;if(i>=text.length)break;
        const abs=base+i;
        const forM=text.slice(i).match(/^for\s*\(\s*(?:(?:int|long|size_t)\s+)?([A-Za-z_]\w*)\s*=\s*([^;]+);\s*\1\s*<\s*([^;]+);\s*\1\s*(\+\+|--|\+=\s*[^)]+|-=?=\s*[^)]+)\s*\)\s*\{/);
        if(forM){const open=i+forM[0].lastIndexOf('{'),end=findMatching(text,open);if(end<0)err('Unclosed for-loop.',code,open+base);const varName=forM[1],startV=evalAt(forM[2],env,code,abs),limitExpr=forM[3],stepRaw=forM[4];let step=stepRaw==='++'?1:stepRaw==='--'?-1:(stepRaw.includes('+=')?evalAt(stepRaw.split('+=')[1],env,code,abs):-evalAt(stepRaw.split('-=')[1],env,code,abs));let guard=0;for(env[varName]=startV;step>0?env[varName]<evalAt(limitExpr,env,code,abs):env[varName]>evalAt(limitExpr,env,code,abs);env[varName]+=step){if(++guard>200000)err('Loop exceeded 200,000 iterations. Check your loop condition.',code,abs);execBlock(text.slice(open+1,end),base+open+1)}i=end+1;continue}
        const semi=text.indexOf(';',i);if(semi<0)break;const stmt=text.slice(i,semi+1).trim();const local=abs;
        if(/^return\b/.test(stmt)){i=semi+1;continue}
        if(/^cout\b/.test(stmt)){i=semi+1;continue}
        let m=stmt.match(/^(?:const\s+)?(?:double|float|int|long)\s+([A-Za-z_]\w*)\s*(?:=\s*(.*))?;$/);
        if(m){env[m[1]]=m[2]?evalAt(m[2],env,code,local):0;if(m[1].toLowerCase()==='fs')fs=+env[m[1]];if(m[1].toLowerCase()==='n')N=+env[m[1]];i=semi+1;continue}
        m=stmt.match(/^(?:vector\s*<\s*(?:double|float|int)\s*>|(?:double|float|int))\s+([A-Za-z_]\w*)\s*(?:\(\s*([^)]*)\s*\)|\[\s*([^\]]+)\s*\])?\s*;$/);
        if(m){const name=m[1],size=m[2]||m[3];if(stmt.includes('vector')){vectors[name]=[];if(size) vectors[name]=new Array(Math.max(0,Math.floor(evalAt(size,env,code,local)))).fill(0)}else arrays[name]=size?new Array(Math.max(0,Math.floor(evalAt(size,env,code,local)))).fill(0):[];i=semi+1;continue}
        m=stmt.match(/^([A-Za-z_]\w*)\.push_back\s*\((.*)\)\s*;$/);if(m&&vectors[m[1]]){vectors[m[1]].push(exprEval(m[2],env));i=semi+1;continue}
        m=stmt.match(/^([A-Za-z_]\w*)\s*\[\s*(.*?)\s*\]\s*=\s*(.*?)\s*;$/);if(m&&(arrays[m[1]]||vectors[m[1]])){const idx=Math.floor(evalAt(m[2],env,code,local)),val=+evalAt(m[3],{...env,...arrays,...vectors},code,local);const a=arrays[m[1]]||vectors[m[1]];if(idx<0||idx>=a.length)err(`Index ${idx} is outside ${m[1]} bounds (${a.length}).`,code,local);a[idx]=val;i=semi+1;continue}
        m=stmt.match(/^([A-Za-z_]\w*)\s*=\s*(.*?)\s*;$/);if(m&&Object.prototype.hasOwnProperty.call(env,m[1])){env[m[1]]=evalAt(m[2],{...env,...arrays,...vectors},code,local);i=semi+1;continue}
        if(/^\s*$/.test(stmt)){i=semi+1;continue}
        err(`Unsupported statement: ${stmt.replace(/\s+/g,' ').slice(0,80)}`,code,local);
      }
    }
    execBlock(body,open+1);
    const candidates=[];Object.entries(vectors).forEach(([k,v])=>candidates.push([k,v]));Object.entries(arrays).forEach(([k,v])=>candidates.push([k,v]));
    if(!candidates.length){for(const [k,v] of Object.entries(env))if(Array.isArray(v))candidates.push([k,v])}
    let chosen=candidates.find(([k])=>/^(signal|samples|x|waveform|y|output)$/i.test(k))||candidates.find(([,v])=>v.length>1);
    if(!chosen) err('No waveform array/vector found. Create a vector/array such as vector<double> signal; and fill it inside a loop.',code,body.length?open+1:0);
    let values=chosen[1].map(Number).filter(Number.isFinite);if(values.length<2)err(`Waveform container "${chosen[0]}" contains fewer than 2 numeric samples.`,code,open+1);
    if(values.length>50000)values=values.slice(0,50000);
    const fsKeys=['Fs','fs','samplingFrequency','sampleRate']; for(const k of fsKeys)if(Number.isFinite(+env[k])){fs=+env[k];break}
    if(!Number.isFinite(fs)||fs<=0)fs=1000;
    return {name:chosen[0],values,fs,N:values.length};
  }

  function draw(values){const c=$('cppCanvas');if(!c)return;const r=c.getBoundingClientRect(),d=devicePixelRatio||1;c.width=Math.max(1,r.width*d);c.height=Math.max(1,r.height*d);const ctx=c.getContext('2d');ctx.setTransform(d,0,0,d,0,0);const w=r.width,h=r.height;ctx.fillStyle='#070707';ctx.fillRect(0,0,w,h);const mn=Math.min(...values),mx=Math.max(...values),sp=mx-mn||1,p={l:42,r:15,t:24,b:32};ctx.strokeStyle='#25252a';for(let i=0;i<6;i++){const y=p.t+(h-p.t-p.b)*i/5;ctx.beginPath();ctx.moveTo(p.l,y);ctx.lineTo(w-p.r,y);ctx.stroke()}ctx.strokeStyle='#34343a';const zy=h-p.b-(0-mn)/sp*(h-p.t-p.b);ctx.beginPath();ctx.moveTo(p.l,zy);ctx.lineTo(w-p.r,zy);ctx.stroke();ctx.strokeStyle='#e21b23';ctx.lineWidth=2;ctx.beginPath();const stride=Math.max(1,Math.ceil(values.length/3000));let j=0;for(let i=0;i<values.length;i+=stride){const x=p.l+j/(Math.ceil(values.length/stride)-1||1)*(w-p.l-p.r),y=h-p.b-(values[i]-mn)/sp*(h-p.t-p.b);j?ctx.lineTo(x,y):ctx.moveTo(x,y);j++}ctx.stroke();ctx.fillStyle='#aaa';ctx.font='10px Arial';ctx.fillText('C++ generated DSP waveform',p.l,14);ctx.fillText(`min ${mn.toFixed(4)}`,p.l,h-10);ctx.fillText(`max ${mx.toFixed(4)}`,w-90,h-10)}
  function setStatus(type,html){const el=$('cppStatus');el.className='cpp-status '+type;el.innerHTML=html}
  function run(){const code=$('cppCode').value;try{$('cppDiagnostics').textContent='Analyzing C++ program…';const r=execute(code);window.__cppValues=r.values;draw(r.values);const mean=r.values.reduce((a,b)=>a+b,0)/r.values.length,rms=Math.sqrt(r.values.reduce((a,b)=>a+b*b,0)/r.values.length),peak=Math.max(...r.values.map(Math.abs));$('cppMetrics').innerHTML=[['Samples',r.values.length],['Sampling rate',r.fs.toFixed(2)+' Hz'],['Duration',((r.values.length-1)/r.fs).toFixed(5)+' s'],['Mean',mean.toFixed(5)],['RMS',rms.toFixed(5)],['Peak',peak.toFixed(5)],['Vector',r.name],['Status','SUCCESS']].map((x,i)=>`<div class="metric"><b>${x[0]}</b><strong class="${i===7?'red':''}">${x[1]}</strong></div>`).join('');$('cppWaveLabel').textContent=`${r.name} • ${r.values.length} samples`;$('cppDiagnostics').textContent='COMPILE CHECK: PASS\nEXECUTION: PASS\n\nNo supported-subset errors were found. Waveform generated successfully.';$('cppTable').innerHTML=r.values.slice(0,300).map((v,i)=>`<tr><td>${i}</td><td>${(i/r.fs).toFixed(6)}</td><td>${v.toFixed(8)}</td></tr>`).join('');setStatus('success','<b>Success.</b> Your C++ DSP program executed in the local educational runner and generated the waveform.');saveHistory('C++ DSP','C++ program → waveform',`${r.name} • ${r.values.length} samples`,{samples:r.values.length,fs:r.fs,vector:r.name,rms});}catch(e){const code=$('cppCode').value,pos=Math.max(0,Math.min(code.length-1,(e.line?code.split(/\n/).slice(0,e.line-1).join('\n').length+(e.line>1?1:0):0)));$('cppDiagnostics').textContent=diagnostics(e.message,code,pos);setStatus('error',`<b>Program error.</b> Found a problem near line ${e.line||lineOf(code,pos)}, column ${e.col||colOf(code,pos)}. Fix the highlighted issue and run again.`);$('cppMetrics').innerHTML='';}}
  function loadExample(){const v=$('cppExample').value;if(v!=='custom')$('cppCode').value=EXAMPLES[v]||EXAMPLES.sine;}
  $('cppExample').onchange=loadExample;$('cppRun').onclick=run;$('cppClear').onclick=()=>{$('cppCode').value='';$('cppDiagnostics').textContent='No diagnostics yet.';$('cppMetrics').innerHTML='';$('cppTable').innerHTML='';$('cppWaveLabel').textContent='No program executed';setStatus('info','<b>Editor cleared.</b> Enter a C++ DSP program.');draw([0,0])};$('cppDownload').onclick=()=>downloadBlob('netsignal_dsp_program.cpp',$('cppCode').value,'text/plain');window.addEventListener('resize',()=>{const t=$('cppWaveLabel')?.textContent;if(t&&t!=='No program executed'&&window.__cppValues)draw(window.__cppValues)});
  const oldRun=run;window.runCppDsp=()=>{oldRun()};
  // Wrap draw/run so resize can use the last result without changing the editor API.
  const originalExecute=execute; // retained for debugging/documentation
  loadExample();draw([0,0]);
})();
