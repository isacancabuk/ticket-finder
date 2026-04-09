import "./Button.css";

export default function Button({ children = "Start Query", disabled = false }) {
  return (
    <button type="submit" disabled={disabled}>
      {children}
    </button>
  );
}
