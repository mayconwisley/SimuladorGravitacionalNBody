import Icon from './Icons.jsx';
import { pageWindow } from './galleryPaging.mjs';

// Page navigation for the scenario gallery; `onChange` receives a 1-based page number.
export default function Pagination({ page, pageCount, onChange }) {
  if (pageCount <= 1) return null;
  return <nav className="pagination" aria-label="Páginas de simulações">
    <button type="button" className="page-button page-step" disabled={page <= 1} onClick={() => onChange(page - 1)}
      aria-label="Página anterior"><Icon name="chevronLeft" size={16} /><span>Anterior</span></button>
    <div className="page-numbers">
      {pageWindow(page, pageCount).map((value, index) => value === null
        ? <span key={`gap-${index}`} className="page-gap" aria-hidden="true">…</span>
        : <button type="button" key={value} className={`page-button${value === page ? ' active' : ''}`}
          aria-current={value === page ? 'page' : undefined} aria-label={`Página ${value}`}
          onClick={() => onChange(value)}>{value}</button>)}
    </div>
    <button type="button" className="page-button page-step" disabled={page >= pageCount} onClick={() => onChange(page + 1)}
      aria-label="Próxima página"><span>Próxima</span><Icon name="chevronRight" size={16} /></button>
  </nav>;
}
