# 古船模型拆装许可与索具更换追踪台

由原“古船模型帆索校准台”扩展：模型建档之外，新增拆桅拆装许可、索具批次更换、完工判定、返修与独立复核、原索位释放与交付资格恢复的全流程追踪。

## 运行

```bash
npm start          # http://localhost:3038
```

数据保存在 `data/model-rigging-calibration.json`（旧数据自动迁移，新增 `permits` 集合）。

## 模块划分

| 文件 | 职责 |
| --- | --- |
| `src/store.js` | 存储读写：JSON 装载、旧数据迁移、落盘，不含业务判定 |
| `src/rules.js` | 判定规则：开单占用、409 冲突、完工一致性、返修回避、复核回避、结论失效重算、交付资格 |
| `src/routes.js` | 入口路由：URL 解析、入参收集、规则调用、HTTP 状态码映射 |
| `src/page.js` | 追踪台页面（列表与模型详情共用同一组接口数据） |
| `server.js` | HTTP 启动壳 |

## 业务规则

1. **拆桅前开单**：必须登记目标索位、替代卷号、监护人、拆装人；缺任一项返回 `409 missing_fields` 且不写记录。
2. **一单一模型**：同一模型存在未完工单时再开单返回 `409 permit_active`。
3. **卷号独占**：替代卷号被其他模型的未完工单占用时返回 `409 reel_occupied`（带占用方信息）。
4. **完工登记**：原索径、实际索径、绕向、张力四项，对照索位标准（`GET /api/specs`）判定；任一不符只转“返修中”，不释放索位。
5. **返修回避**：返修人不能与拆装人相同，否则 `409 same_person`；返修后转待复核。
6. **独立复核**：复核人不得参与过本单（拆装、监护、返修、已复核均算参与）；合格才置“已完工”、释放原索位、恢复交付资格；不合格退回返修。
7. **结论失效重算**：未交付单更换索具批次或修改拆装时间，完工/返修/复核结论作废、回到待拆桅；旧结论整体存入 `history`，旧单编号与历史版本仍可查。已交付单不可修改（`409 permit_delivered`）。
8. **列表/详情一致**：模型列表与模型详情都由同一套 `rules` 汇总（占用索位、在执行单、`deliveryEligible`），刷新后口径一致。

## 接口

- `GET /api/items` / `POST /api/items` / `GET|PATCH /api/items/:code`
- `POST /api/items/:code/logs`
- `GET /api/permits?itemCode=` / `POST /api/permits` / `GET /api/permits/:id`
- `POST /api/permits/:id/complete` · `/rework` · `/review`
- `PATCH /api/permits/:id`（仅 `batchNo`、`disassembleAt`）
- `GET /api/specs` · `GET /api/stats`
