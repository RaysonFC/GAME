// ═══════════════════════════════════════════════════════════
// LABIRINTO MÁGICO — script.js  v3.0
// Loading screen · Névoa ajustável · Inimigos variados · Chefes
// XP permanente · Loja · Skins · Desafio diário · PWA
// ═══════════════════════════════════════════════════════════

// ─── Service Worker ────────────────────────────────────────
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});

// ═══════════════════════════════════════════════════════════
// LOADING SCREEN
// ═══════════════════════════════════════════════════════════
const TIPS = [
  '💡 Pressione as setas brilhantes para passagens secretas!',
  '🧊 O Gelo congela todos os fantasmas por 8 segundos!',
  '📡 O Radar mostra a direção do monstro mais próximo!',
  '🛡️ O Escudo absorve 1 ataque sem perder vida!',
  '✨ Pontos x2 dobra tudo — moedas, chaves, portais!',
  '🐌 Monstro Lento reduz a velocidade dos inimigos!',
  '🔦 Use a Lanterna para ver mais longe na névoa!',
  '⭐ Complete rápido para ganhar 3 estrelas e bônus!',
  '🧲 O Imã atrai moedas na mesma linha ou coluna!',
  '❤️ Compre Vida Extra na loja para chegar mais longe!',
  '🎯 Desafios diários dão moedas bônus — não perca!',
  '👹 Fique atento ao chefe! Ele aparece a cada 5 fases.',
];

function runLoadingScreen(onDone) {
  const screen  = document.getElementById('loading-screen');
  const bar     = document.getElementById('loading-bar');
  const tipEl   = document.getElementById('loading-tip');
  if (!screen) { onDone(); return; }

  tipEl.textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
  let pct = 0;
  const iv = setInterval(() => {
    pct += Math.random() * 18 + 6;
    if (pct >= 100) { pct = 100; clearInterval(iv); }
    bar.style.width = pct + '%';
    if (pct === 100) {
      setTimeout(() => {
        screen.classList.add('hidden');
        setTimeout(() => { screen.style.display = 'none'; onDone(); }, 650);
      }, 320);
    }
  }, 110);
}

// ═══════════════════════════════════════════════════════════
// PWA Install
// ═══════════════════════════════════════════════════════════
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); deferredInstall = e;
  const ib = document.getElementById('menu-install-btn');
  if (ib) ib.style.display = 'inline-flex';
  setTimeout(() => {
    const b = document.getElementById('install-banner');
    if (b && deferredInstall) b.classList.add('show');
  }, 3000);
});
document.getElementById('install-yes').addEventListener('click', () => {
  document.getElementById('install-banner').classList.remove('show');
  if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; }
});
document.getElementById('install-no').addEventListener('click', () => {
  document.getElementById('install-banner').classList.remove('show');
});
const _mib = document.getElementById('menu-install-btn');
if (_mib) _mib.addEventListener('click', () => {
  if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; _mib.style.display='none'; }
  else showToast('Abra o menu do browser → "Adicionar à tela inicial"');
  menuOpen=false; document.getElementById('top-menu').classList.remove('open'); document.getElementById('menu-btn').innerHTML='&#9776;';
});
window.addEventListener('appinstalled', () => {
  document.getElementById('install-banner').classList.remove('show');
  const ib=document.getElementById('menu-install-btn'); if(ib) ib.style.display='none';
  showToast('✅ Instalado! Jogue offline à vontade.');
});

// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════
const COLS=13,ROWS=11,N=1,S=2,E=4,W=8;
const DX={[E]:1,[W]:-1,[N]:0,[S]:0};
const DY={[N]:-1,[S]:1,[E]:0,[W]:0};
const OPP={[N]:S,[S]:N,[E]:W,[W]:E};

const canvas=document.getElementById('c'),ctx=canvas.getContext('2d');
let CELL=40,W_PX=COLS*CELL,H_PX=ROWS*CELL;
function resizeCanvas(){
  canvas.width=window.innerWidth; canvas.height=window.innerHeight;
  const avH=window.innerHeight-48;
  CELL=Math.floor(Math.min(window.innerWidth/COLS,avH/ROWS));
  W_PX=COLS*CELL; H_PX=ROWS*CELL;
}
resizeCanvas(); window.addEventListener('resize',resizeCanvas);

// ═══════════════════════════════════════════════════════════
// CONFIG SETTINGS
// ═══════════════════════════════════════════════════════════
let cfg = { fogDensity: 'normal', sfx: true, ctrl: 'joystick' };
function loadCfg(){ try{ const d=JSON.parse(localStorage.getItem('lm_cfg')||'{}'); cfg={...cfg,...d}; }catch{} }
function saveCfg(){ try{ localStorage.setItem('lm_cfg',JSON.stringify(cfg)); }catch{} }
// FOG PARAMS by density
const FOG_PARAMS = {
  light:  { innerR: 0.5, midStop: 0.7,  outerR: 2.0, alpha1: 0.3, alpha2: 0.7  },
  normal: { innerR: 0.4, midStop: 0.55, outerR: 1.5, alpha1: 0.55, alpha2: 0.97 },
  heavy:  { innerR: 0.3, midStop: 0.45, outerR: 1.2, alpha1: 0.75, alpha2: 0.99 },
};

// ═══════════════════════════════════════════════════════════
// SAVE / LOAD
// ═══════════════════════════════════════════════════════════
const SAVE_KEY='lm_save_v3';
let saveTimer=null;
function saveGame(){
  try{
    localStorage.setItem(SAVE_KEY,JSON.stringify({
      level,score,lives,achCoinTotal,achState,achSecretCount,achPerfectStreak,
      xp,shopUpgrades,unlockedSkins,activeSkin,permanentCoins,
      ranking:getRanking(), ts:Date.now()
    }));
  }catch(e){console.warn('Save failed',e);}
}
function loadGame(){
  try{
    const raw=localStorage.getItem(SAVE_KEY); if(!raw) return false;
    const d=JSON.parse(raw);
    level=d.level||1; score=d.score||0; lives=d.lives||3; achCoinTotal=d.achCoinTotal||0;
    achState=d.achState||{}; achSecretCount=d.achSecretCount||0; achPerfectStreak=d.achPerfectStreak||0;
    xp=d.xp||0; shopUpgrades=d.shopUpgrades||{}; unlockedSkins=d.unlockedSkins||['fairy'];
    activeSkin=d.activeSkin||'fairy'; permanentCoins=d.permanentCoins||0;
    if(d.ranking) saveRanking(d.ranking);
    return true;
  }catch{ return false; }
}
function scheduleSave(){ clearTimeout(saveTimer); saveTimer=setTimeout(saveGame,500); }

// ═══════════════════════════════════════════════════════════
// XP SYSTEM
// ═══════════════════════════════════════════════════════════
let xp=0;
const XP_REWARDS={ key:15, coin:5, secret:10, levelComplete:50, boss:120, daily:80 };
function addXP(amt,wx,wy){
  xp+=amt; updateXPBar();
  if(wx!==undefined){ spawnXPFloat('+'+amt+'XP',wx,wy); }
}
function updateXPBar(){
  const pct=(xp%500)/500*100;
  const bar=document.getElementById('xp-bar');
  if(bar) bar.style.width=pct+'%';
  const v=document.getElementById('xp-val'); if(v) v.textContent=xp;
}
function spawnXPFloat(text,wx,wy){
  const{ox,oy}=getOffset();
  const el=document.createElement('div');el.className='xp-popup';el.textContent=text;
  el.style.left=(ox+wx*CELL+CELL/2+20)+'px';el.style.top=(oy+wy*CELL)+'px';
  document.body.appendChild(el);setTimeout(()=>el.remove(),1000);
}

// ═══════════════════════════════════════════════════════════
// PERMANENT COINS & SHOP
// ═══════════════════════════════════════════════════════════
let permanentCoins=0;
const SHOP_ITEMS=[
  {id:'extraLife',icon:'❤️',name:'Vida Extra',desc:'Começa com +1 vida por fase',levels:[50,100,150],maxLvl:3,effect:'startLives'},
  {id:'fastRegen',icon:'⚡',name:'Stamina+',desc:'Stamina regenera mais rápido',levels:[60,120],maxLvl:2,effect:'staminaRegen'},
  {id:'coinBonus',icon:'💰',name:'Moeda+',desc:'Moedas valem +50% cada',levels:[80,160,240],maxLvl:3,effect:'coinMult'},
  {id:'keyHalo',icon:'🔑',name:'Chaves Visíveis',desc:'Chaves brilham mais forte',levels:[40],maxLvl:1,effect:'keyHalo'},
  {id:'startFreeze',icon:'🧊',name:'Gelo Inicial',desc:'Começa cada fase com Gelo',levels:[90],maxLvl:1,effect:'startFreeze'},
  {id:'moreCoins',icon:'🪙',name:'Mais Moedas',desc:'+4 moedas extras por fase',levels:[70,140],maxLvl:2,effect:'moreCoins'},
];
let shopUpgrades={};
function getShopLevel(id){ return shopUpgrades[id]||0; }
function getShopEffect(eff){
  const it=SHOP_ITEMS.find(i=>i.effect===eff); if(!it) return 0;
  return getShopLevel(it.id);
}
function renderShop(){
  const body=document.getElementById('shop-body');
  const cc=document.getElementById('shop-coin-count'); if(cc) cc.textContent=permanentCoins;
  if(!body) return;
  body.innerHTML=SHOP_ITEMS.map(it=>{
    const lv=getShopLevel(it.id),maxed=lv>=it.maxLvl,cost=it.levels[lv]||0;
    const canBuy=!maxed&&permanentCoins>=cost;
    return`<div class="shop-card${maxed?' maxed':''}">
      <div class="shop-icon">${it.icon}</div>
      <div class="shop-name">${it.name}</div>
      <div class="shop-desc">${it.desc}</div>
      <div class="shop-level">Nível ${lv}/${it.maxLvl}</div>
      <button class="shop-buy-btn${maxed?' owned-btn':''}" data-id="${it.id}" ${(!canBuy&&!maxed)?'disabled':''}>
        ${maxed?'✅ Máximo':`💰${cost}`}
      </button>
    </div>`;
  }).join('');
  body.querySelectorAll('.shop-buy-btn:not(:disabled):not(.owned-btn)').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const it=SHOP_ITEMS.find(i=>i.id===btn.dataset.id); if(!it) return;
      const lv=getShopLevel(it.id),cost=it.levels[lv];
      if(permanentCoins<cost) return;
      permanentCoins-=cost; shopUpgrades[it.id]=(lv+1);
      scheduleSave(); renderShop();
      showToast('✅ '+it.name+' melhorado!');
    });
  });
}
function openShop(){ renderShop(); document.getElementById('shop-overlay').classList.add('show'); }
function closeShop(){ document.getElementById('shop-overlay').classList.remove('show'); }
document.getElementById('shop-btn').addEventListener('click',()=>{openShop();menuOpen=false;document.getElementById('top-menu').classList.remove('open');document.getElementById('menu-btn').innerHTML='&#9776;';});
document.getElementById('shop-close').addEventListener('click',closeShop);

