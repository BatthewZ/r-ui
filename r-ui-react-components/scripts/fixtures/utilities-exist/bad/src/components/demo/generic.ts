// A generic arrow: read as TSX, `<T>` opens a JSX element and swallows the rest of the file.
export const first = <T>(list: readonly T[]): T | undefined => list[0];
export const ROW_CLASS = "font-black";
