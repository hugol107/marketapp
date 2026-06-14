export default function PortfolioPie({ segments }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  let current = 0;
  const gradientStops = segments
    .map((segment) => {
      const start = (current / total) * 100;
      current += segment.value;
      const end = (current / total) * 100;
      return `${segment.color} ${start}% ${end}%`;
    })
    .join(", ");

  return (
    <div className="portfolio-pie-wrap">
      <div className="portfolio-pie" style={{ background: `conic-gradient(${gradientStops})` }}>
        <div className="portfolio-pie-inner">
          <span>Target</span>
          <b>100%</b>
        </div>
      </div>

      <div className="portfolio-legend">
        {segments.map((segment) => (
          <div className="legend-row" key={segment.label}>
            <div className="legend-left">
              <span className="legend-dot" style={{ background: segment.color }} />
              <span>{segment.label}</span>
            </div>
            <b>{segment.value}%</b>
          </div>
        ))}
      </div>
    </div>
  );
}
