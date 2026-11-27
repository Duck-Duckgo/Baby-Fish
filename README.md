# 坏KiKi的小鱼缸

一个可以互动的小网页：缸里有三十多种外形、花纹和游法都不一样的鱼，海底沙面上还有海龟、玳瑁、海蛇、鳄龟等爬行动物。点一下水里任意位置撒鱼食，谁吃到谁长大——每吃满 10 颗体长增加 5%，最多可到出生大小的 3 倍。海底还有卡通化的方块海绵、粉星、触手管家、红蟹掌柜，以及菠萝小屋、蟹堡小店。界面只留一个「放一条鱼」按钮；过一会儿会有潜水艇或潜水员路过。

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
- `src/species.ts`：三十多种鱼 + 海底爬行动物的外形和游动方式
- `src/visitors.ts`：潜水艇和潜水员
- `src/town.ts`：海底卡通角色与建筑
- `src/style.css`：页面样式
- `public/favicon.svg`：网站图标
