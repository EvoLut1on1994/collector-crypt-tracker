# Collector Crypt NFT 追踪工具

这是一个基于 Next.js 的网页工具。输入单个 Solana 地址后，页面会识别该地址当前持有的 Collector Crypt NFT，并补齐可获取到的美元估值，汇总显示持仓总价值。

## 功能

- 输入单个 Solana 地址后查询 Collector Crypt NFT 持仓
- 有 `COLLECTOR_CRYPT_API_KEY` 时，优先使用 Collector Crypt 官方 gacha API 价格目录
- 没有 `COLLECTOR_CRYPT_API_KEY` 时，自动回退到 Collector Crypt 公开站点接口
- 显示每张卡的卡图、卡牌名称、评级、证书编号、官方价格
- 汇总已定价总价值、已定价数量、未定价数量、总持仓数量
- 支持浅色 / 深色主题切换

## 环境变量

复制 `.env.example` 为 `.env.local` 后填写：

```bash
# 可选：有 Key 时优先使用官方价格目录；没有也能运行
COLLECTOR_CRYPT_API_KEY=

# 试用可以直接用公开 RPC；公网部署时更建议换成你自己的稳定 RPC
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

COLLECTOR_CRYPT_CODES=pokemon_50,pokemon_250
COLLECTOR_CRYPT_COLLECTION_HINTS=Collector Crypt,Collector Crypt: Pokemon
```

说明：

- `COLLECTOR_CRYPT_API_KEY` 是可选项
- `SOLANA_RPC_URL` 本地试用可直接用公开 mainnet RPC
- 如果要做公网网站，推荐换成你自己的稳定 Solana RPC，避免公共节点限流
- `COLLECTOR_CRYPT_CODES` 只在官方 API 模式下使用
- `COLLECTOR_CRYPT_COLLECTION_HINTS` 用于识别未定价但疑似属于 Collector Crypt 的 NFT

## 本地运行

```bash
npm.cmd install
npm.cmd run dev
```

访问 [http://localhost:3000](http://localhost:3000)。

## 测试

```bash
npm.cmd run lint
npm.cmd run test
npm.cmd run build
```

## 公网部署

推荐部署到 Vercel，因为这个项目本身就是 Next.js。

### 1. 上传到 GitHub

先把项目放到一个 GitHub 仓库里。

### 2. 在 Vercel 导入项目

- 登录 [Vercel](https://vercel.com/)
- 选择 `Add New Project`
- 导入你的 GitHub 仓库

### 3. 配置环境变量

在 Vercel 项目设置里添加这些环境变量：

- `COLLECTOR_CRYPT_API_KEY`
- `SOLANA_RPC_URL`
- `COLLECTOR_CRYPT_CODES`
- `COLLECTOR_CRYPT_COLLECTION_HINTS`

如果你没有 `COLLECTOR_CRYPT_API_KEY`，也可以先不填，项目仍然能运行，只是走公开价格接口回退模式。

### 4. 部署

Vercel 会自动执行：

```bash
npm install
npm run build
```

部署完成后，它会给你一个公网网址，任何能上网的电脑都可以访问。

## 部署说明

- API 路由已固定使用 Node.js runtime，适合部署到 Vercel Node Serverless 环境
- 在 Windows 本地环境里，Solana RPC 会自动走兼容回退逻辑
- 在 Linux / Vercel 环境里，会直接使用标准 `fetch` 访问 Solana RPC
- 初版覆盖标准 NFT / pNFT，不覆盖 cNFT
- 官方 gacha API 返回的 `insured_value` 按 6 位小数美元换算
- 公开站点接口返回的 `insuredValue` 直接按美元处理
- 如果公开站点接口里没有某张卡的价格，页面会显示“待补价”
