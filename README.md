# 小鱼缸

一个可以互动的小网页：缸里有 25 种外形、花纹和游法都不一样的鱼。点一下水里任意位置撒鱼食，小鱼会游过来吃，吃得越多长得越大。还可以再放几条鱼进来（最多 30 条），或者随时暂停动画。过一会儿，会有潜水艇或潜水员从鱼缸里横穿而过，不影响撒鱼食。

页面用 [Vite](https://vite.dev) + TypeScript 编写，画面全部用 Canvas 2D 绘制，没有其他运行时依赖。桌面端控制面板浮在鱼缸左上角，手机上会收到鱼缸下方。系统开启“减少动态效果”时，鱼和水草会游得慢一些。

## 本地运行

需要 Node.js 20.19+ 或 22.12+。

```bash
npm install
npm run dev
```

然后打开终端里打印的地址（默认是 http://127.0.0.1:47823）。

## 构建

```bash
npm run build     # 类型检查，并把静态文件输出到 dist/
npm run preview   # 在本地预览构建结果
```

`dist/` 里是纯静态文件。`npm run build` 还会把构建结果同步到仓库根目录（`index.html`、`assets/`、`CNAME`），以便 GitHub Pages 从 `main` 根路径发布到自定义域名 [dirtykiki.com](https://dirtykiki.com)。本地开发入口是 `index.vite.html`。

## 目录结构

- `index.html`：页面结构和文案
- `src/main.ts`：按钮、点击撒食和动画循环
- `src/aquarium.ts`：鱼、鱼食、气泡、水草和路过访客的模拟
- `src/species.ts`：25 种鱼的外形和游动方式
- `src/visitors.ts`：潜水艇和潜水员
- `src/style.css`：页面样式
- `public/favicon.svg`：网站图标
