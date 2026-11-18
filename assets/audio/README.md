# 哈吉咪音效库

当前按用户试听结果保留 13 条：普通 6、不满 6、生气 1。`selection.json` 为分类来源，`manifest.json` 为播放索引，`originals/` 保留已选 MP3 的原始副本。以下历史导入清单已被当前分类取代。

## 当前分类与播放

- 普通：hungry-cat、cat-meow、meow-20、21、22、23。
- 不满：meow-13、14、15、16、29、phrase-01。
- 生气：unhappy-cat，对应用户指定的 `the-sound-when-a-cat-is-unhappy-with-something.mp3`。

常态单击随机普通喵叫；靠近时两猫各占左右一个声道，每轮不同不满片段，六条轮完再随机。距离只控制 0–4 半音升调，不增加音量。`pitch/` 的 24 个等时长 WAV 是不满叫声的升调版本，不是新增音效；实时平滑混合，浏览器播放速率保持 1。

未选的 13 个播放文件及对应 3 个原始副本已移出项目、放入系统废纸篓；外部原文件未改动。重建时依次运行 `split_audio.py`、`import_supplemental_audio.py`、`build_pitch_variants.py`，全部遵守当前分类。

## 历史导入记录 · 补充猫叫 15 条

- `angry-old-cat.mp3`：按文件名试配炸毛应激与打架。
- `the-sound-when-a-cat-is-unhappy-with-something.mp3`：按文件名试配偏头预警。
- `cry-of-a-hungry-cat.mp3`、`the-sound-of-a-cat-quotmeowquot.mp3`：点击回应。
- `meow-13/14/15/16/17/20/21/22/23/24/29.mp3`：点击随机回应，编号与原名保留。

仅裁首尾可检测的静音，保留中间停顿及原速原调；统一音量并加短淡入淡出。每种动作连续触发时避开上一段，切换动作与静音时停止当前播放。

分类依据为用户提供的文件名，未直接试听确认。新增猫叫不被当成吧唧嘴声，`chew` 预设仍为空。

复现：`python3 scripts/import_supplemental_audio.py /absolute/path/to/Downloads`。脚本重复导入不会增加重复索引。

## 历史导入记录 · 视频切片 11 段

来自用户提供的 30.05 秒视频。共导出 11 个 AAC / M4A 片段，详见 `manifest.json` 的原视频起止时间。

处理：保留原速原调、转单声道、低切 55Hz、响度目标 -20 LUFS、首尾 12ms / 25ms 淡化。源文件没有修改。

- `tap-01` / `tap-02` / `tap-03`：0.78–1.42 秒短片段，试配单击回应。
- `phrase-01` 至 `phrase-08`：2.66–4.32 秒连续声段，部分试配预警、应激、打架时的原声。
- `chew` 预设保持为空：工具不支持直接听取音频，无法确认哪一段是吧唧嘴；没有用电子音或其他声音假装已经匹配。

“短回应”和“连续声段”按长度命名，拟声词语义未经试听确认。点击样机的「装入猫叫 → 查看全部音效」可以逐段播放。

复现：`python3 scripts/split_audio.py /absolute/path/to/source.mp4`。
