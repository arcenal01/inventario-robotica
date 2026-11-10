// ARQUIVO GERADO: não edite à mão. Para atualizar depois de mudar o banco, rode: npm run db:tipos


export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "auditoria": {
                  Row: {
                    "acao": string,"criado_em": string,"dados_antes": Json | null,"dados_depois": Json | null,"id": number,"registro_id": string | null,"tabela": string,"usuario_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "acao": string,"criado_em"?: string,"dados_antes"?: Json | null,"dados_depois"?: Json | null,"id"?: never,"registro_id"?: string | null,"tabela": string,"usuario_id"?: string | null
                  }
                  Update: {
                    "acao"?: string,"criado_em"?: string,"dados_antes"?: Json | null,"dados_depois"?: Json | null,"id"?: never,"registro_id"?: string | null,"tabela"?: string,"usuario_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "auditoria_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    }
                  ]
                },"categorias": {
                  Row: {
                    "ativa": boolean,"criado_em": string,"id": string,"nome": string,"prefixo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ativa"?: boolean,"criado_em"?: string,"id"?: string,"nome": string,"prefixo": string
                  }
                  Update: {
                    "ativa"?: boolean,"criado_em"?: string,"id"?: string,"nome"?: string,"prefixo"?: string
                  }
                  Relationships: [
                    
                  ]
                },"contadores_codigo": {
                  Row: {
                    "ano": number,"prefixo": string,"ultimo": number
                  }
                  ComputedFields: never
                  Insert: {
                    "ano": number,"prefixo": string,"ultimo"?: number
                  }
                  Update: {
                    "ano"?: number,"prefixo"?: string,"ultimo"?: number
                  }
                  Relationships: [
                    
                  ]
                },"contagem_itens": {
                  Row: {
                    "ajuste_movimentacao_id": string | null,"chave_idempotencia": string,"contado_em": string,"contado_por": string | null,"contagem_id": string,"divergencia": number,"emprestado_em_aberto": number,"endereco_id": string,"id": string,"item_id": string,"nao_listado": boolean,"quantidade_contada": number,"quantidade_sistema": number,"recontagem_pendente": boolean,"rodada": number
                  }
                  ComputedFields: never
                  Insert: {
                    "ajuste_movimentacao_id"?: string | null,"chave_idempotencia": string,"contado_em"?: string,"contado_por"?: string | null,"contagem_id": string,"divergencia": number,"emprestado_em_aberto"?: number,"endereco_id": string,"id"?: string,"item_id": string,"nao_listado"?: boolean,"quantidade_contada": number,"quantidade_sistema": number,"recontagem_pendente"?: boolean,"rodada"?: number
                  }
                  Update: {
                    "ajuste_movimentacao_id"?: string | null,"chave_idempotencia"?: string,"contado_em"?: string,"contado_por"?: string | null,"contagem_id"?: string,"divergencia"?: number,"emprestado_em_aberto"?: number,"endereco_id"?: string,"id"?: string,"item_id"?: string,"nao_listado"?: boolean,"quantidade_contada"?: number,"quantidade_sistema"?: number,"recontagem_pendente"?: boolean,"rodada"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "contagem_itens_ajuste_movimentacao_id_fkey"
      columns: ["ajuste_movimentacao_id"]
isOneToOne: false
      referencedRelation: "movimentacoes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contagem_itens_contado_por_fkey"
      columns: ["contado_por"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contagem_itens_contagem_id_fkey"
      columns: ["contagem_id"]
isOneToOne: false
      referencedRelation: "contagens"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contagem_itens_endereco_id_fkey"
      columns: ["endereco_id"]
isOneToOne: false
      referencedRelation: "enderecos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contagem_itens_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "itens"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contagem_itens_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "vw_itens_estoque"
      referencedColumns: ["id"]
    }
                  ]
                },"contagens": {
                  Row: {
                    "aberta_por": string,"aprovada_em": string | null,"aprovada_por": string | null,"atualizado_em": string,"categoria_id": string | null,"codigo": string,"criado_em": string,"endereco_id": string | null,"escopo": Database["public"]['Enums']["escopo_contagem"],"id": string,"observacao": string | null,"status": Database["public"]['Enums']["status_contagem"]
                  }
                  ComputedFields: never
                  Insert: {
                    "aberta_por": string,"aprovada_em"?: string | null,"aprovada_por"?: string | null,"atualizado_em"?: string,"categoria_id"?: string | null,"codigo"?: string,"criado_em"?: string,"endereco_id"?: string | null,"escopo": Database["public"]['Enums']["escopo_contagem"],"id"?: string,"observacao"?: string | null,"status"?: Database["public"]['Enums']["status_contagem"]
                  }
                  Update: {
                    "aberta_por"?: string,"aprovada_em"?: string | null,"aprovada_por"?: string | null,"atualizado_em"?: string,"categoria_id"?: string | null,"codigo"?: string,"criado_em"?: string,"endereco_id"?: string | null,"escopo"?: Database["public"]['Enums']["escopo_contagem"],"id"?: string,"observacao"?: string | null,"status"?: Database["public"]['Enums']["status_contagem"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "contagens_aberta_por_fkey"
      columns: ["aberta_por"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contagens_aprovada_por_fkey"
      columns: ["aprovada_por"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contagens_categoria_id_fkey"
      columns: ["categoria_id"]
isOneToOne: false
      referencedRelation: "categorias"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contagens_endereco_id_fkey"
      columns: ["endereco_id"]
isOneToOne: false
      referencedRelation: "enderecos"
      referencedColumns: ["id"]
    }
                  ]
                },"emprestimo_perdas": {
                  Row: {
                    "chave_idempotencia": string,"criado_em": string,"emprestimo_id": string,"id": string,"motivo": string,"quantidade": number,"registrado_por": string
                  }
                  ComputedFields: never
                  Insert: {
                    "chave_idempotencia": string,"criado_em"?: string,"emprestimo_id": string,"id"?: string,"motivo": string,"quantidade": number,"registrado_por": string
                  }
                  Update: {
                    "chave_idempotencia"?: string,"criado_em"?: string,"emprestimo_id"?: string,"id"?: string,"motivo"?: string,"quantidade"?: number,"registrado_por"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "emprestimo_perdas_emprestimo_id_fkey"
      columns: ["emprestimo_id"]
isOneToOne: false
      referencedRelation: "emprestimos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "emprestimo_perdas_emprestimo_id_fkey"
      columns: ["emprestimo_id"]
isOneToOne: false
      referencedRelation: "vw_emprestimos_abertos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "emprestimo_perdas_emprestimo_id_fkey"
      columns: ["emprestimo_id"]
isOneToOne: false
      referencedRelation: "vw_emprestimos_atrasados"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "emprestimo_perdas_registrado_por_fkey"
      columns: ["registrado_por"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    }
                  ]
                },"emprestimos": {
                  Row: {
                    "atualizado_em": string,"baixado_por": string | null,"criado_em": string,"emprestado_em": string,"emprestado_para": string,"endereco_origem_id": string,"id": string,"item_id": string,"observacao": string | null,"prazo_previsto": string | null,"quantidade": number,"quantidade_devolvida": number,"quantidade_perdida": number,"registrado_por": string,"status": Database["public"]['Enums']["status_emprestimo"]
                  }
                  ComputedFields: never
                  Insert: {
                    "atualizado_em"?: string,"baixado_por"?: string | null,"criado_em"?: string,"emprestado_em"?: string,"emprestado_para": string,"endereco_origem_id": string,"id"?: string,"item_id": string,"observacao"?: string | null,"prazo_previsto"?: string | null,"quantidade": number,"quantidade_devolvida"?: number,"quantidade_perdida"?: number,"registrado_por": string,"status"?: Database["public"]['Enums']["status_emprestimo"]
                  }
                  Update: {
                    "atualizado_em"?: string,"baixado_por"?: string | null,"criado_em"?: string,"emprestado_em"?: string,"emprestado_para"?: string,"endereco_origem_id"?: string,"id"?: string,"item_id"?: string,"observacao"?: string | null,"prazo_previsto"?: string | null,"quantidade"?: number,"quantidade_devolvida"?: number,"quantidade_perdida"?: number,"registrado_por"?: string,"status"?: Database["public"]['Enums']["status_emprestimo"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "emprestimos_baixado_por_fkey"
      columns: ["baixado_por"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "emprestimos_emprestado_para_fkey"
      columns: ["emprestado_para"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "emprestimos_endereco_origem_id_fkey"
      columns: ["endereco_origem_id"]
isOneToOne: false
      referencedRelation: "enderecos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "emprestimos_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "itens"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "emprestimos_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "vw_itens_estoque"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "emprestimos_registrado_por_fkey"
      columns: ["registrado_por"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    }
                  ]
                },"enderecos": {
                  Row: {
                    "ativo": boolean,"codigo": string,"criado_em": string,"descricao": string | null,"id": string,"nome": string | null,"numero": number,"pai_id": string | null,"substituido_por_id": string | null,"tipo_endereco_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ativo"?: boolean,"codigo"?: string,"criado_em"?: string,"descricao"?: string | null,"id"?: string,"nome"?: string | null,"numero"?: number,"pai_id"?: string | null,"substituido_por_id"?: string | null,"tipo_endereco_id": string
                  }
                  Update: {
                    "ativo"?: boolean,"codigo"?: string,"criado_em"?: string,"descricao"?: string | null,"id"?: string,"nome"?: string | null,"numero"?: number,"pai_id"?: string | null,"substituido_por_id"?: string | null,"tipo_endereco_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "enderecos_pai_id_fkey"
      columns: ["pai_id"]
isOneToOne: false
      referencedRelation: "enderecos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "enderecos_substituido_por_id_fkey"
      columns: ["substituido_por_id"]
isOneToOne: false
      referencedRelation: "enderecos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "enderecos_tipo_endereco_id_fkey"
      columns: ["tipo_endereco_id"]
isOneToOne: false
      referencedRelation: "tipos_endereco"
      referencedColumns: ["id"]
    }
                  ]
                },"itens": {
                  Row: {
                    "atualizado_em": string,"categoria_id": string,"codigo": string,"criado_em": string,"descricao": string | null,"especificacoes": NonNullable<Json>,"estoque_minimo": number,"foto_url": string | null,"id": string,"nome": string,"repor": boolean,"status": Database["public"]['Enums']["status_item"],"tipo_controle": Database["public"]['Enums']["tipo_controle"],"unidade": Database["public"]['Enums']["unidade_medida"]
                  }
                  ComputedFields: never
                  Insert: {
                    "atualizado_em"?: string,"categoria_id": string,"codigo"?: string,"criado_em"?: string,"descricao"?: string | null,"especificacoes"?: NonNullable<Json>,"estoque_minimo"?: number,"foto_url"?: string | null,"id"?: string,"nome": string,"repor"?: boolean,"status"?: Database["public"]['Enums']["status_item"],"tipo_controle"?: Database["public"]['Enums']["tipo_controle"],"unidade"?: Database["public"]['Enums']["unidade_medida"]
                  }
                  Update: {
                    "atualizado_em"?: string,"categoria_id"?: string,"codigo"?: string,"criado_em"?: string,"descricao"?: string | null,"especificacoes"?: NonNullable<Json>,"estoque_minimo"?: number,"foto_url"?: string | null,"id"?: string,"nome"?: string,"repor"?: boolean,"status"?: Database["public"]['Enums']["status_item"],"tipo_controle"?: Database["public"]['Enums']["tipo_controle"],"unidade"?: Database["public"]['Enums']["unidade_medida"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "itens_categoria_id_fkey"
      columns: ["categoria_id"]
isOneToOne: false
      referencedRelation: "categorias"
      referencedColumns: ["id"]
    }
                  ]
                },"movimentacoes": {
                  Row: {
                    "chave_idempotencia": string,"contagem_id": string | null,"criado_em": string,"emprestimo_id": string | null,"endereco_destino_id": string | null,"endereco_origem_id": string | null,"id": string,"item_id": string,"motivo": string | null,"quantidade": number,"romaneio_id": string | null,"tipo": Database["public"]['Enums']["tipo_movimentacao"],"usuario_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "chave_idempotencia": string,"contagem_id"?: string | null,"criado_em"?: string,"emprestimo_id"?: string | null,"endereco_destino_id"?: string | null,"endereco_origem_id"?: string | null,"id"?: string,"item_id": string,"motivo"?: string | null,"quantidade": number,"romaneio_id"?: string | null,"tipo": Database["public"]['Enums']["tipo_movimentacao"],"usuario_id": string
                  }
                  Update: {
                    "chave_idempotencia"?: string,"contagem_id"?: string | null,"criado_em"?: string,"emprestimo_id"?: string | null,"endereco_destino_id"?: string | null,"endereco_origem_id"?: string | null,"id"?: string,"item_id"?: string,"motivo"?: string | null,"quantidade"?: number,"romaneio_id"?: string | null,"tipo"?: Database["public"]['Enums']["tipo_movimentacao"],"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "movimentacoes_contagem_fk"
      columns: ["contagem_id"]
isOneToOne: false
      referencedRelation: "contagens"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "movimentacoes_emprestimo_id_fkey"
      columns: ["emprestimo_id"]
isOneToOne: false
      referencedRelation: "emprestimos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "movimentacoes_emprestimo_id_fkey"
      columns: ["emprestimo_id"]
isOneToOne: false
      referencedRelation: "vw_emprestimos_abertos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "movimentacoes_emprestimo_id_fkey"
      columns: ["emprestimo_id"]
isOneToOne: false
      referencedRelation: "vw_emprestimos_atrasados"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "movimentacoes_endereco_destino_id_fkey"
      columns: ["endereco_destino_id"]
isOneToOne: false
      referencedRelation: "enderecos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "movimentacoes_endereco_origem_id_fkey"
      columns: ["endereco_origem_id"]
isOneToOne: false
      referencedRelation: "enderecos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "movimentacoes_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "itens"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "movimentacoes_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "vw_itens_estoque"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "movimentacoes_romaneio_fk"
      columns: ["romaneio_id"]
isOneToOne: false
      referencedRelation: "romaneios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "movimentacoes_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    }
                  ]
                },"notificacoes": {
                  Row: {
                    "criado_em": string,"id": string,"lida": boolean,"mensagem": string | null,"referencia_id": string | null,"referencia_tabela": string | null,"tipo": string | null,"titulo": string,"usuario_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "criado_em"?: string,"id"?: string,"lida"?: boolean,"mensagem"?: string | null,"referencia_id"?: string | null,"referencia_tabela"?: string | null,"tipo"?: string | null,"titulo": string,"usuario_id": string
                  }
                  Update: {
                    "criado_em"?: string,"id"?: string,"lida"?: boolean,"mensagem"?: string | null,"referencia_id"?: string | null,"referencia_tabela"?: string | null,"tipo"?: string | null,"titulo"?: string,"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notificacoes_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    }
                  ]
                },"pedido_historico": {
                  Row: {
                    "comentario": string | null,"criado_em": string,"id": string,"pedido_id": string,"status_anterior": Database["public"]['Enums']["status_pedido"] | null,"status_novo": Database["public"]['Enums']["status_pedido"],"usuario_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "comentario"?: string | null,"criado_em"?: string,"id"?: string,"pedido_id": string,"status_anterior"?: Database["public"]['Enums']["status_pedido"] | null,"status_novo": Database["public"]['Enums']["status_pedido"],"usuario_id"?: string | null
                  }
                  Update: {
                    "comentario"?: string | null,"criado_em"?: string,"id"?: string,"pedido_id"?: string,"status_anterior"?: Database["public"]['Enums']["status_pedido"] | null,"status_novo"?: Database["public"]['Enums']["status_pedido"],"usuario_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "pedido_historico_pedido_id_fkey"
      columns: ["pedido_id"]
isOneToOne: false
      referencedRelation: "pedidos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pedido_historico_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    }
                  ]
                },"pedido_itens": {
                  Row: {
                    "id": string,"item_id": string,"observacao": string | null,"pedido_id": string,"quantidade_aprovada": number | null,"quantidade_solicitada": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"item_id": string,"observacao"?: string | null,"pedido_id": string,"quantidade_aprovada"?: number | null,"quantidade_solicitada": number
                  }
                  Update: {
                    "id"?: string,"item_id"?: string,"observacao"?: string | null,"pedido_id"?: string,"quantidade_aprovada"?: number | null,"quantidade_solicitada"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "pedido_itens_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "itens"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pedido_itens_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "vw_itens_estoque"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pedido_itens_pedido_id_fkey"
      columns: ["pedido_id"]
isOneToOne: false
      referencedRelation: "pedidos"
      referencedColumns: ["id"]
    }
                  ]
                },"pedidos": {
                  Row: {
                    "aprovado_em": string | null,"aprovado_por": string | null,"atualizado_em": string,"chave_idempotencia": string | null,"codigo": string,"criado_em": string,"finalidade": string,"id": string,"motivo_rejeicao": string | null,"projeto_turma": string | null,"solicitante_id": string,"status": Database["public"]['Enums']["status_pedido"]
                  }
                  ComputedFields: never
                  Insert: {
                    "aprovado_em"?: string | null,"aprovado_por"?: string | null,"atualizado_em"?: string,"chave_idempotencia"?: string | null,"codigo"?: string,"criado_em"?: string,"finalidade": string,"id"?: string,"motivo_rejeicao"?: string | null,"projeto_turma"?: string | null,"solicitante_id": string,"status"?: Database["public"]['Enums']["status_pedido"]
                  }
                  Update: {
                    "aprovado_em"?: string | null,"aprovado_por"?: string | null,"atualizado_em"?: string,"chave_idempotencia"?: string | null,"codigo"?: string,"criado_em"?: string,"finalidade"?: string,"id"?: string,"motivo_rejeicao"?: string | null,"projeto_turma"?: string | null,"solicitante_id"?: string,"status"?: Database["public"]['Enums']["status_pedido"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "pedidos_aprovado_por_fkey"
      columns: ["aprovado_por"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pedidos_solicitante_id_fkey"
      columns: ["solicitante_id"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    }
                  ]
                },"perfis": {
                  Row: {
                    "aprovado_em": string | null,"aprovado_por": string | null,"atualizado_em": string,"criado_em": string,"email": string,"id": string,"nome": string,"perfil": Database["public"]['Enums']["perfil_usuario"],"status_cadastro": Database["public"]['Enums']["status_cadastro"],"turma": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "aprovado_em"?: string | null,"aprovado_por"?: string | null,"atualizado_em"?: string,"criado_em"?: string,"email": string,"id": string,"nome": string,"perfil"?: Database["public"]['Enums']["perfil_usuario"],"status_cadastro"?: Database["public"]['Enums']["status_cadastro"],"turma"?: string | null
                  }
                  Update: {
                    "aprovado_em"?: string | null,"aprovado_por"?: string | null,"atualizado_em"?: string,"criado_em"?: string,"email"?: string,"id"?: string,"nome"?: string,"perfil"?: Database["public"]['Enums']["perfil_usuario"],"status_cadastro"?: Database["public"]['Enums']["status_cadastro"],"turma"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "perfis_aprovado_por_fkey"
      columns: ["aprovado_por"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    }
                  ]
                },"romaneio_itens": {
                  Row: {
                    "endereco_retirada_id": string,"id": string,"item_id": string,"movimentacao_id": string | null,"pedido_item_id": string | null,"quantidade": number,"quantidade_conferida": number | null,"romaneio_id": string,"separado": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "endereco_retirada_id": string,"id"?: string,"item_id": string,"movimentacao_id"?: string | null,"pedido_item_id"?: string | null,"quantidade": number,"quantidade_conferida"?: number | null,"romaneio_id": string,"separado"?: boolean
                  }
                  Update: {
                    "endereco_retirada_id"?: string,"id"?: string,"item_id"?: string,"movimentacao_id"?: string | null,"pedido_item_id"?: string | null,"quantidade"?: number,"quantidade_conferida"?: number | null,"romaneio_id"?: string,"separado"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "romaneio_itens_endereco_retirada_id_fkey"
      columns: ["endereco_retirada_id"]
isOneToOne: false
      referencedRelation: "enderecos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "romaneio_itens_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "itens"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "romaneio_itens_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "vw_itens_estoque"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "romaneio_itens_movimentacao_id_fkey"
      columns: ["movimentacao_id"]
isOneToOne: false
      referencedRelation: "movimentacoes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "romaneio_itens_pedido_item_id_fkey"
      columns: ["pedido_item_id"]
isOneToOne: false
      referencedRelation: "pedido_itens"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "romaneio_itens_romaneio_id_fkey"
      columns: ["romaneio_id"]
isOneToOne: false
      referencedRelation: "romaneios"
      referencedColumns: ["id"]
    }
                  ]
                },"romaneios": {
                  Row: {
                    "aceite_em": string | null,"atualizado_em": string,"chave_entrega": string | null,"codigo": string,"criado_em": string,"criado_por": string,"descricao": string | null,"entregue_em": string | null,"id": string,"pedido_id": string | null,"prazo_devolucao": string | null,"recebido_por": string | null,"separado_em": string | null,"separado_por": string | null,"status": Database["public"]['Enums']["status_romaneio"]
                  }
                  ComputedFields: never
                  Insert: {
                    "aceite_em"?: string | null,"atualizado_em"?: string,"chave_entrega"?: string | null,"codigo"?: string,"criado_em"?: string,"criado_por": string,"descricao"?: string | null,"entregue_em"?: string | null,"id"?: string,"pedido_id"?: string | null,"prazo_devolucao"?: string | null,"recebido_por"?: string | null,"separado_em"?: string | null,"separado_por"?: string | null,"status"?: Database["public"]['Enums']["status_romaneio"]
                  }
                  Update: {
                    "aceite_em"?: string | null,"atualizado_em"?: string,"chave_entrega"?: string | null,"codigo"?: string,"criado_em"?: string,"criado_por"?: string,"descricao"?: string | null,"entregue_em"?: string | null,"id"?: string,"pedido_id"?: string | null,"prazo_devolucao"?: string | null,"recebido_por"?: string | null,"separado_em"?: string | null,"separado_por"?: string | null,"status"?: Database["public"]['Enums']["status_romaneio"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "romaneios_criado_por_fkey"
      columns: ["criado_por"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "romaneios_pedido_id_fkey"
      columns: ["pedido_id"]
isOneToOne: false
      referencedRelation: "pedidos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "romaneios_recebido_por_fkey"
      columns: ["recebido_por"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "romaneios_separado_por_fkey"
      columns: ["separado_por"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    }
                  ]
                },"saldos_por_endereco": {
                  Row: {
                    "atualizado_em": string,"endereco_id": string,"id": string,"item_id": string,"quantidade_atual": number
                  }
                  ComputedFields: never
                  Insert: {
                    "atualizado_em"?: string,"endereco_id": string,"id"?: string,"item_id": string,"quantidade_atual"?: number
                  }
                  Update: {
                    "atualizado_em"?: string,"endereco_id"?: string,"id"?: string,"item_id"?: string,"quantidade_atual"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "saldos_por_endereco_endereco_id_fkey"
      columns: ["endereco_id"]
isOneToOne: false
      referencedRelation: "enderecos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "saldos_por_endereco_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "itens"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "saldos_por_endereco_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "vw_itens_estoque"
      referencedColumns: ["id"]
    }
                  ]
                },"tipos_endereco": {
                  Row: {
                    "armazena_itens": boolean,"ativo": boolean,"criado_em": string,"id": string,"nivel": number,"nome": string,"prefixo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "armazena_itens"?: boolean,"ativo"?: boolean,"criado_em"?: string,"id"?: string,"nivel": number,"nome": string,"prefixo": string
                  }
                  Update: {
                    "armazena_itens"?: boolean,"ativo"?: boolean,"criado_em"?: string,"id"?: string,"nivel"?: number,"nome"?: string,"prefixo"?: string
                  }
                  Relationships: [
                    
                  ]
                },"trocas_qr": {
                  Row: {
                    "concluida_em": string | null,"concluida_por": string | null,"criado_em": string,"criado_por": string,"endereco_antigo_id": string,"endereco_novo_id": string,"id": string,"motivo": string | null,"status": Database["public"]['Enums']["status_troca_qr"]
                  }
                  ComputedFields: never
                  Insert: {
                    "concluida_em"?: string | null,"concluida_por"?: string | null,"criado_em"?: string,"criado_por": string,"endereco_antigo_id": string,"endereco_novo_id": string,"id"?: string,"motivo"?: string | null,"status"?: Database["public"]['Enums']["status_troca_qr"]
                  }
                  Update: {
                    "concluida_em"?: string | null,"concluida_por"?: string | null,"criado_em"?: string,"criado_por"?: string,"endereco_antigo_id"?: string,"endereco_novo_id"?: string,"id"?: string,"motivo"?: string | null,"status"?: Database["public"]['Enums']["status_troca_qr"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "trocas_qr_concluida_por_fkey"
      columns: ["concluida_por"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trocas_qr_criado_por_fkey"
      columns: ["criado_por"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trocas_qr_endereco_antigo_id_fkey"
      columns: ["endereco_antigo_id"]
isOneToOne: false
      referencedRelation: "enderecos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trocas_qr_endereco_novo_id_fkey"
      columns: ["endereco_novo_id"]
isOneToOne: false
      referencedRelation: "enderecos"
      referencedColumns: ["id"]
    }
                  ]
                },"trocas_qr_etiquetas": {
                  Row: {
                    "endereco_antigo_id": string,"endereco_novo_id": string,"id": string,"troca_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "endereco_antigo_id": string,"endereco_novo_id": string,"id"?: string,"troca_id": string
                  }
                  Update: {
                    "endereco_antigo_id"?: string,"endereco_novo_id"?: string,"id"?: string,"troca_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "trocas_qr_etiquetas_endereco_antigo_id_fkey"
      columns: ["endereco_antigo_id"]
isOneToOne: false
      referencedRelation: "enderecos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trocas_qr_etiquetas_endereco_novo_id_fkey"
      columns: ["endereco_novo_id"]
isOneToOne: false
      referencedRelation: "enderecos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trocas_qr_etiquetas_troca_id_fkey"
      columns: ["troca_id"]
isOneToOne: false
      referencedRelation: "trocas_qr"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "vw_contagem_atual": {
                  Row: {
                    "ajuste_movimentacao_id": string | null,"contado_em": string,"contado_por": string | null,"contagem_codigo": string,"contagem_id": string,"divergencia": number,"emprestado_em_aberto": number,"endereco_codigo": string,"endereco_id": string,"id": string,"item_codigo": string,"item_id": string,"item_nome": string,"nao_listado": boolean,"quantidade_contada": number,"quantidade_sistema": number,"recontagem_pendente": boolean,"rodada": number
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "contagem_itens_ajuste_movimentacao_id_fkey"
      columns: ["ajuste_movimentacao_id"]
isOneToOne: false
      referencedRelation: "movimentacoes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contagem_itens_contado_por_fkey"
      columns: ["contado_por"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contagem_itens_contagem_id_fkey"
      columns: ["contagem_id"]
isOneToOne: false
      referencedRelation: "contagens"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contagem_itens_endereco_id_fkey"
      columns: ["endereco_id"]
isOneToOne: false
      referencedRelation: "enderecos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contagem_itens_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "itens"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contagem_itens_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "vw_itens_estoque"
      referencedColumns: ["id"]
    }
                  ]
                },"vw_contagem_divergencias": {
                  Row: {
                    "ajuste_movimentacao_id": string | null,"contado_em": string,"contado_por": string | null,"contagem_codigo": string,"contagem_id": string,"divergencia": number,"emprestado_em_aberto": number,"endereco_codigo": string,"endereco_id": string,"id": string,"item_codigo": string,"item_id": string,"item_nome": string,"nao_listado": boolean,"quantidade_contada": number,"quantidade_sistema": number,"recontagem_pendente": boolean,"rodada": number
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "contagem_itens_ajuste_movimentacao_id_fkey"
      columns: ["ajuste_movimentacao_id"]
isOneToOne: false
      referencedRelation: "movimentacoes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contagem_itens_contado_por_fkey"
      columns: ["contado_por"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contagem_itens_contagem_id_fkey"
      columns: ["contagem_id"]
isOneToOne: false
      referencedRelation: "contagens"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contagem_itens_endereco_id_fkey"
      columns: ["endereco_id"]
isOneToOne: false
      referencedRelation: "enderecos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contagem_itens_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "itens"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contagem_itens_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "vw_itens_estoque"
      referencedColumns: ["id"]
    }
                  ]
                },"vw_emprestimos_abertos": {
                  Row: {
                    "dias_atraso": number | null,"emprestado_em": string,"emprestado_para": string,"emprestado_para_nome": string,"id": string,"item_codigo": string,"item_id": string,"item_nome": string,"prazo_previsto": string | null,"quantidade": number,"quantidade_devolvida": number,"quantidade_pendente": number | null,"quantidade_perdida": number,"situacao": string | null,"status": Database["public"]['Enums']["status_emprestimo"]
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "emprestimos_emprestado_para_fkey"
      columns: ["emprestado_para"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "emprestimos_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "itens"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "emprestimos_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "vw_itens_estoque"
      referencedColumns: ["id"]
    }
                  ]
                },"vw_emprestimos_atrasados": {
                  Row: {
                    "dias_atraso": number | null,"emprestado_em": string,"emprestado_para": string,"emprestado_para_nome": string,"id": string,"item_codigo": string,"item_id": string,"item_nome": string,"prazo_previsto": string | null,"quantidade": number,"quantidade_devolvida": number,"quantidade_pendente": number | null,"quantidade_perdida": number,"situacao": string | null,"status": Database["public"]['Enums']["status_emprestimo"]
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "emprestimos_emprestado_para_fkey"
      columns: ["emprestado_para"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "emprestimos_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "itens"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "emprestimos_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "vw_itens_estoque"
      referencedColumns: ["id"]
    }
                  ]
                },"vw_itens_estoque": {
                  Row: {
                    "abaixo_minimo": boolean | null,"atualizado_em": string,"categoria_id": string,"categoria_nome": string,"categoria_prefixo": string,"codigo": string,"criado_em": string,"descricao": string | null,"emprestado_em_aberto": number | null,"enderecos_com_saldo": number | null,"esgotado": boolean | null,"especificacoes": NonNullable<Json>,"estoque_minimo": number,"foto_url": string | null,"id": string,"nome": string,"repor": boolean,"saldo_total": number | null,"status": Database["public"]['Enums']["status_item"],"tipo_controle": Database["public"]['Enums']["tipo_controle"],"unidade": Database["public"]['Enums']["unidade_medida"]
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "itens_categoria_id_fkey"
      columns: ["categoria_id"]
isOneToOne: false
      referencedRelation: "categorias"
      referencedColumns: ["id"]
    }
                  ]
                },"vw_troca_qr_etiquetas": {
                  Row: {
                    "codigo_antigo": string,"codigo_novo": string,"endereco_antigo_id": string,"endereco_novo_id": string,"nome": string | null,"tipo_nivel": number,"tipo_nome": string,"troca_id": string,"troca_status": Database["public"]['Enums']["status_troca_qr"]
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "trocas_qr_etiquetas_endereco_antigo_id_fkey"
      columns: ["endereco_antigo_id"]
isOneToOne: false
      referencedRelation: "enderecos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trocas_qr_etiquetas_endereco_novo_id_fkey"
      columns: ["endereco_novo_id"]
isOneToOne: false
      referencedRelation: "enderecos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trocas_qr_etiquetas_troca_id_fkey"
      columns: ["troca_id"]
isOneToOne: false
      referencedRelation: "trocas_qr"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "_buscar_idempotente":
{ Args: { "p_chave": string,"p_item": string,"p_tipo": Database["public"]['Enums']["tipo_movimentacao"] }; Returns: {
              "chave_idempotencia": string,
"contagem_id": string | null,
"criado_em": string,
"emprestimo_id": string | null,
"endereco_destino_id": string | null,
"endereco_origem_id": string | null,
"id": string,
"item_id": string,
"motivo": string | null,
"quantidade": number,
"romaneio_id": string | null,
"tipo": Database["public"]['Enums']["tipo_movimentacao"],
"usuario_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "movimentacoes"
        isOneToOne: true
        isSetofReturn: false
      } },
"_carregar_item":
{ Args: { "p_exigir_ativo"?: boolean,"p_item_id": string,"p_permitir_zero"?: boolean,"p_quantidade": number }; Returns: {
              "atualizado_em": string,
"categoria_id": string,
"codigo": string,
"criado_em": string,
"descricao": string | null,
"especificacoes": NonNullable<Json>,
"estoque_minimo": number,
"foto_url": string | null,
"id": string,
"nome": string,
"repor": boolean,
"status": Database["public"]['Enums']["status_item"],
"tipo_controle": Database["public"]['Enums']["tipo_controle"],
"unidade": Database["public"]['Enums']["unidade_medida"]
            }
                          SetofOptions: {
        from: "*"
        to: "itens"
        isOneToOne: true
        isSetofReturn: false
      } },
"_clonar_endereco":
{ Args: { "p_antigo": string,"p_motivo": string,"p_novo_pai": string,"p_troca": string }; Returns: string
                           },
"_enderecos_da_contagem":
{ Args: { "p_contagem_id": string }; Returns: string[]
                           },
"_mudar_status_pedido":
{ Args: { "p_comentario": string,"p_novo": Database["public"]['Enums']["status_pedido"],"p_pedido": string }; Returns: undefined
                           },
"_notificar":
{ Args: { "p_mensagem": string,"p_ref_id": string,"p_ref_tabela": string,"p_tipo": string,"p_titulo": string,"p_usuario": string }; Returns: undefined
                           },
"_notificar_equipe":
{ Args: { "p_mensagem": string,"p_ref_id": string,"p_ref_tabela": string,"p_tipo": string,"p_titulo": string }; Returns: undefined
                           },
"_proximo_codigo":
{ Args: { "p_prefixo": string }; Returns: string
                           },
"_saldo_somar":
{ Args: { "p_endereco": string,"p_item": string,"p_qtd": number }; Returns: undefined
                           },
"_saldo_subtrair":
{ Args: { "p_endereco": string,"p_item": string,"p_qtd": number }; Returns: undefined
                           },
"_validar_endereco":
{ Args: { "p_endereco_id": string,"p_exigir_ativo": boolean }; Returns: undefined
                           },
"abrir_contagem":
{ Args: { "p_categoria_id"?: string,"p_endereco_id"?: string,"p_escopo": Database["public"]['Enums']["escopo_contagem"],"p_observacao"?: string }; Returns: Json
                           },
"ajustar":
{ Args: { "p_chave_idempotencia": string,"p_contagem_id"?: string,"p_endereco_id": string,"p_item_id": string,"p_motivo": string,"p_quantidade_nova": number }; Returns: Json
                           },
"aprovar_contagem":
{ Args: { "p_contagem_id": string }; Returns: Json
                           },
"cancelar_contagem":
{ Args: { "p_contagem_id": string }; Returns: Json
                           },
"cancelar_pedido":
{ Args: { "p_motivo"?: string,"p_pedido_id": string }; Returns: Json
                           },
"cancelar_romaneio":
{ Args: { "p_romaneio_id": string }; Returns: Json
                           },
"concluir_pedido":
{ Args: { "p_pedido_id": string }; Returns: Json
                           },
"concluir_separacao":
{ Args: { "p_romaneio_id": string }; Returns: Json
                           },
"concluir_troca_qr":
{ Args: { "p_troca_id": string }; Returns: Json
                           },
"decidir_pedido":
{ Args: { "p_aprovar": boolean,"p_motivo"?: string,"p_pedido_id": string,"p_quantidades"?: Json }; Returns: Json
                           },
"devolver":
{ Args: { "p_chave_idempotencia": string,"p_emprestimo_id": string,"p_endereco_destino_id": string,"p_motivo"?: string,"p_quantidade": number }; Returns: Json
                           },
"e_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"e_aprovado":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"e_professor_ou_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"emprestar":
{ Args: { "p_chave_idempotencia": string,"p_emprestado_para": string,"p_endereco_id": string,"p_item_id": string,"p_observacao"?: string,"p_prazo_previsto"?: string,"p_quantidade": number,"p_romaneio_id"?: string }; Returns: Json
                           },
"encerrar_contagem":
{ Args: { "p_contagem_id": string,"p_forcar"?: boolean }; Returns: Json
                           },
"entregar_romaneio":
{ Args: { "p_chave_idempotencia": string,"p_conferencias"?: Json,"p_recebido_por": string,"p_romaneio_id": string }; Returns: Json
                           },
"enviar_pedido":
{ Args: { "p_pedido_id": string }; Returns: Json
                           },
"gerar_romaneio_avulso":
{ Args: { "p_descricao": string,"p_itens": Json,"p_prazo_devolucao"?: string }; Returns: Json
                           },
"gerar_romaneio_do_pedido":
{ Args: { "p_pedido_id": string,"p_prazo_devolucao"?: string }; Returns: Json
                           },
"hoje_br":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"itens_para_contar":
{ Args: { "p_contagem_id": string,"p_endereco_id": string }; Returns: {
              "codigo": string,"item_id": string,"nome": string,"situacao": string,"unidade": string
            }[]
                           },
"itens_para_contar_todos":
{ Args: { "p_contagem_id": string }; Returns: {
              "codigo": string,"endereco_id": string,"item_id": string,"nome": string,"situacao": string,"unidade": string
            }[]
                           },
"marcar_emprestimo_perdido":
{ Args: { "p_chave_idempotencia": string,"p_emprestimo_id": string,"p_motivo": string,"p_quantidade": number }; Returns: Json
                           },
"marcar_item_separado":
{ Args: { "p_romaneio_item_id": string,"p_separado"?: boolean }; Returns: Json
                           },
"mover_endereco":
{ Args: { "p_endereco_id": string,"p_motivo"?: string,"p_novo_pai_id": string }; Returns: Json
                           },
"perfil_atual":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["perfil_usuario"]
                           },
"posicoes_da_contagem":
{ Args: { "p_contagem_id": string }; Returns: {
              "ativo": boolean,"codigo": string,"contada_por_mim": boolean,"endereco_id": string,"itens_contados": number,"itens_faltando": number,"nome": string,"recontagens": number,"sem_contagem": boolean
            }[]
                           },
"registrar_contagem":
{ Args: { "p_chave_idempotencia": string,"p_contagem_id": string,"p_endereco_id": string,"p_itens": Json }; Returns: Json
                           },
"registrar_entrada":
{ Args: { "p_chave_idempotencia": string,"p_endereco_id": string,"p_item_id": string,"p_motivo"?: string,"p_quantidade": number }; Returns: Json
                           },
"registrar_saida":
{ Args: { "p_chave_idempotencia": string,"p_endereco_id": string,"p_item_id": string,"p_motivo"?: string,"p_quantidade": number,"p_romaneio_id"?: string }; Returns: Json
                           },
"salvar_pedido":
{ Args: { "p_chave_idempotencia": string,"p_enviar"?: boolean,"p_finalidade": string,"p_itens": Json,"p_pedido_id"?: string,"p_projeto_turma"?: string }; Returns: Json
                           },
"solicitar_recontagem":
{ Args: { "p_contagem_id": string,"p_endereco_id": string,"p_item_id"?: string }; Returns: Json
                           },
"transferir":
{ Args: { "p_chave_idempotencia": string,"p_endereco_destino_id": string,"p_endereco_origem_id": string,"p_item_id": string,"p_motivo"?: string,"p_quantidade": number }; Returns: Json
                           }
          }
          Enums: {
            "escopo_contagem": "geral"|"por_endereco"|"por_categoria","perfil_usuario": "admin"|"professor"|"aluno","status_cadastro": "pendente"|"aprovado"|"rejeitado"|"bloqueado","status_contagem": "aberta"|"em_andamento"|"em_revisao"|"aprovada"|"cancelada","status_emprestimo": "em_aberto"|"devolvido_parcial"|"devolvido"|"perdido","status_item": "ativo"|"inativo","status_pedido": "rascunho"|"enviado"|"aprovado"|"rejeitado"|"separado"|"entregue"|"concluido"|"cancelado","status_romaneio": "gerado"|"em_separacao"|"separado"|"entregue"|"cancelado","status_troca_qr": "pendente"|"concluida","tipo_controle": "consumivel"|"emprestavel","tipo_movimentacao": "entrada"|"saida"|"transferencia"|"ajuste"|"emprestimo"|"devolucao","unidade_medida": "un"|"m"|"kg"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "escopo_contagem": ["geral", "por_endereco", "por_categoria"],"perfil_usuario": ["admin", "professor", "aluno"],"status_cadastro": ["pendente", "aprovado", "rejeitado", "bloqueado"],"status_contagem": ["aberta", "em_andamento", "em_revisao", "aprovada", "cancelada"],"status_emprestimo": ["em_aberto", "devolvido_parcial", "devolvido", "perdido"],"status_item": ["ativo", "inativo"],"status_pedido": ["rascunho", "enviado", "aprovado", "rejeitado", "separado", "entregue", "concluido", "cancelado"],"status_romaneio": ["gerado", "em_separacao", "separado", "entregue", "cancelado"],"status_troca_qr": ["pendente", "concluida"],"tipo_controle": ["consumivel", "emprestavel"],"tipo_movimentacao": ["entrada", "saida", "transferencia", "ajuste", "emprestimo", "devolucao"],"unidade_medida": ["un", "m", "kg"]
          }
        }
} as const

