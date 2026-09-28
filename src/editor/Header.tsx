import { TAB_LABELS, TABS } from '../shared/ids';
import { ISLAND_LIST } from '../shared/islands';
import type { IslandData, IslandId } from '../shared/schema';

/* The island switcher and the list tabs (spec §2): Hostels and Things to do
   are the two maps, Decor holds the icons and routes both maps share. Each
   tab shows how many of its items are visible, as the prototype did. */

export type Tab = (typeof TABS)[number];

type HeaderProps = {
  island: IslandId;
  tab: Tab;
  data: IslandData;
  onIsland: (island: IslandId) => void;
  onTab: (tab: Tab) => void;
};

// Each tab is named after the list it shows.
const visibleCount = (data: IslandData, tab: Tab) => (data[tab] as readonly { visible: boolean }[]).filter((i) => i.visible).length;

export function Header({ island, tab, data, onIsland, onTab }: HeaderProps) {
  return (
    <header className="header">
      <h1 className="title">Nest Island Maps</h1>

      <div className="segmented" role="tablist" aria-label="Island">
        {ISLAND_LIST.map((i) => (
          <button key={i.id} type="button" role="tab" aria-selected={i.id === island} onClick={() => onIsland(i.id)}>
            {i.name}
          </button>
        ))}
      </div>

      <div className="tabs" role="tablist" aria-label="Map">
        {TABS.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={t === tab} onClick={() => onTab(t)}>
            {TAB_LABELS[t]} · {visibleCount(data, t)}
          </button>
        ))}
      </div>
    </header>
  );
}
