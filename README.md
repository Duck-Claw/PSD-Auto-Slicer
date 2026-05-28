# PSD Auto Slicer

English | [中文](#中文)

PSD Auto Slicer is a Photoshop UXP plugin and JSX workflow helper for exporting UI assets from PSD files. It helps artists and game UI teams batch-slice layers into transparent PNG files with consistent naming, sizing rules, nine-slice output, and an export manifest for downstream tools.

## Features

- Export selected layers, selected layer children, or all PSD layers.
- Auto-name UI assets with semantic prefixes such as `Bg`, `Panel`, `Banner`, `Icon`, `Line`, `Btn`, and `Font`.
- Keep duplicate layer names without dropping assets; conflicting output names get suffixes such as `_1`, `_2`.
- Optional folder grouping, even-size output, canvas-size output, and uniform-size output.
- Optional compact nine-slice export as `_9s.png`.
- Generate `export_manifest.json` with size, path, canvas, nine-slice, identity, and hash metadata.
- Includes a legacy JSX script for direct script-based slicing.

## Install

### Option A: Install the UXP package

Use the packaged `.ccx` file from `dist`:

```text
PSD-Auto-Slicer-UXP-v0.2.49.ccx
```

1. Double-click the `.ccx` file.
2. Complete the installation in Creative Cloud Desktop.
3. Restart Photoshop.
4. Open `Plugins > PSD Auto Slicer`.

For Photoshop 2022 or environments without Creative Cloud Desktop, use the manual package:

```text
PSD-Auto-Slicer-UXP-v0.2.49-PS2022-manual.zip
```

Copy the `PSD Auto Slicer` folder into:

```text
C:\Program Files\Adobe\Adobe Photoshop 2022\Plug-ins\
```

### Option B: Load in UXP Developer Tool

1. Install Adobe UXP Developer Tool.
2. Add this folder by selecting `manifest.json`.
3. Click `Load`.
4. Open the plugin from Photoshop's `Plugins` menu.

### Option C: Run the JSX script directly

Use the script in:

```text
legacy/psd-auto-slicer.jsx
```

Or use the latest standalone script from this workspace:

```text
scripts/psd-auto-slicer.jsx
```

In Photoshop, choose:

```text
File > Scripts > Browse...
```

Then select the JSX file.

## Usage

1. Open a PSD in Photoshop.
2. Select the target layer or group.
3. Open `Plugins > PSD Auto Slicer`, or run the JSX script.
4. Choose the output folder and export options.
5. Choose an export mode.
6. Click `开始切图`.
7. Check the generated PNG files and `export_manifest.json`.

## Recommended PSD Convention

Use a top-level group such as:

```text
EXPORT/
  Btn Start Normal
  Icon Coin
  Panel Bg
```

Optional layer markers:

```text
@export Button Confirm
[ignore] Reference Layer
@9s(12,16,12,16) Panel Bg
```

## Current Version

- Plugin version: `0.2.49`
- Photoshop host: `PS`
- UXP minimum host version: `24.0.0`
- Photoshop 2022 manual package target: `23.3+`

## Notes

The UXP panel provides the newer UI and distribution structure. The JSX script remains useful for direct script execution and stable slicing workflows.

---

# 中文

PSD Auto Slicer 是一个 Photoshop UXP 插件，也包含可直接运行的 JSX 脚本流程。它用于从 PSD 中批量导出 UI 资源，自动处理命名、尺寸、九宫格和导出清单，减少手工切图与整理资源的重复工作。

## 核心功能

- 支持导出选中图层、选中图层及子图层、整份 PSD 图层。
- 自动按 UI 语义命名：`Bg`、`Panel`、`Banner`、`Icon`、`Line`、`Btn`、`Font`。
- 同名图层不会漏导；文件名冲突时自动追加 `_1`、`_2`。
- 支持自动整理文件夹、强制偶数尺寸、画布尺寸输出、统一尺寸输出。
- 支持九宫格 `_9s.png` 精简导出。
- 输出 `export_manifest.json`，记录路径、尺寸、画布、九宫格、身份和 hash 信息。
- 保留 JSX 脚本，可不安装插件面板直接运行。

## 安装

### 方式 A：安装 UXP 包

使用 `dist` 里的 `.ccx`：

```text
PSD-Auto-Slicer-UXP-v0.2.49.ccx
```

1. 双击 `.ccx` 文件。
2. 按 Creative Cloud Desktop 提示完成安装。
3. 重启 Photoshop。
4. 打开 `Plugins > PSD Auto Slicer`。

Photoshop 2022 或没有 Creative Cloud Desktop 的环境，可使用手动包：

```text
PSD-Auto-Slicer-UXP-v0.2.49-PS2022-manual.zip
```

将 `PSD Auto Slicer` 文件夹复制到：

```text
C:\Program Files\Adobe\Adobe Photoshop 2022\Plug-ins\
```

### 方式 B：开发者加载

1. 安装 Adobe UXP Developer Tool。
2. 选择本目录下的 `manifest.json`。
3. 点击 `Load`。
4. 回到 Photoshop 的 `Plugins` 菜单打开插件。

### 方式 C：直接运行 JSX

脚本位置：

```text
legacy/psd-auto-slicer.jsx
```

或使用工作区中的最新版独立脚本：

```text
scripts/psd-auto-slicer.jsx
```

在 Photoshop 中选择：

```text
File > Scripts > Browse...
```

然后选择 JSX 文件运行。

## 使用

1. 在 Photoshop 打开 PSD。
2. 选中要导出的图层或分组。
3. 打开 `Plugins > PSD Auto Slicer`，或运行 JSX 脚本。
4. 设置输出目录和切图选项。
5. 选择导出范围。
6. 点击 `开始切图`。
7. 检查输出的 PNG 和 `export_manifest.json`。

## 推荐 PSD 约定

建议使用顶层导出组：

```text
EXPORT/
  Btn Start Normal
  Icon Coin
  Panel Bg
```

可选图层标记：

```text
@export Button Confirm
[ignore] Reference Layer
@9s(12,16,12,16) Panel Bg
```

## 当前版本

- 插件版本：`0.2.49`
- Photoshop host：`PS`
- UXP 最低 host 版本：`24.0.0`
- Photoshop 2022 手动包目标版本：`23.3+`

## 说明

UXP 面板提供新版界面和分发结构；JSX 脚本仍适合直接运行和稳定切图流程。
