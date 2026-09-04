(function () {
    "use strict";

    const DOC_ROOT = "./设定集/约定的魔法/";
    const DEFAULT_DOC = "00-教材说明/本书的定位.md";
    const state = { groups: [], pages: [], current: "", headings: [] };

    const article = document.getElementById("article");
    const chapterNav = document.getElementById("chapter-nav");
    const breadcrumb = document.getElementById("document-path");
    const toc = document.getElementById("toc");
    const pageNavigation = document.getElementById("page-navigation");
    const menuButton = document.getElementById("menu-button");
    const menuScrim = document.getElementById("sidebar-scrim");
    const progressBar = document.getElementById("reading-progress-bar");

    function escapeHtml(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
    }

    function cleanPath(path) {
        let decoded;
        try {
            decoded = decodeURIComponent(String(path || "").replaceAll("\\", "/"));
        } catch (error) {
            return "";
        }
        const parts = [];
        for (const part of decoded.split("/")) {
            if (!part || part === ".") continue;
            if (part === "..") parts.pop();
            else parts.push(part);
        }
        const result = parts.join("/");
        return result.toLowerCase().endsWith(".md") ? result : "";
    }

    function resolveDocPath(currentPath, relativePath) {
        const cleanHref = relativePath.split("#")[0].split("?")[0];
        if (!cleanHref) return currentPath;
        const base = currentPath.includes("/") ? currentPath.slice(0, currentPath.lastIndexOf("/") + 1) : "";
        return cleanPath(base + cleanHref);
    }

    function encodedDocUrl(path) {
        return DOC_ROOT + path.split("/").map(encodeURIComponent).join("/");
    }

    function pageUrl(path, fragment) {
        const url = new URL(window.location.href);
        url.search = "";
        url.hash = fragment || "";
        if (path && path !== DEFAULT_DOC) url.searchParams.set("doc", path);
        return url.pathname + url.search + url.hash;
    }

    function slugify(text, used) {
        const base = text
            .replace(/<[^>]*>/g, "")
            .replace(/[\s\u3000]+/g, "-")
            .replace(/[^\w\u3400-\u9fff-]/g, "")
            .replace(/^-+|-+$/g, "") || "section";
        let slug = base;
        let count = 2;
        while (used.has(slug)) slug = base + "-" + count++;
        used.add(slug);
        return slug;
    }

    function renderInline(source, currentPath) {
        const tokens = [];
        let text = String(source);

        text = text.replace(/`([^`]+)`/g, function (_, code) {
            const index = tokens.push("<code>" + escapeHtml(code) + "</code>") - 1;
            return "\u0000" + index + "\u0000";
        });

        text = text.replace(/\[([^\]]+)]\(([^)]+)\)/g, function (_, label, rawHref) {
            const href = rawHref.trim();
            let link;
            if (/^https?:\/\//i.test(href)) {
                link = '<a href="' + escapeHtml(href) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(label) + "</a>";
            } else if (href.startsWith("#")) {
                link = '<a href="' + escapeHtml(href) + '">' + escapeHtml(label) + "</a>";
            } else {
                const fragment = href.includes("#") ? "#" + href.split("#").slice(1).join("#") : "";
                const target = resolveDocPath(currentPath, href);
                if (target) {
                    link = '<a href="' + escapeHtml(pageUrl(target, fragment)) + '" data-doc="' + escapeHtml(target) + '" data-fragment="' + escapeHtml(fragment) + '">' + escapeHtml(label) + "</a>";
                } else {
                    link = escapeHtml(label);
                }
            }
            const index = tokens.push(link) - 1;
            return "\u0000" + index + "\u0000";
        });

        text = escapeHtml(text)
            .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
            .replace(/__([^_]+)__/g, "<strong>$1</strong>")
            .replace(/\*([^*]+)\*/g, "<em>$1</em>")
            .replace(/  \n/g, "<br>\n");

        return text.replace(/\u0000(\d+)\u0000/g, function (_, index) {
            return tokens[Number(index)] || "";
        });
    }

    function renderMarkdown(markdown, currentPath) {
        const lines = String(markdown).replace(/\r\n?/g, "\n").split("\n");
        const html = [];
        const headings = [];
        const usedSlugs = new Set();
        let paragraph = [];
        let listType = "";
        let quote = [];
        let inCode = false;
        let codeLanguage = "";
        let codeLines = [];

        function flushParagraph() {
            if (!paragraph.length) return;
            html.push("<p>" + renderInline(paragraph.join("\n"), currentPath) + "</p>");
            paragraph = [];
        }

        function flushList() {
            if (!listType) return;
            html.push("</" + listType + ">");
            listType = "";
        }

        function flushQuote() {
            if (!quote.length) return;
            html.push("<blockquote><p>" + renderInline(quote.join("\n"), currentPath) + "</p></blockquote>");
            quote = [];
        }

        function flushAll() {
            flushParagraph();
            flushList();
            flushQuote();
        }

        for (const line of lines) {
            const fence = line.match(/^```\s*([\w-]*)\s*$/);
            if (fence) {
                if (inCode) {
                    const languageClass = codeLanguage ? ' class="language-' + escapeHtml(codeLanguage) + '"' : "";
                    html.push("<pre><code" + languageClass + ">" + escapeHtml(codeLines.join("\n")) + "</code></pre>");
                    codeLines = [];
                    codeLanguage = "";
                    inCode = false;
                } else {
                    flushAll();
                    codeLanguage = fence[1] || "";
                    inCode = true;
                }
                continue;
            }

            if (inCode) {
                codeLines.push(line);
                continue;
            }

            const heading = line.match(/^(#{1,4})\s+(.+?)\s*#*$/);
            const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
            const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
            const quoted = line.match(/^>\s?(.*)$/);

            if (heading) {
                flushAll();
                const level = heading[1].length;
                const label = heading[2];
                const slug = slugify(label, usedSlugs);
                headings.push({ level: level, label: label.replace(/[*_`]/g, ""), id: slug });
                html.push("<h" + level + ' id="' + escapeHtml(slug) + '"><a class="heading-anchor" href="#' + escapeHtml(slug) + '">' + renderInline(label, currentPath) + "</a></h" + level + ">");
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
                html.push("<li>" + renderInline((unordered || ordered)[1], currentPath) + "</li>");
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

        if (inCode) html.push("<pre><code>" + escapeHtml(codeLines.join("\n")) + "</code></pre>");
        flushAll();
        return { html: html.join("\n"), headings: headings };
    }

    function parseNavigation(markdown) {
        const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
        const groups = [];
        let current = null;
        let inReadingOrder = false;
        let inSources = false;

        for (const line of lines) {
            if (/^##\s+阅读顺序/.test(line)) {
                inReadingOrder = true;
                inSources = false;
                continue;
            }
            if (/^##\s+原始资料/.test(line)) {
                inReadingOrder = false;
                inSources = true;
                current = { title: "原始资料", items: [] };
                groups.push(current);
                continue;
            }
            if (/^##\s+/.test(line)) {
                inReadingOrder = false;
                inSources = false;
                current = null;
                continue;
            }
            const heading = line.match(/^###\s+(.+)$/);
            if (inReadingOrder && heading) {
                current = { title: heading[1].trim(), items: [] };
                groups.push(current);
                continue;
            }
            const link = line.match(/\[([^\]]+)]\(([^)]+\.md(?:#[^)]+)?)\)/i);
            if ((inReadingOrder || inSources) && current && link) {
                const path = cleanPath(link[2].split("#")[0]);
                if (path) current.items.push({ title: link[1], path: path });
            }
        }

        return groups.filter(function (group) { return group.items.length; });
    }

    async function fetchDocument(path) {
        const response = await fetch(encodedDocUrl(path), { cache: "no-cache" });
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.text();
    }

    function renderNavigation() {
        chapterNav.innerHTML = state.groups.map(function (group) {
            return '<section class="chapter-group"><h2>' + escapeHtml(group.title) + "</h2>" + group.items.map(function (item) {
                return '<a href="' + escapeHtml(pageUrl(item.path)) + '" data-doc="' + escapeHtml(item.path) + '">' + escapeHtml(item.title) + "</a>";
            }).join("") + "</section>";
        }).join("");
        updateActiveNavigation();
    }

    function updateActiveNavigation() {
        document.querySelectorAll("[data-doc]").forEach(function (element) {
            element.classList.toggle("active", element.dataset.doc === state.current);
        });
    }

    function renderBreadcrumb(path) {
        const currentPage = state.pages.find(function (page) { return page.path === path; });
        const group = state.groups.find(function (item) {
            return item.items.some(function (page) { return page.path === path; });
        });
        const parts = ["约定的魔法"];
        if (group) parts.push(group.title);
        if (currentPage) parts.push(currentPage.title);
        else if (path === "README.md") parts.push("教材总览");
        else parts.push(path.replace(/\.md$/i, "").split("/").pop());
        breadcrumb.innerHTML = parts.map(function (part) { return "<span>" + escapeHtml(part) + "</span>"; }).join("");
    }

    function renderToc(headings) {
        const entries = headings.filter(function (heading) { return heading.level > 1; });
        toc.innerHTML = entries.map(function (heading) {
            return '<a class="level-' + heading.level + '" href="#' + escapeHtml(heading.id) + '">' + escapeHtml(heading.label) + "</a>";
        }).join("");
        document.querySelector(".toc-panel").hidden = entries.length === 0;
    }

    function renderPageNavigation(path) {
        const index = state.pages.findIndex(function (page) { return page.path === path; });
        if (index < 0) {
            pageNavigation.innerHTML = "";
            return;
        }
        const previous = state.pages[index - 1];
        const next = state.pages[index + 1];
        pageNavigation.innerHTML = (previous ? '<a class="page-link previous" href="' + escapeHtml(pageUrl(previous.path)) + '" data-doc="' + escapeHtml(previous.path) + '"><small>← 上一篇</small><strong>' + escapeHtml(previous.title) + "</strong></a>" : "<span></span>") +
            (next ? '<a class="page-link next" href="' + escapeHtml(pageUrl(next.path)) + '" data-doc="' + escapeHtml(next.path) + '"><small>下一篇 →</small><strong>' + escapeHtml(next.title) + "</strong></a>" : "");
    }

    function watchHeadings() {
        if (!("IntersectionObserver" in window)) return;
        const links = Array.from(toc.querySelectorAll("a"));
        const elements = state.headings.map(function (heading) { return document.getElementById(heading.id); }).filter(Boolean);
        const observer = new IntersectionObserver(function (entries) {
            const visible = entries.filter(function (entry) { return entry.isIntersecting; }).sort(function (a, b) { return a.boundingClientRect.top - b.boundingClientRect.top; });
            if (!visible.length) return;
            links.forEach(function (link) { link.classList.toggle("active", link.hash === "#" + visible[0].target.id); });
        }, { rootMargin: "-18% 0px -70% 0px" });
        elements.forEach(function (element) { observer.observe(element); });
    }

    function closeMenu() {
        document.body.classList.remove("menu-open");
        menuButton.setAttribute("aria-expanded", "false");
        menuButton.setAttribute("aria-label", "打开目录");
    }

    async function loadDocument(path, options) {
        const settings = Object.assign({ push: true, scroll: true }, options);
        const safePath = cleanPath(path) || DEFAULT_DOC;
        state.current = safePath;
        article.setAttribute("aria-busy", "true");
        article.innerHTML = '<div class="article-loading"><span class="loading-sigil" aria-hidden="true"></span><p>正在展开时空卷轴…</p></div>';
        pageNavigation.innerHTML = "";
        renderBreadcrumb(safePath);
        updateActiveNavigation();
        closeMenu();

        try {
            const markdown = await fetchDocument(safePath);
            const rendered = renderMarkdown(markdown, safePath);
            state.headings = rendered.headings;
            article.innerHTML = rendered.html;
            article.setAttribute("aria-busy", "false");
            renderToc(rendered.headings);
            renderPageNavigation(safePath);
            watchHeadings();

            const titleHeading = rendered.headings.find(function (heading) { return heading.level === 1; });
            document.title = (titleHeading ? titleHeading.label + " · " : "") + "约定的魔法";
            const destinationFragment = settings.fragment || "";
            if (settings.push) history.pushState({ doc: safePath }, "", pageUrl(safePath, destinationFragment));
            if (settings.scroll) window.scrollTo({ top: 0, behavior: "auto" });

            const requestedHash = destinationFragment || (!settings.push ? window.location.hash : "");
            if (requestedHash) {
                requestAnimationFrame(function () {
                    const target = document.getElementById(decodeURIComponent(requestedHash.slice(1)));
                    if (target) target.scrollIntoView();
                });
            }
        } catch (error) {
            article.setAttribute("aria-busy", "false");
            article.innerHTML = '<div class="article-error"><h1>卷页暂时无法展开</h1><p>没有读取到这篇 Markdown 文件，请检查文件路径后重试。</p><button class="retry-button" id="retry-button" type="button">重新读取</button></div>';
            document.getElementById("retry-button").addEventListener("click", function () { loadDocument(safePath, { push: false }); });
            toc.innerHTML = "";
        }
    }

    async function initialize() {
        try {
            const readme = await fetchDocument("README.md");
            state.groups = parseNavigation(readme);
            state.pages = state.groups.flatMap(function (group) { return group.items; });
            renderNavigation();
        } catch (error) {
            chapterNav.innerHTML = '<p class="source-note">目录读取失败，仍可通过文章内链接继续浏览。</p>';
        }

        const requested = new URL(window.location.href).searchParams.get("doc");
        await loadDocument(cleanPath(requested) || DEFAULT_DOC, { push: false, scroll: false });
    }

    document.addEventListener("click", function (event) {
        const link = event.target.closest("[data-doc]");
        if (!link) return;
        event.preventDefault();
        loadDocument(link.dataset.doc, { fragment: link.dataset.fragment || "" });
    });

    menuButton.addEventListener("click", function () {
        const isOpen = document.body.classList.toggle("menu-open");
        menuButton.setAttribute("aria-expanded", String(isOpen));
        menuButton.setAttribute("aria-label", isOpen ? "关闭目录" : "打开目录");
    });
    menuScrim.addEventListener("click", closeMenu);
    window.addEventListener("popstate", function () {
        const requested = new URL(window.location.href).searchParams.get("doc");
        loadDocument(cleanPath(requested) || DEFAULT_DOC, { push: false });
    });
    window.addEventListener("scroll", function () {
        const maximum = document.documentElement.scrollHeight - window.innerHeight;
        const progress = maximum > 0 ? Math.min(100, Math.max(0, window.scrollY / maximum * 100)) : 0;
        progressBar.style.width = progress + "%";
    }, { passive: true });

    initialize();
}());
