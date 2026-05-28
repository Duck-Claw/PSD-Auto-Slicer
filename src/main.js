/* global require */

let photoshop = null;
let uxp = null;

try {
  photoshop = require("photoshop");
  uxp = require("uxp");
} catch (error) {
  photoshop = null;
  uxp = null;
}

const app = photoshop ? photoshop.app : null;
const core = photoshop ? photoshop.core : null;
const constants = photoshop ? photoshop.constants : {};
const storage = uxp ? uxp.storage : null;

const SETTINGS_KEY = "psd-auto-slicer.settings.v2";
const EXPORT_GROUP_NAME = "EXPORT";
const FONT_TEXT_DICT = {
  "确认": "Confirm",
  "确定": "Confirm",
  "取消": "Cancel",
  "关闭": "Close",
  "返回": "Back",
  "更多": "More",
  "提示": "Tips",
  "公告": "Notice",
  "帮助": "Help",
  "跳过": "Skip",
  "完成": "Complete",
  "继续": "Continue",
  "下一步": "Next",
  "上一步": "Previous",
  "登录": "Login",
  "注册": "Register",
  "游客登录": "GuestLogin",
  "开始游戏": "StartGame",
  "进入游戏": "EnterGame",
  "重新连接": "Reconnect",
  "商城": "Shop",
  "购买": "Buy",
  "购买成功": "BuySuccess",
  "礼包": "Gift",
  "限时礼包": "LimitedGift",
  "超值礼包": "ValueGift",
  "免费领取": "FreeClaim",
  "领取": "Claim",
  "领取奖励": "ClaimReward",
  "战斗": "Battle",
  "开始战斗": "BattleStart",
  "战斗开始": "BattleStart",
  "胜利": "Victory",
  "失败": "Defeat",
  "挑战": "Challenge",
  "扫荡": "Sweep",
  "出战": "Deploy",
  "上阵": "Deploy",
  "角色": "Character",
  "英雄": "Hero",
  "升级": "Upgrade",
  "升星": "StarUp",
  "觉醒": "Awaken",
  "技能": "Skill",
  "装备": "Equipment",
  "强化": "Enhance",
  "抽卡": "Gacha",
  "十连抽": "TenPull",
  "单抽": "SinglePull",
  "召唤": "Summon",
  "好友": "Friends",
  "公会": "Guild",
  "聊天": "Chat",
  "邮件": "Mail",
  "任务": "Quest",
  "活动": "Event",
  "签到": "SignIn",
  "成就": "Achievement",
  "金币": "Gold",
  "钻石": "Diamond",
  "体力": "Energy",
  "经验": "Exp",
  "战力": "Power",
  "设置": "Settings",
  "背包": "Bag",
  "排行榜": "Rank",
  "头像": "Avatar",
  "昵称": "Nickname",
  "等级": "Level"
};
const MODE_HELP = {
  selected: "把当前选中的每个图层或图层组分别导出为独立 PNG。多选时不会合并成一张图。",
  children: "从当前选中的图层组开始向下细分，尽量导出内部可用资源。",
  all: "扫描当前 PSD 的所有图层并批量导出，文件夹按根图层组管理。"
};

const state = {
  mode: "selected",
  outputFolder: null,
  outputPath: "",
  outputToken: "",
  preview: []
};

const $ = (id) => document.getElementById(id);

function setStatus(text, kind) {
  const node = $("statusText");
  node.textContent = text;
  node.className = "status-pill";
  if (kind) node.classList.add(`is-${kind}`);
}

function getSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
  } catch (error) {
    return {};
  }
}

