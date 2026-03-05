export default function Tooltip({ text, children }) {
  if (!text) return children;
  return (
    <span className="tooltip-wrap">
      {children}
      <span className="tooltip-icon">?</span>
      <span className="tooltip-text">{text}</span>
    </span>
  );
}
