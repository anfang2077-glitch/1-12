export default function Loading({ text = '加载中…', full = false }) {
  return (
    <div className={full ? 'loading loading-full' : 'loading'}>
      <span className="spinner" aria-hidden="true" />
      <span className="loading-text">{text}</span>
    </div>
  );
}
