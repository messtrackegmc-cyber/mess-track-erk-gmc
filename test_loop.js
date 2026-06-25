const ltjStartDate = "2026-04-02"; // what if user actually selected the 2nd?
const start = new Date(ltjStartDate);
const end = new Date("2026-04-05");

const formatDateKey = (date) => {
    return date.toISOString().split('T')[0];
};

const dates = [];
const current = new Date(start);
while (current <= end) {
    dates.push(formatDateKey(current));
    current.setDate(current.getDate() + 1);
}
console.log(dates);
