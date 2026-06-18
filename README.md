# Word Search 小游戏

基于 `WordSearch_Frontend_Design.md` 初始化的 Cocos Creator 3.8+ TypeScript MVP 工程骨架，面向微信小游戏和抖音小游戏。

## 已完成内容

- 可运行启动场景：`assets/scenes/Main.scene`，已挂载 `WordSearchRuntime`，打开后会自动生成可玩的简版 UI。
- 核心玩法：8 方向棋盘生成、单词放置、路径校验、反向匹配、通关判断。
- 管理层：`GameManager`、`LevelManager`、`BoardManager`、`WordManager`、`StorageManager`、`AdManager`、`AudioManager`。
- 平台适配：微信、抖音、Web 调试统一 `IPlatform` 接口。
- UI 入口：启动页、首页、关卡选择、游戏页、结算页、设置页组件脚本。
- 配置：运行时通过公共 `LevelGenerator` 生成 300 关，使用公共词库，不再把关卡 JSON 打进小游戏主包。
- 测试：核心棋盘、触摸路径逻辑、300 关单词重复率测试。

## 目录

```text
assets/
  scenes/
  scripts/
    core/
    manager/
    platform/
    ui/
    game/
    utils/
  resources/
    prefab/
    texture/
    audio/
tools/
test/
```

## 本地检查

```bash
npm install
npm test
npx tsc --noEmit
```

## 微信小游戏构建

1. 用 Cocos Creator 构建 `wechatgame`，或执行：

```bash
/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator --project "$(pwd)" --build "configPath=$(pwd)/build/buildConfig_wechatgame.json"
```

2. 构建完成后确认包体和裁剪结果：

```bash
du -sh build/zhaocidashi
find build/zhaocidashi -type f | grep -E 'bullet|physics|spine'
```

上面的 `find` 命令正常应当没有输出，当前验证包体约 `2.2M`。

3. 用微信开发者工具打开 `build/zhaocidashi` 后再预览或上传。

当前验证配置不使用资源分包，也不使用 Cocos 引擎插件分离。构建配置会裁剪到 2D 所需引擎模块，排除物理、Spine、DragonBones、视频、WebView 等模块。单词发音使用在线音频，真机发布前需要在微信公众平台后台把 `https://fanyi.baidu.com` 加到 `downloadFile` 合法域名。

## 浏览器预览

```bash
npm run preview:web
```

然后打开：

```text
http://localhost:8080/preview/
```

## Cocos Creator 接入步骤

1. 用 Cocos Creator 3.8+ 打开当前目录。
2. 在资源管理器里打开 `assets/scenes/Main.scene`。
3. 点击顶部预览运行。该场景已挂载 `WordSearchRuntime`，不需要先手动绑定节点。

后续要做正式多页面版本时，再创建 `Launch`、`Home`、`LevelSelect`、`Game` 场景，并挂载 `LaunchView`、`HomeView`、`LevelSelectView`、`GameView`、`ResultView`、`SettingView`。

## 后续建议

- 在 Creator 编辑器内完成真实场景和预制体布局。
- 增加美术、音频和动画资源。
- 在微信开发者工具、抖音开发者工具和真机上分别测试广告、存档、震动。
