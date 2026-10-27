const http=require('http'),fs=require('fs'),path=require('path'),url=require('url');
const PORT=process.env.PORT||3000,ROOT=__dirname,DATA=path.join(ROOT,'data'),DB=path.join(DATA,'sessions.json');
fs.mkdirSync(DATA,{recursive:true});if(!fs.existsSync(DB))fs.writeFileSync(DB,'[]');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
function json(res,status,obj){const s=JSON.stringify(obj);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(s)}
function body(req){return new Promise((resolve,reject)=>{let s='';req.on('data',c=>{s+=c;if(s.length>1e6)reject(Error('payload too large'))});req.on('end',()=>{try{resolve(s?JSON.parse(s):{})}catch(e){reject(e)}});req.on('error',reject)})}
function sessions(){try{return JSON.parse(fs.readFileSync(DB,'utf8'))}catch{return []}}
const server=http.createServer(async(req,res)=>{try{const u=url.parse(req.url,true),p=u.pathname;
 if(p==='/api/health')return json(res,200,{ok:true,service:'NetSignal Lab Local Backend',version:'3.2',externalApis:false});
 if(p==='/api/sessions'&&req.method==='GET')return json(res,200,sessions());
 if(p==='/api/sessions'&&req.method==='POST'){const x=sessions(),b=await body(req),row={id:Date.now()+Math.random(),time:new Date().toISOString(),...b};x.push(row);fs.writeFileSync(DB,JSON.stringify(x.slice(-500),null,2));return json(res,201,row)}
 if(p==='/api/radio'&&req.method==='POST'){const b=await body(req),keys=['technology','operator','rsrp','rsrq','sinr','pci','arfcn','cellId','band','timestamp'],data={};keys.forEach(k=>{if(k in b)data[k]=b[k]});data.receivedAt=new Date().toISOString();return json(res,200,{ok:true,source:'local Android bridge',data})}
 let file=path.join(ROOT,p==='/'?'index.html':p.replace(/^\//,''));if(!file.startsWith(ROOT)||!fs.existsSync(file)||fs.statSync(file).isDirectory())file=path.join(ROOT,'index.html');const ext=path.extname(file);res.writeHead(200,{'Content-Type':mime[ext]||'application/octet-stream','Cache-Control':'no-cache'});fs.createReadStream(file).pipe(res);
}catch(e){json(res,500,{ok:false,error:e.message})}});
server.listen(PORT,()=>console.log(`NetSignal Lab local backend: http://localhost:${PORT}`));
