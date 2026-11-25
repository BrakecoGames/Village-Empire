/* Village Empire — © 2026 Brakeco Games. All rights reserved.
   Compacte interface op telefoons (staand én liggend): zo veel mogelijk speelveld in beeld.

   - De bouwbalk is standaard ingeklapt: alleen één smalle rij met gereedschap en categorieën. Tik op een
     categorie om de gebouwen te tonen (nog eens tikken = weer inklappen). Na het kiezen van een gebouw klapt
     hij vanzelf in, zodat je de plek op de kaart goed ziet.
   - De hoogte van de bouwbalk staat in de CSS-variabele --bbh: de bouwhint en het infopaneel staan er altijd
     net boven, ook als de balk in- of uitklapt.
   - Village Charter: ingeklapt helemaal weg (de 📜-knop opent hem); de minimap is klein en standaard dicht,
     met een eigen knop in de rij rechts (js/minimap.js). */
'use strict';
(function (VE) {
  const $ = id => document.getElementById(id);
  const touch = () => VE.isMobile || Math.min(window.innerWidth, window.innerHeight) < 520;
  VE.touchUI = touch;
  const U = VE.UI.prototype;

  U.mobileInit = function () {
    if (this._mob) return;
    this._mob = true;
    const bar = $('buildBar');
    const apply = () => {
      document.body.classList.toggle('touch', touch());
      document.body.classList.toggle('short', window.innerHeight < 520);
      this.updateBbh();
    };
    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', () => setTimeout(apply, 250));
    if (touch()) bar.classList.add('collapsed');
    // categorie aantikken: uitklappen; dezelfde categorie nog eens: inklappen (vóór de gewone afhandeling)
    $('tabs').addEventListener('click', e => {
      if (!touch()) return;
      const t = e.target.closest('.tab'); if (!t) return;
      if (t.dataset.cat === this.cat && !bar.classList.contains('collapsed')) { bar.classList.add('collapsed'); e.stopPropagation(); VE.audio.play('click'); this.updateBbh(); return; }
      bar.classList.remove('collapsed');
      setTimeout(() => this.updateBbh(), 0);
    }, true);
    // de hoogte van de balk volgen (in- en uitklappen, draaien van het scherm)
    if (window.ResizeObserver) new ResizeObserver(() => this.updateBbh()).observe(bar);
    apply();
  };
  U.updateBbh = function () {
    const bar = $('buildBar'); if (!bar) return;
    const r = bar.getBoundingClientRect();
    const h = Math.max(0, window.innerHeight - r.top);
    document.documentElement.style.setProperty('--bbh', Math.round(h) + 'px');
  };
  // gebouw gekozen: balk inklappen zodat de kaart vrij is (de bouwhint blijft zichtbaar)
  const setTool0 = U.setTool;
  U.setTool = function (t) {
    setTool0.call(this, t);
    if (t && touch() && VE.DEFS[t]) { $('buildBar').classList.add('collapsed'); this.updateBbh(); }
  };
  // telefoon: geen uitlegkaartje over de kaart bij het kiezen van een gebouw (de bouwhint en de kaart tonen de kosten al)
  const showDef0 = U.showInfoDef;
  U.showInfoDef = function (k) { if (touch()) { this.hideInfo(); return; } return showDef0.call(this, k); };
  const update0 = U.update;
  U.update = function (dt) { this.mobileInit(); update0.call(this, dt); };
})(window.VE);
