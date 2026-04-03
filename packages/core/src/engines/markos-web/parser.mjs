import {parseDocument} from "yaml";

const DEFAULT_ASPECT_RATIO = {
    numeric: 16 / 9,
    text: "16/9",
};
const DEFAULT_CANVAS_WIDTH = 1280;

function normalizeText(value) {
    return value.replace(/\r\n?/g, "\n");
}

function parseYamlBlock(raw) {
    if (!raw.trim()) {
        return {};
    }

    try {
        const parsed = parseDocument(raw).toJS({});
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        return {};
    }
}

function looksLikeFrontmatter(lines) {
    const block = lines.join("\n").trim();
    if (!block) {
        return false;
    }
    if (!block.includes(":")) {
        return false;
    }
    const parsed = parseYamlBlock(block);
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

function parseSlides(lines) {
    const slides = [];
    let currentFrontmatter = {};
    let contentBuffer = [];
    let cursor = 0;
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
                currentFrontmatter = parseYamlBlock(lines.slice(frontmatterStart, cursor).join("\n"));
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
    return {
        slides: parseSlides(lines),
    };
}

export function getSlideTitle(slide, fallbackTitle = "Untitled Slide") {
    return extractSlideTitle(slide) || fallbackTitle;
}

export function getDeckViewport(deck) {
    return {
        aspectRatio: DEFAULT_ASPECT_RATIO.numeric,
        aspectRatioText: DEFAULT_ASPECT_RATIO.text,
        canvasWidth: DEFAULT_CANVAS_WIDTH,
        canvasHeight: Math.round(DEFAULT_CANVAS_WIDTH / DEFAULT_ASPECT_RATIO.numeric),
    };
}

export function getDeckTitle(deck, fallbackTitle = "Untitled Slides") {
    return getSlideTitle(deck.slides[0], fallbackTitle);
}
