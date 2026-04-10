import "./Button.css";

export default function Button({ children = "İstek Başlat", disabled = false, className = "" }) {
  return (
    <button type="submit" disabled={disabled} className={className}>
      {children}
    </button>
  );
}
