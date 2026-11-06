import fs from 'node:fs';
import {chromium} from 'playwright';
import check from './codex-wiki-browser-checks.cjs';
fs.mkdirSync('output/playwright',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-webgl']});
try{await check(await browser.newPage())}finally{await browser.close()}