function saveSettings() {
  const settings = {
    mode: state.mode,
    outputPath: state.outputPath,
    outputToken: state.outputToken,
    autoGroupFolders: $("autoGroupFolders").checked,
    prefix: $("prefixInput").value,
    autoRename: $("autoRename").checked,
    evenSize: $("evenSize").checked,
    canvasSize: $("canvasSize").checked,
    uniformSize: $("uniformSize").checked,
    uniformWidth: $("uniformWidth").value,
    uniformHeight: $("uniformHeight").value,
    nineSlice: $("nineSlice").checked,
    nineLeft: $("nineLeft").value,
    nineRight: $("nineRight").value,
    nineTop: $("nineTop").value,
    nineBottom: $("nineBottom").value
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function setOutputPathValue(path) {
  const node = $("outputPath");
  node.value = path || "";
  node.title = path || "";

  const revealEnd = () => {
    try {
      node.scrollLeft = node.scrollWidth;
      node.scrollTop = node.scrollHeight;
      if (node.setSelectionRange && node.value) {
        const end = node.value.length;
        node.setSelectionRange(end, end);
      }
    } catch (error) {
      // Some UXP input states do not expose selection APIs; scrollLeft is enough.
    }
  };

  revealEnd();
  setTimeout(revealEnd, 0);
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(revealEnd);
  }
}

function loadSettings() {
  const settings = getSettings();
  $("autoGroupFolders").checked = settings.autoGroupFolders !== false;
  $("prefixInput").value = settings.prefix || "";
  $("autoRename").checked = settings.autoRename !== false;
  $("evenSize").checked = settings.evenSize !== false;
  $("canvasSize").checked = !!settings.canvasSize;
  $("uniformSize").checked = !!settings.uniformSize;
  $("uniformWidth").value = settings.uniformWidth || "";
  $("uniformHeight").value = settings.uniformHeight || "";
  $("nineSlice").checked = !!settings.nineSlice;
  $("nineLeft").value = settings.nineLeft || "";
  $("nineRight").value = settings.nineRight || "";
  $("nineTop").value = settings.nineTop || "";
  $("nineBottom").value = settings.nineBottom || "";
  state.outputPath = settings.outputPath || "";
  state.outputToken = settings.outputToken || "";
  setOutputPathValue(state.outputPath);
  setMode(settings.mode || "selected", false);
}

async function restoreOutputFolder() {
  if (!state.outputToken || !storage || !storage.localFileSystem || !storage.localFileSystem.getEntryForPersistentToken) {
    return;
  }
  try {
    state.outputFolder = await storage.localFileSystem.getEntryForPersistentToken(state.outputToken);
    if (state.outputFolder) {
      state.outputPath = state.outputFolder.nativePath || state.outputFolder.name || state.outputPath;
      setOutputPathValue(state.outputPath);
    }
  } catch (error) {
    state.outputFolder = null;
  }
}

function activeDocument() {
  if (!app || !app.documents || !app.documents.length) return null;
  return app.activeDocument;
}

function refreshDocumentInfo() {
  const doc = activeDocument();
  if (!doc) {
    $("docName").textContent = "未检测到 PSD";
    $("selectionTitle").textContent = "当前选中：无";
    $("selectionMeta").textContent = "请先打开一个 PSD 文件";
    return;
  }

  const selected = getSelectedLayers(doc);
  $("docName").textContent = doc.title || doc.name || "未命名 PSD";
  $("selectionTitle").textContent = selected.length
    ? `当前选中：${selected.map((layer) => layer.name).join("、")}`
    : "当前没有选中图层。";
  $("selectionMeta").textContent = selected.length
    ? `${selected.length} 个图层 · ${modeTargetText(state.mode)}`
    : "请在 Photoshop 中选择图层";
}

function setMode(mode, persist = true) {
  state.mode = mode;
  document.querySelectorAll(".mode-card").forEach((button) => {
    const active = button.dataset.mode === mode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  });
  $("modeCopy").textContent = MODE_HELP[mode] || "";
  if (persist) saveSettings();
}

async function chooseFolder() {
  try {
    if (!storage || !storage.localFileSystem) {
      throw new Error("请在 Photoshop UXP 环境中选择文件夹。");
    }
    const folder = await storage.localFileSystem.getFolder();
    if (!folder) return;
    state.outputFolder = folder;
    state.outputPath = folder.nativePath || folder.name || "";
    state.outputToken = storage.localFileSystem.createPersistentToken
      ? await storage.localFileSystem.createPersistentToken(folder)
      : "";
    setOutputPathValue(state.outputPath);
    saveSettings();
    setStatus("就绪");
  } catch (error) {
    setStatus("失败", "error");
    renderWarnings([{ message: error.message }]);
  }
}

function getConfig() {
  const uniformEnabled = $("uniformSize").checked;
  const nineSliceEnabled = $("nineSlice").checked;
  const doc = activeDocument();
  return {
    exportGroupName: EXPORT_GROUP_NAME,
    prefix: sanitizePrefix($("prefixInput").value),
    autoRename: $("autoRename").checked,
    autoTypePrefix: true,
    groupFolders: $("autoGroupFolders").checked,
    skipHidden: true,
    forceEvenSize: $("evenSize").checked,
    forceCanvasSize: $("canvasSize").checked,
    forceUniformSize: uniformEnabled,
    uniformWidth: uniformEnabled ? parsePositiveInt($("uniformWidth").value) : 0,
    uniformHeight: uniformEnabled ? parsePositiveInt($("uniformHeight").value) : 0,
    forceNineSlice: nineSliceEnabled,
    docWidth: doc ? Math.max(1, Math.round(numberFromDimension(doc.width) || 1920)) : 1920,
    docHeight: doc ? Math.max(1, Math.round(numberFromDimension(doc.height) || 1080)) : 1080,
    nineSliceBorders: {
      left: parseOptionalPixelValue($("nineLeft").value),
      right: parseOptionalPixelValue($("nineRight").value),
      top: parseOptionalPixelValue($("nineTop").value),
      bottom: parseOptionalPixelValue($("nineBottom").value)
    },
    nineSliceCenterSize: 2
  };
}

function validateConfig(config) {
  if (!core || !app) {
    throw new Error("请在 Photoshop UXP 环境中运行插件。");
  }
  if (!state.outputFolder) {
    throw new Error("请先选择保存位置。");
  }
  if (config.forceUniformSize && (!config.uniformWidth || !config.uniformHeight)) {
    throw new Error("统一尺寸需要填写有效的宽和高。");
  }
  const borders = config.nineSliceBorders;
  if ([borders.left, borders.right, borders.top, borders.bottom].some((value) => value === null || value < 0)) {
    throw new Error("九宫边距只能填写空白、0 或正整数。");
  }
}

function modeTargetText(mode) {
  if (mode === "selected") return "当前选中整体导出";
  if (mode === "children") return "包含子图层递归导出";
  if (mode === "all") return "PSD 全部图层导出";
  return "预计导出";
}

function getSelectedLayers(doc) {
  try {
    return Array.from(doc.activeLayers || []);
  } catch (error) {
    return [];
  }
}

function collectTargetsForMode(doc, mode) {
  const targets = [];
  const seenTargets = new Set();
  const selected = getSelectedLayers(doc);

  if (mode === "selected") {
    selected.forEach((layer) => addTarget(layer, getLayerPath(layer), cleanExportName(layer.name), targets, seenTargets));
    return targets;
  }

  if (mode === "children") {
    selected.forEach((layer) => {
      if (!isGroupLayer(layer)) {
        addTarget(layer, getLayerPath(layer), cleanExportName(layer.name), targets, seenTargets);
      } else {
        collectLeafLayerTargets(layer, getLayerPath(layer), targets, seenTargets);
      }
    });
    return targets;
  }

  if (mode === "all") {
    Array.from(doc.layers || []).slice().reverse().forEach((layer) => {
      collectLeafLayerTargets(layer, layer.name, targets, seenTargets);
    });
  }

  return targets;
}

function collectLeafLayerTargets(layer, path, targets, seenTargets) {
  if (isIgnored(layer.name)) return;
  if (!isGroupLayer(layer)) {
    addTarget(layer, path, cleanExportName(layer.name), targets, seenTargets);
    return;
  }
  Array.from(layer.layers || []).slice().reverse().forEach((child) => {
    collectLeafLayerTargets(child, `${path}/${child.name}`, targets, seenTargets);
  });
}

function addTarget(layer, path, exportName, targets, seenTargets) {
  if (!layer) return;
  const targetKey = getLayerTargetKey(layer);
  if (seenTargets.has(targetKey)) return;
  seenTargets.add(targetKey);
  targets.push({ layer, path, exportName });
}

function buildPreviewRows(targets, config) {
  const used = {};
  return targets.map((target) => {
    const baseName = makeBaseName(target, config);
    const folderName = config.groupFolders ? getFolderNameForTarget(target.path, config) : "";
    const unique = makeUniqueName(baseName || "slice", used, folderName);
    const bounds = getPixelBounds(target.layer);
    return {
      name: `${unique}.png`,
      variant: shouldExportNineSlice(target.layer, config) ? "normal + _9s" : "normal",
      meta: bounds ? `${bounds.width}*${bounds.height}` : "空边界",
      path: target.path,
      hidden: config.skipHidden && !isEffectivelyVisible(target.layer),
      empty: !bounds || bounds.width <= 0 || bounds.height <= 0
    };
  });
}

async function scanTargets() {
  try {
    refreshDocumentInfo();
    const doc = activeDocument();
    if (!doc) throw new Error("请先打开一个 PSD 文件。");
    const config = getConfig();
    const targets = collectTargetsForMode(doc, state.mode);
    state.preview = buildPreviewRows(targets, config);
    renderPreview(state.preview);
    setStatus("已预览", "done");
  } catch (error) {
    setStatus("失败", "error");
    renderWarnings([{ message: error.message }]);
  }
}

function renderPreview(rows) {
  $("exportSummary").innerHTML = rows.length
    ? `<strong>导出状态：预计导出 ${rows.length} 个资源</strong><span>九宫图会额外生成 _9s 文件。</span>`
    : "<strong>导出状态：没有找到可导出的资源</strong><span>检查选择范围、隐藏图层或 @ignore 标记。</span>";
  $("assetList").innerHTML = rows.length ? rows.map((row) => {
    const stateText = row.hidden ? "隐藏，将跳过" : row.empty ? "空边界，将跳过" : row.variant;
    return `
      <div class="asset-row" title="${escapeHtml(row.path)}">
        <span>${escapeHtml(row.name)}</span>
        <em>${escapeHtml(stateText)} · ${escapeHtml(row.meta)}</em>
      </div>
    `;
  }).join("") : `<div class="hint-row">没有找到可导出的资源。检查选择范围、隐藏图层或 @ignore 标记。</div>`;
}

function renderWarnings(warnings) {
  $("exportSummary").innerHTML = "<strong>导出状态：需要处理以下问题</strong><span>请查看资源列表中的提示。</span>";
  $("assetList").innerHTML = warnings.map((warning) => `
    <div class="hint-row">${escapeHtml(warning.layerPath ? `${warning.layerPath}：${warning.message}` : warning.message)}</div>
  `).join("");
}

async function exportNow() {
  const exportButton = $("exportButton");
  const scanButton = $("scanButton");
  exportButton.disabled = true;
  scanButton.disabled = true;

  try {
    const doc = activeDocument();
    if (!doc) throw new Error("请先打开一个 PSD 文件。");
    const config = getConfig();
    validateConfig(config);
    saveSettings();

    const targets = collectTargetsForMode(doc, state.mode);
    if (!targets.length) throw new Error("没有找到可导出的图层。");

    setStatus("导出中", "running");
    const result = await core.executeAsModal(
      async () => exportTargets(doc, targets, state.outputFolder, config),
      { commandName: "PSD Auto Slicer" }
    );

    setStatus("完成", "done");
    $("exportSummary").innerHTML = `<strong>导出状态：成功导出 ${result.exportedCount} 个</strong><span>跳过/失败 ${result.skippedCount} 个。</span>`;
    if (result.warnings.length) {
      renderWarnings(result.warnings);
    } else {
      renderPreview(buildPreviewRows(targets, config));
    }
  } catch (error) {
    setStatus("失败", "error");
    renderWarnings([{ message: error.message || String(error) }]);
  } finally {
    exportButton.disabled = false;
    scanButton.disabled = false;
  }
}

async function exportTargets(sourceDoc, targets, outputFolder, config) {
  const sourceCanvasWidth = Math.max(1, Math.round(numberFromDimension(sourceDoc.width) || 1));
  const sourceCanvasHeight = Math.max(1, Math.round(numberFromDimension(sourceDoc.height) || 1));
  const manifest = {
    tool: "PSD Auto Slicer",
    version: "0.2.49",
    manifestSchemaVersion: 2,
    exportMode: state.mode,
    source: sourceDoc.title || sourceDoc.name || "",
    sourcePath: sourceDoc.path || "",
    sourceCanvasWidth,
    sourceCanvasHeight,
    exportedAt: new Date().toISOString(),
    outputFolder: outputFolder.nativePath || outputFolder.name || "",
    items: [],
    warnings: []
  };
  const usedNames = {};
  let exportedCount = 0;
  let skippedCount = 0;
  let zIndex = 0;

  for (const target of targets) {
    if (config.skipHidden && !isEffectivelyVisible(target.layer)) {
      manifest.warnings.push(makeWarning("hidden", target.path, "图层或父级图层组被隐藏，已跳过。"));
      skippedCount++;
      continue;
    }

    const bounds = getPixelBounds(target.layer);
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
      manifest.warnings.push(makeWarning("empty", target.path, "图层边界为空，已跳过。"));
      skippedCount++;
      continue;
    }

    const baseName = makeBaseName(target, config) || "slice";
    const targetFolder = config.groupFolders ? await getOutputFolderForTarget(outputFolder, target.path, config) : outputFolder;
    const folderScope = targetFolder.nativePath || targetFolder.name || "";
    const uniqueName = makeUniqueName(baseName, usedNames, folderScope);

    try {
      const file = await targetFolder.createFile(`${uniqueName}.png`, { overwrite: true });
      const info = await exportLayerAsPng(sourceDoc, target.layer, file, uniqueName, config, false);
      manifest.items.push(makeManifestItem(target, file, outputFolder, targetFolder, bounds, uniqueName, info, "normal", zIndex++));
      exportedCount++;

      if (shouldExportNineSlice(target.layer, config)) {
        const nineName = makeUniqueName(`${baseName}_9s`, usedNames, folderScope);
        const nineFile = await targetFolder.createFile(`${nineName}.png`, { overwrite: true });
        const nineInfo = await exportLayerAsPng(sourceDoc, target.layer, nineFile, nineName, config, true);
        manifest.items.push(makeManifestItem(target, nineFile, outputFolder, targetFolder, bounds, nineName, nineInfo, "nine_slice", zIndex++));
        exportedCount++;
      }
    } catch (error) {
      manifest.warnings.push(makeWarning("export_failed", target.path, error.message || String(error)));
      skippedCount++;
    }
  }

  await writeManifest(outputFolder, manifest);
  return { exportedCount, skippedCount, warnings: manifest.warnings };
}

