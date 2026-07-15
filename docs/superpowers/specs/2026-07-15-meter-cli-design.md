# Meter CLI (`@meter-mcp/cli`) 設計書

日付: 2026-07-15
状態: 承認済み設計（実装計画は別文書）

## 目的

Meter に載せる MCP サービスのプロバイダー開発者向けに、Stripe CLI 相当の開発体験を提供する。対象は「Node で MCP サーバーを書く開発者」。買い手・admin・operator の各認証面は対象外とする。

v1 の範囲: オンボーディング（login / init、雛形生成込み）、リソース管理（CRUD）、使用イベントの tail と残高照会、ローカル開発支援（webhook のローカル転送 `meter listen`、テストツールコール `meter call`）。

## 決定事項の要約

| 論点 | 決定 |
|------|------|
| 利用者 | プロバイダー開発者（DX 向上） |
| 配置 | meter-sdk monorepo に `packages/cli`（`@meter-mcp/cli`、bin 名 `meter`） |
| 実装方式 | `MeterPublicApiClient` の薄いラッパー（TypeScript、ESM、Node >=20） |
| ランタイム依存 | `@meter-mcp/sdk` + commander の 2 つのみ |
| `meter listen` | v1 に含める。meter 本体に poll モードの webhook API を追加 |
| `meter init` | 雛形生成まで含める（テンプレートは 1 種類、組み込み方式） |

npm のパッケージ名 `meter` は既存パッケージ（Express middleware）に取られているため使えないが、`@meter-mcp/cli` パッケージ内の bin 名 `meter` は問題なく使える。`npx @meter-mcp/cli` と `npm i -g` の両方をサポートする。

検討して退けた代替案:

- **OpenAPI 生成型 CLI**: API 追随は自動になるが、init の対話フロー・listen・雛形は結局手書きになり、生成コマンドの UX が機械的になる。乖離検出は既存の `verify:openapi` の拡張で足りる。
- **Go/Rust 単一バイナリ**: 配布は最良だが SDK の型を共有できず、雛形（TypeScript）と実装言語が分離する。対象ユーザーには Node がほぼ確実にあるため利点が薄い。

## 1. パッケージ構成・設定・認証

### パッケージ

- `packages/cli`。tsup ビルド、既存の changesets / publint / attw のリリース検証に組み込む。
- bin: `meter`。

### 設定ファイル

`~/.config/meter/config.json`（0600 パーミッション）。プロファイル制:

```json
{
  "profiles": {
    "default": { "baseUrl": "https://meter-mcp.vercel.app", "serviceId": "liminal", "apiKey": "sk_..." },
    "local":   { "baseUrl": "http://localhost:3000", "serviceId": "demo", "apiKey": "sk_..." }
  },
  "activeProfile": "default"
}
```

- API キーの平文保存は Stripe CLI と同じ前例に従う。keychain 対応は見送り。
- 解決の優先順位: **コマンドラインフラグ > 環境変数（`METER_API_KEY` / `METER_BASE_URL` / `METER_SERVICE_ID`）> プロファイル**。
- 全コマンド共通フラグ: `--profile <name>`、`--json`（機械可読出力）。

### 認証

扱う認証は 2 種類のみ:

- **サービス API キー**: 通常の全コマンドの認証。`meter login` で対話保存し、保存前に `listServices` で疎通確認する。
- **オンボーディングキー**: `meter init` のサービス新規作成（`POST /api/onboarding/v1/services`）のみに使用。設定ファイルには保存せず、フラグ / 環境変数 / プロンプトからその場で受け取る。作成後に発行されるサービス API キーの方を保存する。

## 2. コマンド体系

すべて Public API v1（`MeterPublicApiClient`）の薄いラッパー。出力は人間向け表形式、`--json` で生 JSON。