// ═══════════════════════════════════════════════════════════
// SKINS
// ═══════════════════════════════════════════════════════════
const SKINS=[
  {id:'fairy',emoji:'🧚',name:'Fada',req:'Padrão',reqCheck:()=>true},
  {id:'wizard',emoji:'🧙',name:'Mago',req:'Nível 3',reqCheck:()=>level>=3},
  {id:'ninja',emoji:'🥷',name:'Ninja',req:'Nível 5',reqCheck:()=>level>=5},
  {id:'robot',emoji:'🤖',name:'Robô',req:'500 moedas',reqCheck:()=>xp>=500},
  {id:'alien',emoji:'👾',name:'Alien',req:'Nível 10',reqCheck:()=>level>=10},
  {id:'ghost',emoji:'👻',name:'Fantasminha',req:'10 conquistas',reqCheck:()=>Object.keys(achState).length>=10},
  {id:'dragon',emoji:'🐉',name:'Dragão',req:'Chefe derrotado',reqCheck:()=>!!achState['boss_kill']},
  {id:'star',emoji:'⭐',name:'Estrela',req:'3 estrelas em 5 fases',reqCheck:()=>achPerfectStreak>=5},
  {id:'cat',emoji:'🐱',name:'Gatinho',req:'50 moedas coletadas',reqCheck:()=>achCoinTotal>=50},
];
let unlockedSkins=['fairy'], activeSkin='fairy';
function checkSkinUnlocks(){
  SKINS.forEach(s=>{ if(!unlockedSkins.includes(s.id)&&s.reqCheck()){ unlockedSkins.push(s.id); showToast('🎉 Skin desbloqueada: '+s.name+'!'); scheduleSave(); } });
}
function renderSkins(){
  const body=document.getElementById('skin-body'); if(!body) return;
  body.innerHTML=SKINS.map(s=>{
    const unlocked=unlockedSkins.includes(s.id),active=activeSkin===s.id;
    return`<div class="skin-card${active?' active':''}${!unlocked?' locked':''}" data-id="${s.id}">
      <div class="skin-emoji">${s.emoji}</div>
      <div class="skin-name">${s.name}</div>
      <div class="skin-req">${s.req}</div>
      <div class="skin-badge${active?' active-badge':''}">${active?'Ativo':unlocked?'Usar':'🔒'}</div>
    </div>`;
  }).join('');
  body.querySelectorAll('.skin-card:not(.locked)').forEach(el=>{
    el.addEventListener('click',()=>{ activeSkin=el.dataset.id; scheduleSave(); renderSkins(); showIG(SKINS.find(s=>s.id===activeSkin).emoji+' Skin ativada!'); });
  });
}
function openSkins(){ renderSkins(); document.getElementById('skin-overlay').classList.add('show'); }
function closeSkins(){ document.getElementById('skin-overlay').classList.remove('show'); }
document.getElementById('skin-close').addEventListener('click',closeSkins);
function getPlayerEmoji(){ return SKINS.find(s=>s.id===activeSkin)?.emoji||'🧚'; }

// ═══════════════════════════════════════════════════════════
// DAILY CHALLENGE
// ═══════════════════════════════════════════════════════════
const DAILY_CHALLENGES=[
  {id:'coins5',txt:'Colete 5 moedas numa fase',check:()=>_dailyCoins>=5},
  {id:'noHit',txt:'Complete uma fase sem ser atingido',check:()=>_dailyNoHit},
  {id:'secret2',txt:'Use 2 passagens secretas',check:()=>_dailySecrets>=2},
  {id:'speed30',txt:'Complete uma fase em menos de 30s',check:()=>_dailySpeedOk},
  {id:'keys3',txt:'Colete 3 chaves numa fase',check:()=>keysCollected>=3&&totalKeys>=3},
];
let _dailyCoins=0,_dailyNoHit=true,_dailySecrets=0,_dailySpeedOk=false;
let dailyDone=false, currentDaily=null;

function initDailyChallenge(){
  try{
    const today=new Date().toDateString();
    const saved=JSON.parse(localStorage.getItem('lm_daily')||'{}');
    if(saved.date===today){ dailyDone=!!saved.done; currentDaily=DAILY_CHALLENGES.find(c=>c.id===saved.id)||null; }
    if(!currentDaily){ currentDaily=DAILY_CHALLENGES[Math.floor(Math.random()*DAILY_CHALLENGES.length)]; localStorage.setItem('lm_daily',JSON.stringify({date:today,id:currentDaily.id,done:false})); dailyDone=false; }
    const el=document.getElementById('daily-banner');
    if(el&&currentDaily&&!dailyDone){ el.textContent='🎯 Desafio: '+currentDaily.txt; el.classList.add('visible'); setTimeout(()=>el.classList.remove('visible'),5000); }
  }catch{}
}
function checkDailyComplete(){
  if(!currentDaily||dailyDone) return;
  if(currentDaily.check()){
    dailyDone=true;
    permanentCoins+=30; addXP(XP_REWARDS.daily);
    try{ const s=JSON.parse(localStorage.getItem('lm_daily')||'{}'); s.done=true; localStorage.setItem('lm_daily',JSON.stringify(s)); }catch{}
    scheduleSave();
    showToast('🎯 Desafio diário completo! +30💰 +'+XP_REWARDS.daily+'XP');
    spawnConfetti();
  }
}

// ═══════════════════════════════════════════════════════════
// SCENES
// ═══════════════════════════════════════════════════════════
const SCENES=[
  {name:'Floresta',floor:'#0d2415',floorAlt:'#0f2918',wall:'#1a6b3a',glow:'#4ade80',bg:'#030e06',style:'forest', accent:'#86efac'},
  {name:'Caverna', floor:'#1a0f08',floorAlt:'#1e1209',wall:'#8b5e3c',glow:'#d97706',bg:'#0a0604',style:'cave',   accent:'#fcd34d'},
  {name:'Oceano',  floor:'#062040',floorAlt:'#072548',wall:'#1d4ed8',glow:'#60a5fa',bg:'#010c18',style:'ocean',  accent:'#93c5fd'},
  {name:'Vulcao',  floor:'#2d0a04',floorAlt:'#340c05',wall:'#b91c1c',glow:'#f97316',bg:'#140302',style:'volcano',accent:'#fbbf24'},
  {name:'Gelo',    floor:'#0c2d4a',floorAlt:'#0e3354',wall:'#38bdf8',glow:'#e0f2fe',bg:'#010c18',style:'ice',    accent:'#f0f9ff'},
  {name:'Noite',   floor:'#150d2e',floorAlt:'#180f34',wall:'#7c3aed',glow:'#c084fc',bg:'#04020e',style:'night',  accent:'#e879f9'},
];
let sceneIdx=0,scene=SCENES[0];
function applyScene(lvl){ sceneIdx=(lvl-1)%SCENES.length; scene=SCENES[sceneIdx]; document.body.style.background=scene.bg; const t=document.getElementById('stag'); if(t) t.textContent=' '+scene.name; }

// ═══════════════════════════════════════════════════════════
// POWER-UPS
// ═══════════════════════════════════════════════════════════
const POWERUP_DEFS={
  freeze:{id:'freeze',icon:'🧊',name:'Gelo',color:'#38bdf8',desc:'Congela fantasmas por 8s',dur:480,type:'timed',minLevel:1,fogOnly:false,
    applyFn(){freezeActive=true;freezeTimer=this.dur;showIG('🧊 Fantasmas congelados!');unlockAch('freeze_use');}},
  speed:{id:'speed',icon:'⚡',name:'Turbo',color:'#f7c948',desc:'Velocidade dobrada por 10s',dur:600,type:'timed',minLevel:1,fogOnly:false,
    applyFn(){speedTimer=this.dur;showIG('⚡ Turbo por 10s!');}},
  magnet:{id:'magnet',icon:'🧲',name:'Imã',color:'#e879f9',desc:'Atrai moedas por 6s',dur:360,type:'timed',minLevel:2,fogOnly:false,
    applyFn(){magnetTimer=this.dur;showIG('🧲 Imã por 6s!');}},
  torch:{id:'torch',icon:'🔦',name:'Lanterna',color:'#fbbf24',desc:'Amplia visão na névoa (+3 usos)',dur:900,type:'usable',minLevel:3,fogOnly:true,
    applyFn(){torchCharges=(torchCharges||0)+3;updateTorchBtn();showIG('🔦 Lanterna +3!');}},
  radar:{id:'radar',icon:'📡',name:'Radar',color:'#ef4444',desc:'Mostra direção do monstro por 20s',dur:1200,type:'timed',minLevel:3,fogOnly:true,
    applyFn(){radarTimer=this.dur;updateRadarHUD();showIG('📡 Radar 20s!');unlockAch('radar_use');}},
  slowMonster:{id:'slowMonster',icon:'🐌',name:'Monstro Lento',color:'#a3e635',desc:'Inimigos lentos nesta fase',dur:-1,type:'passive',minLevel:2,fogOnly:false,
    applyFn(){passivePowers.add('slowMonster');monsterSpeed=Math.max(monsterSpeed,130);monster2Speed=Math.max(monster2Speed,200);showIG('🐌 Monstros lentos!');},removeFn(){passivePowers.delete('slowMonster');}},
  dumbMonster:{id:'dumbMonster',icon:'🤖',name:'Monstro Burro',color:'#fb923c',desc:'Inimigos aleatórios 70%',dur:-1,type:'passive',minLevel:3,fogOnly:false,
    applyFn(){passivePowers.add('dumbMonster');showIG('🤖 Monstros confusos!');},removeFn(){passivePowers.delete('dumbMonster');}},
  extraLife:{id:'extraLife',icon:'❤️',name:'Vida Extra',color:'#f43f5e',desc:'+1 vida agora!',dur:-1,type:'instant',minLevel:2,fogOnly:false,
    applyFn(){lives=Math.min(lives+1,6);document.getElementById('lives-val').textContent=lives;spawnFloat('❤️+1',player.x,player.y);showIG('❤️ Vida extra!');scheduleSave();}},
  compass:{id:'compass',icon:'🧭',name:'Bússola',color:'#818cf8',desc:'Seta para a saída',dur:-1,type:'passive',minLevel:1,fogOnly:false,
    applyFn(){passivePowers.add('compass');updateCompassHUD(true);showIG('🧭 Bússola!');},removeFn(){passivePowers.delete('compass');updateCompassHUD(false);}},
  shield:{id:'shield',icon:'🛡️',name:'Escudo',color:'#6366f1',desc:'Absorve 1 ataque',dur:-1,type:'passive',minLevel:4,fogOnly:false,
    applyFn(){passivePowers.add('shield');showIG('🛡️ Escudo!');},removeFn(){passivePowers.delete('shield');}},
  reveal:{id:'reveal',icon:'👁️',name:'Revelar',color:'#34d399',desc:'Remove a névoa desta fase',dur:-1,type:'passive',minLevel:3,fogOnly:false,
    applyFn(){passivePowers.add('reveal');fogActive=false;showIG('👁️ Névoa removida!');},removeFn(){passivePowers.delete('reveal');}},
  doubleScore:{id:'doubleScore',icon:'✨',name:'Pontos x2',color:'#fde047',desc:'Pontos dobrados nesta fase',dur:-1,type:'passive',minLevel:5,fogOnly:false,
    applyFn(){passivePowers.add('doubleScore');showIG('✨ Pontos x2!');},removeFn(){passivePowers.delete('doubleScore');}},
  bomb:{id:'bomb',icon:'💥',name:'Bomba',color:'#f97316',desc:'Empurra todos os inimigos',dur:-1,type:'instant',minLevel:4,fogOnly:false,
    applyFn(){monster={x:COLS-1,y:ROWS-1};if(monster2Active)monster2={x:COLS-1,y:0};if(bossActive)boss={...bossStart};showIG('💥 Boom! Inimigos repelidos!');spawnConfetti();}},
};
function pickRandomOffers(lvl){
  const inGame=new Set(['freeze','speed','magnet','torch','radar']);
  return Object.values(POWERUP_DEFS).filter(p=>p.minLevel<=lvl&&!inGame.has(p.id)).sort(()=>Math.random()-.5).slice(0,3);
}
let passivePowers=new Set(),playerInventory=[null,null,null];
let freezeActive=false,freezeTimer=0,speedTimer=0,magnetTimer=0;
let torchCharges=0,torchActive=false,torchTimer=0,radarTimer=0,fogActive=false;
function initInventory(){
  playerInventory=[null,null,null];
  // Shop: start with freeze
  if(getShopEffect('startFreeze')>=1) addToInventory('freeze');
  renderTray();
}
function addToInventory(powId){
  const pow=POWERUP_DEFS[powId]; if(!pow) return;
  if(pow.type==='instant'||pow.type==='passive'){pow.applyFn();return;}
  const slot=playerInventory.findIndex(s=>s===null);
  if(slot===-1){pow.applyFn();return;}
  playerInventory[slot]={...pow,remaining:pow.dur}; renderTray();
}
function useSlot(i){const pow=playerInventory[i];if(!pow||gameState!=='playing')return;pow.applyFn();playerInventory[i]=null;renderTray();}
function renderTray(){
  for(let i=0;i<3;i++){
    const el=document.getElementById('pu-slot-'+i); if(!el) continue;
    const pow=playerInventory[i];
    if(!pow){el.className='pu-slot empty';el.innerHTML='&#9723;';el.onclick=null;}
    else{el.className='pu-slot ready';el.style.borderColor=pow.color||'#a855f7';el.style.boxShadow='0 0 10px '+(pow.color||'#a855f7')+'55';el.innerHTML=pow.icon+'<div class="pu-timer">'+pow.name+'</div>';el.onclick=()=>useSlot(i);}
  }
}
function tickPowerTimers(){
  if(freezeActive&&freezeTimer>0){freezeTimer--;if(freezeTimer<=0){freezeActive=false;showIG('Gelo acabou!');}}
  if(speedTimer>0)speedTimer--;
  if(magnetTimer>0){magnetTimer--;if(magnetTimer===0)showIG('Imã acabou!');}
  if(torchActive&&torchTimer>0){torchTimer--;if(torchTimer<=0){torchActive=false;showIG('Lanterna apagou!');updateTorchBtn();}}
  if(radarTimer>0){radarTimer--;if(radarTimer===0){updateRadarHUD();showIG('Radar desligou!');}}
}
function shouldShowFog(){if(passivePowers.has('reveal'))return false;if(torchActive)return false;return fogActive;}
function updateCompassHUD(on){let el=document.getElementById('_comphud');if(on&&!el){el=document.createElement('div');el.className='hstat';el.id='_comphud';el.innerHTML='&#129517;<span id="_compv">?</span>';document.getElementById('hud-stats').appendChild(el);}else if(!on&&el)el.remove();}
function updateRadarHUD(){
  const hud=document.getElementById('radar-hud');if(!hud)return;
  const active=radarTimer>0; hud.classList.toggle('visible',active); if(!active)return;
  let tx=monster.x,ty=monster.y;
  if(monster2Active&&monster2.x>=0){const d1=Math.abs(monster.x-player.x)+Math.abs(monster.y-player.y),d2=Math.abs(monster2.x-player.x)+Math.abs(monster2.y-player.y);if(d2<d1){tx=monster2.x;ty=monster2.y;}}
  const dx=tx-player.x,dy=ty-player.y,dist=Math.abs(dx)+Math.abs(dy);
  const arr=document.getElementById('radar-arrow'),dEl=document.getElementById('radar-dist');
  if(arr)arr.style.transform='rotate('+(Math.atan2(dy,dx)*180/Math.PI+90)+'deg)';
  if(dEl)dEl.textContent=dist+' cel';
  hud.classList.toggle('danger',dist<=3);
}
function tickMagnet(){
  if(!magnetTimer)return; const mult=passivePowers.has('doubleScore')?2:1;
  for(const c of coins){if(c.collected)continue;if(c.x===player.x||c.y===player.y){c.collected=true;const pts=Math.round(10*level*mult*(1+getShopEffect('coinMult')*0.5));score+=pts;achCoinTotal++;permanentCoins++;document.getElementById('score-val').textContent=score;document.getElementById('coins-val').textContent=achCoinTotal;spawnFloat('+'+pts+'🧲',c.x,c.y);}}
}
function updateTorchBtn(){const btn=document.getElementById('torch-btn');if(!btn)return;btn.classList.toggle('visible',fogActive&&torchCharges>0);const c=document.getElementById('torch-count');if(c)c.textContent=torchCharges;}
document.getElementById('torch-btn').addEventListener('click',()=>{
  if(torchCharges<=0||!fogActive||gameState!=='playing')return;
  torchCharges--;torchActive=true;torchTimer=POWERUP_DEFS.torch.dur;
  updateTorchBtn();showIG('🔦 Lanterna 15s!');unlockAch('torch_use');
});

