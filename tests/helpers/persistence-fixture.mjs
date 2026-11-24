import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
const read=file=>readFileSync(new URL('../../'+file,import.meta.url),'utf8');
export function fixture({readCloud=async()=>({data:null}),writeCloud=async()=>({}),quota=false}={}){
  const elements=new Map(),storage=new Map(),writes=[],messages=[];
  const element=id=>{if(!elements.has(id))elements.set(id,{textContent:'',value:'',addEventListener(){}});return elements.get(id)};
  const State={seed:7,biome:'plains',season:'summer',structures:[],environment:[],relief:{hills:[]},
    resources:{gold:10,wood:4},policies:{tax:25},village:{founded:false},clock:{day:0,speed:0},view:{rotation:0},dirty:true,user:{id:'owner'}};
  const query={select(){return this},eq(){return this},maybeSingle:readCloud,upsert:payload=>{writes.push(JSON.parse(JSON.stringify(payload)));return writeCloud(payload)}};
  State.supabase={from:()=>query};
  const localStorage={getItem:key=>storage.get(key)??null,setItem(key,value){if(quota)throw Error('QuotaExceededError');storage.set(key,String(value))},
    removeItem:key=>storage.delete(key),key:i=>[...storage.keys()][i]??null,get length(){return storage.size}};
  const ctx=createContext({window:{},State,localStorage,performance,URLSearchParams,
    location:{hostname:'localhost',pathname:'/',search:''},document:{getElementById:element},
    console:{warn(){},error(){}},status:message=>messages.push(message),LANDSCAPE_GENERATION_VERSION:1,
    BIOMES:{plains:{}},PROVISIONAL_RESOURCES:{gold:10000,wood:10000},
    setTimeout,clearTimeout,resetLegacyVillageGrowth(){},widenWatercourses(){},clearReliefBandCache(){},
    ensureStaticLandscape(){State.relief={hills:[]};State.environment=[];return false},ensureBorderEntrySelection(){},syncPrimaryRoadBridges(){},
    connectBorderMainRoadsInFrames(){},rebuildSecondaryRoadsOnLoad(){},reconcileReactiveRoadNetwork(){},syncCompletedTowerWallColliders(){},
    reconcileGateMainConnections(){},reconcileSettlementAccessRoads(){},invalidateSceneCache(){},renderUI(){},renderFunctionPanel(){},draw(){},
  });
  runInContext(read('src/settlement-save-snapshot.js'),ctx);
  runInContext(read('src/settlement-app-persistence.js'),ctx);
  return{ctx,State,storage,writes,messages,element,run:code=>runInContext(code,ctx)};
}
