'use strict';
// CONQUER experimental hybrid renderer — WebGPU static-layer compositor.
// The simulation and all scene generation remain renderer-agnostic. When WebGPU
// is unavailable (or ?renderer=canvas2d is present), Canvas 2D remains canonical.
(()=>{
  const gpuCanvas=document.getElementById('gpuCanvas');
  const STATIC_LAYERS=['landscape','ground','shadow','base'];
  const perf=()=>window.__conquerPerf||(window.__conquerPerf={});
  const state={
    requested:true,supported:false,ready:false,active:false,
    adapter:null,device:null,context:null,format:null,pipeline:null,sampler:null,
    vertexBuffer:null,layerGpu:new Map(),width:0,height:0,dpr:1,
    frames:0,uploads:0,lastFrameMs:0,lastUploadMs:0,totalUploadMs:0,
    fallbackReason:null,deviceLost:false
  };

  function rendererForcedCanvas(){
    try{return new URLSearchParams(location.search).get('renderer')==='canvas2d'}catch{return false}
  }
  function publishPerf(){
    const p=perf();
    p.webgpuSupported=state.supported;
    p.webgpuActive=state.active;
    p.webgpuFrames=state.frames;
    p.webgpuUploads=state.uploads;
    p.webgpuLastFrameMs=state.lastFrameMs;
    p.webgpuLastUploadMs=state.lastUploadMs;
    p.webgpuUploadMs=state.totalUploadMs;
    p.webgpuFallbackReason=state.fallbackReason;

    const el=document.getElementById('rendererReadout');
    if(el){
      if(state.active){
        el.textContent='Renderer: WebGPU · '+state.frames+' frame GPU · '+state.uploads+' upload';
      }else if(state.fallbackReason){
        el.textContent='Renderer: Canvas2D · fallback '+state.fallbackReason;
      }else if(state.supported){
        el.textContent='Renderer: WebGPU inizializzazione…';
      }else{
        el.textContent='Renderer: Canvas2D · WebGPU non disponibile';
      }
    }
  }
  function setActive(active,reason=null){
    state.active=!!active&&state.ready;
    state.fallbackReason=reason;
    wrap.classList.toggle('webgpu-active',state.active);
    document.documentElement.dataset.renderer=state.active?'webgpu':'canvas2d';
    publishPerf();
  }
  function destroyLayerTextures(){
    for(const rec of state.layerGpu.values()){
      try{rec.texture?.destroy()}catch{}
    }
    state.layerGpu.clear();
  }
  function fallback(reason,err=null){
    if(err)console.warn('WebGPU fallback:',reason,err);
    state.ready=false;
    state.deviceLost=reason==='device-lost';
    destroyLayerTextures();
    setActive(false,reason);
    try{invalidateSceneCache()}catch{}
    if(typeof draw==='function')requestAnimationFrame(()=>draw());
  }

  function configureCanvas(width,height,dpr=devicePixelRatio||1){
    if(!state.ready||!state.context||!gpuCanvas)return false;
    const w=Math.max(1,Math.round(width*dpr)),h=Math.max(1,Math.round(height*dpr));
    if(w===state.width&&h===state.height&&Math.abs(dpr-state.dpr)<1e-9)return true;
    state.width=w;state.height=h;state.dpr=dpr;
    gpuCanvas.width=w;gpuCanvas.height=h;
    gpuCanvas.style.width=width+'px';gpuCanvas.style.height=height+'px';
    state.context.configure({
      device:state.device,
      format:state.format,
      alphaMode:'premultiplied'
    });
    return true;
  }

  function createPipeline(){
    const shader=state.device.createShaderModule({
      label:'conquer-static-compositor-shader',
      code:`
struct VOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vsMain(@location(0) pos: vec2f, @location(1) uv: vec2f) -> VOut {
  var out: VOut;
  out.pos=vec4f(pos,0.0,1.0);
  out.uv=uv;
  return out;
}

@group(0) @binding(0) var layerSampler: sampler;
@group(0) @binding(1) var layerTexture: texture_2d<f32>;

@fragment
fn fsMain(in: VOut) -> @location(0) vec4f {
  return textureSample(layerTexture,layerSampler,in.uv);
}
`
    });

    state.pipeline=state.device.createRenderPipeline({
      label:'conquer-static-compositor',
      layout:'auto',
      vertex:{
        module:shader,
        entryPoint:'vsMain',
        buffers:[{
          arrayStride:16,
          attributes:[
            {shaderLocation:0,offset:0,format:'float32x2'},
            {shaderLocation:1,offset:8,format:'float32x2'}
          ]
        }]
      },
      fragment:{
        module:shader,
        entryPoint:'fsMain',
        targets:[{
          format:state.format,
          blend:{
            color:{srcFactor:'one',dstFactor:'one-minus-src-alpha',operation:'add'},
            alpha:{srcFactor:'one',dstFactor:'one-minus-src-alpha',operation:'add'}
          },
          writeMask:GPUColorWrite.ALL
        }]
      },
      primitive:{topology:'triangle-strip'}
    });

    state.sampler=state.device.createSampler({
      label:'conquer-static-linear-sampler',
      magFilter:'linear',minFilter:'linear',
      addressModeU:'clamp-to-edge',addressModeV:'clamp-to-edge'
    });

    state.vertexBuffer=state.device.createBuffer({
      label:'conquer-static-quad-buffer',
      size:STATIC_LAYERS.length*4*4*4,
      usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST
    });
  }

  function uploadLayer(name,entry){
    const t0=performance.now(),w=entry.canvas.width,h=entry.canvas.height;
    let rec=state.layerGpu.get(name);
    if(!rec||rec.width!==w||rec.height!==h){
      try{rec?.texture?.destroy()}catch{}
      const texture=state.device.createTexture({
        label:'conquer-'+name+'-texture',
        size:{width:w,height:h,depthOrArrayLayers:1},
        format:'rgba8unorm',
        usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT
      });
      rec={
        width:w,height:h,texture,
        view:texture.createView(),
        bindGroup:null
      };
      rec.bindGroup=state.device.createBindGroup({
        label:'conquer-'+name+'-bind-group',
        layout:state.pipeline.getBindGroupLayout(0),
        entries:[
          {binding:0,resource:state.sampler},
          {binding:1,resource:rec.view}
        ]
      });
      state.layerGpu.set(name,rec);
    }

    // Chrome/Dawn may implement external-image copies through a render path,
    // so external-source textures carry RENDER_ATTACHMENT as well as COPY_DST.
    // Keep a validation scope around the copy so a failed upload can never leave
    // the compositor "active" while sampling an all-zero texture.
    state.device.pushErrorScope('validation');
    state.device.queue.copyExternalImageToTexture(
      {source:entry.canvas,flipY:false},
      {texture:rec.texture,premultipliedAlpha:true},
      {width:w,height:h}
    );
    state.device.popErrorScope().then(err=>{
      if(err){
        console.error('CONQUER WebGPU texture upload validation failed:',name,err.message);
        fallback('texture-upload-validation',err);
      }
    });
    entry.gpuDirty=false;
    const ms=performance.now()-t0;
    state.uploads++;
    state.lastUploadMs=ms;
    state.totalUploadMs+=ms;
    return rec;
  }

  function layerRect(entry,viewport){
    const v=entry.view;if(!v)return null;
    const m=Number(v.overscan)||0;
    if(!sceneCacheZoomPreview){
      return{
        x:State.view.x-v.x-m,
        y:State.view.y-v.y-m,
        w:viewport.width+m*2,
        h:viewport.height+m*2
      };
    }
    const ratio=(Number(State.view.scale)||1)/(Number(v.scale)||1);
    return{
      x:State.view.x+(-m-v.x)*ratio,
      y:State.view.y+(-m-v.y)*ratio,
      w:(viewport.width+m*2)*ratio,
      h:(viewport.height+m*2)*ratio
    };
  }

  function quadVertices(rect,viewport,out,offset){
    const left=rect.x/viewport.width*2-1;
    const right=(rect.x+rect.w)/viewport.width*2-1;
    const top=1-rect.y/viewport.height*2;
    const bottom=1-(rect.y+rect.h)/viewport.height*2;
    const q=[
      left,top,0,0,
      right,top,1,0,
      left,bottom,0,1,
      right,bottom,1,1
    ];
    out.set(q,offset);
  }

  function renderStaticLayers(viewport=wrap.getBoundingClientRect()){
    if(!state.active||!state.ready||!state.device||!state.context)return false;
    if(!viewport.width||!viewport.height)return false;

    try{
      configureCanvas(viewport.width,viewport.height,devicePixelRatio||1);
      const records=[];
      const vertices=new Float32Array(STATIC_LAYERS.length*16);
      let vertexOffset=0;

      for(const name of STATIC_LAYERS){
        const entry=sceneCache[name];
        if(!entry?.view||!entry.canvas?.width||!entry.canvas?.height)return false;
        let rec=state.layerGpu.get(name);
        if(entry.gpuDirty||!rec||rec.width!==entry.canvas.width||rec.height!==entry.canvas.height){
          rec=uploadLayer(name,entry);
        }
        const rect=layerRect(entry,viewport);
        if(!rect)return false;
        quadVertices(rect,viewport,vertices,vertexOffset);
        records.push(rec);
        vertexOffset+=16;
      }

      const t0=performance.now();
      state.device.queue.writeBuffer(state.vertexBuffer,0,vertices);
      const encoder=state.device.createCommandEncoder({label:'conquer-static-compositor-encoder'});
      const pass=encoder.beginRenderPass({
        label:'conquer-static-compositor-pass',
        colorAttachments:[{
          view:state.context.getCurrentTexture().createView(),
          clearValue:{r:32/255,g:36/255,b:25/255,a:1},
          loadOp:'clear',storeOp:'store'
        }]
      });
      pass.setPipeline(state.pipeline);
      for(let i=0;i<records.length;i++){
        pass.setVertexBuffer(0,state.vertexBuffer,i*64,64);
        pass.setBindGroup(0,records[i].bindGroup);
        pass.draw(4,1,0,0);
      }
      pass.end();
      state.device.queue.submit([encoder.finish()]);

      state.frames++;
      state.lastFrameMs=performance.now()-t0;
      publishPerf();
      window.__conquerAnalytics?.measure('WEBGPU_FRAME',state.lastFrameMs,{
        uploads:state.uploads,layers:STATIC_LAYERS.length
      });
      return true;
    }catch(err){
      fallback('render-error',err);
      return false;
    }
  }

  async function init(){
    if(!gpuCanvas){
      state.requested=false;
      fallback('missing-canvas');
      return false;
    }
    if(rendererForcedCanvas()){
      state.requested=false;
      setActive(false,'forced-canvas2d');
      return false;
    }
    state.supported=!!navigator.gpu;
    publishPerf();
    if(!navigator.gpu){
      setActive(false,'webgpu-unavailable');
      return false;
    }

    try{
      const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
      if(!adapter){
        setActive(false,'adapter-unavailable');
        return false;
      }
      const device=await adapter.requestDevice();
      const context=gpuCanvas.getContext('webgpu');
      if(!context){
        setActive(false,'context-unavailable');
        return false;
      }

      state.adapter=adapter;
      state.device=device;
      state.context=context;
      state.format=navigator.gpu.getPreferredCanvasFormat();
      state.ready=true;
      createPipeline();
      const r=wrap.getBoundingClientRect();
      configureCanvas(r.width,r.height,devicePixelRatio||1);
      setActive(true,null);

      device.lost.then(info=>{
        console.warn('CONQUER WebGPU device lost:',info?.message||info?.reason||'unknown');
        fallback('device-lost');
      });

      for(const name of STATIC_LAYERS)if(sceneCache[name])sceneCache[name].gpuDirty=true;
      if(typeof draw==='function')requestAnimationFrame(()=>draw());
      console.info('CONQUER renderer: WebGPU hybrid compositor active');
      return true;
    }catch(err){
      fallback('init-error',err);
      return false;
    }
  }

  function resize(width,height,dpr=devicePixelRatio||1){
    if(!state.ready)return false;
    try{return configureCanvas(width,height,dpr)}
    catch(err){fallback('resize-error',err);return false}
  }

  function status(){
    return{
      requested:state.requested,supported:state.supported,ready:state.ready,active:state.active,
      format:state.format,frames:state.frames,uploads:state.uploads,
      lastFrameMs:+state.lastFrameMs.toFixed(3),
      lastUploadMs:+state.lastUploadMs.toFixed(3),
      fallbackReason:state.fallbackReason,deviceLost:state.deviceLost
    };
  }

  window.ConquerWebGPU={init,resize,renderStaticLayers,status,fallback};
  init();
})();
