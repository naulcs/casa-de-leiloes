# FormiLance — casa de leilões de formigas

Casa de leilões online em que um **leiloeiro** cria lotes a partir de espécies de formigas da API pública **iNaturalist** e **licitantes** disputam os lotes com lances ao vivo. Cada lance é selado criptograficamente e qualquer pessoa pode auditar o histórico de um lote.

- **Aplicação publicada:** https://formilance.onrender.com
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
15. [Segurança](#segurança)
16. [Tempo real e concorrência](#tempo-real-e-concorrência)
17. [Rotas da API](#rotas-da-api)
18. [Decisões de projeto](#decisões-de-projeto)
19. [Comportamentos inesperados e limitações conhecidas](#comportamentos-inesperados-e-limitações-conhecidas)
20. [Extras opcionais](#extras-opcionais)
21. [Uso de IA](#uso-de-ia)
22. [Autor](#autor)

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
- Vitrine separada em **Ao vivo**, **Agendados** e **Encerrados**, com busca por nome. Lotes cancelados não aparecem. A vitrine se atualiza sozinha pelo Socket.IO: lance novo, lote criado, lote que começou, cancelado ou encerrado aparecem sem recarregar a página.
- Sala do lote com lance atual, histórico em tabela, contagem regressiva e número de pessoas acompanhando.
- Mensagens para listas vazias: lote sem lances, busca sem resultado e auditoria de lote sem lances.
- **Auditoria pública** de cada lote (`/auditoria/:id`), indicando se o histórico está íntegro ou adulterado.
- **Comprovante público** de arremate (`/comprovantes/:codigo`), com botão de compartilhar.

**Licitante**
- Carteira com saldo total, saldo comprometido, saldo disponível, depósito simulado (com mensagem de confirmação) e extrato em tabela.
- Lances ao vivo, com aviso de "você está ganhando", "você foi superado" e a posição do licitante entre os participantes. O aviso de "você foi superado" continua aparecendo mesmo depois de recarregar a página.
- Mensagem específica para cada lance recusado.
- "Meus arremates": lotes em que deu lance, situação de cada um e link do comprovante.
- Desistência de um lote (ver [regras](#regras-de-negócio)).

**Leiloeiro**
- Busca de espécies na iNaturalist, com paginação ("Carregar mais").
- Criação de lote com lance inicial, incremento mínimo, início e fim. O botão fica desabilitado enquanto o lote é criado, então um clique duplo não cria dois lotes.
- Cancelamento de lote próprio agendado ou ao vivo. Sem lances, é o cancelamento pedido no PDF; com lances, o valor reservado de quem liderava volta na hora ao saldo disponível (estorno automático).
- Resultado de cada lote (arrematado ou não e por quanto) e total recebido.
- O leiloeiro **não pode dar lances** e só vê e gerencia os próprios lotes, numa tabela com situação, lance atual e resultado.

As páginas que exigem login (carteira, meus arremates e painel) levam para a tela de entrada e, depois do login, voltam para a página que a pessoa queria abrir.

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
| Formatação e lint | Prettier (aspas duplas, largura 80) e oxlint no front |

O dinheiro é sempre guardado em **centavos** (`BIGINT`), nunca em número com vírgula. Os nomes de funções, variáveis e arquivos estão em inglês; os textos da interface e as mensagens de erro, em português.

---

## Estrutura do projeto

```
casa-de-leiloes/
├── client/                  React + Vite
│   ├── index.html
│   └── src/
│       ├── App.jsx          rotas, cabeçalho e páginas que exigem login
│       ├── api.js           chamadas HTTP e token
│       ├── auth.jsx         sessão do usuário
│       ├── useAuth.js       acesso à sessão nas telas
│       ├── sections.js      abas da vitrine
│       ├── format.js        reais, tempo, plural de lances
│       ├── Carousel.jsx     galeria de lotes
│       ├── AntColony.jsx    animação da página inicial
│       ├── Ant3D.jsx        formiga 3D do logo
│       ├── hooks/           useLotRoom (dados e tempo real da sala)
│       ├── components/      BidForm, BidHistory, AntSearch, LotForm, MyLots
│       └── pages/           Showcase (vitrine), LotRoom (sala), Login,
│                            Wallet, MyBids, Dashboard (painel), Audit, Receipt
├── Dockerfile               imagem da aplicação
├── docker-compose.yml       banco + aplicação
└── server/                  Node + Express
    ├── scripts/dev-helpers.sh   atalhos de terminal para testes manuais
    ├── test/                    rules.test.js e lots.test.js
    └── src/
        ├── index.js         servidor HTTP, rotas, Socket.IO, liquidador
        ├── config.js
        ├── db/              pool, transações, schema.sql, migração, seed
        ├── middleware/      autenticação, papéis e limite de tentativas
        ├── routes/          auth, wallet, catalog, lots, bids, audit, receipts, me
        └── services/        regras de negócio: auctioneer, bidding, settlement,
                             integrity, realtime, inaturalist, lots, wallet
```

As rotas só cuidam do HTTP (ler a requisição, chamar o service e responder). As regras ficam nos `services`: criação e cancelamento de lote em `auctioneer.js`, validação do lote em `lots.js`, lances e desistência em `bidding.js`, depósito em `wallet.js` e liquidação em `settlement.js`.

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

No front, `npm run lint` (dentro de `client/`) roda o oxlint, e `npm run build` gera a versão de produção.

---

## Variáveis de ambiente

Arquivo `server/.env` (nunca vai para o Git; há um modelo em `server/.env.example`):

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | Sim | String de conexão do PostgreSQL. No Neon, use `sslmode=verify-full` (é o que vem no `.env.example`). Num PostgreSQL local sem SSL, tire o `?sslmode=...` do fim da string, senão a conexão falha. |
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

Além das chaves e campos únicos, há índices para as consultas mais frequentes: lances por licitante ("Meus arremates"), lotes ativos por líder (saldo comprometido), lotes por leiloeiro (painel), extrato da carteira, lotes pendentes de liquidação e as abas da vitrine, que filtram os lotes pelas datas de início e fim direto no banco.

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

Os testes automatizados cobrem as regras que não dependem do banco (14 testes):

- `server/test/rules.test.js`: lance mínimo (primeiro lance e lances seguintes); anti-sniping (lance a 10 s e a 1m59s do fim, com 2 minutos e com mais de 2 minutos restantes); verificação do histórico íntegro, com valor alterado e com horário de encerramento alterado (os dois casos são detectados).
- `server/test/lots.test.js`: validação da criação de lote (sem formiga, valores zerados ou quebrados, fim no passado, fim antes do início, duração menor que 1 minuto) e limite de tentativas de login (só as tentativas que falham contam).

Também foram feitos **testes manuais de ponta a ponta** contra o banco no Neon (scripts temporários, não versionados):

- **API externa fora do ar:** com a iNaturalist apontada para um endereço que não responde, vitrine, sala, foto, auditoria e comprovante continuaram funcionando; a busca do painel respondeu com mensagem clara.
- **Lances simultâneos:** 8 rodadas de 8 lances disparados ao mesmo tempo por dois licitantes. Em todas, exatamente 1 lance foi aceito; os outros foram recusados pelo motivo correto. A sequência ficou sem buracos, a auditoria íntegra e o saldo comprometido igual à soma dos lotes liderados.
- **Tempo real na vitrine:** criação de lote, lances, início de um lote agendado e cancelamento chegaram à vitrine pelo socket, sem nenhuma nova consulta à API.
- **Fluxos de tela:** licitante superado que recarrega a página continua vendo o aviso; depósito com mensagem de confirmação; clique duplo em "Criar lote" criou um lote só; páginas com login voltam para o lugar certo depois de entrar; telas a 375 px de largura sem rolagem lateral.
- **Segurança:** busca com mais de 100 caracteres recusada e tentativas de login bloqueadas depois do limite.
- Liquidação, desistência e cancelamento.

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
- Um lance aceito nos **últimos 2 minutos** faz o lote terminar **2 minutos depois desse lance**. Exemplo: lance a 10 segundos do fim → o lote passa a terminar 2 minutos depois do lance. Lances com mais de 2 minutos restantes não mudam o fim.

**Liquidação**
- Um processo verifica a cada 2 segundos os lotes encerrados. Com vencedor: debita o vencedor, credita o leiloeiro, registra no extrato dos dois e gera o comprovante. Sem lances: encerra sem vencedor.
- A liquidação é idempotente: rodar duas vezes não cobra duas vezes.

**Cancelamento**
- O leiloeiro pode cancelar um lote próprio enquanto ele estiver agendado ou ao vivo. Sem lances, o lote simplesmente sai da vitrine. Com lances, há **estorno automático**: o valor reservado do licitante que liderava volta na hora ao saldo disponível dele. Lotes encerrados não podem ser cancelados.

**Desistência** _(regra própria, além do PDF)_
- Quem já deu lance e **não está ganhando** pode desistir de um lote ao vivo. Depois disso, não pode mais dar lances nele. Quem está ganhando não pode desistir.

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

## Segurança

- **Senhas** guardadas com `bcryptjs`; login por JWT com validade de 7 dias.
- **Limite de tentativas** em `/auth/login` e `/auth/register`: depois de 10 tentativas que falham em 15 minutos, o mesmo endereço recebe `429` com a mensagem *"Muitas tentativas seguidas. Espere alguns minutos e tente de novo."* Tentativas que dão certo não contam, então quem usa o site normalmente não é bloqueado.
- **Busca limitada a 100 caracteres** na vitrine (`/lots?q=`) e no catálogo, porque a busca percorre o título e os atributos de cada lote.
- **Sem CORS:** em produção o front e a API ficam na mesma origem, e no desenvolvimento o Vite encaminha as chamadas. Por isso o servidor não aceita requisições de outros sites.
- **Valores conferidos no servidor:** ids, valores em centavos, datas e tamanhos de texto são validados antes de qualquer consulta, e todo SQL usa parâmetros (`$1`, `$2`...), sem montar texto com dados do usuário.
- **Segredos** (`JWT_SECRET`, `AUDIT_SECRET`, `DATABASE_URL`) só no `.env` e nas variáveis do Render, nunca no repositório.

---

## Tempo real e concorrência

**Socket.IO**, com salas por lote (`lot:ID`), pela vitrine e por usuário (`user:ID`):

| Evento | Quando |
|---|---|
| `lot:update` | Lote criado, lote agendado que começou, novo lance, prorrogação, cancelamento, encerramento ou liquidação |
| `lot:presence` | Alguém entrou ou saiu da sala |
| `bid:outbid` | Aviso pessoal: "você foi superado" |
| `lot:won` | Aviso pessoal: "você ganhou", com o código do comprovante |

Os eventos públicos só levam dados do lote e o apelido do licitante.

**Vitrine sem consultas repetidas:** a vitrine busca a lista uma vez e depois só escuta a sala `showcase`. Cada `lot:update` entra, sai ou atualiza o cartão conforme a aba aberta, e a lista é buscada de novo apenas se a conexão cair e voltar. Para que um lote agendado apareça em "Ao vivo" na hora certa, o mesmo processo que faz a liquidação avisa a cada 2 segundos os lotes que acabaram de começar.

**Concorrência:** cada lance roda numa transação que trava o lote (`SELECT ... FOR UPDATE`) e depois o licitante, e só então valida as regras, troca o líder, grava o lance com o selo e atualiza o lote. Lances simultâneos no mesmo lote são processados um por vez. A liquidação trava os dois usuários sempre na mesma ordem, para evitar travamento mútuo.

---

## Rotas da API

Todas começam com `/api`. 🔒 = exige login.

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | Teste de vida |
| POST | `/auth/register` | Cadastro (`name`, `email`, `password`, `role`), com limite de tentativas |
| POST | `/auth/login` | Login, devolve o token, com limite de tentativas |
| GET | `/auth/me` 🔒 | Usuário logado |
| GET | `/wallet` 🔒 | Saldos e extrato |
| POST | `/wallet/deposit` 🔒 licitante | Depósito simulado (`amount_cents`) |
| GET | `/catalog/search?q=&page=` 🔒 leiloeiro | Busca na iNaturalist |
| GET | `/lots?status=&q=` | Vitrine (`live`, `scheduled`, `ended`), busca de até 100 caracteres |
| GET | `/lots/mine` 🔒 leiloeiro | Lotes do leiloeiro e total recebido |
| POST | `/lots` 🔒 leiloeiro | Cria lote |
| GET | `/lots/:id` | Detalhe do lote |
| GET | `/lots/:id/image` | Foto do lote (do banco) |
| POST | `/lots/:id/cancel` 🔒 leiloeiro | Cancela lote agendado ou ao vivo; se houver lances, devolve na hora o valor reservado de quem liderava |
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
- **Anti-sniping pelo momento do lance**: o PDF diz que o lance nos 2 minutos finais "estende o fim do lote para +2 minutos". A leitura adotada é que o fim **passa a ser 2 minutos depois do lance**, então todo lance tardio deixa exatamente 2 minutos para os outros responderem.
- **Snapshot do item no banco**, incluindo a foto, para não depender da API externa depois de criado o lote.
- **Sem triggers bloqueando alterações na tabela de lances**: a proposta é **detectar** adulteração. Bloquear a escrita impediria o próprio teste de adulteração.
- **Um único serviço no deploy**: front e API na mesma origem, sem CORS.
- **Regras de negócio nos services**: as rotas só tratam a requisição e a resposta, o que deixa as regras reaproveitáveis (o seed usa a mesma função de lance da aplicação) e testáveis sem subir o servidor.
- **Telas divididas em partes menores**: a sala usa o hook `useLotRoom` e os componentes `BidForm` e `BidHistory`; o painel usa `AntSearch`, `LotForm` e `MyLots`.
- **Nomes em inglês no código**: funções, variáveis, componentes e classes CSS seguem um idioma só. Textos da interface, mensagens de erro e endereços das páginas (`/lotes/:id`, `/carteira`...) ficam em português, porque são o que o usuário vê.
- **JavaScript, sem TypeScript**: avaliei migrar para TypeScript, mas preferi não reescrever todos os arquivos perto do prazo. As entradas da API são validadas no servidor e as regras principais têm testes automatizados.

---

## Comportamentos inesperados e limitações conhecidas

- **Presença na sala e limite de tentativas ficam na memória do servidor.** Funcionam com uma instância; com várias instâncias, cada uma teria a própria contagem. Uma aba aberta em segundo plano conta como presença, e reiniciar o servidor zera o limite de tentativas.
- **Liquidação a cada 2 segundos:** o liquidador consulta o banco o tempo todo enquanto o servidor está ligado, o que mantém o Neon acordado.
- **Limite da integridade:** quem tiver o `AUDIT_SECRET` consegue refazer os selos, e restaurar o banco inteiro para um estado antigo produz uma corrente válida (o comprovante denuncia esse caso, mas só para lotes liquidados).
- **Desistências não entram na corrente de selos:** ficam numa tabela separada e não alteram o histórico de lances.
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
| Testes automatizados | ✅ Parcial: regras puras, integridade, validação de lote e limite de tentativas; os fluxos com banco foram testados manualmente |
| Dark Mode | ✅ Dois temas: **Areia** (claro, fundo de areia granulado) e **Terroso** (escuro). Botão no cabeçalho; a escolha fica salva e a primeira visita segue a preferência do sistema |

---

## Uso de IA

Usei um assistente de inteligência artificial como par de programação durante todo o projeto. Eu definia o que construir e como cada parte deveria funcionar; a IA escrevia a maior parte do código a partir dessas definições; eu montava cada etapa, rodava, testava e pedia correções até o resultado ficar como eu queria.

**Onde a IA foi usada**
- geração de funções repetitivas do código do back-end e do front-end;
- configuração do banco no Neon e do deploy no Render;
- implementação das regras de desistência e automação dos testes;
- estilização e animação do site;
- depuração dos erros encontrados nos meus testes.

**O que eu decidi, revisei e ajustei**
- o nome FormiLance e a direção visual, a partir de referências que eu escolhi (carrossel, cores, temas areia e terroso, formiga 3D);
- regras além do PDF, como a desistência; também propus uma regra de encerramento no minuto final e depois a removi, para o leilão sempre ir até o horário de fim;
- testes manuais de cada fluxo: lances, carteira, liquidação, comprovante, auditoria e cancelamento;
- configuração das contas e das variáveis de ambiente no Neon e no Render;
- revisão do projeto com base no PDF e escolha de quais sugestões de melhoria aplicar.

**Correções e sugestões que fiz durante o desenvolvimento**

Encontrei estes pontos testando o site manualmente ou revisando o que a IA entregava, e pedi as correções:

- **Regra que não estava no PDF:** uma análise da IA marcou o cancelamento com estorno automático como "não implementado", dizendo que ele contrariava uma regra obrigatória de recusar o cancelamento de lotes com lances. Conferi no PDF: ele pede que o leiloeiro possa cancelar lotes sem lances e lista o cancelamento com estorno como opcional, sem proibir nada. A proibição vinha de um checklist que eu tinha usado antes. A partir daí, corrigir manualmente seguindo as informações do PDF, e o cancelamento com estorno foi implementado.
- **Comprovante quebrado:** no fim de um leilão de teste, o link do comprovante abria uma página em branco e sumia quando eu voltava, e não havia como ver o comprovante depois. Isso levou à página pública do comprovante e ao link em "Meus arremates" e na vitrine.
- **Lote no lugar errado:** um lote listado na aba "Ao vivo" abria como encerrado na sala. Também pedi o cronômetro nos cartões dos lotes ao vivo.
- **Desistência:** testando com duas contas, sugeri um botão para o licitante desistir de um lote. Depois percebi que, com só dois participantes, uma desistência entregava o item sem dar chance para outra pessoa entrar no leilão, e pedi para mudar a regra.
- **Regra do minuto final:** propus e detalhei uma regra de encerramento no minuto final (quantos licitantes, quem precisava estar na sala). Ela encurtava a prorrogação de 2 minutos do PDF, então primeiro deixei desligada e depois a removi, para o leilão sempre ir até o horário de fim.
- **Poucas formigas:** notei que o banco tinha só 12 espécies e pedi para buscar mais espécies da iNaturalist e para tirar o hífen dos nomes ("formiga-vermelha" → "formiga vermelha").
- **Visual:** achei o primeiro front "cru" e dirigi a identidade visual com referências que eu escolhi: carrossel no estilo do Instagram, página inicial com formigueiro animado, cores terrosas, temas areia e terroso e formiga 3D no logo. A formiga saía do quadro ao girar e girava rápido demais; pedi para ela ficar de frente e só girar com o mouse em cima. Também pedi o menu no topo e o título mais para cima.
- **Título cortado no deploy:** no site publicado, o nome FormiLance aparecia cortado, e pedi a correção.

---

## Autor

**Luan da Silva Pereira**
