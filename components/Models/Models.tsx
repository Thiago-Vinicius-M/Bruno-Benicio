import styles from "./Models.module.css";

const MODELS = ["Bar - Pub - Boate - Restaurante", "Eventos particulares"];

export function Models() {
  return (
    <section id="modelos" className={styles.models}>
      <div className="container">
        <p className="type-editorial">EAI, GOSTOU?</p>
        <p className="type-body">
          Agora que você já conhece um pouco dos Pretin mais amados do Brasil, chegou a hora de
          escolher o formato que mais combina com a sua festa.
        </p>
        <h2 className={`type-title ${styles.title}`}>MODELOS</h2>
        <ul className={styles.list}>
          {MODELS.map((model) => (
            <li key={model}>
              <figure>
                <div className={styles.frame} />
                <figcaption className={`type-caption ${styles.caption}`}>{model}</figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