```
meter login                 # base URL + サービス API キーを対話保存、疎通確認
meter logout                # プロファイル削除
meter whoami                # 認証先とサービス情報を表示

meter init                  # 雛形生成 + サービス登録（§4）

meter services get          # サービス設定の表示
meter services update       # name / creditName / brandColor / supportEmail 等

meter integration get       # gateway・upstream・顧客認証・toolPrices の現在値
meter integration update    # 同上の更新（--upstream-url, --customer-auth 等）

meter prices list           # integration.toolPrices の一覧（credit と USD 換算を並記）
meter prices set <tool> <credits>   # 1 ツール分だけ更新する簡易コマンド

meter keys list | create <name> | revoke <id>

meter customers list | get <localId>
meter customers grant <localId> <credits> --reason "..."   # credit-adjustments
meter customers suspend | resume <localId>                 # status API

meter balance <localId>     # 残高 + auto-recharge 設定
meter ledger <localId>      # credit_ledger の直近エントリ

meter usage                 # ロールアップ（--by tool|customer、--since、AI コスト/マージン込み）
meter events tail           # 使用イベントのポーリング表示（--customer, --tool フィルタ）

meter webhooks list | create <url> | delete <id> | test [--url]
meter listen [--forward-to <URL>]   # §3

meter call <tool> [--args '{}'] [--customer <localId>]   # ゲートウェイ経由のテストツールコール
```

- **`meter events tail`** はサーバー変更なしで実装する。usage 照会 API をカーソル（最終 ts + id）付きで 2〜3 秒間隔でポーリングし、新規イベントだけを 1 行 1 イベントで着色表示する。tail 用のストリーミング API は v1 では追加しない（既存 API で成立するため）。
- **`meter call`** はテスト顧客（localId `cli-test`、なければ自動作成して初期クレジット付与）で買い手 API キーを発行し、`/api/gateway/v1/services/<id>/mcp` に `tools/call` を送って課金結果（消費クレジット・残高）まで表示する。`payment_required` の再現は残高ゼロの顧客を `--customer` に指定するだけでできる。

## 3. `meter listen` とサーバー側 API

Vercel 上の Meter からローカル開発マシンへは到達できないため、Stripe CLI と同じ「CLI 側から取りに行く」方式にする。既存の webhook outbox（`provider-webhooks.ts`）に **poll モードのエンドポイント**という概念を 1 つだけ追加する。

### サーバー側の追加（meter 本体リポジトリ）

1. `webhook_endpoints` に `mode: "push" | "poll"` を追加（既存行は push）。poll エンドポイントは URL を持たず、作成レスポンスで署名シークレットを返す。
2. outbox への enqueue は push / poll 共通（イベント種別も既存のまま）。**配送 cron は poll エンドポイント宛の行をスキップ**する。
3. 取得 API: `GET /api/v1/services/{id}/webhook-endpoints/{endpointId}/deliveries/pending?cursor=<id>&wait=25`。Vercel Functions の実行時間内に収まる最大 25 秒のロングポーリング。署名済みペイロード（body 原文と `x-meter-signature` に入る値）を返す。
4. ack API: `POST .../deliveries/ack { ids: [...] }`。ack された行を delivered にする。at-least-once 配送（ack 前に CLI が落ちた行は再取得される）。
5. **後始末**: CLI は SIGINT で自分の poll エンドポイントを削除する。取りこぼし対策として、最終ポーリングから 24 時間経過した poll エンドポイントを既存の prune cron が disabled にし、その pending 行を expire する。

`openapi-v1.ts` を同一変更で更新し、`verify:public-api-contract` を通す。`MeterPublicApiClient` にも `pollWebhookDeliveries` / `ackWebhookDeliveries` を追加する（SDK と CLI を同時にリリースできる配置の利点がここで出る）。

### CLI 側の挙動

```
$ meter listen --forward-to http://localhost:8787/webhooks/meter
> 署名シークレット: whsec_xxxx （ローカルサーバーの検証用に .env へ）
> Waiting for events...
2026-07-15 14:02:11  usage.committed      → 200 OK (12ms)
2026-07-15 14:02:30  credit.low_balance   → 500 (retrying in 2s)
```

