import styles from "./Input.module.css";

export default function Input({ type = "text", name, placeholder, required = true }) {
  return (
    <div className={styles.inputGroup}>
      <input type={type} id={name} name={name} required={required} placeholder=" " />
      <label htmlFor={name}>{placeholder}</label>
    </div>
  );
}
