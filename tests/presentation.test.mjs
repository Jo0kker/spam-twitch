import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {randomBytes} from 'node:crypto';
import {DEFAULT_PRESENTATION,validatePresentation,panelGeometry,elementKey} from '../extension/presentation.mjs';
import {sanitizeSnapshot} from '../server/protocol.mjs';
import {demoSnapshot} from '../server/demo.mjs';
import {createEbs} from '../server/ebs.mjs';
import {signJwt} from '../server/auth.mjs';

test('presentation settings allow only implemented options and keep panels inside small and large players',()=>{
  assert.deepEqual(validatePresentation({theme:'url(javascript:bad)',privateKey:'secret'}),DEFAULT_PRESENTATION);
  assert.throws(()=>validatePresentation({activation:'remote-script'},true));
  assert.throws(()=>validatePresentation({showStats:'false'},true));
  assert.equal(validatePresentation({opacity:500}).opacity,100);
  assert.equal(elementKey('Lumière'),'light');assert.equal(elementKey('Shadow'),'shadow');
  for(const [width,height] of [[320,180],[640,360],[960,540],[1920,1080],[500,900]])for(const panelStyle of ['sidebar','card'])for(const side of ['left','right'])for(const size of ['narrow','standard','wide']){
    const panel=panelGeometry({...DEFAULT_PRESENTATION,panelStyle,side,width:size},width,height);
    assert.ok(panel.left>=0 && panel.left+panel.width<=width);
    assert.ok(panel.top>=0 && panel.top+panel.height<=height);
  }
});

test('only visible public card metadata and finite ability values survive sanitization',()=>{
  const input=demoSnapshot(),card=input.cards[0];
  card.details={rarity:'<b>Rare</b>',species:'Créature',region:'Région',hiddenTalent:'secret',resistances:{fire:5,water:-25,nature:Infinity,password:'secret'}};
  Object.assign(card.abilities[0],{precision:120,criticalChance:NaN,criticalMultiplier:2,hiddenAction:'secret'});
  const clean=sanitizeSnapshot(input).cards[0];
  assert.deepEqual(clean.details,{rarity:'Rare',species:'Créature',region:'Région',resistances:{fire:5,water:-25}});
  assert.equal(clean.abilities[0].precision,100);assert.equal(clean.abilities[0].criticalChance,undefined);
  assert.equal(clean.abilities[0].criticalMultiplier,2);assert.equal(clean.abilities[0].hiddenAction,undefined);
  const legacy=sanitizeSnapshot(demoSnapshot()).cards[0];assert.equal(legacy.details,undefined);assert.equal(legacy.abilities[0].precision,undefined);
});

test('streamer presentation persists, reaches viewers without a new game frame, and stays channel scoped',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'spam-presentation-')),secret=randomBytes(32),servers=[];
  const start=async()=>{const {server}=await createEbs({secret,clientId:'fixture',disablePubSub:true,dataPath:join(dir,'state.json')});server.listen(0,'127.0.0.1');await once(server,'listening');servers.push(server);return `http://127.0.0.1:${server.address().port}`;};
  t.after(async()=>{for(const server of servers){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}await rm(dir,{recursive:true,force:true});});
  let origin=await start();
  const token=(role,channel='123')=>signJwt({role,channel_id:channel,exp:Math.floor(Date.now()/1000)+3600},secret);
  const call=(path,method='GET',role='broadcaster',value,channel='123')=>fetch(origin+path,{method,headers:{Authorization:`Bearer ${token(role,channel)}`,'Content-Type':'application/json'},body:value===undefined?undefined:JSON.stringify(value)});
  assert.equal((await call('/api/presentation','PUT','viewer',{side:'left'})).status,401);
  assert.equal((await call('/api/presentation','PUT','broadcaster',{activation:'invalid'})).status,400);
  const settings={...DEFAULT_PRESENTATION,panelStyle:'card',side:'left',mode:'simple',showStats:true,activation:'click',opacity:87};
  assert.equal((await call('/api/presentation','PUT','broadcaster',settings)).status,200);
  const issued=await call('/api/pair-code','POST','broadcaster',{}).then(response=>response.json());
  const paired=await fetch(origin+'/api/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:issued.code})}).then(response=>response.json());
  const heartbeat=await fetch(origin+'/api/publisher/heartbeat',{method:'POST',headers:{Authorization:`Bearer ${paired.publisherToken}`,'x-channel-id':'123'}}).then(response=>response.json());
  assert.deepEqual(heartbeat.presentation,settings,'Companion preview must receive the broadcaster settings.');
  assert.deepEqual((await call('/api/state','GET','viewer').then(response=>response.json())).presentation,settings);
  assert.deepEqual((await call('/api/presentation','GET','broadcaster',undefined,'456').then(response=>response.json())).presentation,DEFAULT_PRESENTATION);
  origin=await start();
  assert.deepEqual((await call('/api/presentation').then(response=>response.json())).presentation,settings);
  const legacy=await call('/api/layout').then(response=>response.json());assert.equal(legacy.layout.w,1);
});


test('full sidebar docks to the player edges while the compact card retains its inset',()=>{
  for(const [width,height] of [[320,180],[640,360],[960,540],[1225,693],[1920,1080]])for(const side of ['right','left']){
    const sidebar=panelGeometry({...DEFAULT_PRESENTATION,panelStyle:'sidebar',side},width,height);
    assert.equal(sidebar.top,0);assert.equal(sidebar.height,height);
    assert.equal(side==='right'?sidebar.left+sidebar.width:sidebar.left,side==='right'?width:0);
    const card=panelGeometry({...DEFAULT_PRESENTATION,panelStyle:'card',side},width,height);
    assert.ok(card.top>0);assert.ok(card.height<height);
  }
  assert.throws(()=>validatePresentation({panelStyle:'remote-html'},true));
});
