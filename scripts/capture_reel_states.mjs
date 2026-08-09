import { chromium } from '/tmp/cartokob-playwright/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const out = new URL('../tmp/reel-captures/', import.meta.url);
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page = await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const shot = name => page.screenshot({path:fileURLToPath(new URL(`${name}.png`,out)),fullPage:false});
await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});
await shot('01-safety');
await page.getByRole('button',{name:'J’ai compris, ouvrir la carte'}).click();
await page.waitForTimeout(1200); await shot('02-home');

const search = page.getByLabel('Rechercher un lieu');
await search.fill('Aéroport de Paris-Orly'); await shot('03-search-favorable');
await page.getByRole('button',{name:'Lancer la recherche'}).click(); await page.waitForTimeout(250); await shot('04-loading-favorable');
await page.waitForFunction(() => { const t=document.querySelector('.mobile-score-hero strong')?.textContent||''; return t && !t.includes('Analyse'); },null,{timeout:45000});
await page.waitForTimeout(800); await shot('05-favorable-result');
const scroller=page.locator('.details-scroll'); await scroller.evaluate(el=>el.scrollTo({top:520,behavior:'instant'})); await page.waitForTimeout(400); await shot('06-favorable-horizon');

await page.getByRole('button',{name:/Nouvelle recherche/}).click(); await page.waitForTimeout(500);
await search.fill('Chamonix-Mont-Blanc'); await shot('07-search-unfavorable');
await page.getByRole('button',{name:'Lancer la recherche'}).click(); await page.waitForTimeout(250); await shot('08-loading-unfavorable');
await page.waitForFunction(() => { const t=document.querySelector('.mobile-score-hero strong')?.textContent||''; return t && !t.includes('Analyse'); },null,{timeout:45000});
await page.waitForTimeout(800); await shot('09-unfavorable-result');
await scroller.evaluate(el=>el.scrollTo({top:520,behavior:'instant'})); await page.waitForTimeout(400); await shot('10-unfavorable-horizon');
await browser.close();