async function exportLayerAsPng(sourceDoc, layer, file, documentName, config, compactNineSlice) {
  const sourceCanvasWidth = Math.max(1, Math.round(numberFromDimension(sourceDoc.width) || 1));
  const sourceCanvasHeight = Math.max(1, Math.round(numberFromDimension(sourceDoc.height) || 1));
  const exportInfo = {
    width: 0,
    height: 0,
    originalTrimmedWidth: 0,
    originalTrimmedHeight: 0,
    evenSizeApplied: false,
    canvasSize: {
      enabled: !!config.forceCanvasSize,
      applied: false,
      width: sourceCanvasWidth,
      height: sourceCanvasHeight
    },
    uniformSize: { enabled: false, applied: false },
    nineSlice: { enabled: false }
  };

  let exportDoc = await app.createDocument({
    name: documentName,
    width: sourceCanvasWidth,
    height: sourceCanvasHeight,
    resolution: numberFromDimension(sourceDoc.resolution) || 72,
    mode: constants.NewDocumentMode ? constants.NewDocumentMode.RGB : "RGBColorMode",
    fill: constants.DocumentFill ? constants.DocumentFill.TRANSPARENT : "transparent"
  });

  try {
    await sourceDoc.duplicateLayers([layer], exportDoc);
    if (!config.forceCanvasSize) {
      await exportDoc.trim(constants.TrimType ? constants.TrimType.TRANSPARENT : "transparent", true, true, true, true);
    } else {
      exportInfo.canvasSize.applied = true;
    }
    exportInfo.originalTrimmedWidth = Math.round(numberFromDimension(exportDoc.width));
    exportInfo.originalTrimmedHeight = Math.round(numberFromDimension(exportDoc.height));

    if (compactNineSlice && shouldExportNineSlice(layer, config)) {
      const result = await compactNineSliceDocument(exportDoc, layer.name, config);
      exportDoc = result.document;
      exportInfo.nineSlice = result.info;
    }

    if (config.forceUniformSize) {
      exportInfo.uniformSize = await applyUniformCanvasSize(exportDoc, config.uniformWidth, config.uniformHeight);
    }

    if (config.forceEvenSize) {
      exportInfo.evenSizeApplied = await makeDocumentSizeEven(exportDoc);
    }

    exportInfo.width = Math.round(numberFromDimension(exportDoc.width));
    exportInfo.height = Math.round(numberFromDimension(exportDoc.height));
    await exportDoc.saveAs.png(file, { compression: 9, interlaced: false }, true);
    exportInfo.sha256 = await computeFileSha256(file);
  } finally {
    try {
      await exportDoc.closeWithoutSaving();
    } catch (error) {}
  }

  return exportInfo;
}

