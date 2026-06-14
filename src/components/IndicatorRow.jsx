export default function IndicatorRow({ label, value, good }) {
  return (
    <div>
      <span>{label}</span>
      <b className={good === true ? "positive" : good === false ? "negative" : "neutral"}>{value}</b>
    </div>
  );
}
