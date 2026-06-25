const formatDateKey = (date) => date.toISOString().split('T')[0];

const ltjStartDate = "2026-04-01";
const start = new Date(ltjStartDate);
// start is 2026-04-01T00:00:00.000Z

const end = new Date("2026-04-05");

const dates = [];
const current = new Date(start);
while (current <= end) {
    dates.push(formatDateKey(current));
    current.setDate(current.getDate() + 1);
}
console.log(dates);