async function compactNineSliceDocument(doc, layerName, config) {
  try {
    if ((doc.layers || []).length > 1) await doc.mergeVisibleLayers();
  } catch (error) {}

  const originalWidth = Math.round(numberFromDimension(doc.width));
  const originalHeight = Math.round(numberFromDimension(doc.height));
  const centerSize = Math.max(1, config.nineSliceCenterSize || 2);
  const borders = getNineSliceBorders(layerName, originalWidth, originalHeight, centerSize, config);
  const horizontalSlice = borders.left > 0 || borders.right > 0;
  const verticalSlice = borders.top > 0 || borders.bottom > 0;

  if (!horizontalSlice && !verticalSlice) {
    return { document: doc, info: nineInfo(false, "no_slice_borders", borders, originalWidth, originalHeight, originalWidth, originalHeight) };
  }

  const centerSourceWidth = originalWidth - borders.left - borders.right;
  const centerSourceHeight = originalHeight - borders.top - borders.bottom;
  if (centerSourceWidth <= 0 || centerSourceHeight <= 0) {
    return { document: doc, info: nineInfo(false, "not_enough_center_area", borders, originalWidth, originalHeight, originalWidth, originalHeight) };
  }

  const centerWidth = horizontalSlice ? Math.min(centerSize, centerSourceWidth) : centerSourceWidth;
  const centerHeight = verticalSlice ? Math.min(centerSize, centerSourceHeight) : centerSourceHeight;
  const compactWidth = horizontalSlice ? borders.left + centerWidth + borders.right : originalWidth;
  const compactHeight = verticalSlice ? borders.top + centerHeight + borders.bottom : originalHeight;

  if (compactWidth >= originalWidth && compactHeight >= originalHeight) {
    return { document: doc, info: nineInfo(false, "already_compact", borders, originalWidth, originalHeight, originalWidth, originalHeight) };
  }

  const sourceMidX = horizontalSlice ? borders.left + Math.floor((centerSourceWidth - centerWidth) / 2) : 0;
  const sourceMidY = verticalSlice ? borders.top + Math.floor((centerSourceHeight - centerHeight) / 2) : 0;

  const compactDoc = await app.createDocument({
    name: `${doc.name}_9s`,
    width: compactWidth,
    height: compactHeight,
    resolution: numberFromDimension(doc.resolution) || 72,
    mode: constants.NewDocumentMode ? constants.NewDocumentMode.RGB : "RGBColorMode",
    fill: constants.DocumentFill ? constants.DocumentFill.TRANSPARENT : "transparent"
  });

  const xRegions = horizontalSlice
    ? [
        { sx: 0, dx: 0, size: borders.left },
        { sx: sourceMidX, dx: borders.left, size: centerWidth },
        { sx: originalWidth - borders.right, dx: borders.left + centerWidth, size: borders.right }
      ]
    : [{ sx: 0, dx: 0, size: originalWidth }];
  const yRegions = verticalSlice
    ? [
        { sy: 0, dy: 0, size: borders.top },
        { sy: sourceMidY, dy: borders.top, size: centerHeight },
        { sy: originalHeight - borders.bottom, dy: borders.top + centerHeight, size: borders.bottom }
      ]
    : [{ sy: 0, dy: 0, size: originalHeight }];

  for (const y of yRegions) {
    for (const x of xRegions) {
      await pasteCroppedRegion(doc, compactDoc, x.sx, y.sy, x.size, y.size, x.dx, y.dy);
    }
  }

  try {
    if ((compactDoc.layers || []).length > 1) await compactDoc.mergeVisibleLayers();
  } catch (error) {}

  await doc.closeWithoutSaving();
  return {
    document: compactDoc,
    info: {
      enabled: true,
      applied: true,
      borders,
      horizontalSlice,
      verticalSlice,
      centerSize,
      originalWidth,
      originalHeight,
      width: compactWidth,
      height: compactHeight
    }
  };
}

