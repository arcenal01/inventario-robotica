"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Input } from "@/components/ui/input";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { esquemaCadastro, type DadosCadastro, type EntradaCadastro } from "./schemas";
import { traduzirErroAuth } from "./mensagens-erro";

export function FormularioCadastro() {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [confirmarEmail, setConfirmarEmail] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EntradaCadastro, unknown, DadosCadastro>({
    resolver: zodResolver(esquemaCadastro),
    defaultValues: { nome: "", email: "", turma: "", senha: "", confirmarSenha: "" },
  });

  async function aoEnviar(dados: DadosCadastro) {
    setErro(null);
    try {
      const supabase = criarClienteNavegador();
      // Nome e turma vão nos metadados; o banco cria o perfil (aluno, pendente) por trigger.
      // Ninguém consegue se cadastrar como professor/admin por aqui.
      const { data, error } = await supabase.auth.signUp({
        email: dados.email,
        password: dados.senha,
        options: { data: { nome: dados.nome, turma: dados.turma } },
      });
      if (error) {
        setErro(traduzirErroAuth(error.message));
        return;
      }
      // Com confirmação de e-mail ligada, e-mail repetido volta sem erro e sem identidades.
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        setErro("Este e-mail já está cadastrado.");
        return;
      }
      if (!data.session) {
        // Confirmação de e-mail ligada (comum na nuvem): ainda não há sessão.
        setConfirmarEmail(true);
        return;
      }
      router.replace("/aguardando-aprovacao");
      router.refresh();
    } catch (e) {
      setErro(traduzirErroAuth(e instanceof Error ? e.message : ""));
    }
  }

  if (confirmarEmail) {
    return (
      <div className="space-y-4">
        <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">
          Cadastro criado! Enviamos um e-mail de confirmação. Confirme e depois entre no sistema.
        </p>
        <Link href="/entrar" className="block text-center text-sm font-medium text-primary hover:underline">
          Ir para o login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(aoEnviar)} className="space-y-4" noValidate>
      <Campo id="nome" rotulo="Nome completo" erro={errors.nome?.message}>
        <Input id="nome" autoComplete="name" {...register("nome")} />
      </Campo>
      <Campo id="email" rotulo="E-mail" erro={errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" inputMode="email" {...register("email")} />
      </Campo>
      <Campo id="turma" rotulo="Turma (opcional, ex.: 2º A)" erro={errors.turma?.message}>
        <Input id="turma" autoComplete="off" {...register("turma")} />
      </Campo>
      <Campo id="senha" rotulo="Senha (mínimo 8 caracteres)" erro={errors.senha?.message}>
        <Input id="senha" type="password" autoComplete="new-password" {...register("senha")} />
      </Campo>
      <Campo id="confirmarSenha" rotulo="Repita a senha" erro={errors.confirmarSenha?.message}>
        <Input id="confirmarSenha" type="password" autoComplete="new-password" {...register("confirmarSenha")} />
      </Campo>

      {erro ? (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {erro}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Enviando..." : "Criar conta"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link href="/entrar" className="font-medium text-primary underline-offset-4 hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}
