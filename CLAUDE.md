# CLAUDE.md

Acesso ao Supabase com SERVICE_ROLE: variável `SUPABASE_SERVICE_ROLE_KEY` no `.env` (gitignored — nunca colocar a chave neste arquivo, que é commitado).

## Variáveis de Template (Propostas / Contratos)

Estas são as variáveis (placeholders `{{...}}`) disponíveis para substituição em modelos de propostas e contratos.

### Dados da Agência

| Variável | Descrição |
| --- | --- |
| `{{AGENCIA_RAZAO_SOCIAL}}` | Razão social da agência |
| `{{AGENCIA_CNPJ}}` | CNPJ da agência |
| `{{AGENCIA_ENDERECO}}` | Endereço da agência |
| `{{AGENCIA_CIDADE}}` | Cidade da agência |
| `{{AGENCIA_UF}}` | Estado (UF) da agência |
| `{{AGENCIA_EMAIL}}` | E-mail da agência |
| `{{AGENCIA_TELEFONE}}` | Telefone da agência |

### Variáveis do Cliente

| Variável | Descrição |
| --- | --- |
| `{{CPF}}` | CPF do cliente |
| `{{NOME_CLIENTE}}` | Nome do cliente |
| `{{EMPRESA_CLIENTE}}` | Nome da empresa do cliente |
| `{{CNPJ_CLIENTE}}` | CNPJ do cliente |
| `{{CIDADE_CLIENTE}}` | Cidade do cliente |
| `{{ESTADO_CLIENTE}}` | Estado do cliente |
| `{{TELEFONE_CLIENTE}}` | Telefone do cliente |
| `{{EMAIL_CLIENTE}}` | E-mail do cliente |

### Variáveis de Proposta

| Variável | Descrição |
| --- | --- |
| `{{SERVICO}}` | Serviço contratado |
| `{{VALOR_BRUTO}}` | Valor bruto da proposta |
| `{{VALOR_LIQUIDO}}` | Valor líquido da proposta |
| `{{DATA_INICIO}}` | Data de início |
| `{{NUM_PARCELAS}}` | Número de parcelas |
| `{{DATA_HOJE}}` | Data atual |
| `{{NUMERO_PROPOSTA}}` | Número da proposta |
| `{{DATA_PROPOSTA}}` | Data da proposta |
| `{{FORMA_PAGAMENTO}}` | Forma de pagamento |
| `{{VALOR_AVISTA}}` | Valor à vista (preço especial) |
| `{{PAGAMENTO_PIX}}` | Dados/informações de pagamento via PIX |