async function pasteCroppedRegion(sourceDoc, targetDoc, sx, sy, width, height, dx, dy) {
  if (width <= 0 || height <= 0) return;
  const batchPlay = photoshop.action.batchPlay;
  let tileDoc = null;
  try {
    tileDoc = await sourceDoc.duplicate(`slice_tile_${sx}_${sy}`, true);
    await tileDoc.crop({ left: sx, top: sy, right: sx + width, bottom: sy + height });
    await tileDoc.duplicateLayers([tileDoc.layers[0]], targetDoc);

    app.activeDocument = targetDoc;
    const pasted = targetDoc.layers[0];
    if (!pasted) return;

    // Read actual bounds via batchPlay — layer.translate() is unreliable in UXP
    const info = await batchPlay([{
      _obj: "get",
      _target: [{ _ref: "layer", _id: pasted.id }],
      _options: { dialogOptions: "dontDisplay" }
    }], { synchronousExecution: false });

    const b = info[0] && info[0].bounds;
    const curLeft = b ? (b.left._value !== undefined ? b.left._value : b.left) : 0;
    const curTop  = b ? (b.top._value  !== undefined ? b.top._value  : b.top)  : 0;
    const offsetX = dx - curLeft;
    const offsetY = dy - curTop;

    if (offsetX !== 0 || offsetY !== 0) {
      await batchPlay([{
        _obj: "move",
        _target: [{ _ref: "layer", _id: pasted.id }],
        to: {
          _obj: "offset",
          horizontal: { _unit: "pixelsUnit", _value: offsetX },
          vertical:   { _unit: "pixelsUnit", _value: offsetY }
        }
      }], { synchronousExecution: false });
    }
  } finally {
    if (tileDoc) try { await tileDoc.closeWithoutSaving(); } catch (e) {}
  }
}

async function makeDocumentSizeEven(doc) {
  const width = Math.round(numberFromDimension(doc.width));
  const height = Math.round(numberFromDimension(doc.height));
  const newWidth = width % 2 === 0 ? width : width + 1;
  const newHeight = height % 2 === 0 ? height : height + 1;
  if (newWidth === width && newHeight === height) return false;
  await doc.resizeCanvas(newWidth, newHeight, constants.AnchorPosition ? constants.AnchorPosition.MIDDLECENTER : "middleCenter");
  return true;
}

async function applyUniformCanvasSize(doc, requestedWidth, requestedHeight) {
  const currentWidth = Math.round(numberFromDimension(doc.width));
  const currentHeight = Math.round(numberFromDimension(doc.height));
  const targetWidth = Math.max(1, Math.round(requestedWidth || currentWidth));
  const targetHeight = Math.max(1, Math.round(requestedHeight || currentHeight));
  const result = {
    enabled: true,
    applied: false,
    requestedWidth: Math.round(requestedWidth || 0),
    requestedHeight: Math.round(requestedHeight || 0),
    widthBefore: currentWidth,
    heightBefore: currentHeight,
    width: targetWidth,
    height: targetHeight,
    cropped: targetWidth < currentWidth || targetHeight < currentHeight
  };
  if (targetWidth === currentWidth && targetHeight === currentHeight) return result;
  await doc.resizeCanvas(targetWidth, targetHeight, constants.AnchorPosition ? constants.AnchorPosition.MIDDLECENTER : "middleCenter");
  result.applied = true;
  return result;
}

