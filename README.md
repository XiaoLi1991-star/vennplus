# VennPlus

Five-set Venn geometry is reproduced from the open data bundled with Adrian
Dusa's R package `venn`. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)
for attribution and redistribution terms.

VennPlus 是一个面向科研数据的本地交互式集合分析工具。数据只在浏览器中处理，可在固定韦恩图、面积近似的 Euler 图和多组 UpSet 图之间切换。

## 当前功能

- 2–5 组固定韦恩图；4 组使用四个等形椭圆，点击交集只查看成员，不改变出版图形
- 2–4 组 Euler 图；2–8 组 UpSet 图；6 组及以上自动使用更易读的 UpSet 图
- 自由编辑组名和成员，支持重复项清理、空行忽略和多个示例数据
- 支持撤销、重做与键盘快捷键，连续输入和标签拖动会合并为一次历史记录
- 可切换数值、百分比和组名，并调节标签字号与加粗
- 可调节集合填充透明度、边框粗细；支持彩色填充或仅保留色板边框
- 彩色填充时可使用色板同色边框，或设置统一的自定义边框颜色
- 分组标签会根据名称长度自动外移并扩展画布，也可拖动、用方向键微调或随时重置
- Venn 与 Euler 画布支持 75%–200% 缩放和一键适应视图；UpSet 保留独立横向滚动
- 点击 Venn、Euler 或 UpSet 区域后，在图下方固定展示交集成员；支持搜索、全选、复制及单区 TXT/CSV 下载
- 自定义成品宽度、高度与 DPI；画布自动适配且不拉伸图形几何
- 导出 SVG、矢量 PDF、带物理 DPI 的 TIFF、PNG、Excel 汇总表、交集统计 CSV、每个集合一列的输入集合 TXT，以及每个非空交集一列的全部交集成员 TXT
- 可导出复现清单 JSON，记录数据哈希、设置哈希、图形参数与输出尺寸

Excel 文件包含 `Summary`、`Intersections`、`Members_Long` 以及每个组的独立工作表，既便于汇总统计，也便于后续筛选成员。

## 本地运行

```bash
npm install
npm run dev
```

浏览器打开终端提示的本地地址。生产构建与质量检查：

```bash
npm run typecheck
npm run test:run
npm run build
```

## 输入规则

每行输入一个成员标识，例如基因名、样本编号或蛋白名称。相同组内的重复行只计算一次；集合区域按“精确归属”计算，即 `A ∩ B` 不包含同时属于 C 的成员。百分比以所有组的并集为分母。

## 隐私

输入解析、集合计算与文件生成均在当前浏览器中完成，应用不会主动上传输入数据。

## 开源许可

VennPlus 源代码采用 [MIT License](LICENSE) 开源。第三方组件与五组 Venn 几何数据的许可和引用要求见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
