# 工事工程ガント管理アプリ 初期版

GitHub + Vercel + Frappe Gantt + GAS + Googleスプレッドシート構成の初期プロトタイプです。

## できること

- 工事一覧の表示
- 工事ごとの工程表表示
- Frappe Ganttによるガントチャート表示
- ガントバーのドラッグによる日程変更
- ガントバーの進捗変更
- 工程の追加・編集・削除
- テンプレート工程の追加
- 変更履歴の表示
- localStorageへの一時保存
- GAS経由のGoogleスプレッドシート読込・保存の雛形

## ファイル構成

```text
kouji-gantt-manager/
├ index.html
├ css/
│  └ style.css
├ js/
│  ├ app.js
│  ├ api.js
│  ├ gantt.js
│  ├ sampleData.js
│  └ utils.js
├ gas/
│  └ Code.gs
├ sheets/
│  ├ 01_projects.csv
│  ├ 04_tasks.csv
│  └ 05_change_logs.csv
├ vercel.json
├ package.json
└ README.md
```

## ローカル確認

一番簡単な確認方法です。

```bash
cd kouji-gantt-manager
python3 -m http.server 5173
```

ブラウザで下記を開きます。

```text
http://localhost:5173
```

Windowsで `python3` が使えない場合は、下記でもOKです。

```bash
python -m http.server 5173
```

## GitHub / Vercel公開

1. GitHubで新規リポジトリを作成
2. このフォルダ内のファイルをアップロード
3. Vercelで対象リポジトリをImport
4. Framework PresetはOtherまたはStatic扱いでOK
5. Build Commandは空欄でOK
6. Output Directoryも空欄または `.` でOK
7. Deploy

## GAS / スプレッドシート連携手順

### 1. Googleスプレッドシートを作成

任意のGoogleスプレッドシートを作成してください。

### 2. Apps Scriptを開く

スプレッドシート上部メニューから、

```text
拡張機能 > Apps Script
```

を開きます。

### 3. Code.gsを貼り付け

`gas/Code.gs` の内容をApps Scriptに貼り付けます。

### 4. SPREADSHEET_IDを設定

スプレッドシートURLの `/d/` と `/edit` の間にあるIDをコピーして、下記に貼り付けます。

```javascript
const SPREADSHEET_ID = 'ここにスプレッドシートIDを入れてください';
```

### 5. setupSheetsを一度実行

Apps Script上で `setupSheets` を選択して実行します。

これで以下のシートが作成されます。

```text
01_工事台帳
04_工程データ
05_変更履歴
```

### 6. Webアプリとしてデプロイ

```text
デプロイ > 新しいデプロイ > 種類の選択 > ウェブアプリ
```

設定例：

```text
実行ユーザー：自分
アクセスできるユーザー：全員、または必要に応じた範囲
```

発行されたWebアプリURLを、画面上部の「GAS URL」に貼り付けます。

### 7. GAS読込 / GAS保存

- `GAS読込`：スプレッドシートからデータを読み込み
- `GAS保存`：画面上のデータをスプレッドシートへ保存

## スプレッドシート列

### 01_工事台帳

```text
project_id, project_name, customer_name, site_address, project_type, planned_start, planned_end, status, manager, memo
```

### 04_工程データ

```text
id, project_id, name, category, start, end, progress, contractor, status, dependencies, memo, source, is_manual_edited
```

### 05_変更履歴

```text
log_id, timestamp, user, project_id, task_id, task_name, action_type, memo
```

## 注意点

- 初期版ではログイン・権限管理は未実装です。
- GAS URLを公開範囲「全員」にする場合、URLを知っている人がアクセスできる可能性があります。
- 本番運用前には、認証・権限・編集履歴・バックアップ設計を追加してください。
- Frappe GanttはCDNから読み込んでいます。オフライン環境や社内制限がある場合は、ライブラリをローカル配置する方式に変更してください。

## 次の開発候補

- 工事台帳の編集画面
- 見積入力から工程表たたき台生成
- 足場あり/なしなど条件による工程生成
- 工程の非表示機能
- 手動編集済み工程の上書き保護
- 休日・祝日考慮
- 担当者・協力会社マスタ
- ログイン・権限管理


## 更新メモ v0.1.1

- 工程編集モーダルが閉じられない場合がある問題を修正しました。
- `hidden` 属性が CSS の `display: grid` に負けないよう、`[hidden] { display: none !important; }` を追加しました。
- Escapeキーでもモーダルを閉じられるようにしました。

## v3 追加内容

- 工事一覧を「契約前」「着手中」「完了」「ゴミ箱」のフォルダで切り替え
- 工事情報編集モーダルを追加
- 工事一覧からの削除は一度ゴミ箱へ移動
- ゴミ箱内では「復元」「完全削除」が可能
- 着工予定日・完工予定日を簡単に変更できる日程変更パネルを追加
- 着工予定日変更時に、工程全体を同じ日数だけ移動するオプションを追加
- GASの `01_projects` に `project_folder / deleted_at / previous_folder` 列を追加

既存スプレッドシートを使う場合は、GASの `setupSheets()` を再実行してヘッダーを更新してください。その後、画面側から一度「GAS保存」を行うと新しい列構成で保存されます。

## v4 ガント表示・操作改善

- 工程名列を広めに表示するCSSを追加しました。
- 日表示のカレンダー幅を広げ、1日単位の視認性を上げました。
- 表示単位「日 / 週 / 月」の切替をFrappe Gantt側へ明示的に反映するようにしました。
- 初期表示位置は、選択中工事の最初の工程開始日を基準にしました。
- バー中央の横移動は無効扱いにし、左右端のドラッグによる期間変更を使う運用に寄せました。
- 左右端のドラッグハンドルを太くし、掴みやすくしました。
- Frappe GanttのCDNを `1.2.2` に固定しました。

差し替え対象ファイル：

```text
index.html
css/style.css
js/app.js
js/gantt.js
README.md
```
