import PptxGenJS from "pptxgenjs";

const PX_PER_INCH = 96;
const PX_PER_POINT = 4 / 3;

function pxToInches(value) {
    return Math.max(0, Number(value) || 0) / PX_PER_INCH;
}

function pxToPoints(value) {
    return Math.max(0, Number(value) || 0) / PX_PER_POINT;
}

function firstDefined(...values) {
    return values.find((value) => value != null);
}

function parseCssColor(value) {
    const normalized = String(value || "").trim();
    if (!normalized || normalized === "transparent") {
        return null;
    }

    const hexMatch = normalized.match(/^#([0-9a-f]{3,8})$/i);
    if (hexMatch) {
        const hexValue = hexMatch[1];
        if (hexValue.length === 3) {
            return {
                color: hexValue.split("").map((char) => `${char}${char}`).join("").toUpperCase(),
                transparency: 0,
            };
        }
        if (hexValue.length === 6) {
            return {
                color: hexValue.toUpperCase(),
                transparency: 0,
            };
        }
        if (hexValue.length === 8) {
            const alpha = Number.parseInt(hexValue.slice(6), 16) / 255;
            return {
                color: hexValue.slice(0, 6).toUpperCase(),
                transparency: Math.round((1 - alpha) * 100),
            };
        }
    }

    const rgbMatch = normalized.match(/^rgba?\(([^)]+)\)$/i);
    if (!rgbMatch) {
        return null;
    }

    const [red = 0, green = 0, blue = 0, alpha = 1] = rgbMatch[1]
        .split(",")
        .map((part) => Number.parseFloat(part.trim()));
    if (![red, green, blue].every(Number.isFinite)) {
        return null;
    }

    const hex = [red, green, blue]
        .map((channel) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase();
    return {
        color: hex,
        transparency: Number.isFinite(alpha) ? Math.round((1 - Math.max(0, Math.min(1, alpha))) * 100) : 0,
    };
}

function normalizeFontWeight(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "bold") {
        return 700;
    }
    const parsed = Number.parseInt(normalized, 10);
    return Number.isFinite(parsed) ? parsed : 400;
}

function normalizeTextAlign(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "center" || normalized === "right" || normalized === "justify") {
        return normalized;
    }
    return "left";
}

function addShapeNode(slide, node, pptx) {
    const fillColor = parseCssColor(node.fillColor);
    const lineColor = parseCssColor(node.lineColor);
    const options = {
        x: pxToInches(node.x),
        y: pxToInches(node.y),
        w: pxToInches(node.w),
        h: pxToInches(node.h),
        line: lineColor && (Number(node.lineWidthPx) || 0) > 0
            ? {
                color: lineColor.color,
                transparency: lineColor.transparency,
                width: pxToPoints(node.lineWidthPx),
            }
            : {
                color: "FFFFFF",
                transparency: 100,
                width: 0,
            },
    };

    if (fillColor) {
        options.fill = {
            color: fillColor.color,
            transparency: fillColor.transparency,
        };
    } else {
        options.fill = {
            color: "FFFFFF",
            transparency: 100,
        };
    }

    if (node.shape === "roundRect") {
        options.rectRadius = Math.max(0.05, Math.min(1, (Number(node.borderRadiusPx) || 0) / Math.max(1, Math.min(Number(node.w) || 1, Number(node.h) || 1))));
    }

    const shapeName = node.shape === "ellipse"
        ? pptx.ShapeType.ellipse
        : node.shape === "roundRect"
            ? pptx.ShapeType.roundRect
            : pptx.ShapeType.rect;

    slide.addShape(shapeName, options);
}

function addTextNode(slide, node) {
    const color = parseCssColor(node.color);
    slide.addText(node.text || "", {
        x: pxToInches(node.x),
        y: pxToInches(node.y),
        w: pxToInches(node.w),
        h: pxToInches(node.h),
        fontFace: firstDefined(node.fontFamily, "Arial"),
        fontSize: Math.max(8, pxToPoints(node.fontSizePx || 16)),
        color: color?.color || "111827",
        transparency: color?.transparency,
        bold: normalizeFontWeight(node.fontWeight) >= 600,
        italic: String(node.fontStyle || "").toLowerCase().includes("italic"),
        align: normalizeTextAlign(node.textAlign),
        margin: 0,
        fit: "shrink",
        breakLine: false,
        valign: "top",
    });
}

function addImageNode(slide, node) {
    slide.addImage({
        path: node.src,
        x: pxToInches(node.x),
        y: pxToInches(node.y),
        w: pxToInches(node.w),
        h: pxToInches(node.h),
    });
}

function sortNodes(nodes = []) {
    const kindWeight = {
        shape: 1,
        image: 2,
        text: 3,
    };
    return [...nodes].sort((left, right) => {
        const layerDelta = (left.layer || kindWeight[left.kind] || 9) - (right.layer || kindWeight[right.kind] || 9);
        if (layerDelta !== 0) {
            return layerDelta;
        }
        return (left.order || 0) - (right.order || 0);
    });
}

export async function writePptxFromExportModel({model, outputFilePath}) {
    if (!model?.deck || !Array.isArray(model?.slides)) {
        throw new Error("A valid export model is required to write PPTX.");
    }

    const pptx = new PptxGenJS();
    const layoutName = "MARKOS_EXPORT";
    pptx.defineLayout({
        name: layoutName,
        width: pxToInches(model.deck.width || 1280),
        height: pxToInches(model.deck.height || 720),
    });
    pptx.layout = layoutName;
    pptx.author = "MarkOS";
    pptx.company = "MarkOS";
    pptx.subject = "MarkOS slide deck";
    pptx.title = model.deck.title || "MarkOS Export";

    for (const slideModel of model.slides) {
        const slide = pptx.addSlide();
        const background = parseCssColor(slideModel.backgroundColor);
        if (background) {
            slide.background = {
                color: background.color,
                transparency: background.transparency,
            };
        }

        for (const node of sortNodes(slideModel.nodes)) {
            if (!node || (Number(node.w) || 0) <= 0 || (Number(node.h) || 0) <= 0) {
                continue;
            }
            if (node.kind === "shape") {
                addShapeNode(slide, node, pptx);
                continue;
            }
            if (node.kind === "image") {
                addImageNode(slide, node);
                continue;
            }
            if (node.kind === "text") {
                addTextNode(slide, node);
            }
        }
    }

    await pptx.writeFile({
        fileName: outputFilePath,
        compression: true,
    });
}
