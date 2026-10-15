export function Bad({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
export function alsoBad(el: HTMLElement, html: string) {
  el.innerHTML = html;
  el.insertAdjacentHTML("beforeend", html);
  if (el.innerHTML === "") return;
}
