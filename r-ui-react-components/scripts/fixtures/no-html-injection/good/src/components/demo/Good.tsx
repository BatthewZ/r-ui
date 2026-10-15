// Never dangerouslySetInnerHTML: a comment may name what is banned.
/**
 * Nor `el.innerHTML = html` in a doc comment.
 */
export function Good({ text }: { text: string }) {
  return <p>{text}</p>;
}
export const same = (el: HTMLElement) => el.innerHTML === "";
