(function () {
    "use strict";

    const SOURCE = "./故事集/短篇.md";
    const state = { stories: [], currentIndex: -1 };
    const storyElement = document.getElementById("story");
    const navElement = document.getElementById("story-nav");
    const pagerElement = document.getElementById("story-pager");
    const positionElement = document.getElementById("topbar-position");
    const progressBar = document.getElementById("reading-progress-bar");
    const menuButton = document.getElementById("menu-button");
    const menuScrim = document.getElementById("sidebar-scrim");

    function escapeHtml(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
    }

    function slugify(text, used) {
        const base = text
            .replace(/[*_`]/g, "")
            .replace(/[\s\u3000]+/g, "-")
            .replace(/[^\w\u3400-\u9fff-]/g, "")
            .replace(/^-+|-+$/g, "") || "story";
        let slug = base;
        let suffix = 2;
        while (used && used.has(slug)) slug = base + "-" + suffix++;
        if (used) used.add(slug);
        return slug;
    }

    function parseCollection(markdown) {
        const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
        const stories = [];
        const used = new Set();
        let category = "未分类";
        let current = null;

        function finishStory() {
            if (!current) return;
            current.markdown = current.lines.join("\n").trim().replace(/\n---\s*$/, "").trim();
            delete current.lines;
            stories.push(current);
            current = null;
        }

        for (const line of lines) {
            const groupHeading = line.match(/^##\s+(.+?)\s*$/);
            const storyHeading = line.match(/^###\s+(.+?)\s*$/);

            if (groupHeading) {
                finishStory();
                if (groupHeading[1] !== "目录") category = groupHeading[1];
                continue;
            }

            if (storyHeading) {
                finishStory();
                current = {
                    title: storyHeading[1],
                    category: category,
                    slug: slugify(storyHeading[1], used),
                    lines: []
                };
                continue;
            }

            if (current) current.lines.push(line);
        }

        finishStory();
        return stories;
    }

    function renderInline(source) {
        const tokens = [];
        let text = String(source);

        text = text.replace(/`([^`]+)`/g, function (_, code) {
            const index = tokens.push("<code>" + escapeHtml(code) + "</code>") - 1;
            return "\u0000" + index + "\u0000";
        });

        text = text.replace(/\[([^\]]+)]\(([^)]+)\)/g, function (_, label, rawHref) {
            const href = rawHref.trim();
            let link = escapeHtml(label);
            if (/^https?:\/\//i.test(href)) {
                link = '<a href="' + escapeHtml(href) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(label) + "</a>";
            } else if (href.startsWith("#")) {
                link = '<a href="' + escapeHtml(href) + '">' + escapeHtml(label) + "</a>";
            }
            const index = tokens.push(link) - 1;
            return "\u0000" + index + "\u0000";
        });

        text = escapeHtml(text)
            .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
            .replace(/__([^_]+)__/g, "<strong>$1</strong>")
            .replace(/\*([^*]+)\*/g, "<em>$1</em>");

        return text.replace(/\u0000(\d+)\u0000/g, function (_, index) {
            return tokens[Number(index)] || "";
        });
    }

    function renderMarkdown(markdown) {
        const lines = String(markdown).replace(/\r\n?/g, "\n").split("\n");
        const html = [];
        let paragraph = [];
        let listType = "";
        let quote = [];

        function flushParagraph() {
            if (!paragraph.length) return;
            html.push("<p>" + renderInline(paragraph.join("\n")) + "</p>");
            paragraph = [];
        }

        function flushList() {
            if (!listType) return;
            html.push("</" + listType + ">");
            listType = "";
        }

        function flushQuote() {
            if (!quote.length) return;
            html.push("<blockquote><p>" + renderInline(quote.join("\n")) + "</p></blockquote>");
            quote = [];
        }

        function flushAll() {
            flushParagraph();
            flushList();
            flushQuote();
        }

        for (const line of lines) {
            const heading = line.match(/^(#{4,6})\s+(.+?)\s*#*$/);
            const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
            const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
            const quoted = line.match(/^>\s?(.*)$/);

            if (heading) {
                flushAll();
                const level = Math.min(6, heading[1].length);
                const id = slugify(heading[2]);
                html.push("<h" + level + ' id="' + escapeHtml(id) + '">' + renderInline(heading[2]) + "</h" + level + ">");
                continue;
            }

            if (quoted) {
                flushParagraph();
                flushList();
                quote.push(quoted[1]);
                continue;
            }
            flushQuote();

            if (unordered || ordered) {
                flushParagraph();
                const nextType = unordered ? "ul" : "ol";
                if (listType !== nextType) {
                    flushList();
                    listType = nextType;
                    html.push("<" + listType + ">");
                }
                html.push("<li>" + renderInline((unordered || ordered)[1]) + "</li>");
                continue;
            }
            flushList();

            if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
                flushParagraph();
                html.push("<hr>");
            } else if (!line.trim()) {
                flushParagraph();
            } else {
                paragraph.push(line);
            }
        }

        flushAll();
        return html.join("\n");
    }

    function groupStories() {
        const groups = [];
        for (const story of state.stories) {
            let group = groups.find(function (item) { return item.name === story.category; });
            if (!group) {
                group = { name: story.category, stories: [] };
                groups.push(group);
            }
            group.stories.push(story);
        }
        return groups;
    }

    function renderNavigation() {
        let number = 0;
        navElement.innerHTML = groupStories().map(function (group) {
            return '<section class="nav-group"><h2>' + escapeHtml(group.name) + "</h2>" + group.stories.map(function (story) {
                number += 1;
                return '<a href="#' + encodeURIComponent(story.slug) + '" data-story="' + escapeHtml(story.slug) + '"><span>' + String(number).padStart(2, "0") + "</span>" + escapeHtml(story.title) + "</a>";
            }).join("") + "</section>";
        }).join("");
    }

    function estimateReadingTime(markdown) {
        const plain = markdown.replace(/[#>*_`\[\]()-]/g, "").replace(/\s/g, "");
        return Math.max(1, Math.ceil(plain.length / 450));
    }

    function renderPager(index) {
        const previous = state.stories[index - 1];
        const next = state.stories[index + 1];
        pagerElement.innerHTML = (previous ? '<a class="pager-link previous" href="#' + encodeURIComponent(previous.slug) + '" data-story="' + escapeHtml(previous.slug) + '"><small>← 上一篇</small><strong>' + escapeHtml(previous.title) + "</strong></a>" : "<span></span>") +
            (next ? '<a class="pager-link next" href="#' + encodeURIComponent(next.slug) + '" data-story="' + escapeHtml(next.slug) + '"><small>下一篇 →</small><strong>' + escapeHtml(next.title) + "</strong></a>" : "");
    }

    function closeMenu() {
        document.body.classList.remove("menu-open");
        menuButton.setAttribute("aria-expanded", "false");
        menuButton.setAttribute("aria-label", "打开篇目目录");
    }

    function showStory(index, options) {
        const settings = Object.assign({ updateHash: true, scroll: true }, options);
        const story = state.stories[index];
        if (!story) return;

        state.currentIndex = index;
        storyElement.innerHTML = '<p class="story-kicker">' + escapeHtml(story.category) + '</p><h1 class="story-title">' + escapeHtml(story.title) + '</h1><div class="story-byline"><span>第 ' + String(index + 1).padStart(2, "0") + ' 篇</span><span>约 ' + estimateReadingTime(story.markdown) + ' 分钟</span></div><div class="story-body">' + renderMarkdown(story.markdown) + "</div>";
        storyElement.setAttribute("aria-busy", "false");
        positionElement.textContent = String(index + 1).padStart(2, "0") + " / " + String(state.stories.length).padStart(2, "0") + " · " + story.title;
        document.title = story.title + " · 短篇集";
        renderPager(index);

        document.querySelectorAll("[data-story]").forEach(function (link) {
            link.classList.toggle("active", link.dataset.story === story.slug);
            if (link.classList.contains("active")) link.setAttribute("aria-current", "page");
            else link.removeAttribute("aria-current");
        });

        if (settings.updateHash) history.pushState({ story: story.slug }, "", "#" + encodeURIComponent(story.slug));
        if (settings.scroll) window.scrollTo({ top: 0, behavior: "auto" });
        progressBar.style.width = "0";
        closeMenu();
    }

    function findStoryFromHash() {
        let slug = "";
        try { slug = decodeURIComponent(window.location.hash.slice(1)); } catch (error) { slug = ""; }
        return state.stories.findIndex(function (story) { return story.slug === slug; });
    }

    async function initialize() {
        try {
            const response = await fetch(SOURCE, { cache: "no-cache" });
            if (!response.ok) throw new Error("HTTP " + response.status);
            state.stories = parseCollection(await response.text());
            if (!state.stories.length) throw new Error("No stories found");
            renderNavigation();
            const requestedIndex = findStoryFromHash();
            showStory(requestedIndex >= 0 ? requestedIndex : 0, { updateHash: false, scroll: false });
        } catch (error) {
            storyElement.setAttribute("aria-busy", "false");
            storyElement.innerHTML = '<div class="story-error"><h1>故事没有翻开</h1><p>暂时无法读取《短篇.md》，请检查文件后重试。</p><button class="retry-button" id="retry-button" type="button">重新读取</button></div>';
            navElement.innerHTML = "";
            positionElement.textContent = "读取失败";
            document.getElementById("retry-button").addEventListener("click", initialize);
        }
    }

    document.addEventListener("click", function (event) {
        const link = event.target.closest("[data-story]");
        if (!link) return;
        event.preventDefault();
        const index = state.stories.findIndex(function (story) { return story.slug === link.dataset.story; });
        showStory(index);
    });

    menuButton.addEventListener("click", function () {
        const open = document.body.classList.toggle("menu-open");
        menuButton.setAttribute("aria-expanded", String(open));
        menuButton.setAttribute("aria-label", open ? "关闭篇目目录" : "打开篇目目录");
    });
    menuScrim.addEventListener("click", closeMenu);

    window.addEventListener("popstate", function () {
        const index = findStoryFromHash();
        if (index >= 0 && index !== state.currentIndex) showStory(index, { updateHash: false });
    });

    window.addEventListener("scroll", function () {
        const start = storyElement.offsetTop;
        const length = Math.max(1, storyElement.offsetHeight - window.innerHeight * .55);
        const progress = Math.min(100, Math.max(0, (window.scrollY - start + window.innerHeight * .15) / length * 100));
        progressBar.style.width = progress + "%";
    }, { passive: true });

    initialize();
}());
