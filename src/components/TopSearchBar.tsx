import type { StationBase } from '../types'

type TopSearchBarProps = {
  query: string
  results: StationBase[]
  onChangeQuery: (query: string) => void
  onPickStation: (stationId: string) => void
}

export function TopSearchBar(props: TopSearchBarProps) {
  const { query, results, onChangeQuery, onPickStation } = props

  return (
    <div className="search-shell">
      <div className="search-card">
        <span className="search-card__icon">搜</span>
        <input
          aria-label="搜索站点或线路"
          className="search-card__input"
          onChange={(event) => onChangeQuery(event.target.value)}
          placeholder="搜索东京车站或线路"
          value={query}
        />
        {query ? (
          <button
            className="search-card__clear"
            onClick={() => onChangeQuery('')}
            type="button"
          >
            清除
          </button>
        ) : null}
      </div>

      {query ? (
        <div className="search-results">
          {results.length ? (
            results.map((station) => (
              <button
                className="search-results__item"
                key={station.id}
                onClick={() => onPickStation(station.id)}
                type="button"
              >
                <strong>{station.name}</strong>
                <span>{station.lines.join(' / ')}</span>
              </button>
            ))
          ) : (
            <div className="search-results__empty">没有匹配到站点或线路。</div>
          )}
        </div>
      ) : null}
    </div>
  )
}
