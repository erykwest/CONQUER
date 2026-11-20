'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),sourceDir=path.join(root,'content','devlog');
const verify=process.argv.includes('--check');
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function frontmatter(file){
  const raw=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
  const match=/^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);
  if(!match)throw Error('Missing Devlog frontmatter: '+file);
  const meta={};
  for(const line of match[1].split('\n')){
    const record=/^([a-z_]+):\s*(.*)$/.exec(line);
    if(!record||meta[record[1]])throw Error('Invalid frontmatter line: '+line);
    meta[record[1]]=record[2];
  }
  for(const k of ['title','list_title','hero_title','description','summary','date','category','status'])
    if(!meta[k])throw Error('Missing metadata '+k+' in '+file);
  if(!['published','draft'].includes(meta.status))throw Error('Invalid publication status');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(meta.date)||Number.isNaN(Date.parse(meta.date)))throw Error('Invalid publication date');
  const slug=path.basename(file,'.md');
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))throw Error('Invalid slug');
  return{meta,body:match[2].trim(),slug};
}
function inline(value){
  return esc(value).replace(/\[([^\]]+)\]\((\/gamesite\/[a-z0-9./-]+)\)/g,'<a class="text-link" href="$2">$1</a>');
}
function markdown(value){
  return value.split(/\n{2,}/).map(chunk=>{
    chunk=chunk.trim();
    if(!chunk)return '';
    if(chunk.startsWith('## '))return '<h2>'+inline(chunk.slice(3))+'</h2>';
    if(chunk.startsWith('> '))return '<blockquote>'+inline(chunk.slice(2))+'</blockquote>';
    return '<p>'+inline(chunk.replace(/\n/g,' '))+'</p>';
  }).filter(Boolean).join('\n');
}
function dateLabel(date){
  const d=new Date(date+'T12:00:00Z');
  return new Intl.DateTimeFormat('en-GB',{timeZone:'UTC',day:'numeric',month:'short',year:'numeric'}).format(d);
}
function renderArticle(post,template){
  const {meta,body,slug}=post;
  const content='<div class="page page-hero"><div class="eyebrow">Development journal · '+esc(dateLabel(meta.date))+'</div><h1>'+esc(meta.hero_title)+'</h1><p class="lead">'+esc(meta.summary)+'</p></div>\n'+
    '<article class="content">\n'+markdown(body)+'\n</article>';
  return template
    .replaceAll('{{PAGE_TITLE}}',esc(meta.title))
    .replaceAll('{{PAGE_DESCRIPTION}}',esc(meta.description))
    .replaceAll('{{PAGE_CANONICAL}}','/gamesite/devlog/'+slug+'.html')
    .replace('{{DEVLOG_ARTICLE}}',content);
}
function rowsFor(posts){
  return posts.map(({meta,slug})=>{
    const label=dateLabel(meta.date).toUpperCase()+' · '+meta.category.toUpperCase();
    return '<a class="article-row" href="/gamesite/devlog/'+slug+'.html"><div class="meta">'+esc(label)+'</div><h3>'+esc(meta.list_title)+'</h3><div class="arrow">Read →</div></a>';
  }).join('\n');
}
function build(){
  const posts=fs.readdirSync(sourceDir).filter(x=>x.endsWith('.md')).sort()
    .map(name=>frontmatter(path.join(sourceDir,name)));
  const published=posts.filter(p=>p.meta.status==='published').sort((a,b)=>b.meta.date.localeCompare(a.meta.date));
  const index=fs.readFileSync(path.join(root,'templates','devlog-index.html'),'utf8').replace('{{DEVLOG_ROWS}}',rowsFor(published));
  const articleTemplate=fs.readFileSync(path.join(root,'templates','devlog-article.html'),'utf8');
  const outputs=[['devlog/index.html',index],...published.map(p=>['devlog/'+p.slug+'.html',renderArticle(p,articleTemplate)])];
  // A draft or removed post must not survive as a public page.
  const expected=new Set(outputs.map(x=>path.basename(x[0])));
  for(const file of fs.readdirSync(path.join(root,'devlog')).filter(x=>x.endsWith('.html')))
    if(!expected.has(file))throw Error('Orphaned public article must be removed: '+file);
  for(const [relative,generated] of outputs){
    const target=path.join(root,relative);
    if(verify)assert.equal(fs.readFileSync(target,'utf8'),generated,'Devlog page is stale: '+relative);
    else fs.writeFileSync(target,generated);
  }
  console.log('Devlog '+(verify?'verified':'generated')+': '+published.length+' published, '+(posts.length-published.length)+' draft; drafts never public');
}
build();
