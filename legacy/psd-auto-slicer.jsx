/*
 * PSD Auto Slicer
 * Photoshop JSX MVP for exporting marked UI layers/layer groups as PNG files.
 *
 * Usage:
 * 1. Open a PSD in Photoshop.
 * 2. Recommended: put exportable resources under a top-level group named
 *    EXPORT, or add @export / [export] to any layer or group name.
 *    If no rule-based targets are found, the script can export the current
 *    selected layer/group or visible top-level layers as a fallback.
 * 3. Run this script from File > Scripts > Browse...
 */

#target photoshop

var PSD_AUTO_SLICER_FONT_TEXT_DICT = {
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

(function () {
    if (!app.documents.length) {
        alert("请先在 Photoshop 中打开一个 PSD 文件。");
        return;
    }

    var sourceDoc = app.activeDocument;
    var originalRulerUnits = app.preferences.rulerUnits;
    app.preferences.rulerUnits = Units.PIXELS;

    var config = {
        exportGroupName: "EXPORT",
        outputScale: 1,
        prefix: "",
        skipHidden: true,
        includeMarkedInsideExportGroup: false,
        autoRename: true,
        autoTypePrefix: true,
        groupFolders: true,
        forceEvenSize: true,
        forceCanvasSize: false,
        forceUniformSize: false,
        uniformWidth: 0,
        uniformHeight: 0,
        forceNineSlice: false,
        nineSliceBorders: { left: 8, right: 8, top: 8, bottom: 8 },
        nineSliceCenterSize: 2
    };

    try {
        var uiConfig = showExportDialog(sourceDoc, config);
        if (!uiConfig) {
            return;
        }

        config.prefix = sanitizePrefix(uiConfig.prefix);
        config.autoRename = uiConfig.autoRename;
        config.groupFolders = uiConfig.groupFolders;
        config.forceEvenSize = uiConfig.forceEvenSize;
        config.forceCanvasSize = uiConfig.forceCanvasSize;
        config.forceUniformSize = uiConfig.forceUniformSize;
        config.uniformWidth = uiConfig.uniformWidth;
        config.uniformHeight = uiConfig.uniformHeight;
        config.forceNineSlice = uiConfig.forceNineSlice;
        config.nineSliceBorders = uiConfig.nineSliceBorders;
        config.exportMode = uiConfig.exportMode;
        config.docWidth = getDocumentPixelWidth(sourceDoc);
        config.docHeight = getDocumentPixelHeight(sourceDoc);

        var outputFolder = uiConfig.outputFolder;
        var targetResult = collectTargetsForMode(sourceDoc, config.exportMode, config);
        var targets = targetResult.targets;
        var exportMode = targetResult.mode;
        if (!targets.length) {
            alert("没有找到可导出的图层。请检查切图方式、图层可见性或 @export / EXPORT 标记。");
            return;
        }

        var manifest = {
            tool: "PSD Auto Slicer",
            version: "0.2.49",
            manifestSchemaVersion: 2,
            exportMode: exportMode,
            source: getDocumentName(sourceDoc),
            sourcePath: getDocumentPath(sourceDoc),
            sourceCanvasWidth: getDocumentPixelWidth(sourceDoc),
            sourceCanvasHeight: getDocumentPixelHeight(sourceDoc),
            exportedAt: new Date().toISOString(),
            outputFolder: outputFolder.fsName,
            items: [],
            warnings: []
        };

        var usedNames = {};
        var exportedCount = 0;
        var skippedCount = 0;
        var zIndex = 0;

        for (var i = 0; i < targets.length; i++) {
            var target = targets[i];

            if (config.skipHidden && !isEffectivelyVisible(target.layer)) {
                manifest.warnings.push(makeWarning("hidden", target.path, "图层或父级图层组被隐藏，已跳过。"));
                skippedCount++;
                continue;
            }

            var bounds = getPixelBounds(target.layer);
            if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
                manifest.warnings.push(makeWarning("empty", target.path, "图层边界为空，已跳过。"));
                skippedCount++;
                continue;
            }

            var baseName = makeBaseName(target, config);
            if (!baseName) {
                baseName = "slice";
            }

            var targetFolder = config.groupFolders ? getOutputFolderForTarget(outputFolder, target.path, config) : outputFolder;
            ensureFolderExists(targetFolder);
            var uniqueName = makeUniqueName(baseName, usedNames, targetFolder.fsName);
            var file = new File(targetFolder.fsName + "/" + uniqueName + ".png");

            try {
                var normalConfig = cloneExportConfig(config);
                normalConfig.enableNineSliceCompact = false;
                var exportInfo = exportLayerAsPng(sourceDoc, target.layer, file, uniqueName, normalConfig);
                manifest.items.push(makeManifestItem(target, file, outputFolder, targetFolder, bounds, uniqueName, exportInfo, "normal", zIndex++));
                exportedCount++;

                if (shouldExportNineSlice(target.layer, config)) {
                    var nineSliceName = makeUniqueName(baseName + "_9s", usedNames, targetFolder.fsName);
                    var nineSliceFile = new File(targetFolder.fsName + "/" + nineSliceName + ".png");
                    var nineSliceConfig = cloneExportConfig(config);
                    nineSliceConfig.enableNineSliceCompact = true;
                    var nineSliceInfo = exportLayerAsPng(sourceDoc, target.layer, nineSliceFile, nineSliceName, nineSliceConfig);
                    manifest.items.push(makeManifestItem(target, nineSliceFile, outputFolder, targetFolder, bounds, nineSliceName, nineSliceInfo, "nine_slice", zIndex++));
                    exportedCount++;
                }
            } catch (exportError) {
                manifest.warnings.push(makeWarning("export_failed", target.path, String(exportError)));
                skippedCount++;
            }
        }

        writeManifest(outputFolder, manifest);

        alert(
            "PSD 自动切图完成。\n\n" +
            "成功导出：" + exportedCount + " 个\n" +
            "跳过/失败：" + skippedCount + " 个\n" +
            "导出目录：" + outputFolder.fsName + "\n\n" +
            "详情见 export_manifest.json"
        );
    } catch (error) {
        alert("PSD 自动切图失败：\n" + error);
    } finally {
        app.activeDocument = sourceDoc;
        app.preferences.rulerUnits = originalRulerUnits;
    }
})();

