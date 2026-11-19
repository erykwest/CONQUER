'use strict';
// Public launch gate for the playable browser prototype.
// All selection and generated worlds are local to the current browser origin.
(function () {
  const SLOT_INDEX = 'conquer.guest.slots.v1';
  const SLOT_PATTERN = /^[a-z0-9-]{12,60}$/i;
  const BIOMES = ['plains', 'hills', 'forest', 'swamp'];
  const GUEST_SCHEMA = 2;
  const params = new URLSearchParams(location.search);
  const requested = params.get('launch') === '1';
  const safe = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const readIndex = () => {
    try { const data = JSON.parse(localStorage.getItem(SLOT_INDEX) || '[]'); return Array.isArray(data) ? data.filter(x => x && SLOT_PATTERN.test(x.id)).slice(0, 30) : []; }
    catch { return []; }
  };
  const storeIndex = slots => localStorage.setItem(SLOT_INDEX, JSON.stringify(slots.slice(0, 30)));
  const saveKey = slot => 'conquer.guest.' + slot + '.schema' + GUEST_SCHEMA + '.settlement.0.0';
  const existingSlots = () => readIndex().filter(s => { try { return !!localStorage.getItem(saveKey(s.id)); } catch { return false; } });
  const newSeed = () => { const a = new Uint32Array(1); crypto.getRandomValues(a); return (a[0] & 0x7fffffff) || 1; };
  const validSeed = text => /^\d{1,10}$/.test(text) && Number(text) >= 1 && Number(text) <= 2147483647;
  const available = () => {
    try { const canvas = document.createElement('canvas'); return !!canvas.getContext('webgl2', {failIfMajorPerformanceCaveat:true}); }
    catch { return false; }
  };
  const authClient = async () => {
    for (let n=0; n<60 && !window.__createSupabaseClient; n++) await new Promise(resolve => setTimeout(resolve, 60));
    if (!window.__createSupabaseClient) throw new Error('Sign-in service is unavailable. Guest play remains available.');
    // Shared with the existing Builder client; only a public publishable key is used.
    return window.__createSupabaseClient(SUPABASE_URL, SUPABASE_KEY);
  };
  function mount(start) {
    if (!requested) return;
    const overlay = document.createElement('div');
    overlay.id = 'conquerGameEntry';
    overlay.className = 'conquer-game-entry';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'conquerEntryTitle');
    overlay.innerHTML =
      '<main class="conquer-entry-shell">' +
        '<div class="conquer-entry-top"><span class="conquer-entry-mark">CONQUER</span><a href="./gamesite/" class="conquer-entry-link">Back to website</a></div>' +
        '<p class="conquer-entry-eyebrow">MEDIEVAL SETTLEMENT SIMULATION · EARLY PROTOTYPE</p>' +
        '<h1 id="conquerEntryTitle">A world waiting to be shaped.</h1>' +
        '<p class="conquer-entry-intro">Build a settlement, raise its walls and make the territory your own.</p>' +
        '<div class="conquer-entry-choices" id="conquerEntryChoices">' +
          '<button type="button" data-entry-tab="guest" aria-pressed="true">Play as Guest<span>Singleplayer Builder · No account needed</span></button>' +
          '<button type="button" data-entry-tab="account" aria-pressed="false">CONQUER Account<span>Sign in with email · Same identity as the website</span></button>' +
        '</div>' +
        '<section data-entry-panel="guest" class="conquer-entry-panel"><h2>New singleplayer game</h2>' +
          '<div class="conquer-entry-grid"><label>World seed<input id="guestSeed" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="10" autocomplete="off" aria-describedby="seedHelp"></label>' +
          '<label>Territory<select id="guestBiome"><option value="random">Random terrain</option><option value="plains">Plains</option><option value="hills">Hills</option><option value="forest">Forest</option><option value="swamp">Swamp</option></select></label></div>' +
          '<p id="seedHelp" class="conquer-entry-detail">The same seed and territory reproduce the same starting landscape within this generator version.</p>' +
          '<div class="conquer-entry-actions"><button type="button" id="guestRoll" class="entry-secondary">Reroll seed</button><button type="button" id="guestStart" class="entry-primary">Create world</button></div>' +
          '<div id="guestContinueArea"></div></section>' +
        '<section data-entry-panel="account" class="conquer-entry-panel" hidden><h2>Your CONQUER account</h2>' +
          '<p class="conquer-entry-detail">Your account is shared with the website. Sign-in is optional for the singleplayer prototype. Multiplayer will require an account in a future release.</p>' +
          '<label>Email address<input id="entryAccountEmail" type="email" autocomplete="email" placeholder="you@example.com" required></label>' +
          '<div class="conquer-entry-actions"><button type="button" id="entrySendLink" class="entry-primary">Email me a sign-in link</button><button type="button" id="entryAccountContinue" class="entry-secondary">Continue with current session</button></div>' +
        '</section><p id="entryMessage" class="conquer-entry-message" role="status" aria-live="polite"></p>' +
        '<footer class="conquer-entry-footer">Desktop browser with WebGL2 required · Guest saves stay in this browser · No multiplayer in Guest mode</footer>' +
      '</main>';
    document.body.appendChild(overlay);
    const $ = sel => overlay.querySelector(sel);
    const message = text => { $('#entryMessage').textContent = text; };
    $('#guestSeed').value = String(newSeed());
    const resume = () => {
      const slots = existingSlots();
      const area = $('#guestContinueArea');
      if (!slots.length) { area.innerHTML = '<p class="conquer-entry-detail">No previous guest worlds found in this browser.</p>'; return; }
      area.innerHTML = '<h3>Continue a guest world</h3><div class="conquer-entry-saves">' +
        slots.map(x => '<button type="button" class="entry-secondary" data-guest-resume="' + safe(x.id) + '">' +
          '<strong>' + safe(x.title || 'Untitled settlement') + '</strong><span>Seed ' + safe(x.seed) + ' · ' + safe(x.biome) + '</span></button>').join('') + '</div>';
      area.querySelectorAll('[data-guest-resume]').forEach(btn => btn.addEventListener('click', () => {
        const slot = slots.find(s => s.id === btn.dataset.guestResume);
        if (!slot || !available()) return message('WebGL2 is not available. Try an up-to-date desktop browser with hardware acceleration.');
        start({mode:'resume',guest:true,slot:slot.id});
        overlay.remove();
      }));
    };
    resume();
    overlay.addEventListener('keydown', e => { if (e.key !== 'Escape') e.stopPropagation(); }, true);
    overlay.querySelectorAll('[data-entry-tab]').forEach(btn => btn.addEventListener('click', () => {
      overlay.querySelectorAll('[data-entry-tab]').forEach(x => x.setAttribute('aria-pressed', String(x===btn)));
      overlay.querySelectorAll('[data-entry-panel]').forEach(x => { x.hidden = x.dataset.entryPanel !== btn.dataset.entryTab; });
      message('');
    }));
    $('#guestRoll').onclick = () => { $('#guestSeed').value = String(newSeed()); message(''); };
    $('#guestStart').onclick = () => {
      const seedString = $('#guestSeed').value.trim(), selection = $('#guestBiome').value;
      if (!validSeed(seedString)) return message('Enter a seed between 1 and 2147483647.');
      if (selection !== 'random' && !BIOMES.includes(selection)) return message('Select a supported territory.');
      if (!available()) return message('This browser cannot start the game: WebGL2 is required.');
      let slots;
      try { slots = readIndex(); localStorage.setItem('conquer.guest.storage-check','1'); localStorage.removeItem('conquer.guest.storage-check'); }
      catch { return message('Browser storage is unavailable. Enable local storage to preserve a guest world.'); }
      const id = crypto.randomUUID(), biome = selection === 'random' ? BIOMES[newSeed() % BIOMES.length] : selection;
      const record = {id,seed:Number(seedString),biome,title:'New settlement',createdAt:new Date().toISOString()};
      try { storeIndex([record, ...slots]); }
      catch { return message('Could not reserve a local save slot. Check available browser storage.'); }
      start({mode:'new',guest:true,slot:id,seed:record.seed,biome:record.biome});
      overlay.remove();
    };
    $('#entrySendLink').onclick = async () => {
      const email = $('#entryAccountEmail').value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return message('Enter a valid email address.');
      try {
        $('#entrySendLink').disabled = true; message('Sending sign-in link…');
        const client = await authClient();
        const redirect = location.origin + location.pathname + '?launch=1';
        const {error} = await client.auth.signInWithOtp({email,options:{emailRedirectTo:redirect,shouldCreateUser:true}});
        if (error) throw error;
        message('Check your email for the sign-in link.');
      } catch (error) { message('Sign-in unavailable: ' + (error?.message || 'Please try again.')); }
      finally { $('#entrySendLink').disabled = false; }
    };
    $('#entryAccountContinue').onclick = async () => {
      try {
        const client = await authClient(), {data,error} = await client.auth.getUser();
        if (error || !data?.user) return message('No active account session. Request a sign-in link first.');
        start({mode:'account',guest:false}); overlay.remove();
      } catch (error) { message(error.message || 'Account service unavailable.'); }
    };
    // Do not auto-accept an account session; keep the guest option equally prominent.
    $('#guestStart').focus();
  }
  window.ConquerGameEntry = Object.freeze({requested,mount,validSeed,saveKey});
})();
