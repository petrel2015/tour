# 旅行行程规划 Web

## 目标
- 手机与电脑端自适应布局
- 行程列表与地图联动
- 数据来源为本地 JSON，仅展示不编辑
- 详情字段支持简单 Markdown（段落与无序列表）

## 关键约束
- 不使用 Google Maps API Key，因此改用 Leaflet + OpenStreetMap 瓦片
- 若需要 Google Maps，请提供 Key 并切换实现

## 交互
- 点击列表项：地图定位并打开弹窗，同时高亮列表
- 点击地图点位：列表滚动并高亮
- 地图默认总览所有点位（自动 fit bounds）

## 数据结构
文件：`data/itinerary.json`

字段说明：
`title` 行程标题
`range.start` 行程开始日期
`range.end` 行程结束日期
`days[]` 按天分组
`days[].items[]` 行程条目
`id` 唯一标识
`time` 时间（HH:mm）
`place` 地点名称或路段
`detailType` 吃的 / 自然景观 / 文化 / 旅途 / 风土人情 / 地理等
`detail` Markdown 字符串（支持段落与列表）
`lat` 纬度
`lng` 经度
`mode` `walk` / `drive` / `flight`
`flightNo` 可选，航班号
`route` 可选，`from` / `to` / `duration`

## 文件结构
```
/tour
  /data
    itinerary.json
  index.html
  styles.css
  app.js
  DESIGN.md
  ITINERARY.md
```

## 视觉与布局
- 桌面端双栏：左列表、右地图
- 移动端上下结构
- 使用暖色背景和卡片化布局，突出行程内容

## 运行方式
- 直接用浏览器打开 `index.html`
- 若浏览器限制本地 JSON 读取，可启一个静态服务器
