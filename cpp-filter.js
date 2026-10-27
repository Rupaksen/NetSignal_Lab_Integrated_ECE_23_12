(function(){
  'use strict';
  const FILTER_EXAMPLES={
    fir:`#include <cmath>\n#include <vector>\nusing namespace std;\n\nint main() {\n    const int N = 1200;\n    const double Fs = 2000.0;\n    vector<double> input(N), output(N);\n\n    // 5-tap moving-average FIR low-pass filter\n    vector<double> b = {0.2, 0.2, 0.2, 0.2, 0.2};\n\n    for (int n = 0; n < N; n++) {\n        double t = n / Fs;\n        input[n] = sin(2 * M_PI * 50 * t) + 0.8 * sin(2 * M_PI * 400 * t);\n        output[n] = b[0] * input[n];\n        if (n >= 1) output[n] += b[1] * input[n-1];\n        if (n >= 2) output[n] += b[2] * input[n-2];\n        if (n >= 3) output[n] += b[3] * input[n-3];\n        if (n >= 4) output[n] += b[4] * input[n-4];\n    }\n    return 0;\n}`,
    iir:`#include <cmath>\n#include <vector>\nusing namespace std;\n\nint main() {\n    const int N = 1200;\n    const double Fs = 2000.0;\n    vector<double> input(N), output(N);\n\n    // First-order IIR low-pass: y[n] = 0.2x[n] + 0.8y[n-1]\n    const double b0 = 0.2;\n    const double a1 = -0.8;\n\n    for (int n = 0; n < N; n++) {\n        double t = n / Fs;\n        input[n] = sin(2 * M_PI * 50 * t) + 0.8 * sin(2 * M_PI * 400 * t);\n        output[n] = b0 * input[n];\n        if (n >= 1) output[n] -= a1 * output[n-1];\n    }\n    return 0;\n}`,
    highpass:`#include <cmath>\n#include <vector>\nusing namespace std;\n\nint main() {\n    const int N = 1200;\n    const double Fs = 2000.0;\n    vector<double> input(N), output(N);\n\n    // Simple differentiator-style FIR high-pass\n    const double b0 = 0.5;\n    const double b1 = -0.5;\n\n    for (int n = 0; n < N; n++) {\n        double t = n / Fs;\n        input[n] = sin(2 * M_PI * 50 * t) + 0.8 * sin(2 * M_PI * 400 * t);\n        output[n] = b0 * input[n];\n        if (n >= 1) output[n] += b1 * input[n-1];\n    }\n    return 0;\n}`
  };
  const $=id=>document.getElementById(id);
  function lineOf(code,pos){return code.slice(0,Math.max(0,pos)).split(/\n/).length}
  function colOf(code,pos){const i=code.lastIndexOf('\n',Math.max(0,pos)-1);return Math.max(1,pos-(i<0?-1:i))}
  function fail(msg,code,pos){const e=new Error(msg);e.line=lineOf(code,pos);e.col=colOf(code,pos);e.pos=pos;throw e}
  function strip(code){return code.replace(/\/\/.*$/gm,'').replace(/\/\*[\s\S]*?\*\//g,'')}
  function safeExpr(src,env,code,pos){
    let s=src.trim().replace(/\bstd::/g,'').replace(/\bM_PI\b/g,'PI').replace(/\bM_E\b/g,'E').replace(/\btrue\b/g,'1').replace(/\bfalse\b/g,'0').replace(/\^/g,'**');
    if(/\b(?:constructor|prototype|__proto__|globalThis|window|document|Function|eval|fetch|import|process|require)\b/.test(s))fail('Unsafe expression.',code,pos);
    if(/[^\w\s+\-*/%().,\[\]<>!=&|?:]/.test(s))fail('Unsupported expression syntax.',code,pos);
    const funcs={sin:Math.sin,cos:Math.cos,tan:Math.tan,asin:Math.asin,acos:Math.acos,atan:Math.atan,exp:Math.exp,sqrt:Math.sqrt,abs:Math.abs,fabs:Math.abs,log:Math.log,log10:Math.log10,pow:Math.pow,floor:Math.floor,ceil:Math.ceil,round:Math.round,min:Math.min,max:Math.max};
    const names=Object.keys(env),vals=names.map(k=>env[k]),fNames=Object.keys(funcs),fVals=fNames.map(k=>funcs[k]);
    try{return Function(...names,...fNames,'PI','E','"use strict"; return ('+s+');')(...vals,...fVals,Math.PI,Math.E)}catch(e){fail('Cannot evaluate expression: '+(e.message||'invalid expression'),code,pos)}
  }
  function matching(s,open,op='{',cl='}'){let d=0;for(let i=open;i<s.length;i++){if(s[i]===op)d++;else if(s[i]===cl&&--d===0)return i}return -1}
  function validate(code){
    const c=strip(code);
    if(!/\bint\s+main\s*\(\s*\)\s*\{/.test(c))fail('main() function not found. Use int main() { ... }.',code,0);
    if(/\b(class|struct|template|new|delete|malloc|free|system|exec|popen|fstream|ifstream|ofstream|cstdio|cstdlib|windows|process|asm|thread)\b/i.test(c))fail('Unsupported or unsafe C++ feature. This lab accepts an educational DSP subset only.',code,0);
    for(const m of c.matchAll(/#include\s*<([^>]+)>/g)) if(!['cmath','vector','iostream'].includes(m[1])) fail('Unsupported header <'+m[1]+'>. Allowed: <cmath>, <vector>, <iostream>.',code,m.index);
    const pairs=[['(',')'],['[',']'],['{','}']];for(const [a,b] of pairs){let d=0;for(let i=0;i<c.length;i++){if(c[i]===a)d++;else if(c[i]===b){d--;if(d<0)fail('Unexpected '+b+'.',code,i)}}if(d!==0)fail('Unbalanced '+a+b+' brackets.',code,c.length-1)}
    return c;
  }
  function splitTop(text,sep=','){let out=[],start=0,d=0;for(let i=0;i<text.length;i++){const ch=text[i];if('([{'.includes(ch))d++;else if(')]}'.includes(ch))d--;else if(ch===sep&&d===0){out.push(text.slice(start,i).trim());start=i+1}}out.push(text.slice(start).trim());return out.filter(Boolean)}
  function parseArrayInit(src,env,code,pos){const inner=src.trim().replace(/^\{/,'').replace(/\}$/,'');return splitTop(inner).map(x=>+safeExpr(x,env,code,pos)).filter(Number.isFinite)}
  function makeDiag(message,code,pos){const line=lineOf(code,pos||0),col=colOf(code,pos||0),lines=code.split(/\n/),text=lines[line-1]||'';return `ERROR: ${message}\nLine ${line}, Column ${col}\n\n${String(line).padStart(4)} | ${text}\n     | ${' '.repeat(Math.max(0,col-1))}^\n\nTip: Define input/output arrays, a filter coefficient set, and compute output[n] inside a for-loop.`}

  function execute(code){
    const c=validate(code),mainPos=c.search(/\bint\s+main\s*\(\s*\)\s*\{/),open=c.indexOf('{',mainPos),close=matching(c,open),body=c.slice(open+1,close);
    if(close<0)fail('Could not find the closing brace of main().',code,c.length-1);
    const env={}; const arrays={}; let fs=1000,N=1200; let loopSeen=false;
    const assign=(name,idx,op,val,pos)=>{if(!arrays[name])fail(`Array/vector "${name}" is not declared.`,code,pos);idx=Math.trunc(idx);if(idx<0||idx>=arrays[name].length)fail(`Index ${idx} is outside ${name} bounds (${arrays[name].length}).`,code,pos);if(op==='=')arrays[name][idx]=val;else if(op==='+=' )arrays[name][idx]+=val;else if(op==='-=' )arrays[name][idx]-=val;else fail('Unsupported assignment operator '+op,code,pos)};
    function statementExec(stmt,base){
      let s=stmt.trim(),pos=base+Math.max(0,stmt.indexOf(s));if(!s)return;
      if(/^return\b/.test(s))return;
      if(/^cout\b/.test(s))return;
      let m=s.match(/^(?:const\s+)?(?:double|float|int|long|size_t)\s+([A-Za-z_]\w*)\s*(?:=\s*(.*?))?;$/);
      if(m){env[m[1]]=m[2]?safeExpr(m[2],{...env,...arrays},code,pos):0;if(/^fs$/i.test(m[1]))fs=+env[m[1]];if(/^N$/i.test(m[1]))N=+env[m[1]];return}
      m=s.match(/^vector\s*<\s*(?:double|float|int)\s*>\s+([A-Za-z_]\w*)\s*(?:\(\s*([^)]*)\s*\)|=\s*(\{[\s\S]*\}))\s*;$/);
      if(m){const name=m[1];if(m[3])arrays[name]=parseArrayInit(m[3],{...env,...arrays},code,pos);else {const size=Math.max(0,Math.floor(safeExpr(m[2]||'0',{...env,...arrays},code,pos)));arrays[name]=new Array(size).fill(0)}return}
      m=s.match(/^vector\s*<\s*(?:double|float|int)\s*>\s+(.+)\s*;$/);
      if(m){for(const part of splitTop(m[1])){const q=part.match(/^([A-Za-z_]\w*)\s*\(\s*([^)]*)\s*\)$/);if(!q)fail('Invalid vector declaration: '+part,code,pos);const size=Math.max(0,Math.floor(safeExpr(q[2],{...env,...arrays},code,pos)));arrays[q[1]]=new Array(size).fill(0)}return}
      m=s.match(/^(?:double|float|int)\s+([A-Za-z_]\w*)\s*\[\s*([^\]]*)\s*\]\s*=\s*(\{[\s\S]*\})\s*;$/);
      if(m){arrays[m[1]]=parseArrayInit(m[3],{...env,...arrays},code,pos);return}
      m=s.match(/^([A-Za-z_]\w*)\s*(\[\s*(.*?)\s*\])?\s*(=|\+=|-=)\s*(.*?)\s*;$/);
      if(m){const name=m[1],rhs=m[5],op=m[4];if(m[2]){const idx=safeExpr(m[3],{...env,...arrays},code,pos),val=+safeExpr(rhs,{...env,...arrays},code,pos);assign(name,idx,op,val,pos)}else{if(!(name in env))fail(`Variable "${name}" is not declared.`,code,pos);const val=safeExpr(rhs,{...env,...arrays},code,pos);if(op==='=')env[name]=val;else if(op==='+=' )env[name]+=val;else env[name]-=val}return}
      fail('Unsupported statement: '+s.replace(/\s+/g,' ').slice(0,90),code,pos);
    }
    function execBlock(text,base){
      let i=0;while(i<text.length){while(i<text.length&&/\s/.test(text[i]))i++;if(i>=text.length)break;const abs=base+i;
        const forM=text.slice(i).match(/^for\s*\(\s*(?:(?:int|long|size_t)\s+)?([A-Za-z_]\w*)\s*=\s*([^;]+);\s*\1\s*(<|<=)\s*([^;]+);\s*\1\s*(\+\+|--|\+=\s*[^)]+|-=\s*[^)]+)\s*\)\s*\{/);
        if(forM){const op=forM[0].lastIndexOf('{'),end=matching(text,i+op);if(end<0)fail('Unclosed for-loop.',code,abs);const vn=forM[1],start=+safeExpr(forM[2],{...env,...arrays},code,abs),limit=forM[4],cmp=forM[3],stepRaw=forM[5];let step=stepRaw==='++'?1:stepRaw==='--'?-1:+safeExpr(stepRaw.replace(/^\+=|^-=/,''),{...env,...arrays},code,abs);if(!Number.isFinite(step)||step===0)fail('Invalid loop step.',code,abs);loopSeen=true;let guard=0;for(env[vn]=start;cmp==='<'?env[vn]<safeExpr(limit,{...env,...arrays},code,abs):env[vn]<=safeExpr(limit,{...env,...arrays},code,abs);env[vn]+=step){if(++guard>50000)fail('Loop exceeded 50,000 iterations. Check N and the loop condition.',code,abs);execBlock(text.slice(i+op+1,end),base+i+op+1)}i=end+1;continue}
        const ifM=text.slice(i).match(/^if\s*\((.*?)\)\s*\{/);
        if(ifM){const op=i+ifM[0].lastIndexOf('{'),end=matching(text,op);if(end<0)fail('Unclosed if block.',code,abs);const cond=!!safeExpr(ifM[1],{...env,...arrays},code,abs);if(cond)execBlock(text.slice(op+1,end),base+op+1);i=end+1;continue}
        const ifOne=text.slice(i).match(/^if\s*\((.*?)\)\s*([^;]+;)/);
        if(ifOne){const cond=!!safeExpr(ifOne[1],{...env,...arrays},code,abs);if(cond)statementExec(ifOne[2],base+i+ifOne[0].indexOf(ifOne[2]));i+=ifOne[0].length;continue}
        let semi=-1,d=0;for(let j=i;j<text.length;j++){const ch=text[j];if('([{'.includes(ch))d++;else if(')]}'.includes(ch))d--;else if(ch===';'&&d===0){semi=j;break}}if(semi<0)fail('Expected semicolon.',code,abs);statementExec(text.slice(i,semi+1),base+i);i=semi+1;
      }
    }
    execBlock(body,open+1);
    if(!loopSeen)fail('No DSP for-loop found. Build the filter sample-by-sample with for (int n = 0; n < N; n++).',code,open+1);
    const names=Object.keys(arrays),inputName=names.find(n=>/^input$/i.test(n))||names.find(n=>/^x$/i.test(n)),outputName=names.find(n=>/^output$/i.test(n))||names.find(n=>/^y$/i.test(n));
    if(!inputName)fail('No input waveform array found. Declare vector<double> input(N).',code,open+1);
    if(!outputName)fail('No output waveform array found. Declare vector<double> output(N).',code,open+1);
    const input=arrays[inputName].map(Number),output=arrays[outputName].map(Number);if(input.length<2||output.length<2)fail('Input/output must contain at least two samples.',code,open+1);if(input.length>50000||output.length>50000)fail('Filter arrays are limited to 50,000 samples.',code,open+1);
    if(!Number.isFinite(fs)||fs<=0)fail('Sampling frequency Fs must be positive.',code,open+1);
    return {input,output,fs,N:Math.min(input.length,output.length),inputName,outputName,coefficients:Object.fromEntries(Object.entries(arrays).filter(([k])=>/^b\d*|^a\d*|^coeff/i.test(k)))};
  }
  function response(input,output,fs){const N=Math.min(2048,input.length,output.length),bins=256,mag=[];for(let k=0;k<bins;k++){let w=2*Math.PI*(k/bins)*0.5,xi=0,xq=0,yi=0,yq=0;for(let n=0;n<N;n++){const a=w*n;xi+=input[n]*Math.cos(a);xq-=input[n]*Math.sin(a);yi+=output[n]*Math.cos(a);yq-=output[n]*Math.sin(a)}const X=Math.hypot(xi,xq),Y=Math.hypot(yi,yq);mag.push({f:(k/bins)*(fs/2),db:20*Math.log10(Math.max(1e-9,Y/Math.max(X,1e-9)))})}return mag}
  function draw(id,series,title){const c=$(id);if(!c)return;const r=c.getBoundingClientRect(),d=devicePixelRatio||1;c.width=Math.max(1,r.width*d);c.height=Math.max(1,r.height*d);const ctx=c.getContext('2d');ctx.setTransform(d,0,0,d,0,0);const w=r.width,h=r.height;ctx.fillStyle='#070707';ctx.fillRect(0,0,w,h);const vals=series.flatMap(s=>s.values),mn=Math.min(...vals),mx=Math.max(...vals),sp=mx-mn||1,p={l:42,r:12,t:24,b:30};ctx.strokeStyle='#24242a';for(let i=0;i<6;i++){const y=p.t+(h-p.t-p.b)*i/5;ctx.beginPath();ctx.moveTo(p.l,y);ctx.lineTo(w-p.r,y);ctx.stroke()}series.forEach((s,j)=>{ctx.strokeStyle=j?'#fff':'#e21b23';ctx.lineWidth=j?1.25:2;ctx.beginPath();const stride=Math.max(1,Math.ceil(s.values.length/2500));let q=0;for(let i=0;i<s.values.length;i+=stride){const x=p.l+q/(Math.ceil(s.values.length/stride)-1||1)*(w-p.l-p.r),y=h-p.b-(s.values[i]-mn)/sp*(h-p.t-p.b);q?ctx.lineTo(x,y):ctx.moveTo(x,y);q++}ctx.stroke()});ctx.fillStyle='#aaa';ctx.font='10px Arial';ctx.fillText(title,p.l,14)}
  function drawResponse(points){const c=$('cppFilterResponse');if(!c)return;const r=c.getBoundingClientRect(),d=devicePixelRatio||1;c.width=Math.max(1,r.width*d);c.height=Math.max(1,r.height*d);const ctx=c.getContext('2d');ctx.setTransform(d,0,0,d,0,0);const w=r.width,h=r.height;ctx.fillStyle='#070707';ctx.fillRect(0,0,w,h);const p={l:42,r:15,t:24,b:30},mn=-60,mx=5;ctx.strokeStyle='#24242a';for(let i=0;i<6;i++){const y=p.t+(h-p.t-p.b)*i/5;ctx.beginPath();ctx.moveTo(p.l,y);ctx.lineTo(w-p.r,y);ctx.stroke()}ctx.strokeStyle='#e21b23';ctx.lineWidth=2;ctx.beginPath();points.forEach((q,i)=>{const x=p.l+i/(points.length-1)*(w-p.l-p.r),v=Math.max(mn,Math.min(mx,q.db)),y=h-p.b-(v-mn)/(mx-mn)*(h-p.t-p.b);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke();ctx.fillStyle='#aaa';ctx.font='10px Arial';ctx.fillText('Estimated magnitude response (relative dB)',p.l,14);ctx.fillText('0 Hz',p.l,h-10);ctx.fillText((points.at(-1)?.f||0).toFixed(0)+' Hz',w-65,h-10)}
  function run(){const code=$('cppFilterCode').value;try{const r=execute(code);window.__cppFilterResult=r;draw('cppFilterCanvas',[{values:r.input},{values:r.output}],'C++ filter • input vs output');const resp=response(r.input,r.output,r.fs);drawResponse(resp);const rms=a=>Math.sqrt(a.reduce((s,v)=>s+v*v,0)/a.length),inR=rms(r.input),outR=rms(r.output),peak=Math.max(...r.output.map(Math.abs));$('cppFilterMetrics').innerHTML=[['Samples',r.N],['Fs',r.fs.toFixed(2)+' Hz'],['Input RMS',inR.toFixed(5)],['Output RMS',outR.toFixed(5)],['RMS ratio',(outR/Math.max(inR,1e-12)*100).toFixed(2)+' %'],['Output peak',peak.toFixed(5)],['Input array',r.inputName],['Output array',r.outputName],['Status','FILTER TEST PASS']].map((x,i)=>`<div class="metric"><b>${x[0]}</b><strong class="${i===8?'red':''}">${x[1]}</strong></div>`).join('');$('cppFilterDiagnostics').textContent='COMPILE CHECK: PASS\nFILTER EXECUTION: PASS\n\nThe C++ DSP filter executed successfully.\nInput and output waveforms were generated and the response was measured.';$('cppFilterStatus').className='cpp-status success';$('cppFilterStatus').innerHTML='<b>Filter test passed.</b> The C++ filter ran successfully and the input/output waveforms are shown below.';$('cppFilterLabel').textContent=`${r.outputName} • ${r.N} samples`;$('cppFilterTable').innerHTML=r.output.slice(0,300).map((v,i)=>`<tr><td>${i}</td><td>${(i/r.fs).toFixed(6)}</td><td>${r.input[i].toFixed(8)}</td><td>${v.toFixed(8)}</td></tr>`).join('');saveHistory('C++ Filters','C++ filter test',`${r.outputName} • RMS ${outR.toFixed(4)}`,{fs:r.fs,samples:r.N,inputRms:inR,outputRms:outR});}catch(e){const code=$('cppFilterCode').value,pos=Math.max(0,Math.min(code.length-1,e.pos||0));$('cppFilterDiagnostics').textContent=makeDiag(e.message,code,pos);$('cppFilterStatus').className='cpp-status error';$('cppFilterStatus').innerHTML=`<b>Filter error.</b> Problem near line ${e.line||lineOf(code,pos)}, column ${e.col||colOf(code,pos)}. Fix the highlighted issue and test again.`;$('cppFilterMetrics').innerHTML='';}}
  function load(){const v=$('cppFilterExample').value;if(v!=='custom')$('cppFilterCode').value=FILTER_EXAMPLES[v]||FILTER_EXAMPLES.fir}
  $('cppFilterExample').onchange=load;$('cppFilterRun').onclick=run;$('cppFilterClear').onclick=()=>{$('cppFilterCode').value='';$('cppFilterDiagnostics').textContent='No diagnostics yet.';$('cppFilterMetrics').innerHTML='';$('cppFilterTable').innerHTML='';$('cppFilterLabel').textContent='No filter executed';$('cppFilterStatus').className='cpp-status info';$('cppFilterStatus').innerHTML='<b>Editor cleared.</b> Enter a C++ DSP filter.'};$('cppFilterDownload').onclick=()=>downloadBlob('netsignal_cpp_filter.cpp',$('cppFilterCode').value,'text/plain');window.addEventListener('resize',()=>{if(window.__cppFilterResult){const r=window.__cppFilterResult;draw('cppFilterCanvas',[{values:r.input},{values:r.output}],'C++ filter • input vs output');drawResponse(response(r.input,r.output,r.fs))}});load();
  window.NetSignalCppFilterEngine={execute,examples:FILTER_EXAMPLES};
  window.runCppFilter=run;
})();
