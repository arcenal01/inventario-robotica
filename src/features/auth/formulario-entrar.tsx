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
import { esquemaEntrar, type DadosEntrar } from "./schemas";
import { traduzirErroAuth } from "./mensagens-erro";

export function FormularioEntrar() {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DadosEntrar>({
    resolver: zodResolver(esquemaEntrar),
    defaultValues: { email: "", senha: "" },
  });

  async function aoEnviar(dados: DadosEntrar) {
    setErro(null);
    try {
      const supabase = criarClienteNavegador();
      const { error } = await supabase.auth.signInWithPassword({ email: dados.email, password: dados.senha });
      if (error) {
        setErro(traduzirErroAuth(error.message));
        return;
      }
      router.replace("/");
      router.refresh();
    } catch (e) {
      setErro(traduzirErroAuth(e instanceof Error ? e.message : ""));
    }
  }

  return (
    <form onSubmit={handleSubmit(aoEnviar)} className="space-y-4" noValidate>
      <Campo id="email" rotulo="E-mail" erro={errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" inputMode="email" {...register("email")} />
      </Campo>
      <Campo id="senha" rotulo="Senha" erro={errors.senha?.message}>
        <Input id="senha" type="password" autoComplete="current-password" {...register("senha")} />
      </Campo>

      {erro ? (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {erro}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Entrando..." : "Entrar"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="font-medium text-primary underline-offset-4 hover:underline">
          Cadastre-se
        </Link>
      </p>
    </form>
  );
}
