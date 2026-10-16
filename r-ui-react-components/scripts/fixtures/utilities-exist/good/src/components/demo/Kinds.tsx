// "Classes" in the ordinary sense: kinds of error, used as data, never as a
// class list. A class-named TABLE that no file uses as classes holds labels.
export const ERROR_CLASSES = ["5xx server", "4xx client", "Timeouts"] as const;
export const errorSeries = ERROR_CLASSES.map((name, i) => ({ name, slot: i + 1 }));
// The same word, unexported, as chart categories.
const classes = ["Rate limited", "Timeouts"];
export const categories = classes.map((name) => name.length);