// ═══════════════════════════════════════════════════════════
// POWER PICK SCREEN
// ═══════════════════════════════════════════════════════════
function showPowerPick(onDone){
  const offers=pickRandomOffers(level); if(!offers.length){onDone();return;}
  const overlay=document.getElementById('powerup-pick-overlay'),cards=document.getElementById('pp-cards');
  document.getElementById('pp-subtitle').textContent=level>=5?'Poderes épicos!':level>=3?'Novos poderes desbloqueados!':'Escolha um poder';
  cards.innerHTML='';
  for(const pow of offers){
    const card=document.createElement('div');card.className='pp-card';
    const dur=pow.type==='instant'?'Imediato':pow.type==='passive'?'Esta fase':Math.round(pow.dur/60)+'s';
    card.innerHTML='<div class="pp-card-icon">'+pow.icon+'</div><div class="pp-card-name">'+pow.name+'</div><div class="pp-card-desc">'+pow.desc+'</div><div class="pp-card-dur">'+dur+'</div>';
    card.addEventListener('click',()=>{overlay.classList.remove('show');addToInventory(pow.id);onDone();});
    cards.appendChild(card);
  }
  overlay.classList.add('show');
}
document.getElementById('pp-skip').addEventListener('click',()=>document.getElementById('powerup-pick-overlay').classList.remove('show'));

// ═══════════════════════════════════════════════════════════
// BOSS SYSTEM
// ═══════════════════════════════════════════════════════════
let bossActive=false,boss={x:0,y:0},bossHP=0,bossMaxHP=0,bossTimer=0,bossSpeed=0;
let bossStart={x:0,y:0};
const BOSS_EMOJIS=['🐲','👺','🧟','🦂','🐙'];

function initBoss(){
  if(level%5!==0) return;
  const excl=[{...player},{...exit},...keys,{...monster}];
  const bp=placeRandom(excl);
  boss={...bp}; bossStart={...bp};
  bossHP=bossMaxHP=8+level*2; bossTimer=0; bossSpeed=Math.max(30,70-level*2);
  bossActive=true;
  updateBossBar();
  showIG('⚠️ CHEFE APARECEU! Lv.'+level);
  const bw=document.getElementById('boss-bar-wrap'); if(bw) bw.classList.add('visible');
}
function updateBossBar(){
  const fill=document.getElementById('boss-bar-fill');
  if(fill) fill.style.width=Math.round(bossHP/bossMaxHP*100)+'%';
}
function damageBoss(){
  if(!bossActive) return;
  if(freezeActive) return; // frozen
  bossHP--; updateBossBar();
  const fill=document.getElementById('boss-bar-fill');
  if(fill){fill.classList.add('damage');setTimeout(()=>fill.classList.remove('damage'),220);}
  if(bossHP<=0){
    bossActive=false;
    const bw=document.getElementById('boss-bar-wrap');if(bw)bw.classList.remove('visible');
    const pts=500*level*(passivePowers.has('doubleScore')?2:1);
    score+=pts; permanentCoins+=20; addXP(XP_REWARDS.boss,boss.x,boss.y);
    document.getElementById('score-val').textContent=score;
    showIG('🏆 Chefe derrotado! +'+pts+' pts!');
    spawnConfetti(); unlockAch('boss_kill');
    scheduleSave();
  }
}

// ═══════════════════════════════════════════════════════════
// ENEMY TYPES
// ═══════════════════════════════════════════════════════════
// enemy2 = 2nd ghost (existing monster2)
// crab   = slow but aggressive — appears level 4+
// bat    = very fast, random — appears level 5+
let crab={x:-99,y:-99},crabTimer=0,crabActive=false;
let bat={x:-99,y:-99},batTimer=0,batActive=false;

function initExtraEnemies(){
  crabActive=level>=4;
  batActive=level>=5;
  if(crabActive){const cp=placeRandom([{...player},{...exit},...keys,{...monster}]);crab={...cp};crabTimer=0;}
  else crab={x:-99,y:-99};
  if(batActive){const bp=placeRandom([{...player},{...exit},...keys,{...monster}]);bat={...bp};batTimer=0;}
  else bat={x:-99,y:-99};
}

// ═══════════════════════════════════════════════════════════
// GAME STATE
// ═══════════════════════════════════════════════════════════
let grid=[],player={x:0,y:0},monster={x:COLS-1,y:ROWS-1};
let keys=[],exit={x:COLS-1,y:ROWS-1},secrets=[],portals=[],traps=[],coins=[];
let inLevelItems=[];
let keysCollected=0,totalKeys=1;
let monsterSpeed=80,monsterTimer=0;
let monster2={x:-99,y:-99},monster2Timer=0,monster2Speed=90,monster2Active=false;
let level=1,score=0,lives=3,stamina=100;
let trail=[],dangerDist=999,frame=0;
let gameState='intro',achCoinTotal=0;

// ═══════════════════════════════════════════════════════════
// MAZE
// ═══════════════════════════════════════════════════════════
function genMaze(){grid=new Array(COLS*ROWS).fill(0);const vis=new Array(COLS*ROWS).fill(false),stk=[0];vis[0]=true;while(stk.length){const cur=stk[stk.length-1],cx=cur%COLS,cy=Math.floor(cur/COLS);const dirs=[N,S,E,W].sort(()=>Math.random()-.5);let mv=false;for(const d of dirs){const nx=cx+DX[d],ny=cy+DY[d];if(nx<0||nx>=COLS||ny<0||ny>=ROWS)continue;const ni=ny*COLS+nx;if(!vis[ni]){grid[cur]|=d;grid[ni]|=OPP[d];vis[ni]=true;stk.push(ni);mv=true;break;}}if(!mv)stk.pop();}}
function idx(x,y){return y*COLS+x;}
function canMove(x,y,d){if(x<0||x>=COLS||y<0||y>=ROWS)return false;return !!(grid[idx(x,y)]&d);}
function bfs(sx,sy,tx,ty){
  if(sx===tx&&sy===ty)return null;
  const dist=new Array(COLS*ROWS).fill(-1),prev=new Array(COLS*ROWS).fill(-1),q=[idx(sx,sy)];dist[idx(sx,sy)]=0;
  while(q.length){const cur=q.shift(),cx=cur%COLS,cy=Math.floor(cur/COLS);for(const d of[N,S,E,W]){if(!(grid[cur]&d))continue;const nx=cx+DX[d],ny=cy+DY[d];if(nx<0||nx>=COLS||ny<0||ny>=ROWS)continue;const ni=idx(nx,ny);if(dist[ni]===-1){dist[ni]=dist[cur]+1;prev[ni]=cur;q.push(ni);}}}
  dangerDist=dist[idx(tx,ty)]>=0?dist[idx(tx,ty)]:999;
  let cur=idx(tx,ty);while(prev[cur]!==idx(sx,sy)&&prev[cur]!==-1)cur=prev[cur];if(prev[cur]===idx(sx,sy))return cur;return null;
}
function placeRandom(excl){let x,y,t=0;do{x=Math.floor(Math.random()*COLS);y=Math.floor(Math.random()*ROWS);t++;}while(t<200&&excl.some(e=>e&&e.x===x&&e.y===y));return{x,y};}

// ═══════════════════════════════════════════════════════════
// INIT LEVEL
// ═══════════════════════════════════════════════════════════
let achLevelStart=0,achMaxDanger=false,achPerfectStreak=0,achSecretCount=0;

function applyLevelRules(){
  for(const[id,def]of Object.entries(POWERUP_DEFS)){if(def.removeFn&&passivePowers.has(id))def.removeFn();}
  passivePowers.clear();torchActive=false;torchTimer=0;torchCharges=0;radarTimer=0;
  fogActive=level>=3;
  updateTorchBtn();updateRadarHUD();
  monsterSpeed=Math.max(45,80-level*3);monster2Speed=Math.max(60,110-level*3);
  if(getShopEffect('staminaRegen')>0) stamina=Math.min(stamina+20*getShopEffect('staminaRegen'),100);
}

function buildInLevelItems(excl){
  inLevelItems=[]; const taken=[...excl];
  const addItem=(powId)=>{const p=placeRandom(taken);taken.push(p);inLevelItems.push({...p,powId,collected:false});};
  addItem('freeze'); addItem('speed');
  if(level>=2) addItem('magnet');
  if(level>=3){ addItem('radar'); addItem('torch'); }
}

