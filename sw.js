const CACHE='flowstock-shell-v30-recovery-3';
const ASSETS=['./','./index.html','./app.css','./js/app.js','./js/demo-data.js','./js/config.js','./js/supabase-client.js','./js/live-data.js','./rf/','./rf/index.html','./rf/rf.css','./rf/rf.js'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',e=>{if(e.request.method==='GET')e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));});
