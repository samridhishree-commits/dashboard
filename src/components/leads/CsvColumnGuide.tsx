export const CSV_REQUIRED_COLUMNS = [
  {
    name: 'phone_number',
    aliases: 'phone, mobile',
    hint: 'Indian mobile: 10 digits starting 6–9, or 91…',
  },
] as const

export const CSV_OPTIONAL_COLUMNS = [
  { name: 'first_name', hint: 'Defaults to “Lead” if missing' },
  { name: 'last_name', hint: 'Or use a single name / full_name column' },
  { name: 'email', hint: 'Stored in CRM' },
  { name: 'city', hint: '' },
  { name: 'state', hint: '' },
  { name: 'course', hint: 'Overridden by campaign course on upload' },
  { name: 'source', hint: 'Also accepts lead_origin' },
  { name: 'lead_id', hint: 'Your sheet ID — display only, not sent to Convin' },
] as const

type CsvColumnGuideProps = {
  compact?: boolean
}

export function CsvColumnGuide({ compact = false }: CsvColumnGuideProps) {
  return (
    <div className={`csv-guide ${compact ? 'csv-guide--compact' : ''}`}>
      <p className="csv-guide-intro">
        First row must be column headers. Only <strong>phone_number</strong> is required to import
        and run.
      </p>
      <div className="csv-guide-groups">
        <div className="csv-guide-group">
          <h4>
            Required <span className="csv-req-badge">Mandatory</span>
          </h4>
          <ul>
            {CSV_REQUIRED_COLUMNS.map((col) => (
              <li key={col.name}>
                <code>{col.name}</code>
                <span>{col.hint}</span>
                {col.aliases ? <em>also: {col.aliases}</em> : null}
              </li>
            ))}
          </ul>
        </div>
        <div className="csv-guide-group">
          <h4>
            Optional <span className="csv-opt-badge">Not required</span>
          </h4>
          <ul>
            {CSV_OPTIONAL_COLUMNS.map((col) => (
              <li key={col.name}>
                <code>{col.name}</code>
                {col.hint ? <span>{col.hint}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