async function getOutputFolderForTarget(outputFolder, layerPath, config) {
  const folderName = getFolderNameForTarget(layerPath, config);
  if (!folderName) return outputFolder;
  try {
    const existing = await outputFolder.getEntry(folderName);
    if (existing) return existing;
  } catch (error) {}
  return outputFolder.createFolder(folderName);
}

function getFolderNameForTarget(layerPath, config) {
  const parts = String(layerPath || "").split("/");
  let folderName = "";
  if (parts.length >= 2 && parts[0].toLowerCase() === config.exportGroupName.toLowerCase()) {
    folderName = parts[1];
  } else if (parts.length >= 2) {
    folderName = parts[0];
  }
  return sanitizeFileName(folderName, false);
}

async function writeManifest(folder, manifest) {
  const file = await folder.createFile("export_manifest.json", { overwrite: true });
  await file.write(JSON.stringify(manifest, null, 2), { format: storage.formats.utf8 });
}

function makeManifestItem(target, file, outputFolder, targetFolder, bounds, uniqueName, exportInfo, variant, zIndex) {
  const layerId = getLayerIdentity(target.layer);
  return {
    assetId: makeAssetId(layerId, target.path, variant),
    layerId,
    assetType: inferAssetType(target.layer),
    zIndex,
    sha256: exportInfo.sha256 || "",
    name: uniqueName,
    originalName: target.layer.name,
    layerPath: target.path,
    layerType: getLayerType(target.layer),
    variant,
    file: file.nativePath || file.name,
    relativeFolder: getRelativeFolder(outputFolder, targetFolder),
    x: bounds.left,
    y: bounds.top,
    width: exportInfo.width,
    height: exportInfo.height,
    originalTrimmedWidth: exportInfo.originalTrimmedWidth,
    originalTrimmedHeight: exportInfo.originalTrimmedHeight,
    evenSizeApplied: exportInfo.evenSizeApplied,
    canvasSize: exportInfo.canvasSize,
    uniformSize: exportInfo.uniformSize,
    nineSlice: exportInfo.nineSlice,
    sourceType: getLayerType(target.layer)
  };
}

async function computeFileSha256(file) {
  try {
    if (!file || !file.read || typeof crypto === "undefined" || !crypto.subtle) return "";
    const data = await file.read({ format: storage.formats.binary });
    const digest = await crypto.subtle.digest("SHA-256", data);
    return arrayBufferToHex(digest);
  } catch (error) {
    return "";
  }
}

function arrayBufferToHex(buffer) {
  const bytes = new Uint8Array(buffer);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

function getLayerIdentity(layer) {
  if (!layer) return "";
  if (layer.id !== undefined && layer.id !== null) return String(layer.id);
  if (layer._id !== undefined && layer._id !== null) return String(layer._id);
  return "";
}

function makeAssetId(layerId, layerPath, variant) {
  const base = layerId ? `layer_${layerId}` : `path_${simpleStringHash(layerPath || "")}`;
  return `psd_${base}_${variant || "normal"}`;
}

function simpleStringHash(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
}

function inferAssetType(layer) {
  const prefix = inferAutoNamePrefix(layer, { autoDetectNaming: true });
  return String(prefix || "Asset").replace(/[^A-Za-z0-9_]/g, "") || "Asset";
}

function getRelativeFolder(rootFolder, targetFolder) {
  const root = rootFolder.nativePath || rootFolder.name || "";
  const target = targetFolder.nativePath || targetFolder.name || "";
  if (!root || target === root) return "";
  if (target.indexOf(`${root}/`) === 0) return target.substring(root.length + 1);
  return targetFolder.name || target;
}

function makeBaseName(target, config) {
  const resourceName = config.autoRename ? sanitizeFileName(target.exportName, true) : sanitizeOriginalFileName(target.exportName);
  if (config.autoRename && config.autoTypePrefix && isTextLayer(target.layer)) {
    const fontPrefix = inferAutoNamePrefix(target.layer, config);
    if (isSameNameToken(fontPrefix.replace(/^Font_?/i, ""), resourceName)) {
      return `${config.prefix}${fontPrefix}`;
    }
    return `${config.prefix}${fontPrefix}_${resourceName}`;
  }
  const typePrefix = config.autoRename && config.autoTypePrefix ? `${inferAutoNamePrefix(target.layer, config)}_` : "";
  return `${config.prefix}${typePrefix}${resourceName}`;
}

function isGroupLayer(layer) {
  if (!layer) return false;
  const kind = String(layer.kind || "").toLowerCase();
  return kind === "group" || kind.indexOf("group") >= 0 || !!(layer.layers && layer.layers.length);
}

function getLayerType(layer) {
  if (isGroupLayer(layer)) return "group";
  const kind = String(layer.kind || "").toLowerCase();
  if (kind.indexOf("text") >= 0) return "text";
  if (kind.indexOf("solid") >= 0 || kind.indexOf("shape") >= 0) return "shape";
  return "image";
}

function inferAutoNamePrefix(layer, config) {
  if (isTextLayer(layer)) {
    return getFontNamePrefix(layer);
  }

  const name = String(layer && layer.name ? layer.name : "").toLowerCase();
  const bounds = getPixelBounds(layer);
  const docWidth = Math.max(1, Math.round((config && config.docWidth) || 1920));
  const docHeight = Math.max(1, Math.round((config && config.docHeight) || 1080));
  const width = bounds ? Math.max(0, bounds.width) : 0;
  const height = bounds ? Math.max(0, bounds.height) : 0;
  const longSide = Math.max(width, height);
  const shortSide = Math.min(width, height);
  const ratio = width / Math.max(height, 1);
  const area = width * height;
  const docArea = docWidth * docHeight;
  const areaRatio = docArea ? area / docArea : 0;

  if (hasAnyKeyword(name, ["标题"])) return "Font";
  if (hasAnyKeyword(name, ["bg", "background", "背景", "底图"])) return "Bg";
  if (hasAnyKeyword(name, ["btn", "button", "按钮", "tab"])) return "Btn";
  if (hasAnyKeyword(name, ["icon", "ico", "图标", "avatar", "头像"])) return "Icon";
  if (hasAnyKeyword(name, ["panel", "popup", "dialog", "card", "window", "box", "面板", "弹窗", "卡片"])) return "Panel";
  if (hasAnyKeyword(name, ["line", "divider", "split", "分割线"])) return "Line";

  if (bounds) {
    if (shortSide <= 4) return "Line";
    if (longSide < 96 && shortSide < 96) return "Icon";
    if (longSide > 800 && shortSide > 400) return "Bg";
    if (areaRatio >= 0.6 || (width >= docWidth * 0.8 && height >= docHeight * 0.8)) return "Bg";
    if (ratio > 3 || ratio < 0.33) return "Banner";
    if (looksLikeButton(width, height)) return "Btn";
    if (longSide > 300 && shortSide > 120) return "Panel";
  }

  return "Asset";
}

function isTextLayer(layer) {
  return String(layer && layer.kind ? layer.kind : "").toLowerCase().indexOf("text") >= 0;
}

function getFontNamePrefix(layer) {
  const text = normalizeFontText(getLayerTextContent(layer));
  const translated = FONT_TEXT_DICT[text];
  return `Font_${sanitizeNamePart(translated || getFallbackFontText(text)) || "Text"}`;
}

function getLayerTextContent(layer) {
  try {
    const textItem = layer && layer.textItem;
    if (!textItem) return "";
    return textItem.contents || textItem.content || textItem.text || "";
  } catch (error) {
    return "";
  }
}

function normalizeFontText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function getFallbackFontText(text) {
  const value = normalizeFontText(text);
  if (!value) return "Text";
  if (/[\u3400-\u9fff]/.test(value)) {
    return value.replace(/\s+/g, "").slice(0, 5);
  }
  return toPascalCase(value);
}

function toPascalCase(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/[【】[\]()（）]/g, "")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}

