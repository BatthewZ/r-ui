import { Button } from "../components/base";

export const cn = (...parts: string[]) => parts.join(" ") || String(Button);
