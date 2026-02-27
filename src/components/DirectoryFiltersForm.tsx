import type { CountrySummary, DeviceSummary, DirectoryFilters, TagSummary } from '../lib/types';

type DirectoryFiltersFormProps = {
  filters: DirectoryFilters;
  tags: TagSummary[];
  countries: CountrySummary[];
  devices: DeviceSummary[];
};

export default function DirectoryFiltersForm({
  filters,
  tags,
  countries,
  devices,
}: DirectoryFiltersFormProps) {
  return (
    <form method="get" action="/" className="FilterForm">
      <label>
        Search
        <input
          type="search"
          name="q"
          defaultValue={filters.q || ''}
          placeholder="Search people, tags, tools…"
        />
      </label>

      <label>
        Tag
        <select name="tag" defaultValue={filters.tag || ''}>
          <option value="">All tags</option>
          {tags.map((tag) => (
            <option key={tag.slug} value={tag.slug}>
              {tag.name} ({tag.count})
            </option>
          ))}
        </select>
      </label>

      <label>
        Country
        <select name="country" defaultValue={filters.country || ''}>
          <option value="">All countries</option>
          {countries.map((country) => (
            <option key={country.emoji} value={country.emoji}>
              {country.emoji} ({country.count})
            </option>
          ))}
        </select>
      </label>

      <label>
        Device
        <select name="device" defaultValue={filters.device || ''}>
          <option value="">All devices</option>
          {devices.map((device) => (
            <option key={device.name} value={device.name}>
              {device.name} ({device.count})
            </option>
          ))}
        </select>
      </label>

      <div className="FilterActions">
        <button type="submit">Apply filters</button>
        <a href="/">Clear</a>
      </div>
    </form>
  );
}
