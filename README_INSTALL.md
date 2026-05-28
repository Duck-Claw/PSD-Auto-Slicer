# PSD Auto Slicer UXP Plugin

这是 `PSD Auto Slicer` 的 Photoshop UXP 插件版安装包结构。

当前版本目标：

- 可以作为 Photoshop 面板加载，并固定在 Photoshop 侧边栏。
- 按最新设计稿整理导出设置、尺寸规则、九宫切图和切图方式。
- 保留现有稳定 JSX 脚本在 `legacy/psd-auto-slicer.jsx`。
- 为后续把切图引擎迁移到 UXP 插件预留界面和配置结构。

## 安装方式

### 开发/团队内测

1. 安装 Adobe UXP Developer Tool。
2. 打开 UXP Developer Tool。
3. 点击 `Add Plugin...`。
4. 选择本目录下的 `manifest.json`。
5. 点击 `Load`。
6. 回到 Photoshop，在 `Plugins` 菜单或侧边栏中打开 `PSD Auto Slicer`。

### 分享给其他同事

可以分享 `../dist/PSD-Auto-Slicer-UXP-v0.2.49.ccx` 或整个 `uxp-plugin` 文件夹。

如果分享 `.ccx`：

1. 对方双击 `.ccx`。
2. Creative Cloud Desktop 会尝试安装插件。
3. 安装后重启 Photoshop，打开 `Plugins > PSD Auto Slicer`。

如果 `.ccx` 被系统拦截，使用开发方式加载 `manifest.json` 最稳定。

正式大规模分发时，建议用 UXP Developer Tool 生成签名后的 CCX 包，再发给团队。

## 当前切图能力说明

当前生产可用的切图逻辑仍在：

```text
legacy/psd-auto-slicer.jsx
```

这个 UXP 版本已经完成插件面板、安装包结构和配置交互。下一阶段需要把 JSX 中的导出逻辑迁移成 UXP/Photoshop API 的实现，再让 `开始切图` 直接执行真实导出。
