// A bare word is a class only in a class context: the hoisted class is reported, the word list is not.
const COMMON = ["shadow", "rounded", "dragon"];
const RAISED = "shadow";
export const isCommon = (word: string) => COMMON.includes(word);
export const Raised = () => <div className={RAISED} />;
