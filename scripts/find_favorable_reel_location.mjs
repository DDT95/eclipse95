import { chromium } from '/tmp/cartokob-playwright/node_modules/playwright/index.mjs';
const candidates=['Aéroport de Paris-Orly','Aéroport de Brest Bretagne','Aérodrome de Pontoise-Cormeilles-en-Vexin','Phare du Créac’h, Ouessant','Plage de la Torche, Plomeur'];
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
await page.goto('http://127.0.0.1:4173/'); await page.getByRole('button',{name:'J’ai compris, ouvrir la carte'}).click();
for(const q of candidates){
 const input=page.getByLabel('Rechercher un lieu'); await input.fill(q); await page.getByRole('button',{name:'Lancer la recherche'}).click();
 await page.waitForTimeout(12000); console.log(q,'=>',(await page.locator('.mobile-score-hero').innerText()).replace(/\n/g,' | '));
 await page.getByRole('button',{name:/Nouvelle recherche/}).click(); await page.waitForTimeout(300);
}
await browser.close();
