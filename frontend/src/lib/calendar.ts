export const businessToday = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

export function validDate(day: unknown): day is string {
  return typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day)
    && !day.startsWith('0000-')
    && Number.isFinite(Date.parse(day)) && new Date(day).toISOString().slice(0, 10) === day;
}
