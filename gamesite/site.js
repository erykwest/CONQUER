'use strict';
(() => {
  const menu = document.querySelector('[data-nav-toggle]');
  const nav = document.querySelector('[data-nav]');
  if (menu && nav) menu.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    menu.setAttribute('aria-expanded', String(open));
  });
  const $ = id => document.getElementById(id);
  const status = (id, msg) => { if ($(id)) $(id).textContent = msg; };
  const sdk = async () => {
    const mod = await import('https://esm.sh/@supabase/supabase-js@2.117.1');
    return mod.createClient('https://fwpmcyxggvdtsuatovzo.supabase.co',
      'sb_publishable_-nHMiLTkFCVTMwBFOmFqfQ_oZUUybfv');
  };
  // Cookie-free aggregate metrics; the endpoint accepts only whitelisted event names.
  const metric = event => fetch('/api/gamesite-metric', {
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({event}),keepalive:true
  }).catch(() => {});
  const path = location.pathname;
  const metricForPage = path.endsWith('/gamesite/') || path.endsWith('/gamesite/index.html') ? 'home_view' :
    path.endsWith('/gamesite/game.html') ? 'game_view' :
    path.endsWith('/gamesite/play.html') ? 'play_view' :
    path.endsWith('/gamesite/media.html') ? 'media_view' :
    path.endsWith('/gamesite/follow.html') ? 'follow_view' :
    path.includes('/gamesite/devlog/') ? 'devlog_view' : null;
  if (metricForPage) metric(metricForPage);
  const account = $('accountForm');
  if (account) {
    let client;
    const connect = async () => client || (client = await sdk());
    const update = async () => {
      try {
        const s = await connect(), {data} = await s.auth.getUser();
        if (data?.user) {
          status('accountStatus', 'Signed in as ' + (data.user.email || 'CONQUER player') + '.');
          if ($('accountSignedOut')) $('accountSignedOut').hidden = true;
          if ($('accountSignedIn')) $('accountSignedIn').hidden = false;
        } else {
          status('accountStatus','Sign in with your email to use your CONQUER account on this website and in the Builder.');
          if ($('accountSignedOut')) $('accountSignedOut').hidden = false;
          if ($('accountSignedIn')) $('accountSignedIn').hidden = true;
        }
      } catch (e) { status('accountStatus','Authentication service is temporarily unavailable. Guest play still works.'); }
    };
    account.addEventListener('submit', async ev => {
      ev.preventDefault();
      const input = $('accountEmail'), button = account.querySelector('[type=submit]');
      const email = input.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return status('accountStatus','Enter a valid email address.');
      button.disabled = true; status('accountStatus','Sending sign-in link…');
      try {
        const s = await connect();
        const {error} = await s.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+'/gamesite/account.html',shouldCreateUser:true}});
        if (error) throw error;
        status('accountStatus','Check your inbox for the sign-in link.');
      } catch (e) { status('accountStatus','Unable to send a sign-in link: '+(e.message||'please try again.')); }
      finally { button.disabled = false; }
    });
    $('accountSignOut')?.addEventListener('click', async () => {
      try { const s = await connect(); const {error} = await s.auth.signOut(); if(error) throw error; await update(); }
      catch (e) { status('accountStatus','Could not sign out: '+(e.message||'try again.')); }
    });
    update();
  }
  const follow = $('followForm');
  if (follow) follow.addEventListener('submit', async ev => {
    ev.preventDefault();
    const button = follow.querySelector('[type=submit]'), consent = $('followConsent'), email = $('followEmail')?.value.trim();
    if (!consent?.checked) return status('followStatus','Please confirm your email subscription consent.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '')) return status('followStatus','Enter a valid email address.');
    button.disabled = true; status('followStatus','Requesting confirmation…');
    try {
      const response = await fetch('/api/gamesite-follow', {
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({email,consent:true,website:$('followWebsite')?.value||''})
      });
      if (!response.ok) throw Error(response.status===503 ? 'Email delivery is not configured yet.' : 'Please try again later.');
      status('followStatus','Please check your inbox for the confirmation link. You are not subscribed until you confirm.');
      follow.reset();
    } catch (e) { status('followStatus', e.message || 'Unable to submit. Try again later.'); }
    finally { button.disabled = false; }
  });
  const detectWebGL2 = () => {
    try { const canvas = document.createElement('canvas'); return !!canvas.getContext('webgl2',{failIfMajorPerformanceCaveat:true}); }
    catch { return false; }
  };
  const start = $('gameStartLink');
  if (start) start.addEventListener('click', () => { if (detectWebGL2()) metric('play_click'); });
  if (start) {
    if (!detectWebGL2()) {
      start.setAttribute('aria-disabled','true');
      start.addEventListener('click', ev => ev.preventDefault());
      status('compatibility','WebGL2 was not detected. Use a modern desktop browser with hardware acceleration enabled.');
    } else status('compatibility','WebGL2 detected. The Builder can be launched in this browser.');
  }
  $('loadPreview')?.addEventListener('click', () => {
    const frame = $('livePreview'), button = $('loadPreview');
    if (!detectWebGL2()) return status('previewStatus','WebGL2 is required for the live Builder preview.');
    if (!frame) return;
    frame.parentElement.querySelectorAll('h2,p').forEach(element => element.hidden = true);
    frame.src = '../index.html?launch=1';
    frame.hidden = false;
    button.hidden = true;
    status('previewStatus','Live game runtime loaded on request. This is not a pre-recorded screenshot.');
  });
})();