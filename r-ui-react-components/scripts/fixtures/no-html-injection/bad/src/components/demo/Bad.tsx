export function Bad({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
export function alsoBad(el: HTMLElement, html: string) {
  el.innerHTML = html;
  el.insertAdjacentHTML("beforeend", html);
  if (el.innerHTML === "") return;
  el["outerHTML"] = html;
}
export function more(el: HTMLElement, html: string) {
  el.outerHTML = html;
  el.innerHTML += html;
  return document.createRange().createContextualFragment(html);
}
