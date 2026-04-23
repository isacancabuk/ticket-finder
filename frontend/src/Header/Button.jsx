import styles from "./Button.module.css";

export default function Button({ children = "İstek Başlat", disabled = false }) {
  return (
    <button 
      type="submit" 
      disabled={disabled} 
      className={styles.mainButton}
    >
      {children}
    </button>
  );
}