function initLevel(){
  genMaze();
  player={x:0,y:0};exit={x:COLS-1,y:ROWS-1};
  keysCollected=0;totalKeys=Math.min(1+level,3);keys=[];
  _dailyCoins=0;_dailyNoHit=true;_dailySecrets=0;_dailySpeedOk=false;

  const taken=[{...player},{...exit}];
  const quads=[{minX:0,maxX:Math.floor(COLS/2),minY:0,maxY:Math.floor(ROWS/2)},{minX:Math.floor(COLS/2),maxX:COLS,minY:0,maxY:Math.floor(ROWS/2)},{minX:0,maxX:Math.floor(COLS/2),minY:Math.floor(ROWS/2),maxY:ROWS}];
  for(let i=0;i<totalKeys;i++){const q=quads[i];let k,t=0;do{k={x:q.minX+Math.floor(Math.random()*(q.maxX-q.minX)),y:q.minY+Math.floor(Math.random()*(q.maxY-q.minY))};t++;}while(t<40&&taken.some(e=>e.x===k.x&&e.y===k.y));keys.push({x:k.x,y:k.y,collected:false});taken.push({...k});}

  monster={x:COLS-1,y:ROWS-1};monsterTimer=0;
  if(level>=3){monster2={x:COLS-1,y:0};monster2Timer=0;monster2Active=true;}else{monster2Active=false;monster2={x:-99,y:-99};}

  secrets=[];
  for(let i=0;i<Math.min(4+level*2,16);i++){let ax,ay,bx,by,dir,t=0;do{ax=Math.floor(Math.random()*(COLS-2))+1;ay=Math.floor(Math.random()*(ROWS-2))+1;dir=[N,S,E,W][Math.floor(Math.random()*4)];bx=ax+DX[dir];by=ay+DY[dir];t++;}while(t<50&&(bx<0||bx>=COLS||by<0||by>=ROWS||(grid[idx(ax,ay)]&dir)||secrets.some(s=>s.ax===ax&&s.ay===ay)));if(t<50&&bx>=0&&bx<COLS)secrets.push({ax,ay,bx,by,dir});}

  portals=[];const nP=Math.min(1+Math.floor(level/2),4),pC=['#a855f7','#06b6d4','#f59e0b','#10b981'];
  const excl=[{...player},{...exit},...keys,{...monster}];
  for(let i=0;i<nP;i++){const a=placeRandom(excl);excl.push(a);const b=placeRandom(excl);excl.push(b);portals.push({ax:a.x,ay:a.y,bx:b.x,by:b.y,col:pC[i%4]});}

  traps=[];const nT=Math.min(1+level,6),tE=[{...player},{...exit},...keys,{...monster},...portals.map(p=>({x:p.ax,y:p.ay}))];
  for(let i=0;i<nT;i++){const t2=placeRandom(tE);tE.push(t2);traps.push({x:t2.x,y:t2.y,hit:false});}

  buildInLevelItems([{...player},{...exit},...keys,{...monster},...portals.map(p=>({x:p.ax,y:p.ay})),...traps]);

  const coinCount=8+getShopEffect('moreCoins')*4;
  coins=[];for(let i=0;i<coinCount;i++)coins.push({...placeRandom([{...player},{...exit},...keys,{...monster}]),collected:false});

  // Boss
  bossActive=false;const bw=document.getElementById('boss-bar-wrap');if(bw)bw.classList.remove('visible');
  initBoss();

  // Extra enemies
  initExtraEnemies();

  // Extra lives from shop
  const extraLv=getShopEffect('startLives');
  lives=level===1?3+extraLv:Math.max(lives,1);

  stamina=100;trail=[];freezeActive=false;freezeTimer=0;speedTimer=0;magnetTimer=0;dangerDist=999;

  applyLevelRules();initInventory();applyScene(level);

  document.getElementById('key-total').textContent=totalKeys;
  document.getElementById('lives-val').textContent=lives;
  document.getElementById('coins-val').textContent=achCoinTotal;
  document.getElementById('stars-hud').innerHTML='⭐⭐⭐';
  document.getElementById('score-val').textContent=score;
  document.getElementById('lvl-val').textContent=level;
  updateXPBar();

  startRecording();achLevelStart=frame;achMaxDanger=false;
  gameState='playing';
  showDialog(level);
  checkSkinUnlocks();
  initDailyChallenge();
}

// ═══════════════════════════════════════════════════════════
// DRAW
// ═══════════════════════════════════════════════════════════
const bgStars=[];for(let i=0;i<90;i++)bgStars.push({px:Math.random(),py:Math.random(),r:Math.random()*1.5+0.3,t:Math.random()*Math.PI*2});
function em(x,y,sz,e){ctx.font=sz+'px serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(e,x,y);}
function getOffset(){const sw=canvas.width,sh=canvas.height;return{ox:Math.floor((sw-W_PX)/2),oy:48+Math.floor((sh-48-H_PX)/2)};}
function drawLeaf(c,x,y,r,a){c.save();c.translate(x,y);c.rotate(a);c.beginPath();c.ellipse(0,0,r*.5,r,0,0,Math.PI*2);c.fill();c.restore();}
function drawIceCrystal(c,x,y,r){for(let a=0;a<6;a++){const ag=a*Math.PI/3;c.beginPath();c.moveTo(x,y);c.lineTo(x+Math.cos(ag)*r,y+Math.sin(ag)*r);c.stroke();c.beginPath();c.moveTo(x+Math.cos(ag)*r*.55-Math.cos(ag+Math.PI/2)*r*.2,y+Math.sin(ag)*r*.55-Math.sin(ag+Math.PI/2)*r*.2);c.lineTo(x+Math.cos(ag)*r*.55+Math.cos(ag+Math.PI/2)*r*.2,y+Math.sin(ag)*r*.55+Math.sin(ag+Math.PI/2)*r*.2);c.stroke();}}
function drawStar4(c,x,y,r){c.beginPath();for(let i=0;i<8;i++){const ag=i*Math.PI/4,rad=i%2===0?r:r*.38;if(i===0)c.moveTo(x+Math.cos(ag)*rad,y+Math.sin(ag)*rad);else c.lineTo(x+Math.cos(ag)*rad,y+Math.sin(ag)*rad);}c.closePath();c.fill();}
function drawWallDecorations(){
  const cs=CELL,t=frame;
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
    const g=grid[idx(x,y)],px=x*cs,py=y*cs;ctx.save();ctx.globalAlpha=0.5+0.12*Math.sin(t*.04+x*.3+y*.5);
    if(scene.style==='forest'){ctx.fillStyle=scene.accent;ctx.shadowColor=scene.glow;ctx.shadowBlur=4;if(!(g&N))drawLeaf(ctx,px+cs/2,py,cs*.18,t*.03+x);if(!(g&W))drawLeaf(ctx,px,py+cs/2,cs*.18,t*.03+y);}
    else if(scene.style==='cave'){ctx.fillStyle=scene.wall;ctx.shadowColor=scene.glow;ctx.shadowBlur=3;if(!(g&N)){ctx.globalAlpha=.4+.1*Math.sin(t*.02+x);const s=px+cs*.2;ctx.beginPath();ctx.moveTo(s,py);ctx.lineTo(s-cs*.07,py+cs*.18);ctx.lineTo(s+cs*.07,py+cs*.18);ctx.closePath();ctx.fill();const s2=px+cs*.7;ctx.beginPath();ctx.moveTo(s2,py);ctx.lineTo(s2-cs*.06,py+cs*.14);ctx.lineTo(s2+cs*.06,py+cs*.14);ctx.closePath();ctx.fill();}if(!(g&W)){ctx.globalAlpha=.4+.1*Math.sin(t*.02+y);ctx.beginPath();ctx.moveTo(px,py+cs*.25);ctx.lineTo(px+cs*.14,py+cs*.32);ctx.lineTo(px,py+cs*.4);ctx.closePath();ctx.fill();}}
    else if(scene.style==='ocean'){ctx.strokeStyle=scene.accent;ctx.lineWidth=1.5;ctx.shadowColor=scene.glow;ctx.shadowBlur=6;ctx.globalAlpha=.45+.15*Math.sin(t*.06+x*.4);if(!(g&N)){ctx.beginPath();ctx.moveTo(px+cs*.1,py);for(let wi=0;wi<4;wi++){const wx0=px+cs*.1+wi*cs*.2;ctx.quadraticCurveTo(wx0+cs*.05,py-cs*.06*(wi%2===0?1:-1),wx0+cs*.1,py);ctx.quadraticCurveTo(wx0+cs*.15,py+cs*.06*(wi%2===0?1:-1),wx0+cs*.2,py);}ctx.stroke();}if(!(g&W)){ctx.beginPath();ctx.moveTo(px,py+cs*.1);for(let hi=0;hi<4;hi++){const hy0=py+cs*.1+hi*cs*.2;ctx.quadraticCurveTo(px-cs*.06*(hi%2===0?1:-1),hy0+cs*.05,px,hy0+cs*.1);ctx.quadraticCurveTo(px+cs*.06*(hi%2===0?1:-1),hy0+cs*.15,px,hy0+cs*.2);}ctx.stroke();}}
    else if(scene.style==='volcano'){ctx.globalAlpha=.5+.2*Math.sin(t*.08+x*.5+y*.3);if(!(g&N)){ctx.fillStyle=t%120<60?scene.glow:scene.accent;ctx.shadowColor=scene.glow;ctx.shadowBlur=8;const d1y=py+((t*.8+x*30)%40)/40*cs*.35;ctx.beginPath();ctx.ellipse(px+cs*.25,d1y,cs*.06,cs*.1,0,0,Math.PI*2);ctx.fill();}if(!(g&W)){ctx.fillStyle=t%120<60?scene.accent:scene.glow;const dx2=px+((t*.7+y*40)%40)/40*cs*.35;ctx.beginPath();ctx.ellipse(dx2,py+cs*.3,cs*.1,cs*.06,0,0,Math.PI*2);ctx.fill();}}
    else if(scene.style==='ice'){ctx.strokeStyle=scene.accent;ctx.lineWidth=1;ctx.shadowColor=scene.glow;ctx.shadowBlur=5;ctx.globalAlpha=.5+.15*Math.sin(t*.05+x*.6+y*.4);if(!(g&N))drawIceCrystal(ctx,px+cs/2,py,cs*.2);if(!(g&W))drawIceCrystal(ctx,px,py+cs/2,cs*.2);}
    else if(scene.style==='night'){ctx.fillStyle=scene.accent;ctx.shadowColor=scene.glow;ctx.shadowBlur=6;if(!(g&N)){ctx.globalAlpha=.6+.4*Math.sin(t*.07+x*.8);drawStar4(ctx,px+cs*.3,py,cs*.1);ctx.globalAlpha=.4+.4*Math.sin(t*.09+x*.5+1);drawStar4(ctx,px+cs*.72,py,cs*.08);}if(!(g&W)){ctx.globalAlpha=.5+.4*Math.sin(t*.06+y*.9);drawStar4(ctx,px,py+cs*.35,cs*.09);}}
    ctx.restore();
  }
}
function drawRadarBeam(){
  if(radarTimer<=0)return;
  let tx=monster.x,ty=monster.y;
  if(monster2Active&&monster2.x>=0){const d1=Math.abs(monster.x-player.x)+Math.abs(monster.y-player.y),d2=Math.abs(monster2.x-player.x)+Math.abs(monster2.y-player.y);if(d2<d1){tx=monster2.x;ty=monster2.y;}}
  const ppx=player.x*CELL+CELL/2,ppy=player.y*CELL+CELL/2;
  const angle=Math.atan2(ty-player.y,tx-player.x),len=CELL*1.4,pulse=0.6+0.4*Math.sin(frame*.15);
  ctx.save();ctx.globalAlpha=.85*pulse;ctx.strokeStyle='#ef4444';ctx.lineWidth=2.5;ctx.shadowColor='#ef4444';ctx.shadowBlur=10;ctx.lineCap='round';
  const ex=ppx+Math.cos(angle)*len,ey=ppy+Math.sin(angle)*len;
  ctx.beginPath();ctx.moveTo(ppx,ppy);ctx.lineTo(ex,ey);ctx.stroke();
  const aw=8;ctx.beginPath();ctx.moveTo(ex,ey);ctx.lineTo(ex+Math.cos(angle+2.5)*aw,ey+Math.sin(angle+2.5)*aw);ctx.moveTo(ex,ey);ctx.lineTo(ex+Math.cos(angle-2.5)*aw,ey+Math.sin(angle-2.5)*aw);ctx.stroke();
  ctx.restore();
}

