---
allowed-tools: Bash(herdr *), Bash(git *), Bash(*/scripts/*.sh *), Bash(jq *), Read
argument-hint: <branch> と作業内容、または 監視/停止などの操作
description: herdrとgit worktreeで並列Claudeエージェントを管理する。ブランチごとに独立したworktree+herdrワークスペースを作り、サブエージェントの起動・監視・指示・停止・後片付けを行う。並列実装・並列レビュー・調査ワーカーの起動に使う。
metadata:
    github-path: skills/herdr-worktree
    github-ref: refs/heads/main
    github-repo: https://github.com/ncukondo/agent-skills
    github-tree-sha: 6d739d572166bd1f1d1b795a4aa5cc3e1dbc7b54
name: herdr-worktree
---
# herdr-worktree: worktree並列エージェント管理

git worktreeでブランチごとに独立した作業環境を作り、[herdr](https://herdr.dev) のワークスペース/ペインでClaudeエージェントを並列に走らせる。エージェントは `--permission-mode auto` で起動され、許可プロンプトなしで自律作業する。

## 前提条件

- `herdr` インストール済み・サーバー起動中（`herdr status` で確認）
- Claude統合インストール済み（`herdr integration install claude`）— これがないとエージェント状態を検知できない
- `jq`, `git`（`--pr` オプションを使う場合は `gh` も）
- **対象リポジトリの中から実行すること**（リポジトリはcwdから `git rev-parse` で特定される）

## スクリプト一覧

スキルの `scripts/` ディレクトリにある。`<target>` はpane ID（例 `w13:p2`）またはエージェント名（worktreeディレクトリ名）。

| スクリプト | 用途 |
|---|---|
| `spawn-agent.sh <branch> [--create] [--pr <n>] [--setup <cmd>\|--no-setup] [-- <prompt>]` | worktree作成（lockfileから npm/pnpm/yarn install を自動判定）+ エージェント起動 |
| `launch-agent.sh <dir> [prompt]` | 既存ディレクトリでエージェント起動（spawn-agentの下請け） |
| `monitor-agents.sh [--watch] [--json] [--all]` | このリポジトリのエージェント一覧・状態 |
| `check-agent-state.sh <target>` | 状態確認: idle / working / permission / starting |
| `send-to-agent.sh <target> "<prompt>"` | 実行中エージェントへ追加指示（idle時のみ） |
| `kill-agent.sh <target> [--keep-pane]` | エージェント停止（ペインを閉じる） |
| `remove-worktree.sh <branch> [--delete-branch]` | エージェント停止 + workspace/worktree削除 + ブランチ削除 |

## 基本ワークフロー

```bash
SKILL_SCRIPTS=<このスキルのscripts/への絶対パス>

# 1. ワーカー起動（新規ブランチ + worktree + herdr workspace + claude）
"$SKILL_SCRIPTS/spawn-agent.sh" feat/my-feature --create -- "docs/plan.md に従って実装し、PRを作成して"

# 2. 完了待ち（タスク完了で "done" になる）
herdr wait agent-status <pane> --status done --timeout 3600000

# 3. 出力確認
herdr agent read <pane> --lines 30

# 4. 追加指示（必要なら）
"$SKILL_SCRIPTS/send-to-agent.sh" <pane> "テストが落ちているので修正して"
# 追加指示の後は working → done の順で待つこと（下記の注意参照）

# 5. 後片付け（マージ後など）
"$SKILL_SCRIPTS/remove-worktree.sh" feat/my-feature --delete-branch
```

並列起動する場合は spawn-agent.sh を順番に実行する（`git worktree add` の同時実行はgitのlock競合を起こしうる）。ワーカー数は4体程度までを目安にする。

## herdrの挙動に関する重要な注意

運用検証で判明した仕様。ハマりやすいので必ず守ること。

1. **herdr CLIは失敗してもexit 0**。エラーはJSONの `{"error": ...}` フィールドで返る。生の `herdr` コマンドを使うときは必ずペイロードを確認する（同梱スクリプトは対応済み）。
2. **タスク完了は `idle` ではなく `done`**。`herdr wait agent-status --status done` で待つ。`check-agent-state.sh` は done を idle にマップして返す。
3. **send直後の `done` 待ちはレースする**。前タスクの done 状態が残っているため即座にマッチしてしまう。追加指示の後は `--status working` を待ってから `--status done` を待つ。
4. **起動時ダイアログ（MCP確認・trust prompt）が `idle` と報告されることがある**。「idle=完了」と断定せず、`herdr agent read` で画面を確認するか、成果物（PR・ファイル・コミット）で完了を裏取りする。ダイアログで止まっていたら `herdr pane send-keys <pane> Enter` で承認できる。
5. **workspaceのルートペイン**: `herdr worktree open` はシェルのルートペインを必ず1つ作る。launch-agent.sh は新規作成時にこれを自動で閉じる（既存workspaceのペインは触らない）。
6. **長時間の `herdr wait` は呼び出し側の都合で切られることがある**。オーケストレーター側のエージェントから数十分規模の完了待ちを張る場合は、`herdr wait` 単発に頼らず、ポーリング（`check-agent-state.sh` のループ）やエージェントハーネス側の監視機能を併用する。
7. **`herdr pane run` のEnterがClaude TUIに飲まれることがある**（断続的なrace）。プロンプトが入力欄に未送信のまま残り、エージェントはidleのまま。また pane run は成功時に何も出力しない（他コマンドと違いJSONを返さない）。send-to-agent.sh は送信後に working への遷移を確認し、だめならEnterを再送する — 生の pane run ではなく必ずこちらを使う。
8. **pane captureの入力行（`❯`）にゴーストサジェストが写ることがある**。Claude TUIが表示する入力候補（例: 次に打ちそうなスラッシュコマンド）で、実際の入力ではない。`herdr agent read` の出力で入力欄に文字が見えても、それだけで「誰かが入力した」と判断しないこと。

## 状態モデル

| herdr状態 | check-agent-state.sh | 意味 |
|---|---|---|
| `working` | working | タスク実行中 |
| `done` | idle | タスク完了・入力待ち |
| `idle` | idle | 入力待ち |
| `blocked` | permission | ダイアログ等で停止中・要対応 |
| `unknown` | starting | 検知直後で状態未確定 |

## worktreeのパス規約

`~/.herdr/worktrees/<リポジトリ名>/<ブランチ名のスラッシュをダッシュに変換>`（herdr自身の規約と同一）。この配下に作ることで `herdr worktree list` から見え、workspace連動の削除（`herdr worktree remove --workspace`）が使える。

## トラブルシューティング

- **エージェントが30秒たっても working にならない**: launch-agent.sh が警告を出す。`herdr agent read <pane> --lines 30` で画面確認 → ダイアログなら `herdr pane send-keys <pane> Enter`。
- **`agent not found`**: claudeが終了済みか、Claude統合が未インストール。`herdr integration install claude` を確認。
- **worktreeが削除できない**: `remove-worktree.sh` がherdr→git→rm -rfの順でフォールバックする。それでも残る場合は `git worktree prune`。
