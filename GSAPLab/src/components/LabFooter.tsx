export function LabFooter() {
  return (
    <footer className="lab-footer">
      <div className="wrap lab-footer__grid">
        <div>
          <h2>GSAP Scroll Lab</h2>
          <p>
            Projeto de estudo. Para adicionar o exemplo 11, crie <code>src/examples/example11-…/</code> e registre-o em{" "}
            <code>src/lab/registry.ts</code>. O passo a passo está no <code>README.md</code>.
          </p>
        </div>
        <div>
          <h2>Documentação oficial</h2>
          <ul>
            <li>
              <a href="https://gsap.com/docs/v3/Plugins/ScrollTrigger/" target="_blank" rel="noreferrer">
                ScrollTrigger
              </a>
            </li>
            <li>
              <a href="https://gsap.com/docs/v3/GSAP/Timeline" target="_blank" rel="noreferrer">
                Timeline
              </a>
            </li>
            <li>
              <a href="https://gsap.com/resources/position-parameter/" target="_blank" rel="noreferrer">
                Position parameter
              </a>
            </li>
            <li>
              <a href="https://gsap.com/docs/v3/GSAP/gsap.matchMedia()" target="_blank" rel="noreferrer">
                gsap.matchMedia()
              </a>
            </li>
            <li>
              <a href="https://gsap.com/resources/React/" target="_blank" rel="noreferrer">
                GSAP + React (useGSAP)
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h2>Créditos de mídia</h2>
          <ul>
            <li>Fotos: Unsplash (via picsum.photos) — Licença Unsplash.</li>
            <li>Vídeo da flor: MDN Web Docs — CC0.</li>
            <li>
              Trechos de <em>Sintel</em> © Blender Foundation —{" "}
              <a href="https://durian.blender.org/" target="_blank" rel="noreferrer">
                durian.blender.org
              </a>{" "}
              — CC BY 3.0.
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