function draw(){
  if(!grid||!grid.length)return;
  const t=frame,sw=canvas.width,sh=canvas.height,{ox,oy}=getOffset();
  ctx.clearRect(0,0,sw,sh);ctx.fillStyle=scene.bg||'#060a14';ctx.fillRect(0,0,sw,sh);
  for(const s of bgStars){ctx.globalAlpha=.3+.3*Math.sin(s.t+t*.016);ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(s.px*sw,s.py*sh,s.r,0,Math.PI*2);ctx.fill();}
  ctx.globalAlpha=1;ctx.save();ctx.translate(ox,oy);

  // Floor
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){ctx.fillStyle=(x+y)%2===0?scene.floor:scene.floorAlt;ctx.fillRect(x*CELL,y*CELL,CELL,CELL);}
  // Trail
  for(let i=trail.length-1;i>=0;i--){const tr=trail[i];tr.t--;if(tr.t<=0){trail.splice(i,1);continue;}ctx.save();ctx.globalAlpha=(tr.t/50)*.48;ctx.fillStyle='#c084fc';ctx.shadowColor='#a855f7';ctx.shadowBlur=7;ctx.beginPath();ctx.arc(tr.x*CELL+CELL/2,tr.y*CELL+CELL/2,CELL*.2*(tr.t/50),0,Math.PI*2);ctx.fill();ctx.restore();}
  // Secrets
  for(const s of secrets){
    const gl=.6+.4*Math.sin(t*.08+s.ax),px=s.ax*CELL,py=s.ay*CELL,cx2=px+CELL/2,cy2=py+CELL/2;
    ctx.save();ctx.globalAlpha=.2+.1*gl;ctx.fillStyle='#cc44ff';ctx.beginPath();ctx.rect(px+2,py+2,CELL-4,CELL-4);ctx.fill();
    ctx.globalAlpha=.8+.2*gl;ctx.strokeStyle='#ff88ff';ctx.lineWidth=5;ctx.shadowColor='#ff44ff';ctx.shadowBlur=14;
    ctx.beginPath();if(s.dir===N){ctx.moveTo(px+4,py);ctx.lineTo(px+CELL-4,py);}else if(s.dir===S){ctx.moveTo(px+4,py+CELL);ctx.lineTo(px+CELL-4,py+CELL);}else if(s.dir===E){ctx.moveTo(px+CELL,py+4);ctx.lineTo(px+CELL,py+CELL-4);}else{ctx.moveTo(px,py+4);ctx.lineTo(px,py+CELL-4);}ctx.stroke();
    ctx.shadowBlur=0;ctx.globalAlpha=.88;const arrows={[N]:'⬆️',[S]:'⬇️',[E]:'➡️',[W]:'⬅️'};ctx.font=(CELL*.42)+'px serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(arrows[s.dir],cx2,cy2);
    ctx.restore();
  }
  // Walls
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){const px=x*CELL,py=y*CELL,g=grid[idx(x,y)];ctx.strokeStyle=scene.wall;ctx.lineWidth=3;ctx.lineCap='square';ctx.shadowColor=scene.glow;ctx.shadowBlur=5;if(!(g&N)){ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px+CELL,py);ctx.stroke();}if(!(g&S)){ctx.beginPath();ctx.moveTo(px,py+CELL);ctx.lineTo(px+CELL,py+CELL);ctx.stroke();}if(!(g&E)){ctx.beginPath();ctx.moveTo(px+CELL,py);ctx.lineTo(px+CELL,py+CELL);ctx.stroke();}if(!(g&W)){ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px,py+CELL);ctx.stroke();}ctx.shadowBlur=0;}
  drawWallDecorations();
  // Exit
  const epx=exit.x*CELL+CELL/2,epy=exit.y*CELL+CELL/2;
  if(keysCollected<totalKeys){ctx.save();ctx.globalAlpha=.45;em(epx,epy,CELL*.72,'🔒');ctx.restore();}
  else{const p=.8+.2*Math.sin(t*.15);ctx.save();ctx.shadowColor='#00e676';ctx.shadowBlur=20*p;em(epx,epy,CELL*.88,'🚪');ctx.restore();ctx.save();ctx.globalAlpha=.2*p;ctx.fillStyle='#00e676';ctx.beginPath();ctx.arc(epx,epy,CELL*.84,0,Math.PI*2);ctx.fill();ctx.restore();}
  // Keys (with shop halo)
  for(const k of keys){if(k.collected)continue;const kpx=k.x*CELL+CELL/2,kpy=k.y*CELL+CELL/2,bob=Math.sin(t*.1+k.x)*3,p=.7+.3*Math.sin(t*.12+k.y);ctx.save();ctx.globalAlpha=.28*p*(getShopEffect('keyHalo')>=1?1.6:1);ctx.fillStyle='#ffe566';ctx.beginPath();ctx.arc(kpx,kpy+bob,CELL*(getShopEffect('keyHalo')>=1?.95:.8),0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;ctx.shadowColor='#f7c948';ctx.shadowBlur=getShopEffect('keyHalo')>=1?32:20;em(kpx,kpy+bob,CELL*.82,'🔑');ctx.restore();}
  // In-level items
  for(const item of inLevelItems){if(item.collected)continue;const def=POWERUP_DEFS[item.powId];if(!def)continue;const pulse=.7+.3*Math.sin(t*.15+item.x);ctx.save();ctx.shadowColor=def.color;ctx.shadowBlur=14*pulse;if(item.powId==='radar'||item.powId==='torch'){ctx.globalAlpha=.18*pulse;ctx.fillStyle=def.color;ctx.beginPath();ctx.arc(item.x*CELL+CELL/2,item.y*CELL+CELL/2,CELL*.75,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;em(item.x*CELL+CELL/2,item.y*CELL+CELL/2,CELL*.82,def.icon);ctx.restore();}
  // Coins
  const coinMult=1+getShopEffect('coinMult')*.5;
  for(const c of coins){if(c.collected)continue;ctx.save();ctx.shadowColor='#f7c948';ctx.shadowBlur=9;const mag=magnetTimer>0&&(c.x===player.x||c.y===player.y)?1.4:1;em(c.x*CELL+CELL/2,c.y*CELL+CELL/2+Math.sin(t*.12+c.x)*2,CELL*.56*mag,'💰');ctx.restore();}
  // Portals
  for(let i=0;i<portals.length;i++){const p=portals[i],pulse=.7+.3*Math.sin(t*.1+i);ctx.save();ctx.globalAlpha=.9;ctx.shadowColor=p.col;ctx.shadowBlur=20*pulse;em(p.ax*CELL+CELL/2,p.ay*CELL+CELL/2,CELL*.72,'🌀');em(p.bx*CELL+CELL/2,p.by*CELL+CELL/2,CELL*.72,'🌀');ctx.restore();}
  // Traps
  for(const tr of traps){if(tr.hit)continue;ctx.save();ctx.globalAlpha=.8+.2*Math.sin(t*.18);em(tr.x*CELL+CELL/2,tr.y*CELL+CELL/2,CELL*.6,'💣');ctx.restore();}
  // Boss
  if(bossActive){const bx=boss.x*CELL+CELL/2,by=boss.y*CELL+CELL/2,bPulse=.7+.3*Math.sin(t*.12);ctx.save();ctx.globalAlpha=.2*bPulse;ctx.fillStyle='#ef4444';ctx.beginPath();ctx.arc(bx,by,CELL*.95,0,Math.PI*2);ctx.fill();ctx.shadowColor='#ef4444';ctx.shadowBlur=25*bPulse;ctx.globalAlpha=1;em(bx,by,CELL,BOSS_EMOJIS[level%BOSS_EMOJIS.length]);ctx.restore();}
  // Crab & bat
  if(crabActive&&crab.x>=0){ctx.save();if(freezeActive)ctx.globalAlpha=.4;ctx.shadowColor='#fb923c';ctx.shadowBlur=16;em(crab.x*CELL+CELL/2,crab.y*CELL+CELL/2,CELL*.85,'🦀');ctx.restore();}
  if(batActive&&bat.x>=0){ctx.save();if(freezeActive)ctx.globalAlpha=.4;ctx.shadowColor='#a855f7';ctx.shadowBlur=14;const batBob=Math.sin(t*.3)*3;em(bat.x*CELL+CELL/2,bat.y*CELL+CELL/2+batBob,CELL*.82,'🦇');ctx.restore();}
  // Player
  const ppx=player.x*CELL+CELL/2,ppy=player.y*CELL+CELL/2;
  ctx.save();ctx.globalAlpha=.25;ctx.fillStyle='#000';ctx.beginPath();ctx.ellipse(ppx,ppy+CELL*.3,CELL*.24,CELL*.08,0,0,Math.PI*2);ctx.fill();ctx.restore();
  if(speedTimer>0){ctx.save();ctx.globalAlpha=.15+.07*Math.sin(t*.4);ctx.fillStyle='#f7c948';ctx.beginPath();ctx.arc(ppx,ppy,CELL*.7,0,Math.PI*2);ctx.fill();ctx.restore();}
  if(passivePowers.has('shield')){ctx.save();ctx.globalAlpha=.25+.1*Math.sin(t*.2);ctx.strokeStyle='#6366f1';ctx.lineWidth=2;ctx.beginPath();ctx.arc(ppx,ppy,CELL*.55,0,Math.PI*2);ctx.stroke();ctx.restore();}
  if(radarTimer>0){ctx.save();ctx.globalAlpha=.12+.08*Math.sin(t*.2);ctx.strokeStyle='#ef4444';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(ppx,ppy,CELL*.8*(0.9+0.1*Math.sin(t*.1)),0,Math.PI*2);ctx.stroke();ctx.restore();}
  ctx.save();ctx.shadowColor='#80d8ff';ctx.shadowBlur=18;em(ppx,ppy-Math.abs(Math.sin(t*.18))*2,CELL*.9,getPlayerEmoji());ctx.restore();
  drawRadarBeam();
  // Monsters
  if(monster.x>=0){const mpx=monster.x*CELL+CELL/2,mpy=monster.y*CELL+CELL/2;ctx.save();if(freezeActive)ctx.globalAlpha=.4;ctx.shadowColor='#ff2244';ctx.shadowBlur=20;em(mpx+Math.sin(t*.22)*2,mpy,CELL*.9,'👻');ctx.restore();if(freezeActive){ctx.save();em(mpx,mpy-CELL*.5,CELL*.5,'❄️');ctx.restore();}}
  if(monster2Active&&monster2.x>=0){ctx.save();if(freezeActive)ctx.globalAlpha=.4;ctx.shadowColor='#ff6600';ctx.shadowBlur=18;em(monster2.x*CELL+CELL/2+Math.sin(t*.25)*2,monster2.y*CELL+CELL/2,CELL*.85,'👹');ctx.restore();}
  // Global tints
  if(freezeActive){ctx.save();ctx.globalAlpha=.09+.04*Math.sin(t*.2);ctx.fillStyle='#38bdf8';ctx.fillRect(0,0,W_PX,H_PX);ctx.restore();}
  if(speedTimer>0){ctx.save();ctx.globalAlpha=.05+.02*Math.sin(t*.3);ctx.fillStyle='#f7c948';ctx.fillRect(0,0,W_PX,H_PX);ctx.restore();}
  // Danger vignette
  const dang=Math.max(0,1-dangerDist/8);
  if(dang>0){const p=dang*(.26+.1*Math.sin(t*.3));const grd=ctx.createRadialGradient(W_PX/2,H_PX/2,H_PX*.2,W_PX/2,H_PX/2,H_PX*.75);grd.addColorStop(0,'rgba(255,0,50,0)');grd.addColorStop(1,'rgba(255,0,50,'+p+')');ctx.fillStyle=grd;ctx.fillRect(0,0,W_PX,H_PX);}
  // Fog with density setting
  if(shouldShowFog()){
    const fp=FOG_PARAMS[cfg.fogDensity]||FOG_PARAMS.normal;
    const fx=player.x*CELL+CELL/2,fy=player.y*CELL+CELL/2;
    const baseR=CELL*(torchActive?6.5:3.5);
    const fg=ctx.createRadialGradient(fx,fy,baseR*fp.innerR,fx,fy,baseR*fp.outerR);
    fg.addColorStop(0,'rgba(0,0,0,0)');fg.addColorStop(fp.midStop,'rgba(0,0,0,'+fp.alpha1+')');fg.addColorStop(1,'rgba(0,0,0,'+fp.alpha2+')');
    ctx.fillStyle=fg;ctx.fillRect(0,0,W_PX,H_PX);
  }
  ctx.restore();
  drawMinimap();updateHUD();
  if(radarTimer>0)updateRadarHUD();
}

function updateHUD(){
  const sb=document.getElementById('speed-bar'),sf=document.getElementById('speed-fill');
  if(speedTimer>0){sb.style.display='block';sf.style.width=Math.round(speedTimer/600*100)+'%';}else sb.style.display='none';
  const pct=Math.max(0,Math.min(1,1-dangerDist/10))*100;
  document.getElementById('danger-bar').style.width=pct+'%';
  if(pct>85)achMaxDanger=true;
  if(gameState==='playing'&&frame%30===0){const el=frame-achLevelStart,s=el/60<30?3:el/60<60?2:1;document.getElementById('stars-hud').innerHTML=['☆☆☆','⭐☆☆','⭐⭐☆','⭐⭐⭐'][s];}
  const sf2=document.getElementById('stamina-fill');
  const regenRate=.15+getShopEffect('staminaRegen')*.08;
  if(stamina<100)stamina=Math.min(100,stamina+regenRate);
  if(sf2){sf2.style.width=stamina+'%';sf2.style.background=stamina>60?'linear-gradient(90deg,#f7c948,#22c55e)':stamina>30?'linear-gradient(90deg,#f97316,#f7c948)':'linear-gradient(90deg,#ef4444,#f97316)';}
  if(passivePowers.has('compass')){const cv=document.getElementById('_compv');if(cv){const dx=exit.x-player.x,dy=exit.y-player.y;cv.textContent=Math.abs(dx)>Math.abs(dy)?(dx>0?'➡':'⬅'):(dy>0?'⬇':'⬆');}}
}
function drawMinimap(){
  const mc=document.getElementById('minimap');if(!mc||!grid||!grid.length)return;
  const mx=mc.getContext('2d'),mw=mc.width,mh=mc.height,cs=mw/COLS;
  mx.fillStyle='#060a14';mx.fillRect(0,0,mw,mh);
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){const g=grid[idx(x,y)];mx.strokeStyle='rgba(90,63,160,0.7)';mx.lineWidth=.5;if(!(g&N)){mx.beginPath();mx.moveTo(x*cs,y*cs);mx.lineTo((x+1)*cs,y*cs);mx.stroke();}if(!(g&S)){mx.beginPath();mx.moveTo(x*cs,(y+1)*cs);mx.lineTo((x+1)*cs,(y+1)*cs);mx.stroke();}if(!(g&E)){mx.beginPath();mx.moveTo((x+1)*cs,y*cs);mx.lineTo((x+1)*cs,(y+1)*cs);mx.stroke();}if(!(g&W)){mx.beginPath();mx.moveTo(x*cs,y*cs);mx.lineTo(x*cs,(y+1)*cs);mx.stroke();}}
  for(const k of keys){if(!k.collected){mx.fillStyle='#f7c948';mx.beginPath();mx.arc((k.x+.5)*cs,(k.y+.5)*cs,1.5,0,Math.PI*2);mx.fill();}}
  mx.fillStyle='#22c55e';mx.beginPath();mx.arc((exit.x+.5)*cs,(exit.y+.5)*cs,2,0,Math.PI*2);mx.fill();
  if(monster.x>=0){mx.fillStyle='#ef4444';mx.beginPath();mx.arc((monster.x+.5)*cs,(monster.y+.5)*cs,2,0,Math.PI*2);mx.fill();}
  if(monster2Active&&monster2.x>=0){mx.fillStyle='#f97316';mx.beginPath();mx.arc((monster2.x+.5)*cs,(monster2.y+.5)*cs,2,0,Math.PI*2);mx.fill();}
  if(bossActive){mx.fillStyle='#ff0066';mx.beginPath();mx.arc((boss.x+.5)*cs,(boss.y+.5)*cs,3,0,Math.PI*2);mx.fill();}
  if(crabActive&&crab.x>=0){mx.fillStyle='#fb923c';mx.beginPath();mx.arc((crab.x+.5)*cs,(crab.y+.5)*cs,2,0,Math.PI*2);mx.fill();}
  if(batActive&&bat.x>=0){mx.fillStyle='#a855f7';mx.beginPath();mx.arc((bat.x+.5)*cs,(bat.y+.5)*cs,2,0,Math.PI*2);mx.fill();}
  mx.fillStyle='#a855f7';mx.beginPath();mx.arc((player.x+.5)*cs,(player.y+.5)*cs,2.5,0,Math.PI*2);mx.fill();
}

// ═══════════════════════════════════════════════════════════
// GAME LOOP
// ═══════════════════════════════════════════════════════════
function gameLoop(){
  frame++;
  if(gameState==='playing'){
    if(frame%2===0)recordingMoves.push({px:player.x,py:player.y,mx:monster.x,my:monster.y});
    tickPowerTimers();tickMagnet();

    // Monster 1
    if(monster.x>=0){
      monsterTimer++;
      if(monsterTimer>=monsterSpeed){monsterTimer=0;
        if(!freezeActive){const rnd=passivePowers.has('dumbMonster')?.70:.35;if(Math.random()<rnd){const rd=[N,S,E,W].filter(d=>canMove(monster.x,monster.y,d));if(rd.length>0){const d=rd[Math.floor(Math.random()*rd.length)];monster.x+=DX[d];monster.y+=DY[d];}}else{const nxt=bfs(monster.x,monster.y,player.x,player.y);if(nxt!==null){monster.x=nxt%COLS;monster.y=Math.floor(nxt/COLS);}}}
        bfs(monster.x,monster.y,player.x,player.y);
        if(monster.x===player.x&&monster.y===player.y)hitPlayer();
      }
    }
    // Monster 2
    if(monster2Active&&monster2.x>=0){
      monster2Timer++;
      if(monster2Timer>=monster2Speed){monster2Timer=0;
        if(!freezeActive){if(Math.random()<.35){const rd=[N,S,E,W].filter(d=>canMove(monster2.x,monster2.y,d));if(rd.length>0){const d=rd[Math.floor(Math.random()*rd.length)];monster2.x+=DX[d];monster2.y+=DY[d];}}else{const nxt=bfs(monster2.x,monster2.y,player.x,player.y);if(nxt!==null){monster2.x=nxt%COLS;monster2.y=Math.floor(nxt/COLS);}}}
        if(monster2.x===player.x&&monster2.y===player.y)hitPlayer();
      }
    }
    // Crab (slow, follows BFS always)
    if(crabActive&&crab.x>=0){
      crabTimer++;
      if(crabTimer>=Math.max(70,120-level*4)){crabTimer=0;
        if(!freezeActive){const nxt=bfs(crab.x,crab.y,player.x,player.y);if(nxt!==null){crab.x=nxt%COLS;crab.y=Math.floor(nxt/COLS);}}
        if(crab.x===player.x&&crab.y===player.y)hitPlayer();
      }
    }
    // Bat (very fast, random 60%)
    if(batActive&&bat.x>=0){
      batTimer++;
      if(batTimer>=Math.max(25,50-level*2)){batTimer=0;
        if(!freezeActive){if(Math.random()<.6){const rd=[N,S,E,W].filter(d=>canMove(bat.x,bat.y,d));if(rd.length>0){const d=rd[Math.floor(Math.random()*rd.length)];bat.x+=DX[d];bat.y+=DY[d];}}else{const nxt=bfs(bat.x,bat.y,player.x,player.y);if(nxt!==null){bat.x=nxt%COLS;bat.y=Math.floor(nxt/COLS);}}}
        if(bat.x===player.x&&bat.y===player.y)hitPlayer();
      }
    }
    // Boss AI
    if(bossActive){
      bossTimer++;
      if(bossTimer>=bossSpeed){bossTimer=0;
        if(!freezeActive){
          // Boss teleports randomly 20% of the time
          if(Math.random()<.2){const bp=placeRandom([{...player}]);boss={...bp};}
          else{const nxt=bfs(boss.x,boss.y,player.x,player.y);if(nxt!==null){boss.x=nxt%COLS;boss.y=Math.floor(nxt/COLS);}}
        }
        if(boss.x===player.x&&boss.y===player.y)hitPlayer();
      }
    }
    if(frame%1800===0)saveGame();
  }
  draw();requestAnimationFrame(gameLoop);
}

function hitPlayer(){
  _dailyNoHit=false;
  if(passivePowers.has('shield')){
    passivePowers.delete('shield');showIG('🛡️ Escudo destruído!');
    monster={x:COLS-1,y:ROWS-1};if(monster2Active)monster2={x:COLS-1,y:0};
    if(bossActive)boss={...bossStart};
    unlockAch('shield_save');
    const fl=document.createElement('div');fl.className='hit-flash';document.body.appendChild(fl);setTimeout(()=>{if(fl.parentNode)fl.remove();},350);
    return;
  }
  lives--;document.getElementById('lives-val').textContent=lives;scheduleSave();
  const fl=document.createElement('div');fl.className='hit-flash';document.body.appendChild(fl);setTimeout(()=>{if(fl.parentNode)fl.remove();},350);
  if(lives<=0){saveReplay();gameState='dead';showOverlay('💀 Game Over!','Suas vidas acabaram!','😤 Tentar de Novo');}
  else{player={x:0,y:0};monster=placeRandom([{...player},{...exit},...keys]);showIG('💔 Restam: '+lives);}
}

// ═══════════════════════════════════════════════════════════
// MOVEMENT
// ═══════════════════════════════════════════════════════════
function tryMove(dir){
  if(gameState!=='playing')return;
  trail.push({x:player.x,y:player.y,t:50});
  if(stamina>0)stamina=Math.max(0,stamina-1);
  const sec=secrets.find(s=>s.ax===player.x&&s.ay===player.y&&s.dir===dir);
  if(sec){player.x=sec.bx;player.y=sec.by;flashSecret();afterMove();return;}
  const sec2=secrets.find(s=>s.bx===player.x&&s.by===player.y&&s.dir===OPP[dir]);
  if(sec2){player.x=sec2.ax;player.y=sec2.ay;flashSecret();afterMove();return;}
  if(!canMove(player.x,player.y,dir))return;
  player.x+=DX[dir];player.y+=DY[dir];afterMove();
}

function afterMove(){
  const mult=passivePowers.has('doubleScore')?2:1;
  const cMult=1+getShopEffect('coinMult')*.5;
  // Keys
  for(const k of keys){if(!k.collected&&k.x===player.x&&k.y===player.y){k.collected=true;keysCollected++;const pts=Math.round(50*level*mult);score+=pts;addXP(XP_REWARDS.key,player.x,player.y);document.getElementById('score-val').textContent=score;document.getElementById('key-val').textContent=keysCollected;spawnFloat('+'+pts,player.x,player.y);}}
  // Coins
  for(const c of coins){if(!c.collected&&c.x===player.x&&c.y===player.y){c.collected=true;const pts=Math.round(10*level*mult*cMult);score+=pts;achCoinTotal++;permanentCoins++;_dailyCoins++;addXP(XP_REWARDS.coin);document.getElementById('score-val').textContent=score;document.getElementById('coins-val').textContent=achCoinTotal;spawnFloat('+'+pts,player.x,player.y);checkAchievements();checkDailyComplete();}}
  // In-level items
  for(const item of inLevelItems){if(!item.collected&&item.x===player.x&&item.y===player.y){item.collected=true;addToInventory(item.powId);}}
  // Boss proximity → damage
  if(bossActive&&Math.abs(boss.x-player.x)<=1&&Math.abs(boss.y-player.y)<=1&&boss.x!==player.x){damageBoss();}
  // Portals
  for(const p of portals){if((player.x===p.ax&&player.y===p.ay)||(player.x===p.bx&&player.y===p.by)){const tx=player.x===p.ax?p.bx:p.ax,ty=player.y===p.ay?p.by:p.ay;player.x=tx;player.y=ty;spawnFloat('🌀+20',player.x,player.y);score+=Math.round(20*mult);document.getElementById('score-val').textContent=score;break;}}
  // Traps
  for(const tr of traps){if(!tr.hit&&player.x===tr.x&&player.y===tr.y){tr.hit=true;stamina=Math.max(0,stamina-35);spawnFloat('-35⚡',player.x,player.y);const fl=document.createElement('div');fl.className='trap-flash';document.body.appendChild(fl);setTimeout(()=>{if(fl.parentNode)fl.remove();},450);if(stamina<=0&&lives>1){lives--;document.getElementById('lives-val').textContent=lives;player={x:0,y:0};}}}
  // Win
  if(player.x===exit.x&&player.y===exit.y&&keysCollected>=totalKeys){
    const elapsed=(frame-achLevelStart)/60;
    const starCount=elapsed<30?3:elapsed<60?2:1;
    if(elapsed<30) _dailySpeedOk=true;
    const starStr=['⭐','⭐⭐','⭐⭐⭐'][starCount-1];
    const bonus=Math.round(200*level*starCount*mult);
    score+=bonus;addXP(XP_REWARDS.levelComplete);
    document.getElementById('score-val').textContent=score;
    if(starCount===3){achPerfectStreak++;if(achPerfectStreak>=3)unlockAch('stars3x3');}else achPerfectStreak=0;
    permanentCoins+=starCount*3;
    saveReplay();checkAchievements();checkDailyComplete();checkSkinUnlocks();spawnConfetti();
    gameState='win';scheduleSave();
    showOverlay('🎉 Escapou!',starStr+'\nBônus: +'+bonus+' pts\n\nEscolha seu poder!','⚡ Próxima fase');
    document.getElementById('ov-btn').onclick=()=>{
      document.getElementById('game-overlay').classList.remove('show');
      level++;document.getElementById('lvl-val').textContent=level;
      showPowerPick(()=>initLevel());
    };
  }
}

function flashSecret(){
  achSecretCount++;_dailySecrets++;
  const el=document.getElementById('secret-flash');el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1200);
  const mult=passivePowers.has('doubleScore')?2:1,pts=30*mult;
  score+=pts;document.getElementById('score-val').textContent=score;
  addXP(XP_REWARDS.secret,player.x,player.y);spawnFloat('✨+'+pts,player.x,player.y);
  checkAchievements();checkDailyComplete();
}

