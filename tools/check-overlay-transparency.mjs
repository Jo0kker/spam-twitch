import http from 'node:http';

// Manual browser check using the default color scheme of the Twitch supervisor.
// Both light and dark background patterns must remain visible through the overlay.
const html = `<!doctype html><html lang="fr"><meta charset="utf-8"><title>SPAM · Contrôle de transparence</title>
<style>body{font:18px system-ui;background:#eee;color:#111;margin:24px}main{display:flex;gap:24px}.test{flex:1}h2{font-size:20px}.pattern{height:480px;position:relative;background:repeating-conic-gradient(#11b9c4 0% 25%,#f6c24d 0% 50%) 50% / 120px 120px;border:3px solid #222}iframe{position:absolute;inset:0;width:100%;height:100%;border:0}.dark .pattern{background:repeating-conic-gradient(#164454 0% 25%,#5b6840 0% 50%) 50% / 120px 120px}</style>
<h1>La grille doit rester visible derrière chaque overlay</h1><main><section class="test"><h2>Hôte clair</h2><div class="pattern"><iframe title="Overlay sur hôte clair" src="http://127.0.0.1:8787/extension/video_overlay.html"></iframe></div></section><section class="test dark"><h2>Hôte sombre</h2><div class="pattern"><iframe title="Overlay sur hôte sombre" src="http://127.0.0.1:8787/extension/video_overlay.html"></iframe></div></section></main></html>`;
http.createServer((request, response) => { response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(html); }).listen(8790, '127.0.0.1', () => console.log('Transparency check: http://127.0.0.1:8790'));
