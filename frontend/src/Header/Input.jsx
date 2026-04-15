import { forwardRef } from "react";
import styles from "./Input.module.css";

const Input = forwardRef(function Input({ type = "text", name, placeholder, required = true, ...rest }, ref) {
  return (
    <div className={styles.inputGroup}>
      <input ref={ref} type={type} id={name} name={name} required={required} placeholder=" " {...rest} />
      <label htmlFor={name}>{placeholder}</label>
    </div>
  );
});

export default Input;