// ═══════════════════════════════════════════════════════════
// UI HELPERS
// ═══════════════════════════════════════════════════════════
function spawnFloat(text,wx,wy){const{ox,oy}=getOffset();const el=document.createElement('div');el.className='float-score';el.textContent=text;el.style.left=(ox+wx*CELL+CELL/2-20)+'px';el.style.top=(oy+wy*CELL)+'px';document.body.appendChild(el);setTimeout(()=>el.remove(),900);}
let gtostTimer=null;
function showIG(msg){const t=document.getElementById('gtost');if(!t)return;t.textContent=msg;t.style.opacity='1';clearTimeout(gtostTimer);gtostTimer=setTimeout(()=>{t.style.opacity='0';},2200);}
function showToast(msg){const t=document.getElementById('toast');t.innerHTML=msg;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),2500);}
function showOverlay(title,sub,btnText){
  document.getElementById('ov-title').innerHTML=title;
  document.getElementById('ov-title').style.color=gameState==='dead'?'#ff4466':'#f7c948';
  document.getElementById('ov-sub').textContent=sub;
  document.getElementById('ov-btn').textContent=btnText;
  document.getElementById('ov-btn').onclick=null;
  document.getElementById('game-overlay').classList.add('show');
}
function spawnConfetti(){const colors=['#f7c948','#a855f7','#22c55e','#38bdf8','#f97316','#ec4899'];for(let i=0;i<55;i++){setTimeout(()=>{const el=document.createElement('div');el.className='confetti-piece';el.style.cssText='left:'+Math.random()*100+'vw;top:-10px;width:'+(6+Math.random()*7)+'px;height:'+(6+Math.random()*7)+'px;background:'+colors[Math.floor(Math.random()*colors.length)]+';border-radius:2px;animation-duration:'+(0.9+Math.random()*.7)+'s;';document.body.appendChild(el);setTimeout(()=>{if(el.parentNode)el.remove();},1700);},i*20);}}

