export default function FormField({ label, required = false, error, hint, htmlFor, className = '', children }) {
  return (
    <div className={`form-field ${className}`.trim()}>
      {label && (
        <label className="form-label" htmlFor={htmlFor}>
          {label}
          {required && <span className="required">*</span>}
        </label>
      )}
      {children}
      {error ? <div className="form-error">{error}</div> : hint ? <div className="form-hint">{hint}</div> : null}
    </div>
  );
}