- 受信イベントを `--forward-to` へ原文 body + `x-meter-signature` 付きで POST する。
- ローカルが 2xx 以外を返したら CLI 内で数回リトライし、最終失敗は表示のみとする。サーバー側の ack は取得成功時点で行い、再配送の責任は listen セッション内に閉じる。
- `--forward-to` 省略時はイベントを整形表示するだけの観察モード。

## 4. `meter init`（雛形生成）

雛形は 1 種類のみ。Meter には gateway 方式（プロバイダーのサーバーは課金コード無し、Meter がプロキシ）と組み込み方式（`@meter-mcp/mcp` で直接メーター）の 2 系統があるが、gateway 方式は upstream が公開 URL である必要がありローカルで完結しないため、**雛形は組み込み方式**を採用する。gateway 化は後から `meter integration update --upstream-url` でできる旨を README に書く。

### 生成される内容（TypeScript / Streamable HTTP MCP サーバー）

```
my-service/
├── src/server.ts        # @modelcontextprotocol/sdk + @meter-mcp/mcp
│                        #   例ツール 2 つ: echo（固定価格）と
│                        #   summarize（creditsOverride で出力量課金の実例）
├── .env                 # METER_BASE_URL / METER_API_KEY / METER_SERVICE_ID 書き込み済み
├── .env.example
├── .gitignore           # .env を除外
├── package.json         # dev: tsx watch, build: tsup
└── README.md            # 動作確認手順と gateway 化の案内
```

### 対話フロー

1. プロジェクト名（= ディレクトリ名、serviceId の初期値）
2. サービスの用意: 「新規作成（オンボーディングキーを入力）」か「既存サービスを使う（ログイン済みプロファイル）」の二択
3. 新規作成時: `POST /api/onboarding/v1/services` → サービス API キー発行 → プロファイルと `.env` の両方へ保存
4. 例ツール 2 つの `toolPrices` を integration に登録
5. `npm install` 実行（`--no-install` で省略可）
6. 完了メッセージで次の 3 手を提示: `npm run dev` → `meter call echo --args '{"text":"hi"}'` → `meter events tail`

**受け入れ基準: init 完了から 1 分以内に「ツールを呼んでクレジットが減る」ところまで到達できること。**

テンプレートは `packages/cli/templates/` に実ファイルとして置き、CI で「テンプレートを実際に生成して `tsc --noEmit` が通る」検証を足す（機械的な最下層チェック）。

## 5. テストとリリース

### meter 本体側（listen 用 API）

- `smoke:public-api` に poll エンドポイントのケースを追加: poll モード作成 → イベント発火 → pending 取得 → ack → 再取得で空、の一巡。配送 cron が poll 宛をスキップすること、prune cron が 24 時間無応答の poll エンドポイントを無効化することも同じスモークで検証する。
- `verify:public-api-contract` / `verify:public-api-exports` が新ルートと SDK エクスポートの乖離を機械検出する（既存の仕組みをそのまま使う）。

### meter-sdk 側（CLI 本体）

- 各パッケージと同じく node test runner を使う。
- ユニット: 設定の優先順位解決（フラグ > 環境変数 > プロファイル）、出力整形、tail のカーソル計算。
- コマンド統合テスト: SDK のテストと同じ方式で、インプロセスのモック HTTP サーバーに対して CLI コマンド関数を実行し、リクエスト形状と終了コードを検証する。`login` はプロンプトを注入可能にして自動化する。
- テンプレート検証: CI で `meter init` を実際に走らせ（サービス作成はモック）、生成物に `tsc --noEmit` が通ることを確認する。
- ルートの `verify` スクリプト（build + test + typecheck + publint + attw + openapi 照合）に cli パッケージを組み込む。

### リリース

changesets で `@meter-mcp/cli@0.1.0` として他 3 パッケージと同列に公開する。

### 実装順序（依存の向き）

1. meter 本体に poll API + スモーク
2. SDK に `pollWebhookDeliveries` / `ackWebhookDeliveries` を追加
3. CLI パッケージ（login / CRUD / tail / call → init → listen の順）

1 と 2 が先に必要なのは listen だけで、CLI の大半は現行 API だけで作り始められるため、実際には 3 を並行で進められる。