// ═══════════════════════════════════════════════════════════
// DIALOGS
// ═══════════════════════════════════════════════════════════
const DLGS={
  1:'Fase 1 — Floresta! Colete as chaves e fuja! Use as passagens secretas!',
  2:'Fase 2 — Caverna! Cuidado com as armadilhas no chão!',
  3:'Fase 3 — Oceano! Névoa desceu... e um 2º monstro chegou! Ache o 📡 e a 🔦!',
  4:'Fase 4 — Vulcão! Um caranguejo apareceu! Use os portais de lava!',
  5:'Fase 5 — Gelo! Um morcego veloíssimo chegou! E uma nova fase começa...',
  6:'Fase 6 — Noite Eterna! Todos os inimigos juntos. Boa sorte!',
};
let dialogTimer=null;
function showDialog(lvl){
  const txt=DLGS[((lvl-1)%6)+1]+(level%5===0?'\n⚠️ FASE DE CHEFE!':'');
  document.getElementById('dialog-text').textContent=txt;
  document.getElementById('dialog-box').classList.add('show');
  clearTimeout(dialogTimer);dialogTimer=setTimeout(closeDialog,5500);
}
function closeDialog(){document.getElementById('dialog-box').classList.remove('show');}
document.getElementById('dialog-close-btn').addEventListener('click',closeDialog);

// ═══════════════════════════════════════════════════════════
// PAUSE
// ═══════════════════════════════════════════════════════════
function pauseGame(){if(gameState!=='playing')return;gameState='paused';document.getElementById('pause-overlay').classList.add('show');}
function resumeGame(){if(gameState!=='paused')return;gameState='playing';document.getElementById('pause-overlay').classList.remove('show');}
function quitToMenu(){document.getElementById('pause-overlay').classList.remove('show');saveGame();gameState='intro';showOverlay('🧳 Labirinto<br>Mágico!','Pegue as chaves 🔑 e corra para a porta 🚪\nO fantasminha vai te pegar! 👻','▶ Jogar!');}
document.getElementById('pause-btn').addEventListener('click',()=>{if(gameState==='playing')pauseGame();else if(gameState==='paused')resumeGame();});
document.getElementById('btn-resume').addEventListener('click',resumeGame);
document.getElementById('btn-quit').addEventListener('click',quitToMenu);
document.getElementById('btn-pause-ranking').addEventListener('click',()=>{document.getElementById('pause-overlay').classList.remove('show');openRanking();});
document.getElementById('btn-pause-replay').addEventListener('click',()=>{document.getElementById('pause-overlay').classList.remove('show');openReplay();});

// ═══════════════════════════════════════════════════════════
// RANKING
// ═══════════════════════════════════════════════════════════
function getRanking(){try{return JSON.parse(localStorage.getItem('lm_ranking')||'[]');}catch{return[];}}
function saveRanking(r){try{localStorage.setItem('lm_ranking',JSON.stringify(r));}catch{}}
function saveScore(){const name=document.getElementById('ranking-name-input').value.trim()||'Anônimo';const r=getRanking();r.push({name,score,level,date:new Date().toLocaleDateString('pt-BR')});r.sort((a,b)=>b.score-a.score);saveRanking(r.slice(0,10));renderRanking();document.getElementById('ranking-name-input').value='';showToast('💾 Salvo!');}
function renderRanking(){const r=getRanking(),medals=['🥇','🥈','🥉'],body=document.getElementById('ranking-body');if(!r.length){body.innerHTML='<div class="rank-empty">Nenhuma pontuação ainda.</div>';return;}body.innerHTML=r.map((e,i)=>'<div class="rank-row" style="animation-delay:'+(i*.05)+'s"><span class="rank-pos">'+(i<3?medals[i]:(i+1)+'º')+'</span><span class="rank-name">'+e.name+'</span><span class="rank-score">'+e.score.toLocaleString()+'</span><span class="rank-level">Nv.'+e.level+'</span></div>').join('');}
function openRanking(){renderRanking();document.getElementById('ranking-overlay').classList.add('show');}
function closeRanking(){document.getElementById('ranking-overlay').classList.remove('show');}
document.getElementById('ranking-btn').addEventListener('click',openRanking);
document.getElementById('ranking-close').addEventListener('click',closeRanking);
document.getElementById('ranking-save-btn').addEventListener('click',saveScore);

// ═══════════════════════════════════════════════════════════
// TUTORIAL
// ═══════════════════════════════════════════════════════════
let tutStep=0;const TUT_STEPS=6;
function buildTutDots(){const d=document.getElementById('tut-dots');d.innerHTML='';for(let i=0;i<TUT_STEPS;i++){const s=document.createElement('div');s.className='tut-dot'+(i===0?' active':'');d.appendChild(s);}}
function tutNext(){const steps=document.querySelectorAll('.tut-step');steps[tutStep].classList.remove('active');tutStep++;if(tutStep>=TUT_STEPS){closeTutorial();return;}steps[tutStep].classList.add('active');document.querySelectorAll('.tut-dot').forEach((d,i)=>d.classList.toggle('active',i===tutStep));document.getElementById('tut-next').innerHTML=tutStep===TUT_STEPS-1?'🎯 Jogar!':'Próximo →';}
function closeTutorial(){document.getElementById('tutorial-overlay').classList.remove('show');try{localStorage.setItem('lm_tut_done','1');}catch{}}
function openTutorial(){tutStep=0;document.querySelectorAll('.tut-step').forEach((s,i)=>s.classList.toggle('active',i===0));document.getElementById('tut-next').innerHTML='Próximo →';buildTutDots();document.getElementById('tutorial-overlay').classList.add('show');}
document.getElementById('tut-next').addEventListener('click',tutNext);
document.getElementById('tut-skip').addEventListener('click',closeTutorial);
try{if(!localStorage.getItem('lm_tut_done'))setTimeout(openTutorial,600);}catch{}

// ═══════════════════════════════════════════════════════════
// ACHIEVEMENTS
// ═══════════════════════════════════════════════════════════
const ACHIEVEMENTS=[
  {id:'first_win',icon:'🏆',name:'Primeira Fuga',desc:'Complete o 1º nível'},
  {id:'level5',icon:'🔥',name:'Veterano',desc:'Chegue ao nível 5'},
  {id:'level10',icon:'👑',name:'Mestre',desc:'Chegue ao nível 10'},
  {id:'score1000',icon:'⭐',name:'Mil Pontos',desc:'Alcance 1.000 pts'},
  {id:'score5000',icon:'🌟',name:'Cinco Mil',desc:'Alcance 5.000 pts'},
  {id:'secret3',icon:'💡',name:'Detetive',desc:'Use 3 passagens secretas'},
  {id:'no_danger',icon:'🛡️',name:'Ninja',desc:'Complete sem perigo máximo'},
  {id:'speedrun',icon:'⚡',name:'Speedrunner',desc:'Complete em menos de 30s'},
  {id:'collector',icon:'🪵',name:'Colecionador',desc:'Colete 20 moedas'},
  {id:'freeze_use',icon:'❄️',name:'Caçador Gélido',desc:'Use o power-up de gelo'},
  {id:'keys3',icon:'🔐',name:'Chaveiro',desc:'Colete 3 chaves num nível'},
  {id:'survivor',icon:'❤️',name:'Sobrevivente',desc:'Complete com 3+ vidas'},
  {id:'stars3x3',icon:'🌟',name:'Perfeito!',desc:'3 estrelas em 3 fases seguidas'},
  {id:'coins50',icon:'💰',name:'Rico!',desc:'Colete 50 moedas'},
  {id:'shield_save',icon:'🛡️',name:'Blindado',desc:'Escudo te salvou de 1 ataque'},
  {id:'fog_survivor',icon:'🌫️',name:'Nas Trevas',desc:'Complete fase com névoa'},
  {id:'radar_use',icon:'📡',name:'Detetive Digital',desc:'Use o Radar'},
  {id:'torch_use',icon:'🔦',name:'Explorador',desc:'Use a Lanterna na névoa'},
  {id:'boss_kill',icon:'🐲',name:'Caçador de Chefes',desc:'Derrote um chefe'},
  {id:'daily_done',icon:'🎯',name:'Disciplinado',desc:'Complete um desafio diário'},
  {id:'all_skins',icon:'🎨',name:'Colecionador de Skins',desc:'Desbloqueie 5 skins'},
];
let achState={};
function loadAch(){try{achState=JSON.parse(localStorage.getItem('lm_ach')||'{}');}catch{achState={};}}
function saveAch(){try{localStorage.setItem('lm_ach',JSON.stringify(achState));}catch{}}
function unlockAch(id){if(achState[id])return;achState[id]=true;saveAch();const a=ACHIEVEMENTS.find(x=>x.id===id);if(!a)return;const pop=document.getElementById('ach-popup');pop.innerHTML='🏆 '+a.name+'!';pop.classList.add('pop');setTimeout(()=>pop.classList.remove('pop'),3000);renderAchievements();}
function checkAchievements(){
  if(gameState==='win')unlockAch('first_win');
  if(level>=5)unlockAch('level5');if(level>=10)unlockAch('level10');
  if(score>=1000)unlockAch('score1000');if(score>=5000)unlockAch('score5000');
  if(achSecretCount>=3)unlockAch('secret3');
  if(!achMaxDanger&&gameState==='win')unlockAch('no_danger');
  if(gameState==='win'&&(frame-achLevelStart)/60<30)unlockAch('speedrun');
  if(achCoinTotal>=20)unlockAch('collector');if(achCoinTotal>=50)unlockAch('coins50');
  if(totalKeys>=3&&keysCollected>=3)unlockAch('keys3');
  if(lives>=3&&gameState==='win')unlockAch('survivor');
  if(fogActive&&gameState==='win')unlockAch('fog_survivor');
  if(radarTimer>0)unlockAch('radar_use');
  if(torchActive)unlockAch('torch_use');
  if(dailyDone)unlockAch('daily_done');
  if(unlockedSkins.length>=5)unlockAch('all_skins');
}
function renderAchievements(){const u=ACHIEVEMENTS.filter(a=>achState[a.id]).length;document.getElementById('ach-prog-label').textContent=u+' / '+ACHIEVEMENTS.length+' desbloqueadas';document.getElementById('ach-prog-bar').style.width=Math.round(u/ACHIEVEMENTS.length*100)+'%';document.getElementById('ach-list').innerHTML=ACHIEVEMENTS.map(a=>'<div class="ach-card '+(achState[a.id]?'unlocked':'')+'"><div class="ach-icon">'+a.icon+'</div><div class="ach-name">'+a.name+'</div><div class="ach-desc">'+(achState[a.id]?a.desc:'???')+'</div></div>').join('');}
function openAchievements(){renderAchievements();document.getElementById('achievements-overlay').classList.add('show');}
function closeAchievements(){document.getElementById('achievements-overlay').classList.remove('show');}
document.getElementById('ach-btn').addEventListener('click',openAchievements);
document.getElementById('ach-close').addEventListener('click',closeAchievements);
loadAch();

