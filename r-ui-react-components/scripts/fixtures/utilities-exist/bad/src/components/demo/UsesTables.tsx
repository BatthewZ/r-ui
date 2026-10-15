// Uses a class-named table exported by another file: it is a class list there too.
import { TONE_CLASSES } from "./Tables";
const cn = (...parts: unknown[]) => parts.join(" ");
export const UsesTables = () => <span className={cn(TONE_CLASSES)}>a</span>;
