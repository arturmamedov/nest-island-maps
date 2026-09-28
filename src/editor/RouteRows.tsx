import { ROUTE_BEND } from '../shared/tokens';
import { RemoveButton, RowsHead, ShowOnButton, VisibilityToggle, type RowsProps } from './RowControls';
import { addRoute, cycleRouteEnd, cycleShowOn, remove, setBend, setVisible } from './state';

/* "Dotted routes" on the Decor tab (spec §2): toggle, From → To, bend −1…1,
   Show on, ×. Each end cycles through the visible hostels and never lands on
   the other end; a route needs two visible hostels to exist at all. */

const BEND_STEP = 0.05;

export function RouteRows({ data, onEdit }: RowsProps) {
  const labelOf = (slug: string) => data.hostels.find((h) => h.slug === slug)?.label ?? '—';
  return (
    <section className="rows-section" aria-labelledby="routes-title">
      <h3 id="routes-title" className="rows-title">
        Dotted routes
      </h3>
      {data.routes.length > 0 && <RowsHead columns={['', 'From → to', 'Bend', 'Show on', '']} decor />}
      <div className="rows">
        {data.routes.map((r) => (
          <div key={r.id} className="row row-decor" role="group" aria-label={`${labelOf(r.from)} → ${labelOf(r.to)}`} data-key={r.id}>
            <VisibilityToggle visible={r.visible} onChange={(v) => onEdit(setVisible('routes', r.id, v))} />
            <div className="route-ends">
              <button type="button" aria-label={`From: ${labelOf(r.from)}`} title="Click to change" onClick={() => onEdit(cycleRouteEnd(r.id, 'from'))}>
                {labelOf(r.from)}
              </button>
              <span aria-hidden="true">→</span>
              <button type="button" aria-label={`To: ${labelOf(r.to)}`} title="Click to change" onClick={() => onEdit(cycleRouteEnd(r.id, 'to'))}>
                {labelOf(r.to)}
              </button>
            </div>
            <input
              type="range"
              className="range"
              aria-label="Bend"
              min={ROUTE_BEND.min}
              max={ROUTE_BEND.max}
              step={BEND_STEP}
              value={r.bend}
              onChange={(e) => onEdit(setBend(r.id, Number(e.target.value)))}
            />
            <ShowOnButton showOn={r.showOn} onClick={() => onEdit(cycleShowOn('routes', r.id))} />
            <RemoveButton name={`${labelOf(r.from)} → ${labelOf(r.to)}`} onClick={() => onEdit(remove('routes', r.id))} />
          </div>
        ))}
      </div>
      <div className="rows-foot">
        <button type="button" className="btn btn-outline" onClick={() => onEdit(addRoute(), 'Route added')}>
          + Add route
        </button>
      </div>
    </section>
  );
}