// ═══════════════════════════════════════════════════════════
// REPLAY
// ═══════════════════════════════════════════════════════════
let replayData=null,recordingMoves=[],replayInterval=null,replayPlaying=false,replayIdx=0;
function startRecording(){recordingMoves=[];}
function saveReplay(){replayData={moves:[...recordingMoves],grid:[...grid],keys:JSON.parse(JSON.stringify(keys)),exit:{...exit},cols:COLS,rows:ROWS};}
function openReplay(){document.getElementById('replay-overlay').classList.add('show');if(!replayData){document.getElementById('replay-empty').style.display='block';document.getElementById('replay-content').style.display='none';}else{document.getElementById('replay-empty').style.display='none';document.getElementById('replay-content').style.display='flex';document.getElementById('replay-info').textContent='Nível '+(level-1)+' — '+replayData.moves.length+' frames';drawReplayFrame(0);}}
function closeReplay(){stopReplay();document.getElementById('replay-overlay').classList.remove('show');}
function drawReplayFrame(i){const rc=document.getElementById('replay-canvas'),rx=rc.getContext('2d');if(!replayData)return;const{moves:mv,grid:rg,keys:rk,exit:re,cols,rows}=replayData,rw=rc.width,rh=rc.height,cs=Math.floor(Math.min(rw/cols,rh/rows)),ox=Math.floor((rw-cols*cs)/2),oy=Math.floor((rh-rows*cs)/2);rx.fillStyle='#060a14';rx.fillRect(0,0,rw,rh);for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){rx.fillStyle=(x+y)%2===0?'#1c0c38':'#1f0e3e';rx.fillRect(ox+x*cs,oy+y*cs,cs,cs);}for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const g=rg[y*cols+x];rx.strokeStyle='#5a3fa0';rx.lineWidth=1.5;rx.lineCap='square';if(!(g&N)){rx.beginPath();rx.moveTo(ox+x*cs,oy+y*cs);rx.lineTo(ox+(x+1)*cs,oy+y*cs);rx.stroke();}if(!(g&S)){rx.beginPath();rx.moveTo(ox+x*cs,oy+(y+1)*cs);rx.lineTo(ox+(x+1)*cs,oy+(y+1)*cs);rx.stroke();}if(!(g&E)){rx.beginPath();rx.moveTo(ox+(x+1)*cs,oy+y*cs);rx.lineTo(ox+(x+1)*cs,oy+(y+1)*cs);rx.stroke();}if(!(g&W)){rx.beginPath();rx.moveTo(ox+x*cs,oy+y*cs);rx.lineTo(ox+x*cs,oy+(y+1)*cs);rx.stroke();}}rx.font=cs*.75+'px serif';rx.textAlign='center';rx.textBaseline='middle';rx.fillText('🚪',ox+re.x*cs+cs/2,oy+re.y*cs+cs/2);for(const k of rk){if(!k.collected)rx.fillText('🔑',ox+k.x*cs+cs/2,oy+k.y*cs+cs/2);}if(i>0){for(let j=Math.max(0,i-12);j<i;j++){const m=mv[j];rx.save();rx.globalAlpha=(j-Math.max(0,i-12))/12*.35;rx.fillStyle='#c084fc';rx.beginPath();rx.arc(ox+m.px*cs+cs/2,oy+m.py*cs+cs/2,cs*.18,0,Math.PI*2);rx.fill();rx.restore();}}if(i<mv.length){const m=mv[i];rx.font=cs*.82+'px serif';rx.fillText('🧚',ox+m.px*cs+cs/2,oy+m.py*cs+cs/2);rx.globalAlpha=.6;rx.fillText('👻',ox+m.mx*cs+cs/2,oy+m.my*cs+cs/2);rx.globalAlpha=1;}document.getElementById('replay-fill').style.width=(mv.length?Math.round(i/mv.length*100):0)+'%';}
function toggleReplayPlay(){if(!replayData)return;if(replayPlaying){stopReplay();return;}replayPlaying=true;replayIdx=0;document.getElementById('rp-play-btn').textContent='⏸ Pausar';replayInterval=setInterval(()=>{if(replayIdx>=replayData.moves.length){stopReplay();return;}drawReplayFrame(replayIdx);replayIdx+=2;},50);}
function stopReplay(){replayPlaying=false;clearInterval(replayInterval);replayInterval=null;document.getElementById('rp-play-btn').textContent='▶ Play';}
document.getElementById('replay-close').addEventListener('click',closeReplay);
document.getElementById('rp-play-btn').addEventListener('click',toggleReplayPlay);
document.getElementById('rp-stop-btn').addEventListener('click',stopReplay);

// ═══════════════════════════════════════════════════════════
// CONFIG PANEL
// ═══════════════════════════════════════════════════════════
let ctrlMode='joystick';
document.getElementById('opt-joystick').addEventListener('click',()=>{ctrlMode='joystick';document.getElementById('opt-joystick').classList.add('selected');document.getElementById('opt-dpad').classList.remove('selected');});
document.getElementById('opt-dpad').addEventListener('click',()=>{ctrlMode='dpad';document.getElementById('opt-dpad').classList.add('selected');document.getElementById('opt-joystick').classList.remove('selected');});
document.getElementById('config-save').addEventListener('click',()=>{
  document.getElementById('ctrl-zone').className=ctrlMode==='dpad'?'dpad-mode':'joystick-mode';
  const fog=document.querySelector('input[name="fog"]:checked');if(fog)cfg.fogDensity=fog.value;
  const sfxEl=document.getElementById('cfg-sfx');if(sfxEl)cfg.sfx=sfxEl.checked;
  cfg.ctrl=ctrlMode; saveCfg();
  document.getElementById('config-overlay').classList.remove('show');
  showToast('✅ Configurações salvas!');
});
document.getElementById('config-btn').addEventListener('click',()=>{
  // Sync UI state
  const fogEl=document.querySelector('input[name="fog"][value="'+cfg.fogDensity+'"]');if(fogEl)fogEl.checked=true;
  const sfxEl=document.getElementById('cfg-sfx');if(sfxEl)sfxEl.checked=cfg.sfx;
  document.getElementById('config-overlay').classList.toggle('show');
});
document.getElementById('config-close').addEventListener('click',()=>document.getElementById('config-overlay').classList.remove('show'));

// ═══════════════════════════════════════════════════════════
// KEYBOARD
// ═══════════════════════════════════════════════════════════
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){if(gameState==='playing')pauseGame();else if(gameState==='paused')resumeGame();return;}
  const m={ArrowUp:N,ArrowDown:S,ArrowRight:E,ArrowLeft:W,w:N,s:S,d:E,a:W};
  if(m[e.key]!==undefined){e.preventDefault();tryMove(m[e.key]);}
});
document.getElementById('dpad-up').addEventListener('click',()=>tryMove(N));
document.getElementById('dpad-down').addEventListener('click',()=>tryMove(S));
document.getElementById('dpad-left').addEventListener('click',()=>tryMove(W));
document.getElementById('dpad-right').addEventListener('click',()=>tryMove(E));

// ═══════════════════════════════════════════════════════════
// JOYSTICK
// ═══════════════════════════════════════════════════════════
(function(){
  const wrap=document.getElementById('joystick-wrap'),knob=document.getElementById('joystick-knob');
  const R=40,DEAD=13;let active=false,lastDir=null,moveInt=null;
  function gc(){const r=wrap.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};}
  function sk(dx,dy){const len=Math.sqrt(dx*dx+dy*dy),c=Math.min(len,R),nx=len>0?dx/len*c:0,ny=len>0?dy/len*c:0;knob.style.transform='translate(calc(-50% + '+nx+'px), calc(-50% + '+ny+'px))';}
  function df(dx,dy){if(Math.sqrt(dx*dx+dy*dy)<DEAD)return null;return Math.abs(dx)>Math.abs(dy)?(dx>0?E:W):(dy>0?S:N);}
  function sr(dir){if(moveInt)clearInterval(moveInt);tryMove(dir);moveInt=setInterval(()=>tryMove(dir),speedTimer>0?80:155);lastDir=dir;}
  function stop(){if(moveInt){clearInterval(moveInt);moveInt=null;}lastDir=null;knob.style.transform='translate(-50%,-50%)';}
  function om(cx,cy){const c=gc(),dx=cx-c.x,dy=cy-c.y;sk(dx,dy);const dir=df(dx,dy);if(dir!==lastDir){if(dir)sr(dir);else stop();}}
  wrap.addEventListener('touchstart',e=>{e.preventDefault();active=true;om(e.touches[0].clientX,e.touches[0].clientY);},{passive:false});
  wrap.addEventListener('touchmove',e=>{e.preventDefault();if(active)om(e.touches[0].clientX,e.touches[0].clientY);},{passive:false});
  wrap.addEventListener('touchend',()=>{active=false;stop();});
  wrap.addEventListener('mousedown',e=>{active=true;om(e.clientX,e.clientY);});
  window.addEventListener('mousemove',e=>{if(active)om(e.clientX,e.clientY);});
  window.addEventListener('mouseup',()=>{if(active){active=false;stop();}});
})();

// ═══════════════════════════════════════════════════════════
// MENU TOGGLE
// ═══════════════════════════════════════════════════════════
let menuOpen=false;
document.getElementById('menu-btn').addEventListener('click',()=>{
  menuOpen=!menuOpen;
  document.getElementById('top-menu').classList.toggle('open',menuOpen);
  document.getElementById('menu-btn').innerHTML=menuOpen?'✕':'&#9776;';
  if(menuOpen&&gameState==='playing')pauseGame();
});
['pause-btn','ach-btn','ranking-btn','config-btn','shop-btn'].forEach(id=>{
  const el=document.getElementById(id);
  if(el)el.addEventListener('click',()=>{menuOpen=false;document.getElementById('top-menu').classList.remove('open');document.getElementById('menu-btn').innerHTML='&#9776;';});
});

// ═══════════════════════════════════════════════════════════
// START BUTTON
// ═══════════════════════════════════════════════════════════
document.getElementById('ov-btn').addEventListener('click',function(){
  if(document.getElementById('ov-btn').onclick) return;
  document.getElementById('game-overlay').classList.remove('show');
  if(gameState==='dead'){const sv=level,ss=score;initLevel();level=sv;score=ss;document.getElementById('lvl-val').textContent=level;document.getElementById('score-val').textContent=score;}
  else initLevel();
});

// ═══════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════
loadCfg();loadAch();
let xp=0,shopUpgrades={},unlockedSkins=['fairy'],activeSkin='fairy',permanentCoins=0;
const hasSave=loadGame();

applyScene(1);genMaze();gameState='intro';

if(hasSave&&level>1){
  const sub=document.getElementById('ov-sub');
  if(sub)sub.textContent='Progresso carregado! Nível '+level+' · '+score.toLocaleString()+' pts\nContinue de onde parou!';
}

// Apply saved config
const fogEl=document.querySelector('input[name="fog"][value="'+cfg.fogDensity+'"]');if(fogEl)fogEl.checked=true;
if(cfg.ctrl==='dpad'){document.getElementById('ctrl-zone').className='dpad-mode';document.getElementById('opt-dpad').classList.add('selected');document.getElementById('opt-joystick').classList.remove('selected');ctrlMode='dpad';}

// Run loading screen then start game loop
runLoadingScreen(()=>{ gameLoop(); initDailyChallenge(); });
