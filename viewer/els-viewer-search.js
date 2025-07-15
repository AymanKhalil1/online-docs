// --- Viewer Manual Search Index ---
const VIEWER_INDEX = [
    { title: "Viewer Home", url: "viewerhome.html" },
    { title: "Viewer Workspace", url: "workspace.html" },
    { title: "Basic Features", url: "basicfeatures.html" },
    { title: "Viewer's Specialties", url: "viewerspecialities.html" },
    // Add more viewer manual pages as needed
];

// Fetch and extract a snippet from a viewer HTML file, and return both the text and the snippet
async function fetchViewerContentAndSnippet(url, query, windowSize = 20) {
    try {
        const resp = await fetch(url);
        if (!resp.ok) return { text: "", snippet: "(Could not load preview)" };
        const html = await resp.text();
        // Remove scripts/styles, get text content
        const div = document.createElement("div");
        div.innerHTML = html;
        div.querySelectorAll("script,style").forEach((el) => el.remove());
        const text = div.textContent.replace(/\s+/g, " ").trim();
        return { text, snippet: getViewerSnippet(text, query, windowSize) };
    } catch (e) {
        return { text: "", snippet: "(Could not load preview)" };
    }
}

function getViewerSnippet(content, query, windowSize = 20) {
    if (!query)
        return content.slice(0, 120) + (content.length > 120 ? "..." : "");
    const lcContent = content.toLowerCase();
    const lcQuery = query.toLowerCase();
    const idx = lcContent.indexOf(lcQuery);
    if (idx === -1)
        return content.slice(0, 120) + (content.length > 120 ? "..." : "");
    // Find word boundaries
    const words = content.split(/\s+/);
    let charCount = 0,
        startWord = 0,
        endWord = words.length - 1;
    for (let i = 0; i < words.length; i++) {
        if (charCount + words[i].length >= idx) {
            startWord = Math.max(0, i - windowSize);
            endWord = Math.min(words.length - 1, i + windowSize);
            break;
        }
        charCount += words[i].length + 1;
    }
    const snippet = words.slice(startWord, endWord + 1).join(" ");
    return (
        (startWord > 0 ? "... " : "") +
        snippet +
        (endWord < words.length - 1 ? " ..." : "")
    );
}

function highlightViewerQuery(snippet, query) {
    if (!query) return snippet;
    const re = new RegExp(
        "(" + query.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&") + ")",
        "ig"
    );
    return snippet.replace(re, "<mark>$1</mark>");
}

async function showViewerResults(results, query, viewerContents) {
    const resultsList = document.getElementById("viewer-search-results");
    resultsList.innerHTML = "";
    if (results.length === 0) {
        resultsList.style.display = "none";
        return;
    }
    results.forEach((item, i) => {
        const li = document.createElement("li");
        li.className =
            "list-group-item list-group-item-action d-flex flex-row align-items-start viewer-search-result-item";
        li.tabIndex = 0;

        const titleDiv = document.createElement("div");
        titleDiv.className = "viewer-search-result-title fw-semibold";
        titleDiv.textContent = item.title;

        const previewDiv = document.createElement("div");
        previewDiv.className = "viewer-search-result-preview text-muted small ms-3";
        previewDiv.innerHTML = highlightViewerQuery(viewerContents[i].snippet, query);

        li.appendChild(titleDiv);
        li.appendChild(previewDiv);

        li.addEventListener("click", () => {
            window.location.href = item.url;
        });
        li.addEventListener("keydown", (e) => {
            if (e.key === "Enter") window.location.href = item.url;
        });
        resultsList.appendChild(li);
    });
    resultsList.style.display = "block";
}

function fuzzyViewerMatch(query, text) {
    query = query.toLowerCase();
    text = text.toLowerCase();
    let qi = 0,
        ti = 0;
    while (qi < query.length && ti < text.length) {
        if (query[qi] === text[ti]) qi++;
        ti++;
    }
    return qi === query.length;
}

async function doViewerSearch() {
    const searchInput = document.getElementById("viewer-search");
    const resultsList = document.getElementById("viewer-search-results");
    const query = searchInput.value.trim();
    if (!query) {
        showViewerResults([], query, []);
        return;
    }
    // Fetch all viewer contents in parallel
    const viewerContents = await Promise.all(
        VIEWER_INDEX.map((item) => fetchViewerContentAndSnippet(item.url, query))
    );
    // Match on title or viewer content
    let results = VIEWER_INDEX.filter(
        (item, i) =>
            item.title.toLowerCase().includes(query.toLowerCase()) ||
            viewerContents[i].text.toLowerCase().includes(query.toLowerCase())
    );
    let filteredViewerContents = VIEWER_INDEX.map((item, i) => viewerContents[i]);
    // Only keep viewerContents for matched results
    filteredViewerContents = VIEWER_INDEX.map((item, i) => ({ item, idx: i }))
        .filter(
            ({ item, idx }) =>
                item.title.toLowerCase().includes(query.toLowerCase()) ||
                viewerContents[idx].text.toLowerCase().includes(query.toLowerCase())
        )
        .map(({ idx }) => viewerContents[idx]);
    if (results.length < 5) {
        // Add fuzzy matches if not enough substring matches
        const fuzzy = VIEWER_INDEX.map((item, i) => ({ item, idx: i })).filter(
            ({ item, idx }) =>
                (fuzzyViewerMatch(query, item.title) ||
                    fuzzyViewerMatch(query, viewerContents[idx].text)) &&
                !results.includes(item)
        );
        results = results.concat(fuzzy.map(({ item }) => item));
        filteredViewerContents = filteredViewerContents.concat(
            fuzzy.map(({ idx }) => viewerContents[idx])
        );
    }
    // Limit to 8 results
    await showViewerResults(
        results.slice(0, 8),
        query,
        filteredViewerContents.slice(0, 8)
    );
}

function setupViewerSearch() {
    const searchInput = document.getElementById("viewer-search");
    const searchBtn = document.getElementById("viewer-search-btn");
    const resultsList = document.getElementById("viewer-search-results");
    if (!searchInput || !searchBtn || !resultsList) return;

    searchInput.addEventListener("input", doViewerSearch);
    searchBtn.addEventListener("click", doViewerSearch);
    searchInput.addEventListener("focus", doViewerSearch);
    searchInput.addEventListener("blur", () => {
        setTimeout(() => {
            resultsList.style.display = "none";
        }, 200);
    });

    // Keyboard navigation for results
    searchInput.addEventListener("keydown", function (e) {
        if (e.key === "ArrowDown") {
            const first = resultsList.querySelector("li");
            if (first) first.focus();
        } else if (e.key === "Enter") {
            const first = resultsList.querySelector("li");
            if (first) {
                window.location.href = VIEWER_INDEX.find(
                    (item) => item.title === first.textContent
                ).url;
            }
        }
    });
    resultsList.addEventListener("keydown", function (e) {
        if (e.key === "ArrowDown") {
            if (e.target.nextSibling) e.target.nextSibling.focus();
        } else if (e.key === "ArrowUp") {
            if (e.target.previousSibling) e.target.previousSibling.focus();
            else searchInput.focus();
        }
    });
}

document.addEventListener("DOMContentLoaded", setupViewerSearch);
