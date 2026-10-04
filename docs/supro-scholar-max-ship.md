# Supro Scholar Max — Ship Log

## Stage 1–4 (baseline)

Multi-turn Fin conversations, 苏大学士 ZH narrative, gold tiers 1–4×, Alpha40-lite, StockFormer attention proxy, e2e strategy loop, research report mode. Deployed to Cloudflare Pages (`supro.si`).

## Stage 5A — Edge Transformer + Multimodal (5×)

**Branch:** `cursor/stage5-5a-edge-0341`

### Shipped
- Distilled PatchTST-style edge inference: `src/lib/fin/transformer-inference.ts`
- Bake artifact: `public/data/transformer-infer-bake.json` (`npm run transformer-infer:bake`)
- Fin mode `edge_infer` at **5×** gold; floor **50** gold (`functions/_shared/gold-tiers.js`)
- DeepSeek vision path: `functions/_shared/vision.js` + `callVisionLlm` in `llm.js` (model `LLM_VISION_MODEL` / default `deepseek-v4-flash-vision-exp`)
- Fin Desk accepts optional screenshot (`image` data URL) + client `inference` JSON
- Fin UI: upload control + edge prediction-band board

### Station-master note (ZH)
1. 确认 Pages 已配置 `LLM_API_KEY`（及可选 `LLM_VISION_MODEL`）。
2. 硬刷新 `supro.si` 后打开苏坡大模型 → 选择「边缘推理/多模态」(5x)。
3. 可上传 K 线/财报截图；确认金币按 5× 扣除（管理员免扣）。
4. 无需新 SQL（图谱仍为 JSON；会话表沿用 Stage 1）。

### Verify
- `npm test` + `npm run build` green
- No Computer Use in CI; human verifies multimodal on production