function showExportDialog(doc, config) {
    var savedSettings = loadToolSettings();
    var activeLayerName = "";
    try {
        var selectedLayerCount = getSelectedLayerIndices().length;
        activeLayerName = selectedLayerCount > 1 ? selectedLayerCount + " 个图层/组" : doc.activeLayer.name;
    } catch (e) {
        activeLayerName = "";
    }

    var dialog = new Window("dialog", "PSD Auto Slicer");
    dialog.orientation = "column";
    dialog.alignChildren = ["fill", "top"];
    dialog.margins = 20;
    dialog.spacing = 14;

    var infoPanel = dialog.add("panel", undefined, "当前 PSD");
    infoPanel.orientation = "column";
    infoPanel.alignChildren = ["fill", "top"];
    infoPanel.margins = 14;
    infoPanel.spacing = 6;
    infoPanel.add("statictext", undefined, "文件：" + getDocumentName(doc));
    infoPanel.add("statictext", undefined, "当前选中：" + activeLayerName);

    var outputPanel = dialog.add("panel", undefined, "导出设置");
    outputPanel.orientation = "column";
    outputPanel.alignChildren = ["fill", "top"];
    outputPanel.margins = 14;
    outputPanel.spacing = 10;

    var pathGroup = outputPanel.add("group");
    pathGroup.orientation = "row";
    pathGroup.alignChildren = ["fill", "center"];
    var pathLabel = pathGroup.add("statictext", undefined, "保存路径");
    pathLabel.preferredSize.width = 72;
    var pathInput = pathGroup.add("edittext", undefined, savedSettings.outputFolder || "");
    pathInput.characters = 42;
    var browseButton = pathGroup.add("button", undefined, "选择...");

    browseButton.onClick = function () {
        var folder = Folder.selectDialog("选择切图导出目录");
        if (folder) {
            pathInput.text = folder.fsName;
        }
    };

    var prefixGroup = outputPanel.add("group");
    prefixGroup.orientation = "row";
    prefixGroup.alignChildren = ["left", "center"];
    var prefixLabel = prefixGroup.add("statictext", undefined, "资源名前缀");
    prefixLabel.preferredSize.width = 72;
    var prefixInput = prefixGroup.add("edittext", undefined, savedSettings.prefix || "");
    prefixInput.characters = 24;
    prefixGroup.add("statictext", undefined, "例如 ui_main_，可留空");

    var renameCheckbox = outputPanel.add("checkbox", undefined, "自动规范命名（添加类型前缀，并转换为小写下划线）");
    renameCheckbox.value = typeof savedSettings.autoRename === "boolean" ? savedSettings.autoRename : !!config.autoRename;

    var groupFoldersCheckbox = outputPanel.add("checkbox", undefined, "自动分文件夹（按根图层组或 EXPORT 子组归类）");
    groupFoldersCheckbox.value = typeof savedSettings.groupFolders === "boolean" ? savedSettings.groupFolders : config.groupFolders !== false;

    var sizePanel = dialog.add("panel", undefined, "尺寸规则");
    sizePanel.orientation = "column";
    sizePanel.alignChildren = ["fill", "top"];
    sizePanel.margins = 14;
    sizePanel.spacing = 8;

    var evenCheckbox = sizePanel.add("checkbox", undefined, "强制导出宽高为偶数，不足时补 1 像素透明空白");
    evenCheckbox.value = typeof savedSettings.forceEvenSize === "boolean" ? savedSettings.forceEvenSize : !!config.forceEvenSize;

    var canvasCheckbox = sizePanel.add("checkbox", undefined, "画布尺寸输出（不裁切透明边，按 PSD 原画布导出）");
    canvasCheckbox.value = typeof savedSettings.forceCanvasSize === "boolean" ? savedSettings.forceCanvasSize : !!config.forceCanvasSize;

    var uniformGroup = sizePanel.add("group");
    uniformGroup.orientation = "row";
    uniformGroup.alignChildren = ["left", "center"];
    var uniformCheckbox = uniformGroup.add("checkbox", undefined, "统一导出尺寸");
    uniformCheckbox.value = typeof savedSettings.forceUniformSize === "boolean" ? savedSettings.forceUniformSize : !!config.forceUniformSize;
    var widthInput = uniformGroup.add("edittext", undefined, savedSettings.uniformWidth || "");
    widthInput.characters = 6;
    uniformGroup.add("statictext", undefined, "*");
    var heightInput = uniformGroup.add("edittext", undefined, savedSettings.uniformHeight || "");
    heightInput.characters = 6;
    uniformGroup.add("statictext", undefined, "px，内容居中；尺寸小于内容时居中裁切");

    widthInput.enabled = uniformCheckbox.value;
    heightInput.enabled = uniformCheckbox.value;
    uniformCheckbox.onClick = function () {
        widthInput.enabled = uniformCheckbox.value;
        heightInput.enabled = uniformCheckbox.value;
    };

    var nineSlicePanel = dialog.add("panel", undefined, "九宫切图");
    nineSlicePanel.orientation = "column";
    nineSlicePanel.alignChildren = ["fill", "top"];
    nineSlicePanel.margins = 14;
    nineSlicePanel.spacing = 8;

    var nineSliceCheckbox = nineSlicePanel.add("checkbox", undefined, "额外导出 _9s 最小九宫图");
    nineSliceCheckbox.value = typeof savedSettings.forceNineSlice === "boolean" ? savedSettings.forceNineSlice : !!config.forceNineSlice;

    var nineSliceGroup = nineSlicePanel.add("group");
    nineSliceGroup.orientation = "row";
    nineSliceGroup.alignChildren = ["left", "center"];
    nineSliceGroup.add("statictext", undefined, "左");
    var nineLeftInput = nineSliceGroup.add("edittext", undefined, savedSettings.nineLeft || String(config.nineSliceBorders.left));
    nineLeftInput.characters = 5;
    nineSliceGroup.add("statictext", undefined, "右");
    var nineRightInput = nineSliceGroup.add("edittext", undefined, savedSettings.nineRight || String(config.nineSliceBorders.right));
    nineRightInput.characters = 5;
    nineSliceGroup.add("statictext", undefined, "上");
    var nineTopInput = nineSliceGroup.add("edittext", undefined, savedSettings.nineTop || String(config.nineSliceBorders.top));
    nineTopInput.characters = 5;
    nineSliceGroup.add("statictext", undefined, "下");
    var nineBottomInput = nineSliceGroup.add("edittext", undefined, savedSettings.nineBottom || String(config.nineSliceBorders.bottom));
    nineBottomInput.characters = 5;
    nineSliceGroup.add("statictext", undefined, "px；空白或 0 = 不切该方向，中间拉伸区保留 2px");

    setNineSliceInputsEnabled(nineSliceCheckbox.value);
    nineSliceCheckbox.onClick = function () {
        setNineSliceInputsEnabled(nineSliceCheckbox.value);
    };

    function setNineSliceInputsEnabled(enabled) {
        nineLeftInput.enabled = enabled;
        nineRightInput.enabled = enabled;
        nineTopInput.enabled = enabled;
        nineBottomInput.enabled = enabled;
    }

    var modePanel = dialog.add("panel", undefined, "切图方式");
    modePanel.orientation = "column";
    modePanel.alignChildren = ["fill", "top"];
    modePanel.margins = 14;
    modePanel.spacing = 10;

    var modeItems = getExportModeItems(doc);
    var modeButtons = [];
    var selectedModeIndex = getDefaultExportModeIndex(modeItems, doc);

    var tabsRow1 = modePanel.add("group");
    tabsRow1.orientation = "row";
    tabsRow1.alignChildren = ["fill", "center"];
    tabsRow1.spacing = 8;

    for (var i = 0; i < modeItems.length; i++) {
        var button = tabsRow1.add("button", undefined, modeItems[i].tabLabel);
        button.preferredSize.width = 190;
        button.preferredSize.height = 84;
        button.modeIndex = i;
        button.onClick = function () {
            setModeTab(this.modeIndex);
        };
        modeButtons.push(button);
    }

    var modeTitle = modePanel.add("statictext", undefined, "");
    modeTitle.preferredSize.width = 600;

    var modeHelp = modePanel.add("statictext", undefined, "", { multiline: true });
    modeHelp.preferredSize.width = 600;
    modeHelp.preferredSize.height = 50;

    function setModeTab(index) {
        selectedModeIndex = index;
        for (var j = 0; j < modeButtons.length; j++) {
            modeButtons[j].text = modeItems[j].tabLabel;
            applyModeButtonState(modeButtons[j], j === selectedModeIndex);
        }
        modeTitle.text = "当前切图方式：" + modeItems[selectedModeIndex].label;
        modeHelp.text = modeItems[selectedModeIndex].help;
    };
    setModeTab(selectedModeIndex);
    dialog.onShow = function () {
        setModeTab(selectedModeIndex);
    };

    var nineSliceHint = dialog.add("statictext", undefined, "勾选九宫切图后，会同时导出原尺寸图和 _9s 最小图。", { multiline: true });
    nineSliceHint.preferredSize.width = 600;

    var buttonGroup = dialog.add("group");
    buttonGroup.alignment = "right";
    buttonGroup.spacing = 2;
    var cancelButton = buttonGroup.add("button", undefined, "取消", { name: "cancel" });
    cancelButton.preferredSize.width = 110;
    cancelButton.preferredSize.height = 48;
    var exportButton = buttonGroup.add("button", undefined, "开始切图", { name: "ok" });
    exportButton.preferredSize.width = 180;
    exportButton.preferredSize.height = 48;

    var result = null;
    exportButton.onClick = function () {
        if (!pathInput.text || !String(pathInput.text).replace(/^\s+|\s+$/g, "")) {
            alert("请先选择保存路径。");
            return;
        }
        var folder = new Folder(pathInput.text);
        if (!folder.exists) {
            var createFolder = confirm("保存路径不存在，是否创建？\n\n" + folder.fsName);
            if (!createFolder) {
                return;
            }
            ensureFolderExists(folder);
        }

        var uniformWidth = 0;
        var uniformHeight = 0;
        if (uniformCheckbox.value) {
            uniformWidth = parseInt(widthInput.text, 10);
            uniformHeight = parseInt(heightInput.text, 10);
            if (isNaN(uniformWidth) || isNaN(uniformHeight) || uniformWidth <= 0 || uniformHeight <= 0) {
                alert("请输入有效的统一尺寸宽高，例如 128 * 128。");
                return;
            }
        }

        var nineSliceBorders = {
            left: 0,
            right: 0,
            top: 0,
            bottom: 0
        };
        if (nineSliceCheckbox.value) {
            nineSliceBorders.left = parseOptionalPixelValue(nineLeftInput.text);
            nineSliceBorders.right = parseOptionalPixelValue(nineRightInput.text);
            nineSliceBorders.top = parseOptionalPixelValue(nineTopInput.text);
            nineSliceBorders.bottom = parseOptionalPixelValue(nineBottomInput.text);
            if (
                nineSliceBorders.left === null || nineSliceBorders.right === null ||
                nineSliceBorders.top === null || nineSliceBorders.bottom === null ||
                nineSliceBorders.left < 0 || nineSliceBorders.right < 0 ||
                nineSliceBorders.top < 0 || nineSliceBorders.bottom < 0
            ) {
                alert("请输入有效的九宫边距。可以留空，不能输入负数。");
                return;
            }
        }

        result = {
            outputFolder: folder,
            prefix: prefixInput.text,
            autoRename: renameCheckbox.value,
            groupFolders: groupFoldersCheckbox.value,
            forceEvenSize: evenCheckbox.value,
            forceCanvasSize: canvasCheckbox.value,
            forceUniformSize: uniformCheckbox.value,
            uniformWidth: uniformWidth,
            uniformHeight: uniformHeight,
            forceNineSlice: nineSliceCheckbox.value,
            nineSliceBorders: nineSliceBorders,
            exportMode: modeItems[selectedModeIndex].value
        };
        saveToolSettings({
            outputFolder: folder.fsName,
            prefix: prefixInput.text,
            autoRename: renameCheckbox.value,
            groupFolders: groupFoldersCheckbox.value,
            forceEvenSize: evenCheckbox.value,
            forceCanvasSize: canvasCheckbox.value,
            forceUniformSize: uniformCheckbox.value,
            uniformWidth: widthInput.text,
            uniformHeight: heightInput.text,
            forceNineSlice: nineSliceCheckbox.value,
            nineLeft: nineLeftInput.text,
            nineRight: nineRightInput.text,
            nineTop: nineTopInput.text,
            nineBottom: nineBottomInput.text
        });
        dialog.close(1);
    };

    cancelButton.onClick = function () {
        result = null;
        dialog.close(0);
    };

    dialog.center();
    dialog.show();
    return result;
}

