const fs=require('fs');
module.exports=function sub(p, pairs){let s=fs.readFileSync(p,'utf8');const crlf=s.includes('\r\n');if(crlf)s=s.replace(/\r\n/g,'\n');for(const [a,b] of pairs){if(!s.includes(a)){console.log('MISSING in',p,':',a.slice(0,70).replace(/\n/g,'⏎'));continue;}s=s.split(a).join(b);}if(crlf)s=s.replace(/\n/g,'\r\n');fs.writeFileSync(p,s);}
