const TONES = ['gray', 'blue', 'green', 'orange', 'red', 'purple', 'teal'];

export default function Badge({ tone = 'gray', children, dot = false }) {
  const safeTone = TONES.includes(tone) ? tone : 'gray';
  return (
    <span className={`badge badge-${safeTone}`}>
      {dot && <span className="badge-dot" aria-hidden="true" />}
      {children}
    </span>
  );
}