function getExportModeItems(doc) {
    return [
        {
            value: "selected_layer",
            tabLabel: "选中的图层",
            label: "选中的图层",
            help: "把当前选中的每个图层或图层组分别导出为独立 PNG。多选时不会合并成一张图。"
        },
        {
            value: "selected_group_leaf_layers",
            tabLabel: "选中的图层及子图层",
            label: "选中的图层及子图层",
            help: "从当前选中的图层组开始，递归切出里面所有可见的细分图层资源；多选组会分别递归处理。默认推荐这个模式。"
        },
        {
            value: "document_leaf_layers",
            tabLabel: "PSD 所有图层",
            label: "PSD 所有图层",
            help: "遍历当前 PSD，递归切出所有可见的细分图层资源。文件夹仍只按根目录一级图层组管理。"
        }
    ];
}

function getDefaultExportModeIndex(items, doc) {
    var desired = "selected_layer";

    for (var i = 0; i < items.length; i++) {
        if (items[i].value === desired) {
            return i;
        }
    }
    return 0;
}

function applyModeButtonState(button, selected) {
    try {
        var background = selected ? [1, 1, 1, 1] : [0.78, 0.78, 0.78, 1];
        var foreground = selected ? [0, 0, 0, 1] : [0.2, 0.2, 0.2, 1];
        button.graphics.backgroundColor = button.graphics.newBrush(button.graphics.BrushType.SOLID_COLOR, background);
        button.graphics.foregroundColor = button.graphics.newPen(button.graphics.PenType.SOLID_COLOR, foreground, 1);
    } catch (e) {
        // Some Photoshop ScriptUI button themes ignore custom colors.
    }
}

function getSelectedLayers(doc) {
    var originalLayer = doc.activeLayer;
    var indices = getSelectedLayerIndices();
    var layers = [];

    if (!indices.length) {
        return [originalLayer];
    }

    for (var i = 0; i < indices.length; i++) {
        try {
            selectLayerByIndex(indices[i], false);
            layers.push(doc.activeLayer);
        } catch (e) {
            // Some special layers may not be selectable through Action Manager.
        }
    }

    try {
        doc.activeLayer = originalLayer;
    } catch (restoreError) {
        // Restoring selection is best-effort; export references are already collected.
    }

    if (!layers.length) {
        layers.push(originalLayer);
    }

    return layers;
}

