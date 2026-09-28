import styles from "./Contact.module.css";

const CONTACTS = ["Contato 1", "Contato 2", "Contato 3", "Contato 4"];

export function Contact() {
  return (
    <section id="contato" className={styles.contact}>
      <div className="container">
        <h2 className="type-title">CONTATO</h2>
        <ul className={styles.list}>
          {CONTACTS.map((contact) => (
            <li key={contact} className="type-body">
              {contact}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
