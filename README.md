# K12Media 試卷查看器

基於 Cloudflare Workers + Pages 的試卷圖片在線查看系統。

## 功能

- 🔐 Cookie 認證登錄 k12media.cn
- 🔍 按學號或姓名搜索學生
- 📚 按科目分類查看答卷圖片
- 🖼️ 多圖預覽與全屏查看
- 🤖 預留 AI 文字識別與自動閱卷接口

## 技術棧

- **前端**: HTML/CSS/JavaScript (Cloudflare Pages)
- **後端**: Cloudflare Workers
- **API 代理**: 解決 CORS 跨域問題

## 部署

### 1. 安裝依賴

```bash
cd worker
npm install
```

### 2. 本地開發

```bash
# 啟動 Worker
cd worker
npx wrangler dev

# 預覽前端
cd frontend
python3 -m http.server 3000
```

### 3. 部署到 Cloudflare

```bash
# 部署 Worker
cd worker
npx wrangler publish

# 前端通過 Cloudflare Pages 自動部署
```

## 使用說明

1. 從瀏覽器獲取 k12media.cn 的 Cookie
2. 在網頁中粘貼 Cookie 完成認證
3. 輸入學生學號或姓名進行搜索
4. 點擊科目標籤查看對應答卷圖片

## 目錄結構

```
k12media-web/
├── frontend/          # Cloudflare Pages 前端
│   ├── index.html
│   ├── css/
│   └── js/
├── worker/            # Cloudflare Worker 後端
│   ├── src/
│   └── wrangler.toml
└── .github/workflows/ # GitHub Actions
```

## License

MIT
