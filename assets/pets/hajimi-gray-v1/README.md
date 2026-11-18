# 灰白虎斑皮肤 v1

使用内置 ImageGen，以橘猫的两张动作帧图为编辑参考，生成银灰毛色、深灰虎斑、白色肚皮和爪子的新皮肤。保留同一画风、角色比例和动作。

- `warn.gif`：偏头预警，512×512，透明循环。
- `stress.gif`：歪头、拱背炸毛、张嘴，512×512，透明循环。
- `grooming.gif`：低头舔前爪，512×512，透明循环。
- `frames/`、`sheets/`：透明源帧和完整动作帧图。
- `prompts.json`：本次两条完整 ImageGen 提示词。

样机新增的猫会在橘猫与灰白虎斑之间交替。右键猫咪或聚焦后按 S 可以切换皮肤，不影响它当前的互动状态。

复现 GIF 编码：`python3 scripts/build_cat_gifs.py --asset-root assets/pets/hajimi-gray-v1`。
