// Tema claro/escuro. A escolha fica no aparelho (localStorage); o padrão é o escuro.

export type Tema = "escuro" | "claro";
export const CHAVE_TEMA = "tema";

/** Roda no <head> antes da página aparecer, para não piscar o tema errado. */
export const SCRIPT_TEMA = `try{if(localStorage.getItem("${CHAVE_TEMA}")==="claro")document.documentElement.classList.remove("dark")}catch(e){}`;

export function aplicarTema(tema: Tema) {
  const html = document.documentElement;
  // troca todas as cores de uma vez (sem transição); libera as transições dois quadros depois
  html.classList.add("trocando-tema");
  html.classList.toggle("dark", tema === "escuro");
  requestAnimationFrame(() => requestAnimationFrame(() => html.classList.remove("trocando-tema")));
  try {
    localStorage.setItem(CHAVE_TEMA, tema);
  } catch {
    // modo privado sem armazenamento: vale só nesta aba
  }
}