function sanitizeNamePart(value) {
  return String(value || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/-+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function isSameNameToken(a, b) {
  return normalizeNameToken(a) === normalizeNameToken(b);
}

function normalizeNameToken(value) {
  return String(value || "")
    .trim()
    .replace(/\.(png|jpg|jpeg|webp|tga)$/ig, "")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/[_\s-]+/g, "")
    .toLowerCase();
}

function hasAnyKeyword(text, keywords) {
  return keywords.some((keyword) => text.indexOf(keyword) >= 0);
}

function looksLikeButton(width, height) {
  const longSide = Math.max(width, height);
  const shortSide = Math.min(width, height);
  const ratio = longSide / Math.max(shortSide, 1);
  return longSide >= 48 && shortSide >= 18 && longSide <= 420 && shortSide <= 140 && ratio >= 1.4;
}

function getLayerPath(layer) {
  const names = [];
  let current = layer;
  while (current && current.name) {
    names.unshift(current.name);
    current = current.parent;
    if (!current || String(current.typename || "").toLowerCase() === "document") break;
  }
  return names.join("/");
}

function getLayerTargetKey(layer) {
  if (layer && layer.id !== undefined && layer.id !== null) return `id:${layer.id}`;
  if (layer && layer._id !== undefined && layer._id !== null) return `id:${layer._id}`;
  if (layer && layer.layerID !== undefined && layer.layerID !== null) return `id:${layer.layerID}`;
  return layer;
}

function getPixelBounds(layer) {
  try {
    const bounds = layer.boundsNoEffects || layer.bounds;
    if (!bounds) return null;
    const left = Math.round(numberFromBound(bounds.left));
    const top = Math.round(numberFromBound(bounds.top));
    const right = Math.round(numberFromBound(bounds.right));
    const bottom = Math.round(numberFromBound(bounds.bottom));
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  } catch (error) {
    return null;
  }
}

function numberFromBound(value) {
  if (typeof value === "number") return value;
  if (value && typeof value.value === "number") return value.value;
  if (value && typeof value._value === "number") return value._value;
  return Number(value) || 0;
}

function numberFromDimension(value) {
  if (typeof value === "number") return value;
  if (value && typeof value.value === "number") return value.value;
  if (value && typeof value._value === "number") return value._value;
  if (value && typeof value.as === "function") {
    try {
      return value.as("px");
    } catch (error) {}
  }
  return Number(value) || 0;
}

function isEffectivelyVisible(layer) {
  let current = layer;
  while (current && current.name) {
    if (current.visible === false) return false;
    current = current.parent;
  }
  return true;
}

function shouldExportNineSlice(layer, config) {
  return !!(config && config.forceNineSlice) || isNineSliceName(layer.name);
}

function isNineSliceName(name) {
  return /@9s/i.test(String(name || ""));
}

function getNineSliceBorders(layerName, width, height, centerSize, config) {
  const parsed = parseNineSliceBorderText(layerName);
  const borders = parsed || (config.forceNineSlice ? config.nineSliceBorders : {
    left: clampNumber(Math.round(width * 0.25), 4, 32),
    top: clampNumber(Math.round(height * 0.25), 4, 32),
    right: clampNumber(Math.round(width * 0.25), 4, 32),
    bottom: clampNumber(Math.round(height * 0.25), 4, 32)
  });
  return normalizeNineSliceBorders(borders, width, height, centerSize);
}

function parseNineSliceBorderText(layerName) {
  const match = String(layerName || "").match(/@9s\s*\(([^)]*)\)/i);
  if (!match) return null;
  const values = match[1].split(",").map((part) => parseInt(part, 10)).filter((value) => !isNaN(value)).map((value) => Math.max(0, value));
  if (values.length === 1) return { left: values[0], top: values[0], right: values[0], bottom: values[0] };
  if (values.length === 2) return { left: values[0], top: values[1], right: values[0], bottom: values[1] };
  if (values.length >= 4) return { left: values[0], top: values[1], right: values[2], bottom: values[3] };
  return null;
}

