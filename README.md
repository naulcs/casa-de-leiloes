# FormiLance — casa de leilões de formigas

Casa de leilões online em que um **leiloeiro** cria lotes a partir de espécies de formigas da API pública **iNaturalist** e **licitantes** disputam os lotes com lances ao vivo. Cada lance é selado criptograficamente e qualquer pessoa pode auditar o histórico de um lote.

- **Aplicação publicada:** _link será adicionado após o deploy_
- **Repositório:** https://github.com/naulcs/casa-de-leiloes

---

## Sumário

1. [Contas de demonstração](#contas-de-demonstração)
2. [Funcionalidades](#funcionalidades)
3. [Tecnologias](#tecnologias)
4. [Estrutura do projeto](#estrutura-do-projeto)
5. [Como rodar localmente](#como-rodar-localmente)
6. [Variáveis de ambiente](#variáveis-de-ambiente)
7. [Banco de dados (Neon / PostgreSQL)](#banco-de-dados-neon--postgresql)
8. [Dados de demonstração (seed)](#dados-de-demonstração-seed)
9. [Testes](#testes)
10. [Deploy](#deploy)
11. [API pública: iNaturalist](#api-pública-inaturalist)
12. [Regras de negócio](#regras-de-negócio)
13. [Histórico à prova de adulteração](#histórico-à-prova-de-adulteração)
14. [Privacidade](#privacidade)
15. [Tempo real e concorrência](#tempo-real-e-concorrência)
16. [Rotas da API](#rotas-da-api)
17. [Decisões de projeto](#decisões-de-projeto)
18. [Comportamentos inesperados e limitações conhecidas](#comportamentos-inesperados-e-limitações-conhecidas)
19. [Extras opcionais](#extras-opcionais)
20. [Uso de IA](#uso-de-ia)
21. [Autor](#autor)

---

## Contas de demonstração

Criadas pelo seed (`npm run db:seed`). Todas usam a senha **`123456`**.

| Papel | E-mail | Observação |
|---|---|---|
| Leiloeiro | `leiloeiro@exemplo.com` | Dono dos lotes de demonstração |
| Licitante | `ana@exemplo.com` | Começa com R$ 500,00 de saldo simulado |
| Licitante | `bia@exemplo.com` | Começa com R$ 500,00 de saldo simulado |

Essas contas existem apenas para avaliação e não guardam nenhum dado real.

---

## Funcionalidades

**Para todos (sem login)**
- Página inicial com apresentação animada.
- Vitrine separada em **Ao vivo**, **Agendados** e **Encerrados**, com busca por nome. Lotes cancelados não aparecem.
- Sala do lote com lance atual, histórico, contagem regressiva e número de pessoas acompanhando.
- **Auditoria pública** de cada lote (`/auditoria/:id`), indicando se o histórico está íntegro ou adulterado.
- **Comprovante público** de arremate (`/comprovantes/:codigo`), com botão de compartilhar.

**Licitante**
- Carteira com saldo total, saldo comprometido, saldo disponível, depósito simulado e extrato.
- Lances ao vivo, com aviso de "você está ganhando", "você foi superado" e a posição do licitante entre os participantes.
- Mensagem específica para cada lance recusado.
- "Meus arremates": lotes em que deu lance, situação de cada um e link do comprovante.
- Desistência de um lote (ver [regras](#regras-de-negócio)).

**Leiloeiro**
- Busca de espécies na iNaturalist, com paginação ("Carregar mais").
- Criação de lote com lance inicial, incremento mínimo, início e fim.
- Cancelamento de lote próprio agendado ou ao vivo. Sem lances, é o cancelamento pedido no PDF; com lances, o valor reservado de quem liderava volta na hora ao saldo disponível (estorno automático).
- Resultado de cada lote (arrematado ou não e por quanto) e total recebido.
- O leiloeiro **não pode dar lances** e só vê e gerencia os próprios lotes.

---

## Tecnologias

| Camada | Escolha |
|---|---|
| Front-end | React 19 + Vite, React Router, Socket.IO Client, three.js (formiga 3D do logo) |
| Back-end | Node.js 24 + Express 5 (ES Modules) |
| Tempo real | Socket.IO |
| Banco | PostgreSQL no Neon, driver `pg`, SQL puro (sem ORM) |
| Autenticação | JWT (7 dias) + senhas com `bcryptjs` |
| Testes | `node:test` (executor nativo do Node) |
| Formatação | Prettier (aspas duplas, largura 80) |

O dinheiro é sempre guardado em **centavos** (`BIGINT`), nunca em número com vírgula.

---

## Estrutura do projeto

```
casa-de-leiloes/
├── client/                  React + Vite
│   ├── index.html
│   └── src/
│       ├── App.jsx          rotas e cabeçalho
│       ├── api.js           chamadas HTTP e token
│       ├── auth.jsx         sessão do usuário
│       ├── format.js        reais, tempo, plural de lances
│       ├── Carrossel.jsx    galeria de lotes
│       ├── Formigueiro.jsx  animação da página inicial
│       ├── Formiga3D.jsx    formiga 3D do logo
│       └── pages/           Vitrine, Sala, Login, Carteira, Arremates,
│                            Painel, Auditoria, Comprovante
├── Dockerfile               imagem da aplicação
├── docker-compose.yml       banco + aplicação
└── server/                  Node + Express
    ├── scripts/dev-helpers.sh   atalhos de terminal para testes manuais
    ├── test/regras.test.js      testes automatizados
    └── src/
        ├── index.js         servidor HTTP, rotas, Socket.IO, liquidador
        ├── config.js
        ├── db/              pool, transações, schema.sql, migração, seed
        ├── middleware/      autenticação e papéis
        ├── routes/          auth, wallet, catalog, lots, bids, audit, receipts, me
        └── services/        bidding, settlement, integrity, realtime,
                             inaturalist, lots, wallet
```

---

## Como rodar localmente

### Pré-requisitos

- **Node.js 24** ou superior e **npm 11**
- Um banco **PostgreSQL**. O projeto usa o [Neon](https://neon.tech) (gratuito), mas qualquer PostgreSQL 14+ funciona.
- Git

### Passo a passo

```bash
git clone https://github.com/naulcs/casa-de-leiloes.git
cd casa-de-leiloes
```

**1. Servidor**

```bash
cd server
npm install
cp .env.example .env
```

Preencha o `.env` (veja [Variáveis de ambiente](#variáveis-de-ambiente)) e rode:

```bash
npm run db:init
npm run db:seed
npm run dev
```

O servidor sobe em `http://localhost:3000`.

**2. Front-end** (em outro terminal)

```bash
cd client
npm install
npm run dev
```

Abra `http://localhost:5173`. O Vite já encaminha `/api` e `/socket.io` para o servidor na porta 3000.

### Rodando com Docker Compose

Sobe o PostgreSQL e a aplicação (API + front compilado) com um comando, sem instalar Node nem banco na máquina. Requer o Docker Desktop aberto.

```bash
docker compose up --build
```

Abra `http://localhost:3000`. As tabelas são criadas automaticamente na subida. Para criar os dados de demonstração:

```bash
docker compose exec app npm run db:seed
```

Se a porta 3000 já estiver em uso, escolha outra com a variável PORTA (por exemplo, PORTA=3005 antes do comando) e abra o site nessa porta. Os segredos têm valores padrão só para teste local. Para usar outros, defina `JWT_SECRET` e `AUDIT_SECRET` no terminal antes do `docker compose up`. Para parar, use `docker compose down`; os dados ficam no volume `dados`, e `docker compose down -v` apaga tudo.

### Comandos do servidor

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe o servidor e reinicia ao salvar arquivos |
| `npm start` | Sobe o servidor (produção) |
| `npm run db:ping` | Testa a conexão com o banco |
| `npm run db:init` | Cria as tabelas que ainda não existem (não apaga dados) |
| `npm run db:reset` | **Apaga tudo** e recria as tabelas |
| `npm run db:seed` | Cria as contas e os lotes de demonstração |
| `npm test` | Roda os testes automatizados |

---

## Variáveis de ambiente

Arquivo `server/.env` (nunca vai para o Git; há um modelo em `server/.env.example`):

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | Sim | String de conexão do PostgreSQL. No Neon, use `sslmode=verify-full`. |
| `JWT_SECRET` | Sim | Segredo para assinar os tokens de login. |
| `AUDIT_SECRET` | Sim | Segredo dos selos do histórico de lances. **Deve ficar fora do banco.** |
| `PORT` | Não | Porta do servidor (padrão `3000`). O Render define sozinho. |
| `INATURALIST_URL` | Não | Endereço da API da iNaturalist (padrão `https://api.inaturalist.org/v1`). Útil para simular a API fora do ar. |

Para gerar segredos fortes:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> Trocar o `AUDIT_SECRET` faz todos os históricos já gravados aparecerem como adulterados, porque os selos foram calculados com o segredo antigo. Em desenvolvimento, rode `npm run db:reset` e `npm run db:seed` depois de trocar.

---

## Banco de dados (Neon / PostgreSQL)

1. Crie uma conta em [neon.tech](https://neon.tech) e um projeto.
2. Em **Connection Details**, copie a string de conexão e cole em `DATABASE_URL`, trocando o final por `sslmode=verify-full`.
3. Rode `npm run db:ping` para testar e `npm run db:init` para criar as tabelas.

Tabelas (`server/src/db/schema.sql`):

| Tabela | Conteúdo |
|---|---|
| `users` | Contas, papel (`auctioneer` ou `bidder`) e saldo total |
| `lots` | Lotes, snapshot do item da iNaturalist, regras, líder atual e selo do topo do histórico |
| `lot_images` | Cópia da foto de cada lote |
| `bids` | Histórico de lances, cada um com o selo do anterior |
| `wallet_transactions` | Extrato: depósitos, compras e vendas |
| `receipts` | Comprovantes de arremate |
| `withdrawals` | Desistências de licitantes |

O **status** do lote (agendado, ao vivo, encerrado, cancelado) não é guardado: é calculado pelas datas em cada consulta.

---

## Dados de demonstração (seed)

`npm run db:seed` cria:

- 1 leiloeiro e 2 licitantes (ver [Contas de demonstração](#contas-de-demonstração)), cada licitante com R$ 500,00.
- Lotes de **várias espécies reais da iNaturalist, com foto**: alguns **ao vivo, durando de 3 a 10 dias**, já com lances abertos da Ana e da Bia, e alguns **agendados** para os dias seguintes.

Todos os lances do seed passam pela mesma função usada pela aplicação, então o histórico nasce com os selos válidos.

O seed pode ser rodado várias vezes: ele não duplica contas nem lotes ainda abertos. Se os lotes de demonstração já tiverem encerrado, rodar de novo cria lotes novos. Se a iNaturalist estiver fora do ar, o seed usa dois lotes reserva sem foto.

---

## Testes

```bash
cd server
npm test
```

Os testes automatizados (`server/test/regras.test.js`) cobrem as regras que não dependem do banco:

- lance mínimo (primeiro lance e lances seguintes);
- regra de encerramento no minuto final (sem licitantes, com um, com dois, com e sem pessoas na sala);
- verificação do histórico: íntegro, valor alterado detectado e encerramento antecipado aceito como legítimo.

Também foram feitos **testes manuais de ponta a ponta** contra o banco no Neon (scripts temporários, não versionados):

- **API externa fora do ar:** com a iNaturalist apontada para um endereço que não responde, vitrine, sala, foto, auditoria e comprovante continuaram funcionando; a busca do painel respondeu com mensagem clara.
- **Lances simultâneos:** 8 rodadas de 8 lances disparados ao mesmo tempo por dois licitantes. Em todas, exatamente 1 lance foi aceito; os outros foram recusados pelo motivo correto. A sequência ficou sem buracos, a auditoria íntegra e o saldo comprometido igual à soma dos lotes liderados.
- Liquidação, desistência, encerramento no minuto final e cancelamento.

---

## Deploy

A aplicação roda como **um único serviço** no [Render](https://render.com): o Express serve a API, o Socket.IO e o front já compilado (`client/dist`), com fallback para as rotas do React. O banco fica no Neon.

Configuração do serviço no Render (**Web Service**, ligado ao repositório):

| Campo | Valor |
|---|---|
| Build Command | `npm install --prefix server && npm install --prefix client && npm run build --prefix client` |
| Start Command | `npm start --prefix server` |
| Variáveis | `DATABASE_URL`, `JWT_SECRET`, `AUDIT_SECRET` e `NODE_VERSION=24` |

Depois do primeiro deploy, rode `npm run db:init` e `npm run db:seed` apontando para o banco de produção.

---

## API pública: iNaturalist

**Por que a iNaturalist:** é gratuita, não exige chave, tem fotos com licença aberta e nomes populares em português. A escolha inicial foi outra (Art Institute of Chicago), descartada porque a API bloqueava as requisições do servidor.

**Como é usada:**
- Busca só espécies da família das formigas (Formicidae, `taxon_id=47336`), de 30 em 30 por página.
- Só aparecem espécies com foto em licença **Creative Commons**; o crédito do autor e a licença ficam salvos nos atributos do lote.
- Nomes com hífen são normalizados com espaço ("formiga-vermelha-do-fogo" → "Formiga vermelha do fogo").
- As buscas ficam 5 minutos em cache, para poupar a API.

**Se a API cair:** ao criar um lote, o servidor copia para o banco o título, os atributos e a **própria foto**. Vitrine, sala, auditoria e comprovante usam só o banco, então continuam funcionando (isso foi testado). Só a busca e a criação de lotes novos ficam indisponíveis, com a mensagem *"A API de formigas está indisponível agora. Tente de novo em instantes."* Se houver uma busca recente em cache, ela é usada mesmo vencida.

---

## Regras de negócio

**Lances**
- Só são aceitos com o lote ao vivo (entre início e fim).
- Primeiro lance ≥ lance inicial; os seguintes ≥ lance atual + incremento mínimo.
- Quem está ganhando não pode cobrir o próprio lance.
- O lance só é aceito se couber no **saldo disponível**.
- Ordem das recusas, cada uma com mensagem própria: lote cancelado, não iniciado, encerrado, licitante já ganhando, desistiu do lote, abaixo do mínimo, saldo insuficiente.

**Saldo**
- Disponível = total − comprometido.
- **Comprometido** é calculado, não guardado: soma dos lances em que o licitante lidera, em lotes não cancelados e não liquidados. Ao ser superado, o valor volta ao disponível na hora, sem estorno manual.

**Anti-sniping**
- Um lance aceito nos **últimos 2 minutos** soma mais 2 minutos ao fim atual do lote.

**Liquidação**
- Um processo verifica a cada 2 segundos os lotes encerrados. Com vencedor: debita o vencedor, credita o leiloeiro, registra no extrato dos dois e gera o comprovante. Sem lances: encerra sem vencedor.
- A liquidação é idempotente: rodar duas vezes não cobra duas vezes.

**Cancelamento**
- O leiloeiro pode cancelar um lote próprio enquanto ele estiver agendado ou ao vivo. Sem lances, o lote simplesmente sai da vitrine. Com lances, há **estorno automático**: o valor reservado do licitante que liderava volta na hora ao saldo disponível dele. Lotes encerrados não podem ser cancelados.

**Desistência** _(regra própria, além do PDF)_
- Quem já deu lance e **não está ganhando** pode desistir de um lote ao vivo. Depois disso, não pode mais dar lances nele. Quem está ganhando não pode desistir.

**Encerramento no minuto final** _(regra própria, além do PDF)_
- Se o lote teve **pelo menos 2 licitantes** e **pelo menos um deles está na sala**, ele é encerrado nos **59 segundos finais** e o líder vence.
- Se só uma pessoa deu lance, ou se nenhum licitante está na sala, o lote vai até o último segundo.
- Quando alguém que deu lance sai e sobra só uma pessoa, a vitrine e a sala avisam, nos 2 minutos finais, que o lote será encerrado no minuto final.

---

## Histórico à prova de adulteração

O objetivo é detectar **qualquer** alteração, remoção ou inserção de lances feita depois, inclusive direto no banco.

**Técnica: corrente de selos HMAC-SHA256.**

1. Cada lote nasce com um **selo de gênese**, calculado sobre o id do lote, lance inicial, incremento e início.
2. Cada lance recebe um selo calculado sobre **todos os seus dados** (lote, sequência, licitante, valor, horário, novo fim do lote) **mais o selo do lance anterior**. Assim, os lances ficam encadeados.
3. O lote guarda o selo do último lance e a contagem de lances, também selados.
4. O segredo (`AUDIT_SECRET`) **fica fora do banco**. Quem altera o banco não consegue recalcular os selos.

A página de auditoria refaz a corrente inteira e aponta o problema exato: valor alterado, lance removido ou inserido, sequência quebrada, líder ou lance atual diferente do histórico, horário de fim alterado.

**Como testar a detecção:** altere um lance direto no banco, por exemplo

```sql
UPDATE bids SET amount_cents = amount_cents + 1 WHERE id = 1;
```

e abra `/auditoria/<id do lote>`: o histórico aparece como adulterado, indicando o lance.

O **comprovante** guarda o selo final do histórico no momento da liquidação. Se o banco for restaurado para um estado antigo, o comprovante deixa de bater com o histórico.

---

## Privacidade

Auditoria, histórico de lances e comprovante nunca mostram nome, e-mail ou id do licitante. Cada licitante aparece como um apelido, por exemplo **"Licitante #3FA21C"**, derivado do id com o segredo de auditoria. O apelido **muda de um lote para outro**, então não dá para seguir a mesma pessoa entre lotes. O código do comprovante é aleatório (`randomBytes(12)`), e o vencedor vê o código só nas próprias telas.

---

## Tempo real e concorrência

**Socket.IO**, com salas por lote (`lot:ID`), pela vitrine e por usuário (`user:ID`):

| Evento | Quando |
|---|---|
| `lot:update` | Novo lance, prorrogação, cancelamento, encerramento ou liquidação |
| `lot:presence` | Alguém entrou ou saiu da sala |
| `bid:outbid` | Aviso pessoal: "você foi superado" |
| `lot:won` | Aviso pessoal: "você ganhou", com o código do comprovante |

Os eventos públicos só levam dados do lote e o apelido do licitante.

**Concorrência:** cada lance roda numa transação que trava o lote (`SELECT ... FOR UPDATE`) e depois o licitante, e só então valida as regras, troca o líder, grava o lance com o selo e atualiza o lote. Lances simultâneos no mesmo lote são processados um por vez. A liquidação trava os dois usuários sempre na mesma ordem, para evitar travamento mútuo.

---

## Rotas da API

Todas começam com `/api`. 🔒 = exige login.

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | Teste de vida |
| POST | `/auth/register` | Cadastro (`name`, `email`, `password`, `role`) |
| POST | `/auth/login` | Login, devolve o token |
| GET | `/auth/me` 🔒 | Usuário logado |
| GET | `/wallet` 🔒 | Saldos e extrato |
| POST | `/wallet/deposit` 🔒 licitante | Depósito simulado (`amount_cents`) |
| GET | `/catalog/search?q=&page=` 🔒 leiloeiro | Busca na iNaturalist |
| GET | `/lots?status=&q=` | Vitrine (`live`, `scheduled`, `ended`) |
| GET | `/lots/mine` 🔒 leiloeiro | Lotes do leiloeiro e total recebido |
| POST | `/lots` 🔒 leiloeiro | Cria lote |
| GET | `/lots/:id` | Detalhe do lote |
| GET | `/lots/:id/image` | Foto do lote (do banco) |
| POST | `/lots/:id/cancel` 🔒 leiloeiro | Cancela lote sem lances |
| GET | `/lots/:id/bids` | Histórico de lances |
| POST | `/lots/:id/bids` 🔒 licitante | Dá um lance (`amount_cents`) |
| POST | `/lots/:id/withdraw` 🔒 licitante | Desiste do lote |
| GET | `/audit/:id` | Auditoria pública |
| GET | `/receipts/:code` | Comprovante público |
| GET | `/me/bids` 🔒 licitante | Meus arremates |

---

## Decisões de projeto

- **Status calculado pelas datas**, nunca guardado: não há como o status ficar desatualizado.
- **Saldo comprometido calculado**: superar alguém libera o saldo dele na hora, sem rotina de estorno.
- **Estorno automático pelo saldo calculado**: como o saldo comprometido é calculado a partir dos lotes ativos, cancelar um lote com lances libera o valor do líder no mesmo instante, sem lançamento de estorno no extrato.
- **Anti-sniping literal**: o lance nos 2 minutos finais soma 2 minutos ao fim **atual**.
- **Snapshot do item no banco**, incluindo a foto, para não depender da API externa depois de criado o lote.
- **Sem triggers bloqueando alterações na tabela de lances**: a proposta é **detectar** adulteração. Bloquear a escrita impediria o próprio teste de adulteração.
- **Um único serviço no deploy**: front e API na mesma origem, sem configurar CORS em produção.

---

## Comportamentos inesperados e limitações conhecidas

- **Encerramento antes do horário:** pela regra do minuto final, um lote com dois ou mais licitantes e alguém na sala termina 59 segundos antes do horário mostrado. O encerramento acontece entre 57 e 59 segundos antes, porque o servidor verifica a cada 2 segundos.
- **Presença na sala fica na memória do servidor.** Funciona com uma instância; com várias instâncias, cada uma veria só os próprios visitantes. Uma aba aberta em segundo plano conta como presença.
- **Liquidação a cada 2 segundos:** o liquidador consulta o banco o tempo todo enquanto o servidor está ligado, o que mantém o Neon acordado.
- **Limite da integridade:** quem tiver o `AUDIT_SECRET` consegue refazer os selos, e restaurar o banco inteiro para um estado antigo produz uma corrente válida (o comprovante denuncia esse caso, mas só para lotes liquidados).
- **Desistências e o horário de encerramento antecipado não entram na corrente de selos.** A auditoria aceita o encerramento antecipado quando o horário bate com o registro `early_end_at`.
- **Nomes em inglês:** algumas espécies não têm nome popular em português na iNaturalist e aparecem em inglês.
- **Lotes de demonstração expiram** após alguns dias; rode `npm run db:seed` de novo.
- **Hospedagem gratuita:** no plano gratuito do Render, o serviço "dorme" depois de um tempo sem acesso e o primeiro acesso pode levar cerca de 1 minuto.
- **Fora de escopo** (conforme o PDF): nota fiscal, revenda entre usuários, aplicativo nativo e recuperação de senha.

---

## Extras opcionais

| Extra | Situação |
|---|---|
| Busca e filtro de lotes | ✅ Busca por nome em cada seção da vitrine |
| Cancelamento com estorno automático | ✅ O leiloeiro pode cancelar lotes com lances; o valor reservado de quem liderava volta na hora ao saldo disponível |
| Docker Compose | ✅ `docker compose up --build` sobe o banco e a aplicação |
| Testes automatizados | ✅ Parcial: regras puras e integridade; testes com banco foram manuais |
| Dark Mode | ✅ Dois temas: **Areia** (claro, fundo de areia granulado) e **Terroso** (escuro). Botão no cabeçalho; a escolha fica salva e a primeira visita segue a preferência do sistema |

---

## Uso de IA

Utilizei um assistente de inteligência artificial para esclarecer conceitos, sugerir e revisar trechos de código e auxiliar na depuração de erros. Todo o código foi escrito, revisado, testado e ajustado por mim, com o apoio da IA nos pontos descritos aqui, e as regras de negócio foram definidas por mim.

Além disso, a IA foi utilizada de forma pontual nas seguintes etapas:

- configuração e publicação do banco de dados no Neon;
- ajuste das regras de desistência;
- automação dos testes;
- estilização e animação do site.

---

## Autor

**Luan da Silva Pereira**
