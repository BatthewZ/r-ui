// Uses class-named tables exported by another file, one under an alias: they are class lists there too.
import { SIZE_CLASSES as sizes, TONE_CLASSES } from "./Tables";
const cn = (...parts: unknown[]) => parts.join(" ");
export const UsesTables = () => <span className={cn(TONE_CLASSES, sizes)}>a</span>;