function normalizeNineSliceBorders(borders, width, height, centerSize) {
  const normalized = {
    left: clampNumber(Math.max(0, Math.round(borders.left || 0)), 0, Math.max(0, width)),
    top: clampNumber(Math.max(0, Math.round(borders.top || 0)), 0, Math.max(0, height)),
    right: clampNumber(Math.max(0, Math.round(borders.right || 0)), 0, Math.max(0, width)),
    bottom: clampNumber(Math.max(0, Math.round(borders.bottom || 0)), 0, Math.max(0, height))
  };
  if (normalized.left + normalized.right >= width) {
    const available = Math.max(0, width - centerSize);
    normalized.left = Math.floor(available / 2);
    normalized.right = available - normalized.left;
  }
  if (normalized.top + normalized.bottom >= height) {
    const available = Math.max(0, height - centerSize);
    normalized.top = Math.floor(available / 2);
    normalized.bottom = available - normalized.top;
  }
  return normalized;
}

function nineInfo(applied, reason, borders, originalWidth, originalHeight, width, height) {
  return { enabled: true, applied, reason, borders, originalWidth, originalHeight, width, height };
}

function cleanExportName(name) {
  return String(name || "")
    .replace(/@export/ig, "")
    .replace(/\[export\]/ig, "")
    .replace(/@9s\s*\([^)]*\)/ig, "")
    .replace(/@9s/ig, "")
    .replace(/@ignore/ig, "")
    .replace(/\[ignore\]/ig, "")
    .replace(/\.(png|jpg|jpeg|webp|tga)$/ig, "")
    .trim();
}

function sanitizeFileName(name, normalizeCase) {
  let result = String(name || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/-+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (normalizeCase) result = result.toLowerCase();
  return result;
}

function sanitizeOriginalFileName(name) {
  return String(name || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\.(png|jpg|jpeg|webp|tga)$/ig, "");
}

function sanitizePrefix(prefix) {
  return String(prefix || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/-+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+/g, "");
}

function makeUniqueName(baseName, usedNames, scope) {
  const keyPrefix = scope ? `${scope}/` : "";
  let name = baseName;
  let index = 1;
  while (usedNames[keyPrefix + name]) {
    name = `${baseName}_${index}`;
    index++;
  }
  usedNames[keyPrefix + name] = true;
  return name;
}

function isIgnored(name) {
  const lower = String(name || "").toLowerCase();
  return lower.indexOf("@ignore") >= 0 || lower.indexOf("[ignore]") >= 0;
}

function parsePositiveInt(value) {
  const parsed = parseInt(value, 10);
  return isNaN(parsed) || parsed <= 0 ? 0 : parsed;
}

function parseOptionalPixelValue(text) {
  const valueText = String(text || "").trim();
  if (!valueText) return 0;
  const value = parseInt(valueText, 10);
  return isNaN(value) ? null : value;
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function makeWarning(type, layerPath, message) {
  return { type, layerPath, message };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  })[char]);
}

let lastViewportWidth = 0;
let lastViewportHeight = 0;

function setViewportScroll(left, top) {
  const nextLeft = Math.max(0, left);
  const nextTop = Math.max(0, top);
  window.scrollTo(nextLeft, nextTop);
  document.documentElement.scrollLeft = nextLeft;
  document.documentElement.scrollTop = nextTop;
  document.body.scrollLeft = nextLeft;
  document.body.scrollTop = nextTop;
}

function pinViewportToBottomRight() {
  const exportButton = $("exportButton");
  if (exportButton) {
    const rect = exportButton.getBoundingClientRect();
    const currentLeft = window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft || 0;
    const currentTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    const targetLeft = currentLeft + rect.right - window.innerWidth + 18;
    const targetTop = currentTop + rect.bottom - window.innerHeight + 18;
    setViewportScroll(targetLeft, targetTop);
    return;
  }
  const scrollX = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth;
  const scrollY = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight;
  setViewportScroll(scrollX, scrollY);
}

function scheduleViewportPin() {
  pinViewportToBottomRight();
  setTimeout(pinViewportToBottomRight, 0);
  setTimeout(pinViewportToBottomRight, 120);
  setTimeout(pinViewportToBottomRight, 360);
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(pinViewportToBottomRight);
  }
}

function watchViewportResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  if (width !== lastViewportWidth || height !== lastViewportHeight) {
    lastViewportWidth = width;
    lastViewportHeight = height;
    scheduleViewportPin();
  }
}

function bindEvents() {
  $("chooseFolder").addEventListener("click", chooseFolder);
  $("scanButton").addEventListener("click", scanTargets);
  $("exportButton").addEventListener("click", exportNow);
  $("outputPath").addEventListener("focus", () => setOutputPathValue(state.outputPath));
  $("outputPath").addEventListener("click", () => setOutputPathValue(state.outputPath));
  document.querySelectorAll(".mode-card").forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.mode));
    button.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setMode(button.dataset.mode);
      }
    });
  });
  document.querySelectorAll("input").forEach((input) => {
    input.addEventListener("change", saveSettings);
    input.addEventListener("input", saveSettings);
  });
  window.addEventListener("resize", scheduleViewportPin);
  setInterval(watchViewportResize, 250);
}

async function boot() {
  loadSettings();
  await restoreOutputFolder();
  bindEvents();
  refreshDocumentInfo();
  $("modeCopy").textContent = MODE_HELP[state.mode] || "";
  scanTargets();
  scheduleViewportPin();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
