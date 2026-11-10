// Testes dos schemas de validação (rodam com: npm test). Não precisam de banco nem de navegador.
import test from "node:test";
import assert from "node:assert/strict";
import { esquemaEntrar, esquemaCadastro } from "../src/features/auth/schemas.ts";
import { esquemaAlteracaoPerfil } from "../src/features/usuarios/schemas.ts";
import { traduzirErroAuth } from "../src/features/auth/mensagens-erro.ts";

const cadastroValido = {
  nome: "Maria Silva",
  email: "maria@escola.pr.gov.br",
  senha: "Senha@1234",
  confirmarSenha: "Senha@1234",
};

test("entrar: aceita e-mail e senha", () => {
  assert.equal(esquemaEntrar.safeParse({ email: "a@b.co", senha: "x" }).success, true);
});

test("entrar: recusa e-mail inválido e senha vazia", () => {
  assert.equal(esquemaEntrar.safeParse({ email: "nao-e-email", senha: "x" }).success, false);
  assert.equal(esquemaEntrar.safeParse({ email: "a@b.co", senha: "" }).success, false);
});

test("entrar: remove espaços do e-mail", () => {
  const r = esquemaEntrar.parse({ email: "  a@b.co ", senha: "x" });
  assert.equal(r.email, "a@b.co");
});

test("cadastro: aceita dados válidos", () => {
  assert.equal(esquemaCadastro.safeParse(cadastroValido).success, true);
});

test("cadastro: recusa senha curta", () => {
  const r = esquemaCadastro.safeParse({ ...cadastroValido, senha: "1234567", confirmarSenha: "1234567" });
  assert.equal(r.success, false);
});

test("cadastro: recusa senhas diferentes e aponta o campo certo", () => {
  const r = esquemaCadastro.safeParse({ ...cadastroValido, confirmarSenha: "outra-senha" });
  assert.equal(r.success, false);
  assert.deepEqual(r.error.issues[0].path, ["confirmarSenha"]);
});

test("cadastro: recusa nome curto", () => {
  assert.equal(esquemaCadastro.safeParse({ ...cadastroValido, nome: "Al" }).success, false);
});

test("cadastro: turma é opcional, sem espaços e vazia vira undefined", () => {
  assert.equal(esquemaCadastro.parse(cadastroValido).turma, undefined);
  assert.equal(esquemaCadastro.parse({ ...cadastroValido, turma: "  2º A  " }).turma, "2º A");
  assert.equal(esquemaCadastro.parse({ ...cadastroValido, turma: "   " }).turma, undefined);
  assert.equal(esquemaCadastro.safeParse({ ...cadastroValido, turma: "x".repeat(31) }).success, false);
});

test("usuários: aceita alteração de status e de perfil", () => {
  assert.equal(esquemaAlteracaoPerfil.safeParse({ status_cadastro: "aprovado" }).success, true);
  assert.equal(esquemaAlteracaoPerfil.safeParse({ status_cadastro: "aprovado", perfil: "professor" }).success, true);
});

test("usuários: recusa valores fora dos enums, vazio e campos extras", () => {
  assert.equal(esquemaAlteracaoPerfil.safeParse({ perfil: "superadmin" }).success, false);
  assert.equal(esquemaAlteracaoPerfil.safeParse({}).success, false);
  assert.equal(esquemaAlteracaoPerfil.safeParse({ email: "x@y.z", perfil: "aluno" }).success, false);
});

test("mensagens de erro do Auth são traduzidas", () => {
  assert.equal(traduzirErroAuth("Invalid login credentials"), "E-mail ou senha incorretos.");
  assert.match(traduzirErroAuth("Failed to fetch"), /Sem conexão/);
  assert.match(traduzirErroAuth("algo desconhecido"), /Tente de novo/);
});
