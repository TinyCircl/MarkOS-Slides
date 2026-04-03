import {FILE_FRONTMATTER_KEYS, normalizeText, parseYamlObject} from "../../core/deck-utils.mjs";

const DEFAULT_ASPECT_RATIO = {
    numeric: 16 / 9,
    text: "16/9",
};
const DEFAULT_CANVAS_WIDTH = 1280;

function parseAspectRatio(value) {
    if (typeof value === "number" && value > 0) {
        return {numeric: value, text: String(value)};
    }

    if (typeof value === "string") {
        const trimmed = value.trim();
        const slashMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
        if (slashMatch) {
            const width = Number.parseFloat(slashMatch[1]);
            const height = Number.parseFloat(slashMatch[2]);
            if (width > 0 && height > 0) {
                return {numeric: width / height, text: `${width}/${height}`};
            }
        }

        const direct = Number.parseFloat(trimmed);
        if (!Number.isNaN(direct) && direct > 0) {
            return {numeric: direct, text: trimmed};
        }
    }

    return DEFAULT_ASPECT_RATIO;
}

function scanTopFrontmatter(lines) {
    if (lines[0] !== "---") {
        return {headmatter: {}, nextIndex: 0};
    }

    let cursor = 1;
    while (cursor < lines.length && lines[cursor] !== "---") {
        cursor += 1;
    }

    if (cursor >= lines.length) {
        return {headmatter: {}, nextIndex: 0};
    }

    const headmatter = parseYamlObject(lines.slice(1, cursor).join("\n"));
    const invalidKeys = Object.keys(headmatter).filter((key) => !FILE_FRONTMATTER_KEYS.has(key));
    if (invalidKeys.length > 0) {
        throw new Error(
            `Invalid file frontmatter key(s): ${invalidKeys.join(", ")}. `
            + "Use the first frontmatter block only for deck-level fields "
            + "(theme, title, aspectRatio, canvasWidth), and put first-slide settings in a second frontmatter block.",
        );
    }

    return {
        headmatter,
        nextIndex: cursor + 1,
    };
}

function looksLikeFrontmatter(lines) {
    const block = lines.join("\n").trim();
    if (!block) {
        return false;
    }
    if (!block.includes(":")) {
        return false;
    }
    const parsed = parseYamlObject(block, {fallback: null});
    return parsed && typeof parsed === "object" && Object.keys(parsed).length > 0;
}

function stripMarkdown(value) {
    return value
        .replace(/`([^`]+)`/g, "$1")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/\*([^*]+)\*/g, "$1")
        .replace(/!\[[^\]]*]\([^)]+\)/g, "")
        .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
        .replace(/^#{1,6}\s+/gm, "")
        .replace(/^\s*[-*+]\s+/gm, "")
        .replace(/^\s*\d+\.\s+/gm, "")
        .trim();
}

function extractSlideTitle(slide) {
    if (typeof slide?.frontmatter?.title === "string" && slide.frontmatter.title.trim()) {
        return slide.frontmatter.title.trim();
    }

    const headingMatch = slide?.content?.match(/^#{1,6}\s+(.+)$/m);
    if (headingMatch) {
        return stripMarkdown(headingMatch[1]).trim();
    }

    const firstMeaningfulLine = String(slide?.content ?? "")
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line.length > 0 && line !== "::right::");

    return firstMeaningfulLine ? stripMarkdown(firstMeaningfulLine).slice(0, 48) : "";
}

function parseSlides(lines, startIndex = 0) {
    const slides = [];
    let currentFrontmatter = {};
    let contentBuffer = [];
    let cursor = startIndex;
    let activeFence = null;

    function flushCurrentSlide() {
        const content = contentBuffer.join("\n").trim();
        if (!content && Object.keys(currentFrontmatter).length === 0) {
            contentBuffer = [];
            return;
        }
        slides.push({
            frontmatter: currentFrontmatter,
            content,
        });
        contentBuffer = [];
    }

    while (cursor < lines.length) {
        const line = lines[cursor];
        const fenceMatch = line.match(/^(\s*)(`{3,}|~{3,})/);

        if (!activeFence && line === "---") {
            flushCurrentSlide();
            cursor += 1;

            const frontmatterStart = cursor;
            while (cursor < lines.length && lines[cursor] !== "---") {
                cursor += 1;
            }

            if (cursor < lines.length && cursor > frontmatterStart && looksLikeFrontmatter(lines.slice(frontmatterStart, cursor))) {
                currentFrontmatter = parseYamlObject(lines.slice(frontmatterStart, cursor).join("\n"));
                cursor += 1;
            } else {
                currentFrontmatter = {};
                cursor = frontmatterStart;
            }
            continue;
        }

        contentBuffer.push(line);
        if (fenceMatch) {
            const marker = fenceMatch[2];
            if (!activeFence) {
                activeFence = {char: marker[0], size: marker.length};
            } else if (marker[0] === activeFence.char && marker.length >= activeFence.size) {
                activeFence = null;
            }
        }
        cursor += 1;
    }

    flushCurrentSlide();
    return slides.filter((slide) => slide.content || Object.keys(slide.frontmatter).length > 0);
}

export function parseDeck(source) {
    const lines = normalizeText(source).split("\n");
    const {headmatter, nextIndex} = scanTopFrontmatter(lines);
    return {
        headmatter,
        slides: parseSlides(lines, nextIndex),
    };
}

export function getSlideTitle(slide, fallbackTitle = "Untitled Slide") {
    return extractSlideTitle(slide) || fallbackTitle;
}

export function getDeckViewport(deck) {
    const ratio = parseAspectRatio(deck.headmatter?.aspectRatio);
    const canvasWidth = typeof deck.headmatter?.canvasWidth === "number" && deck.headmatter.canvasWidth > 0
        ? deck.headmatter.canvasWidth
        : DEFAULT_CANVAS_WIDTH;

    return {
        aspectRatio: ratio.numeric,
        aspectRatioText: ratio.text,
        canvasWidth,
        canvasHeight: Math.round(canvasWidth / ratio.numeric),
    };
}

export function getDeckTitle(deck, fallbackTitle = "Untitled Slides") {
    if (typeof deck.headmatter?.title === "string" && deck.headmatter.title.trim()) {
        return deck.headmatter.title.trim();
    }

    return getSlideTitle(deck.slides[0], fallbackTitle);
}