function getSelectedLayerIndices() {
    var selected = [];
    var selectedLayersKey = stringIDToTypeID("selectedLayers");

    try {
        var ref = new ActionReference();
        ref.putProperty(charIDToTypeID("Prpr"), selectedLayersKey);
        ref.putEnumerated(charIDToTypeID("Dcmn"), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
        var desc = executeActionGet(ref);

        if (desc.hasKey(selectedLayersKey)) {
            var list = desc.getList(selectedLayersKey);
            for (var i = 0; i < list.count; i++) {
                selected.push(list.getReference(i).getIndex());
            }
            return selected;
        }
    } catch (e) {
        // Fall through to older Photoshop targetLayers property.
    }

    var targetLayersKey = stringIDToTypeID("targetLayers");

    try {
        var legacyRef = new ActionReference();
        legacyRef.putProperty(charIDToTypeID("Prpr"), targetLayersKey);
        legacyRef.putEnumerated(charIDToTypeID("Dcmn"), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
        var legacyDesc = executeActionGet(legacyRef);

        if (legacyDesc.hasKey(targetLayersKey)) {
            var legacyList = legacyDesc.getList(targetLayersKey);
            var offset = hasBackgroundLayer() ? 0 : 1;
            for (var j = 0; j < legacyList.count; j++) {
                selected.push(legacyList.getReference(j).getIndex() + offset);
            }
            return selected;
        }
    } catch (legacyError) {
        // Fall through to active layer index.
    }

    try {
        var activeRef = new ActionReference();
        activeRef.putProperty(charIDToTypeID("Prpr"), charIDToTypeID("ItmI"));
        activeRef.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
        selected.push(executeActionGet(activeRef).getInteger(charIDToTypeID("ItmI")));
    } catch (activeError) {
        selected = [];
    }

    return selected;
}

function selectLayerByIndex(index, addToSelection) {
    var desc = new ActionDescriptor();
    var ref = new ActionReference();
    ref.putIndex(charIDToTypeID("Lyr "), index);
    desc.putReference(charIDToTypeID("null"), ref);
    if (addToSelection) {
        desc.putEnumerated(
            stringIDToTypeID("selectionModifier"),
            stringIDToTypeID("selectionModifierType"),
            stringIDToTypeID("addToSelection")
        );
    }
    desc.putBoolean(charIDToTypeID("MkVs"), false);
    executeAction(charIDToTypeID("slct"), desc, DialogModes.NO);
}

function hasBackgroundLayer() {
    try {
        app.activeDocument.backgroundLayer;
        return true;
    } catch (e) {
        return false;
    }
}

function collectTargetsForMode(doc, mode, config) {
    var targets = [];
    var seenPaths = {};
    var selectedLayers = getSelectedLayers(doc);

    if (mode === "selected_layer") {
        for (var i = 0; i < selectedLayers.length; i++) {
            addTarget(selectedLayers[i], getLayerPath(selectedLayers[i]), cleanExportName(selectedLayers[i].name), targets, seenPaths);
        }
        return { mode: "selected_layer", targets: targets };
    }

    if (mode === "selected_group_leaf_layers") {
        for (var j = 0; j < selectedLayers.length; j++) {
            var selectedLayer = selectedLayers[j];
            if (selectedLayer.typename !== "LayerSet") {
                addTarget(selectedLayer, getLayerPath(selectedLayer), cleanExportName(selectedLayer.name), targets, seenPaths);
            } else {
                collectLeafLayerTargets(selectedLayer, getLayerPath(selectedLayer), targets, seenPaths);
            }
        }
        return { mode: "selected_group_leaf_layers", targets: targets };
    }

    if (mode === "document_leaf_layers") {
        collectDocumentLeafLayerTargets(doc, targets, seenPaths);
        return { mode: "document_leaf_layers", targets: targets };
    }

    return { mode: mode, targets: targets };
}

function collectExportTargets(doc, config) {
    var targets = [];
    var seenPaths = {};

    for (var i = 0; i < doc.layers.length; i++) {
        var layer = doc.layers[i];
        var rootPath = layer.name;

        if (isExportRoot(layer, config.exportGroupName)) {
            collectDirectChildren(layer, rootPath, targets, seenPaths);
        }

        collectMarkedLayers(layer, rootPath, targets, seenPaths, config);
    }

    return targets;
}

function collectTopLevelVisibleTargets(doc, targets, seenPaths) {
    for (var i = doc.layers.length - 1; i >= 0; i--) {
        var layer = doc.layers[i];
        if (isIgnored(layer.name) || !isEffectivelyVisible(layer)) {
            continue;
        }
        addTarget(layer, layer.name, cleanExportName(layer.name), targets, seenPaths);
    }
}

function collectDirectChildren(group, groupPath, targets, seenPaths) {
    for (var i = group.layers.length - 1; i >= 0; i--) {
        var child = group.layers[i];
        if (isIgnored(child.name)) {
            continue;
        }
        addTarget(child, groupPath + "/" + child.name, cleanExportName(child.name), targets, seenPaths);
    }
}

function collectLeafLayerTargets(layer, path, targets, seenPaths) {
    if (isIgnored(layer.name)) {
        return;
    }

    if (layer.typename !== "LayerSet") {
        addTarget(layer, path, cleanExportName(layer.name), targets, seenPaths);
        return;
    }

    for (var i = layer.layers.length - 1; i >= 0; i--) {
        var child = layer.layers[i];
        collectLeafLayerTargets(child, path + "/" + child.name, targets, seenPaths);
    }
}

function collectDocumentLeafLayerTargets(doc, targets, seenPaths) {
    for (var i = doc.layers.length - 1; i >= 0; i--) {
        var layer = doc.layers[i];
        collectLeafLayerTargets(layer, layer.name, targets, seenPaths);
    }
}

function getLayerPath(layer) {
    var names = [];
    var current = layer;
    while (current && current.typename !== "Document") {
        names.unshift(current.name);
        current = current.parent;
    }
    return names.join("/");
}

function collectMarkedLayers(layer, path, targets, seenPaths, config) {
    if (isMarkedForExport(layer.name) && !isIgnored(layer.name)) {
        addTarget(layer, path, cleanExportName(layer.name), targets, seenPaths);
    }

    if (layer.typename !== "LayerSet") {
        return;
    }

    if (isExportRoot(layer, config.exportGroupName) && !config.includeMarkedInsideExportGroup) {
        return;
    }

    for (var i = layer.layers.length - 1; i >= 0; i--) {
        var child = layer.layers[i];
        collectMarkedLayers(child, path + "/" + child.name, targets, seenPaths, config);
    }
}

function addTarget(layer, path, exportName, targets, seenPaths) {
    if (seenPaths[path]) {
        return;
    }
    seenPaths[path] = true;
    targets.push({
        layer: layer,
        path: path,
        exportName: exportName
    });
}

function cloneExportConfig(config) {
    var cloned = {};
    for (var key in config) {
        if (config.hasOwnProperty(key)) {
            cloned[key] = config[key];
        }
    }
    return cloned;
}

function parseOptionalPixelValue(text) {
    var valueText = String(text || "").replace(/^\s+|\s+$/g, "");
    if (!valueText) {
        return 0;
    }
    var value = parseInt(valueText, 10);
    if (isNaN(value)) {
        return null;
    }
    return value;
}

function makeManifestItem(target, file, outputFolder, targetFolder, bounds, uniqueName, exportInfo, variant, zIndex) {
    var layerId = getLayerIdentity(target.layer);
    return {
        assetId: makeAssetId(layerId, target.path, variant),
        layerId: layerId,
        assetType: inferAssetType(target.layer, exportInfo),
        zIndex: zIndex,
        sha256: exportInfo.sha256 || "",
        name: uniqueName,
        originalName: target.layer.name,
        layerPath: target.path,
        layerType: getLayerType(target.layer),
        variant: variant,
        file: file.fsName,
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

function isExportRoot(layer, exportGroupName) {
    return layer.typename === "LayerSet" && layer.name.toLowerCase() === exportGroupName.toLowerCase();
}

function isMarkedForExport(name) {
    var lower = name.toLowerCase();
    return lower.indexOf("@export") >= 0 || lower.indexOf("[export]") >= 0;
}

function isIgnored(name) {
    var lower = name.toLowerCase();
    return lower.indexOf("@ignore") >= 0 || lower.indexOf("[ignore]") >= 0;
}

function cleanExportName(name) {
    return name
        .replace(/@export/ig, "")
        .replace(/\[export\]/ig, "")
        .replace(/@9s\s*\([^)]*\)/ig, "")
        .replace(/@9s/ig, "")
        .replace(/@ignore/ig, "")
        .replace(/\[ignore\]/ig, "")
        .replace(/\.(png|jpg|jpeg|webp|tga)$/ig, "")
        .replace(/^\s+|\s+$/g, "");
}

function sanitizeFileName(name, normalizeCase) {
    var result = String(name || "")
        .replace(/^\s+|\s+$/g, "")
        .replace(/[\\\/:*?"<>|]+/g, "_")
        .replace(/\s+/g, "_")
        .replace(/-+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "");

    if (normalizeCase) {
        result = result.toLowerCase();
    }

    return result;
}

function sanitizeOriginalFileName(name) {
    return String(name || "")
        .replace(/^\s+|\s+$/g, "")
        .replace(/[\\\/:*?"<>|]+/g, "_")
        .replace(/\.(png|jpg|jpeg|webp|tga)$/ig, "");
}

function sanitizePrefix(prefix) {
    var result = String(prefix || "")
        .replace(/^\s+|\s+$/g, "")
        .replace(/[\\\/:*?"<>|]+/g, "_")
        .replace(/\s+/g, "_")
        .replace(/-+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+/g, "");

    return result;
}

function makeUniqueName(baseName, usedNames, scope) {
    var keyPrefix = scope ? scope + "/" : "";
    var name = baseName;
    var index = 1;
    while (usedNames[keyPrefix + name]) {
        name = baseName + "_" + index;
        index++;
    }
    usedNames[keyPrefix + name] = true;
    return name;
}

function getLayerType(layer) {
    if (layer.typename === "LayerSet") {
        return "group";
    }

    try {
        if (layer.kind === LayerKind.TEXT) {
            return "text";
        }
        if (layer.kind === LayerKind.SOLIDFILL) {
            return "shape";
        }
        if (layer.kind === LayerKind.SMARTOBJECT) {
            return "image";
        }
    } catch (e) {
        return "image";
    }

    return "image";
}

function getLayerTypePrefix(layer) {
    return getLayerType(layer) + "_";
}

function makeBaseName(target, config) {
    var resourceName = config.autoRename ? sanitizeFileName(target.exportName, true) : sanitizeOriginalFileName(target.exportName);
    if (config.autoRename && config.autoTypePrefix && isTextLayer(target.layer)) {
        var fontPrefix = inferAutoNamePrefix(target.layer, config);
        if (isSameNameToken(fontPrefix.replace(/^Font_?/i, ""), resourceName)) {
            return config.prefix + fontPrefix;
        }
        return config.prefix + fontPrefix + "_" + resourceName;
    }
    var typePrefix = config.autoRename && config.autoTypePrefix ? inferAutoNamePrefix(target.layer, config) + "_" : "";
    return config.prefix + typePrefix + resourceName;
}

function inferAutoNamePrefix(layer, config) {
    if (isTextLayer(layer)) {
        return getFontNamePrefix(layer);
    }

    var name = String(layer && layer.name ? layer.name : "").toLowerCase();
    var bounds = getPixelBounds(layer);
    var docWidth = Math.max(1, Math.round((config && config.docWidth) || 1920));
    var docHeight = Math.max(1, Math.round((config && config.docHeight) || 1080));
    var width = bounds ? Math.max(0, bounds.width) : 0;
    var height = bounds ? Math.max(0, bounds.height) : 0;
    var longSide = Math.max(width, height);
    var shortSide = Math.min(width, height);
    var ratio = width / Math.max(height, 1);
    var areaRatio = docWidth * docHeight ? (width * height) / (docWidth * docHeight) : 0;

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
    try {
        return layer && layer.kind === LayerKind.TEXT;
    } catch (e) {
        return false;
    }
}

function getFontNamePrefix(layer) {
    var text = normalizeFontText(getLayerTextContent(layer));
    var translated = PSD_AUTO_SLICER_FONT_TEXT_DICT[text];
    return "Font_" + (sanitizeNamePart(translated || getFallbackFontText(text)) || "Text");
}

function getLayerTextContent(layer) {
    try {
        return layer && layer.textItem ? layer.textItem.contents || "" : "";
    } catch (e) {
        return "";
    }
}

function normalizeFontText(text) {
    return String(text || "").replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
}

function getFallbackFontText(text) {
    var value = normalizeFontText(text);
    if (!value) return "Text";
    if (/[\u3400-\u9fff]/.test(value)) {
        return value.replace(/\s+/g, "").slice(0, 5);
    }
    return toPascalCase(value);
}

function toPascalCase(value) {
    var words = String(value || "")
        .replace(/[_-]+/g, " ")
        .replace(/[【】\[\]()（）]/g, "")
        .split(" ");
    var result = "";
    for (var i = 0; i < words.length; i++) {
        if (words[i]) {
            result += words[i].charAt(0).toUpperCase() + words[i].slice(1);
        }
    }
    return result;
}

function sanitizeNamePart(value) {
    return String(value || "")
        .replace(/^\s+|\s+$/g, "")
        .replace(/[\\\/:*?"<>|]+/g, "_")
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
        .replace(/^\s+|\s+$/g, "")
        .replace(/\.(png|jpg|jpeg|webp|tga)$/ig, "")
        .replace(/[\\\/:*?"<>|]+/g, "_")
        .replace(/[_\s-]+/g, "")
        .toLowerCase();
}

function hasAnyKeyword(text, keywords) {
    for (var i = 0; i < keywords.length; i++) {
        if (text.indexOf(keywords[i]) >= 0) return true;
    }
    return false;
}

function looksLikeButton(width, height) {
    var longSide = Math.max(width, height);
    var shortSide = Math.min(width, height);
    var ratio = longSide / Math.max(shortSide, 1);
    return longSide >= 48 && shortSide >= 18 && longSide <= 420 && shortSide <= 140 && ratio >= 1.4;
}

function inferAssetType(layer) {
    return String(inferAutoNamePrefix(layer, { autoDetectNaming: true }) || "Asset").replace(/[^A-Za-z0-9_]/g, "") || "Asset";
}

function getLayerIdentity(layer) {
    var doc = null;
    var originalLayer = null;
    try {
        doc = app.activeDocument;
        originalLayer = doc.activeLayer;
        doc.activeLayer = layer;
        var ref = new ActionReference();
        ref.putProperty(charIDToTypeID("Prpr"), stringIDToTypeID("layerID"));
        ref.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
        return String(executeActionGet(ref).getInteger(stringIDToTypeID("layerID")));
    } catch (e) {
        return simpleStringHash(getLayerPath(layer));
    } finally {
        try {
            if (doc && originalLayer) {
                doc.activeLayer = originalLayer;
            }
        } catch (restoreError) {}
    }
}

function makeAssetId(layerId, layerPath, variant) {
    var base = layerId ? "layer_" + layerId : "path_" + simpleStringHash(layerPath || "");
    return "psd_" + base + "_" + (variant || "normal");
}

function simpleStringHash(value) {
    var hash = 2166136261;
    value = String(value || "");
    for (var i = 0; i < value.length; i++) {
        hash ^= value.charCodeAt(i);
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(16);
}

function getOutputFolderForTarget(outputFolder, layerPath, config) {
    var parts = String(layerPath || "").split("/");
    var folderName = "";

    if (parts.length >= 2 && parts[0].toLowerCase() === config.exportGroupName.toLowerCase()) {
        folderName = parts[1];
    } else if (parts.length >= 2) {
        folderName = parts[0];
    }

    folderName = sanitizeFileName(folderName, false);
    if (!folderName) {
        return outputFolder;
    }

    return new Folder(outputFolder.fsName + "/" + folderName);
}

function ensureFolderExists(folder) {
    if (folder.exists) {
        return;
    }

    var parent = folder.parent;
    if (parent && !parent.exists) {
        ensureFolderExists(parent);
    }
    folder.create();
}

function getRelativeFolder(rootFolder, targetFolder) {
    var rootPath = rootFolder.fsName;
    var targetPath = targetFolder.fsName;
    if (targetPath === rootPath) {
        return "";
    }
    if (targetPath.indexOf(rootPath + "/") === 0) {
        return targetPath.substring(rootPath.length + 1);
    }
    return targetPath;
}

function padNumber(value, width) {
    var text = String(value);
    while (text.length < width) {
        text = "0" + text;
    }
    return text;
}

function getPixelBounds(layer) {
    var bounds;
    try {
        bounds = layer.bounds;
    } catch (e) {
        return null;
    }

    if (!bounds || bounds.length < 4) {
        return null;
    }

    var left = Math.round(bounds[0].as("px"));
    var top = Math.round(bounds[1].as("px"));
    var right = Math.round(bounds[2].as("px"));
    var bottom = Math.round(bounds[3].as("px"));

    return {
        left: left,
        top: top,
        right: right,
        bottom: bottom,
        width: right - left,
        height: bottom - top
    };
}

function isEffectivelyVisible(layer) {
    var current = layer;
    while (current) {
        try {
            if (!current.visible) {
                return false;
            }
        } catch (e) {
            return false;
        }
        current = current.parent;
        if (!current || current.typename === "Document") {
            break;
        }
    }
    return true;
}

function exportLayerAsPng(sourceDoc, layer, file, documentName, config) {
    app.activeDocument = sourceDoc;
    var sourceCanvasWidth = getDocumentPixelWidth(sourceDoc);
    var sourceCanvasHeight = getDocumentPixelHeight(sourceDoc);
    var exportInfo = {
        width: 0,
        height: 0,
        originalTrimmedWidth: 0,
        originalTrimmedHeight: 0,
        evenSizeApplied: false,
        canvasSize: {
            enabled: !!(config && config.forceCanvasSize),
            applied: false,
            width: sourceCanvasWidth,
            height: sourceCanvasHeight
        },
        uniformSize: {
            enabled: false,
            applied: false
        },
        nineSlice: {
            enabled: false
        }
    };

    var exportDoc = app.documents.add(
        UnitValue(sourceCanvasWidth, "px"),
        UnitValue(sourceCanvasHeight, "px"),
        sourceDoc.resolution,
        documentName,
        NewDocumentMode.RGB,
        DocumentFill.TRANSPARENT
    );

    try {
        app.activeDocument = sourceDoc;
        layer.duplicate(exportDoc, ElementPlacement.PLACEATBEGINNING);
        app.activeDocument = exportDoc;

        removeDefaultBackgroundIfAny(exportDoc);
        if (config && config.forceCanvasSize) {
            exportInfo.canvasSize.applied = true;
        } else {
            exportDoc.trim(TrimType.TRANSPARENT, true, true, true, true);
        }
        exportInfo.originalTrimmedWidth = getDocumentPixelWidth(exportDoc);
        exportInfo.originalTrimmedHeight = getDocumentPixelHeight(exportDoc);

        if (config && config.enableNineSliceCompact && shouldExportNineSlice(layer, config)) {
            var nineSliceResult = compactNineSliceDocument(exportDoc, layer.name, config);
            exportInfo.nineSlice = nineSliceResult.info;
            exportDoc = nineSliceResult.document;
        }

        if (config && config.forceUniformSize) {
            exportInfo.uniformSize = applyUniformCanvasSize(exportDoc, config.uniformWidth, config.uniformHeight);
        }

        if (config && config.forceEvenSize) {
            exportInfo.evenSizeApplied = makeDocumentSizeEven(exportDoc);
        }

        exportInfo.width = getDocumentPixelWidth(exportDoc);
        exportInfo.height = getDocumentPixelHeight(exportDoc);

        if (file.exists) {
            file.remove();
        }

        var pngOptions = new PNGSaveOptions();
        pngOptions.compression = 9;
        pngOptions.interlaced = false;
        exportDoc.saveAs(file, pngOptions, true, Extension.LOWERCASE);
        exportInfo.sha256 = computeFileSha256(file);
    } finally {
        try {
            exportDoc.close(SaveOptions.DONOTSAVECHANGES);
        } catch (closeError) {
            // The document may already be closed if Photoshop throws during save.
        }
    }

    return exportInfo;
}

function makeDocumentSizeEven(doc) {
    var width = getDocumentPixelWidth(doc);
    var height = getDocumentPixelHeight(doc);
    var newWidth = width % 2 === 0 ? width : width + 1;
    var newHeight = height % 2 === 0 ? height : height + 1;

    if (newWidth === width && newHeight === height) {
        return false;
    }

    doc.resizeCanvas(UnitValue(newWidth, "px"), UnitValue(newHeight, "px"), AnchorPosition.MIDDLECENTER);
    return true;
}

function applyUniformCanvasSize(doc, requestedWidth, requestedHeight) {
    var currentWidth = getDocumentPixelWidth(doc);
    var currentHeight = getDocumentPixelHeight(doc);
    var targetWidth = Math.max(1, Math.round(requestedWidth || currentWidth));
    var targetHeight = Math.max(1, Math.round(requestedHeight || currentHeight));

    var result = {
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

    if (targetWidth === currentWidth && targetHeight === currentHeight) {
        return result;
    }

    doc.resizeCanvas(UnitValue(targetWidth, "px"), UnitValue(targetHeight, "px"), AnchorPosition.MIDDLECENTER);
    result.applied = true;
    return result;
}

function shouldExportNineSlice(layer, config) {
    return !!(config && config.forceNineSlice) || isNineSliceName(layer.name);
}

function prepareNineSliceSourceDocument(doc) {
    app.activeDocument = doc;
    try {
        if (doc.layers.length > 1) {
            doc.mergeVisibleLayers();
        }
    } catch (mergeError) {
        try {
            doc.activeLayer.rasterize(RasterizeType.ENTIRELAYER);
        } catch (rasterizeError) {
            // Some layer types are already rasterized or cannot be rasterized here.
        }
    }
    return doc;
}

function compactNineSliceDocument(doc, layerName, config) {
    doc = prepareNineSliceSourceDocument(doc);
    var originalWidth = getDocumentPixelWidth(doc);
    var originalHeight = getDocumentPixelHeight(doc);
    var centerSize = Math.max(1, config && config.nineSliceCenterSize ? config.nineSliceCenterSize : 2);
    var borders = getNineSliceBorders(layerName, originalWidth, originalHeight, centerSize, config);
    var horizontalSlice = borders.left > 0 || borders.right > 0;
    var verticalSlice = borders.top > 0 || borders.bottom > 0;

    if (!horizontalSlice && !verticalSlice) {
        return {
            document: doc,
            info: {
                enabled: true,
                applied: false,
                reason: "no_slice_borders",
                borders: borders,
                originalWidth: originalWidth,
                originalHeight: originalHeight,
                width: originalWidth,
                height: originalHeight
            }
        };
    }

    var centerSourceWidth = originalWidth - borders.left - borders.right;
    var centerSourceHeight = originalHeight - borders.top - borders.bottom;
    if (centerSourceWidth <= 0 || centerSourceHeight <= 0) {
        return {
            document: doc,
            info: {
                enabled: true,
                applied: false,
                reason: "not_enough_center_area",
                borders: borders,
                originalWidth: originalWidth,
                originalHeight: originalHeight,
                width: originalWidth,
                height: originalHeight
            }
        };
    }

    var centerWidth = horizontalSlice ? Math.min(centerSize, centerSourceWidth) : centerSourceWidth;
    var centerHeight = verticalSlice ? Math.min(centerSize, centerSourceHeight) : centerSourceHeight;
    var compactWidth = horizontalSlice ? borders.left + centerWidth + borders.right : originalWidth;
    var compactHeight = verticalSlice ? borders.top + centerHeight + borders.bottom : originalHeight;
    if (compactWidth <= 0 || compactHeight <= 0) {
        return {
            document: doc,
            info: {
                enabled: true,
                applied: false,
                reason: "invalid_compact_size",
                borders: borders,
                originalWidth: originalWidth,
                originalHeight: originalHeight,
                width: originalWidth,
                height: originalHeight
            }
        };
    }

    if (compactWidth >= originalWidth && compactHeight >= originalHeight) {
        return {
            document: doc,
            info: {
                enabled: true,
                applied: false,
                reason: "already_compact",
                borders: borders,
                originalWidth: originalWidth,
                originalHeight: originalHeight,
                width: originalWidth,
                height: originalHeight
            }
        };
    }

    var sourceMidX = horizontalSlice ? borders.left + Math.floor((centerSourceWidth - centerWidth) / 2) : 0;
    var sourceMidY = verticalSlice ? borders.top + Math.floor((centerSourceHeight - centerHeight) / 2) : 0;
    var compactDoc = app.documents.add(
        UnitValue(compactWidth, "px"),
        UnitValue(compactHeight, "px"),
        doc.resolution,
        doc.name + "_9s",
        NewDocumentMode.RGB,
        DocumentFill.TRANSPARENT
    );

    var xRegions = horizontalSlice ? [
        { sx: 0, dx: 0, size: borders.left },
        { sx: sourceMidX, dx: borders.left, size: centerWidth },
        { sx: originalWidth - borders.right, dx: borders.left + centerWidth, size: borders.right }
    ] : [
        { sx: 0, dx: 0, size: originalWidth }
    ];
    var yRegions = verticalSlice ? [
        { sy: 0, dy: 0, size: borders.top },
        { sy: sourceMidY, dy: borders.top, size: centerHeight },
        { sy: originalHeight - borders.bottom, dy: borders.top + centerHeight, size: borders.bottom }
    ] : [
        { sy: 0, dy: 0, size: originalHeight }
    ];

    var pastedCount = 0;
    for (var y = 0; y < yRegions.length; y++) {
        for (var x = 0; x < xRegions.length; x++) {
            if (pasteCroppedRegion(
                doc,
                compactDoc,
                xRegions[x].sx,
                yRegions[y].sy,
                xRegions[x].size,
                yRegions[y].size,
                xRegions[x].dx,
                yRegions[y].dy
            )) {
                pastedCount++;
            }
        }
    }

    app.activeDocument = compactDoc;
    if (pastedCount > 0 && compactDoc.layers.length > 1) {
        compactDoc.mergeVisibleLayers();
    }
    app.activeDocument = doc;
    doc.close(SaveOptions.DONOTSAVECHANGES);
    app.activeDocument = compactDoc;

    return {
        document: compactDoc,
        info: {
            enabled: true,
                applied: true,
                borders: borders,
                horizontalSlice: horizontalSlice,
                verticalSlice: verticalSlice,
                centerSize: centerSize,
                originalWidth: originalWidth,
            originalHeight: originalHeight,
            width: compactWidth,
            height: compactHeight
        }
    };
}

function getNineSliceBorders(layerName, width, height, centerSize, config) {
    var parsed = parseNineSliceBorderText(layerName);
    var borders;
    if (parsed) {
        borders = parsed;
    } else if (configHasManualNineSliceBorders(config)) {
        borders = config.nineSliceBorders;
    } else {
        borders = {
            left: clampNumber(Math.round(width * 0.25), 4, 32),
            top: clampNumber(Math.round(height * 0.25), 4, 32),
            right: clampNumber(Math.round(width * 0.25), 4, 32),
            bottom: clampNumber(Math.round(height * 0.25), 4, 32)
        };
    }

    return normalizeNineSliceBorders(borders, width, height, centerSize);
}

function configHasManualNineSliceBorders(config) {
    return !!(
        config &&
        config.forceNineSlice &&
        config.nineSliceBorders &&
        typeof config.nineSliceBorders.left !== "undefined" &&
        typeof config.nineSliceBorders.right !== "undefined" &&
        typeof config.nineSliceBorders.top !== "undefined" &&
        typeof config.nineSliceBorders.bottom !== "undefined"
    );
}

function parseNineSliceBorderText(layerName) {
    var match = String(layerName || "").match(/@9s\s*\(([^)]*)\)/i);
    if (!match) {
        return null;
    }

    var rawParts = match[1].split(",");
    var values = [];
    for (var i = 0; i < rawParts.length; i++) {
        var value = parseInt(rawParts[i], 10);
        if (!isNaN(value)) {
            values.push(Math.max(0, value));
        }
    }

    if (values.length === 1) {
        return { left: values[0], top: values[0], right: values[0], bottom: values[0] };
    }
    if (values.length === 2) {
        return { left: values[0], top: values[1], right: values[0], bottom: values[1] };
    }
    if (values.length >= 4) {
        return { left: values[0], top: values[1], right: values[2], bottom: values[3] };
    }

    return null;
}

function normalizeNineSliceBorders(borders, width, height, centerSize) {
    var normalized = {
        left: clampNumber(Math.max(0, Math.round(borders.left)), 0, Math.max(0, width)),
        top: clampNumber(Math.max(0, Math.round(borders.top)), 0, Math.max(0, height)),
        right: clampNumber(Math.max(0, Math.round(borders.right)), 0, Math.max(0, width)),
        bottom: clampNumber(Math.max(0, Math.round(borders.bottom)), 0, Math.max(0, height))
    };

    if (normalized.left + normalized.right >= width) {
        var horizontalAvailable = Math.max(0, width - centerSize);
        normalized.left = Math.floor(horizontalAvailable / 2);
        normalized.right = horizontalAvailable - normalized.left;
    }

    if (normalized.top + normalized.bottom >= height) {
        var verticalAvailable = Math.max(0, height - centerSize);
        normalized.top = Math.floor(verticalAvailable / 2);
        normalized.bottom = verticalAvailable - normalized.top;
    }

    return normalized;
}

function pasteCroppedRegion(sourceDoc, targetDoc, sx, sy, width, height, dx, dy) {
    if (width <= 0 || height <= 0) {
        return false;
    }

    var tileDoc = null;
    try {
        app.activeDocument = sourceDoc;
        tileDoc = sourceDoc.duplicate("nine_slice_tile", true);
        app.activeDocument = tileDoc;
        tileDoc.crop([
            UnitValue(sx, "px"),
            UnitValue(sy, "px"),
            UnitValue(sx + width, "px"),
            UnitValue(sy + height, "px")
        ]);

        var tileBounds = getPixelBounds(tileDoc.activeLayer);
        if (!tileBounds || tileBounds.width <= 0 || tileBounds.height <= 0) {
            tileDoc.close(SaveOptions.DONOTSAVECHANGES);
            return false;
        }

        var pastedLayer = tileDoc.activeLayer.duplicate(targetDoc, ElementPlacement.PLACEATBEGINNING);
        app.activeDocument = targetDoc;
        pastedLayer.translate(UnitValue(dx, "px"), UnitValue(dy, "px"));
        tileDoc.close(SaveOptions.DONOTSAVECHANGES);
        return true;
    } catch (regionError) {
        try {
            if (tileDoc) {
                tileDoc.close(SaveOptions.DONOTSAVECHANGES);
            }
        } catch (closeError) {}
        return false;
    }
}

function clampNumber(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function getDocumentPixelWidth(doc) {
    return Math.round(doc.width.as("px"));
}

function getDocumentPixelHeight(doc) {
    return Math.round(doc.height.as("px"));
}

function removeDefaultBackgroundIfAny(doc) {
    if (doc.layers.length <= 1) {
        return;
    }

    for (var i = doc.layers.length - 1; i >= 0; i--) {
        var layer = doc.layers[i];
        if (layer.name === "Background" || layer.name === "背景") {
            try {
                layer.remove();
            } catch (e) {
                // Ignore locked background layers created by older Photoshop versions.
            }
        }
    }
}

function writeManifest(folder, manifest) {
    var manifestFile = new File(folder.fsName + "/export_manifest.json");
    manifestFile.encoding = "UTF-8";
    manifestFile.open("w");
    manifestFile.write(stringifyJson(manifest, 0));
    manifestFile.close();
}

function computeFileSha256(file) {
    try {
        if (!file || !file.exists) {
            return "";
        }
        file.encoding = "BINARY";
        file.open("r");
        var data = file.read();
        file.close();
        return sha256BinaryString(data);
    } catch (e) {
        try {
            file.close();
        } catch (closeError) {}
        return "";
    }
}

function sha256BinaryString(data) {
    var bytes = [];
    for (var i = 0; i < data.length; i++) {
        bytes.push(data.charCodeAt(i) & 0xff);
    }

    var bitLenHi = Math.floor(bytes.length / 0x20000000);
    var bitLenLo = (bytes.length << 3) >>> 0;
    bytes.push(0x80);
    while ((bytes.length % 64) !== 56) {
        bytes.push(0);
    }
    bytes.push((bitLenHi >>> 24) & 0xff, (bitLenHi >>> 16) & 0xff, (bitLenHi >>> 8) & 0xff, bitLenHi & 0xff);
    bytes.push((bitLenLo >>> 24) & 0xff, (bitLenLo >>> 16) & 0xff, (bitLenLo >>> 8) & 0xff, bitLenLo & 0xff);

    var h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
    var h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
    var k = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];
    var w = new Array(64);

    for (var offset = 0; offset < bytes.length; offset += 64) {
        for (var j = 0; j < 16; j++) {
            var p = offset + j * 4;
            w[j] = ((bytes[p] << 24) | (bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3]) >>> 0;
        }
        for (j = 16; j < 64; j++) {
            var s0 = (rotr(w[j - 15], 7) ^ rotr(w[j - 15], 18) ^ (w[j - 15] >>> 3)) >>> 0;
            var s1 = (rotr(w[j - 2], 17) ^ rotr(w[j - 2], 19) ^ (w[j - 2] >>> 10)) >>> 0;
            w[j] = add32(add32(add32(w[j - 16], s0), w[j - 7]), s1);
        }

        var a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
        for (j = 0; j < 64; j++) {
            var ch = ((e & f) ^ ((~e) & g)) >>> 0;
            var maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
            var sigma0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
            var sigma1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
            var temp1 = add32(add32(add32(add32(h, sigma1), ch), k[j]), w[j]);
            var temp2 = add32(sigma0, maj);
            h = g;
            g = f;
            f = e;
            e = add32(d, temp1);
            d = c;
            c = b;
            b = a;
            a = add32(temp1, temp2);
        }

        h0 = add32(h0, a); h1 = add32(h1, b); h2 = add32(h2, c); h3 = add32(h3, d);
        h4 = add32(h4, e); h5 = add32(h5, f); h6 = add32(h6, g); h7 = add32(h7, h);
    }

    return hex32(h0) + hex32(h1) + hex32(h2) + hex32(h3) + hex32(h4) + hex32(h5) + hex32(h6) + hex32(h7);
}

function rotr(value, bits) {
    return ((value >>> bits) | (value << (32 - bits))) >>> 0;
}

function add32(a, b) {
    return (a + b) >>> 0;
}

function hex32(value) {
    var text = (value >>> 0).toString(16);
    while (text.length < 8) {
        text = "0" + text;
    }
    return text;
}

function loadToolSettings() {
    var settings = {
        outputFolder: ""
    };
    var settingsFile = getToolSettingsFile();
    if (!settingsFile || !settingsFile.exists) {
        return settings;
    }

    try {
        settingsFile.encoding = "UTF-8";
        settingsFile.open("r");
        var text = settingsFile.read();
        settingsFile.close();
        settings.outputFolder = readJsonStringSetting(text, "outputFolder", "");
        settings.prefix = readJsonStringSetting(text, "prefix", "");
        settings.uniformWidth = readJsonStringSetting(text, "uniformWidth", "");
        settings.uniformHeight = readJsonStringSetting(text, "uniformHeight", "");
        settings.nineLeft = readJsonStringSetting(text, "nineLeft", "");
        settings.nineRight = readJsonStringSetting(text, "nineRight", "");
        settings.nineTop = readJsonStringSetting(text, "nineTop", "");
        settings.nineBottom = readJsonStringSetting(text, "nineBottom", "");
        settings.autoRename = readJsonBooleanSetting(text, "autoRename", undefined);
        settings.groupFolders = readJsonBooleanSetting(text, "groupFolders", undefined);
        settings.forceEvenSize = readJsonBooleanSetting(text, "forceEvenSize", undefined);
        settings.forceCanvasSize = readJsonBooleanSetting(text, "forceCanvasSize", undefined);
        settings.forceUniformSize = readJsonBooleanSetting(text, "forceUniformSize", undefined);
        settings.forceNineSlice = readJsonBooleanSetting(text, "forceNineSlice", undefined);
    } catch (e) {
        try {
            settingsFile.close();
        } catch (closeError) {}
    }

    return settings;
}

function readJsonStringSetting(text, key, fallback) {
    var pattern = new RegExp("\"" + key + "\"\\s*:\\s*\"((?:\\\\.|[^\"\\\\])*)\"");
    var match = String(text || "").match(pattern);
    return match ? unescapeJsonString(match[1]) : fallback;
}

function readJsonBooleanSetting(text, key, fallback) {
    var pattern = new RegExp("\"" + key + "\"\\s*:\\s*(true|false)");
    var match = String(text || "").match(pattern);
    return match ? match[1] === "true" : fallback;
}

function saveToolSettings(settings) {
    var settingsFile = getToolSettingsFile();
    if (!settingsFile) {
        return;
    }

    try {
        settingsFile.encoding = "UTF-8";
        settingsFile.open("w");
        settingsFile.write(stringifyJson(settings, 0));
        settingsFile.close();
    } catch (e) {
        try {
            settingsFile.close();
        } catch (closeError) {}
    }
}

function getToolSettingsFile() {
    try {
        var scriptFile = new File($.fileName);
        return new File(scriptFile.parent.fsName + "/psd-auto-slicer-settings.json");
    } catch (e) {
        return new File(Folder.userData.fsName + "/psd-auto-slicer-settings.json");
    }
}

function stringifyJson(value, indent) {
    var pad = repeatString("  ", indent);
    var nextPad = repeatString("  ", indent + 1);

    if (value === null) {
        return "null";
    }

    var type = typeof value;
    if (type === "string") {
        return "\"" + escapeJson(value) + "\"";
    }
    if (type === "number" || type === "boolean") {
        return String(value);
    }

    if (value instanceof Array) {
        if (!value.length) {
            return "[]";
        }
        var arrayParts = [];
        for (var i = 0; i < value.length; i++) {
            arrayParts.push(nextPad + stringifyJson(value[i], indent + 1));
        }
        return "[\n" + arrayParts.join(",\n") + "\n" + pad + "]";
    }

    var objectParts = [];
    for (var key in value) {
        if (value.hasOwnProperty(key)) {
            objectParts.push(nextPad + "\"" + escapeJson(key) + "\": " + stringifyJson(value[key], indent + 1));
        }
    }
    if (!objectParts.length) {
        return "{}";
    }
    return "{\n" + objectParts.join(",\n") + "\n" + pad + "}";
}

function escapeJson(text) {
    return String(text)
        .replace(/\\/g, "\\\\")
        .replace(/"/g, "\\\"")
        .replace(/\r/g, "\\r")
        .replace(/\n/g, "\\n")
        .replace(/\t/g, "\\t");
}

function unescapeJsonString(text) {
    return String(text || "")
        .replace(/\\"/g, "\"")
        .replace(/\\\\/g, "\\")
        .replace(/\\r/g, "\r")
        .replace(/\\n/g, "\n")
        .replace(/\\t/g, "\t");
}

function repeatString(text, count) {
    var result = "";
    for (var i = 0; i < count; i++) {
        result += text;
    }
    return result;
}

function makeWarning(type, layerPath, message) {
    return {
        type: type,
        layerPath: layerPath,
        message: message
    };
}

function getDocumentName(doc) {
    try {
        return doc.name;
    } catch (e) {
        return "";
    }
}

function getDocumentPath(doc) {
    try {
        return doc.fullName.fsName;
    } catch (e) {
        return "";
    }
}
