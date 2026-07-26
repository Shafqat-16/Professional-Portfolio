#!/usr/bin/env python3
"""Generate the static blog (blog/index.html + blog/<slug>/index.html) from
Markdown files in content/posts/. Run after adding or editing a post:

    ./.venv/bin/python scripts/build_blog.py

Then commit the regenerated blog/ output alongside the source .md file.
"""
import html
import json
import re
from datetime import date
from pathlib import Path

import markdown
import yaml

ROOT = Path(__file__).resolve().parent.parent
POSTS_DIR = ROOT / "content" / "posts"
OUTPUT_DIR = ROOT / "blog"
SITE_URL = "https://shafqat-ashraf.vercel.app"
AUTHOR_NAME = "Muhammad Shafqat Ashraf"

FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?\n)---\s*\n(.*)$", re.DOTALL)

NAV = """    <nav id="navbar">
        <div class="container">
            <a href="/" class="logo">M.<span>Shafqat</span></a>
            <ul class="nav-links">
                <li><a href="/#home">Home</a></li>
                <li><a href="/#about">Profile</a></li>
                <li><a href="/#experience">Experience</a></li>
                <li><a href="/#skills">Competencies</a></li>
                <li><a href="/#projects">Case Studies</a></li>
                <li><a href="/blog/" class="active">Writing</a></li>
                <li><a href="/#contact" class="nav-contact">Contact</a></li>
            </ul>
            <div class="menu-btn">
                <div class="bar"></div>
                <div class="bar"></div>
                <div class="bar"></div>
            </div>
        </div>
    </nav>"""

FOOTER = """    <footer>
        <div class="container">
            <p>&copy; 2026 Shafqat Ashraf. All rights reserved.</p>
            <div class="social-links">
                <a href="https://github.com/shafqat-ashraf" target="_blank"><i class="fab fa-github"></i></a>
                <a href="https://linkedin.com/in/muhammad-shafqat-ashraf/" target="_blank"><i class="fab fa-linkedin"></i></a>
                <a href="#"><i class="fab fa-twitter"></i></a>
            </div>
        </div>
    </footer>"""

HEAD_ASSETS = """    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link
        href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
        rel="stylesheet">
    <link rel="stylesheet" href="/style.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">"""


def format_date(d: date) -> str:
    return f"{d.strftime('%B')} {d.day}, {d.year}"


def post_url(slug: str) -> str:
    return f"/blog/{slug}/"


def parse_post(path: Path):
    match = FRONTMATTER_RE.match(path.read_text(encoding="utf-8"))
    if not match:
        raise ValueError(f"{path.name}: missing --- frontmatter block")
    meta = yaml.safe_load(match.group(1)) or {}
    for field in ("title", "date", "excerpt"):
        if field not in meta:
            raise ValueError(f"{path.name}: frontmatter missing required field '{field}'")
    body = match.group(2)
    # The article's own leading "# Title" duplicates the page <h1> rendered
    # from frontmatter, so drop it before converting to HTML.
    body = re.sub(r"\A\s*#\s+.+\n+", "", body, count=1)
    return {
        "slug": path.stem,
        "title": meta["title"],
        "date": meta["date"],
        "excerpt": meta["excerpt"],
        "tags": meta.get("tags", []),
        "related_project": meta.get("relatedProject"),
        "body": body,
    }


def render_markdown(body: str) -> str:
    converter = markdown.Markdown(
        extensions=["fenced_code", "codehilite"],
        extension_configs={"codehilite": {"guess_lang": False}},
    )
    return converter.convert(body)


def reading_minutes(body: str) -> int:
    words = len(body.split())
    return max(1, round(words / 200))


def tag_spans(tags):
    return "\n                    ".join(f"<span>{html.escape(t)}</span>" for t in tags)


def render_post_page(post, content_html, minutes):
    title = html.escape(post["title"])
    excerpt = html.escape(post["excerpt"])
    date_iso = post["date"].isoformat()
    date_display = format_date(post["date"])
    canonical = f"{SITE_URL}{post_url(post['slug'])}"
    og_image = f"{SITE_URL}/profile.jpg"
    tags_html = tag_spans(post["tags"])

    return f"""<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title} | Shafqat Ashraf</title>
    <meta name="description" content="{excerpt}">
    <meta name="author" content="{AUTHOR_NAME}">
    <link rel="canonical" href="{canonical}">
    <link rel="sitemap" type="application/xml" title="Sitemap" href="/sitemap.xml">

    <!-- Open Graph -->
    <meta property="og:type" content="article">
    <meta property="og:url" content="{canonical}">
    <meta property="og:title" content="{title}">
    <meta property="og:description" content="{excerpt}">
    <meta property="og:image" content="{og_image}">
    <meta property="article:published_time" content="{date_iso}">
    <meta property="article:author" content="{AUTHOR_NAME}">

    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:title" content="{title}">
    <meta property="twitter:description" content="{excerpt}">
    <meta property="twitter:image" content="{og_image}">

    <!-- Structured Data (Schema.org) -->
    <script type="application/ld+json">
    {json.dumps({
        "@context": "https://schema.org",
        "@type": "TechArticle",
        "headline": post["title"],
        "description": post["excerpt"],
        "image": og_image,
        "author": {"@type": "Person", "name": AUTHOR_NAME, "url": f"{SITE_URL}/"},
        "publisher": {"@type": "Person", "name": AUTHOR_NAME},
        "datePublished": date_iso,
        "dateModified": date_iso,
        "mainEntityOfPage": {"@type": "WebPage", "@id": canonical},
    }, indent=2)}
    </script>
{HEAD_ASSETS}
</head>

<body>
{NAV}

    <main>
        <article class="section-padding post-page">
            <div class="container post-container">
                <a href="/blog/" class="post-back">&larr; All Writing</a>
                <header class="post-header reveal">
                    <span class="section-tag">Writing</span>
                    <h1 class="post-title">{title}</h1>
                    <div class="post-meta">
                        <span><i class="fas fa-calendar"></i> {date_display}</span>
                        <span><i class="fas fa-clock"></i> {minutes} min read</span>
                        <span><i class="fas fa-user"></i> {AUTHOR_NAME}</span>
                    </div>
                    <div class="post-tags">
                    {tags_html}
                    </div>
                </header>
                <div class="post-content reveal">
                    {content_html}
                </div>
            </div>
        </article>
    </main>

{FOOTER}

    <script src="/script.js"></script>
</body>

</html>
"""


def render_index_page(posts):
    canonical = f"{SITE_URL}/blog/"
    cards = []
    for post in posts:
        url = post_url(post["slug"])
        title = html.escape(post["title"])
        excerpt = html.escape(post["excerpt"])
        date_display = format_date(post["date"])
        tags_html = tag_spans(post["tags"])
        cards.append(f"""                <article class="post-card reveal">
                    <div class="post-card-meta">
                        <span class="post-date">{date_display}</span>
                        <span class="post-reading-time">{post["minutes"]} min read</span>
                    </div>
                    <h3><a href="{url}">{title}</a></h3>
                    <p>{excerpt}</p>
                    <div class="post-tags">
                    {tags_html}
                    </div>
                    <a href="{url}" class="post-card-link">Read article <i class="fas fa-arrow-right"></i></a>
                </article>""")
    cards_html = "\n".join(cards)

    return f"""<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Writing | Shafqat Ashraf</title>
    <meta name="description"
        content="Technical write-ups on embedded firmware, DSP, RTOS, and edge intelligence by Muhammad Shafqat Ashraf.">
    <meta name="author" content="{AUTHOR_NAME}">
    <link rel="canonical" href="{canonical}">
    <link rel="sitemap" type="application/xml" title="Sitemap" href="/sitemap.xml">

    <!-- Open Graph -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="{canonical}">
    <meta property="og:title" content="Writing | Shafqat Ashraf">
    <meta property="og:description"
        content="Technical write-ups on embedded firmware, DSP, RTOS, and edge intelligence.">
    <meta property="og:image" content="{SITE_URL}/profile.jpg">
{HEAD_ASSETS}
</head>

<body>
{NAV}

    <main>
        <section id="writing" class="section-padding blog-hero">
            <div class="container">
                <div class="section-header">
                    <span class="section-tag">Writing</span>
                    <h1 class="blog-hero-title">Field Notes & <span>Technical Write-ups</span></h1>
                    <p>Long-form engineering notes on firmware, DSP, and edge intelligence — the problems I actually
                        solved, and how.</p>
                </div>
                <div class="posts-grid">
{cards_html}
                </div>
            </div>
        </section>
    </main>

{FOOTER}

    <script src="/script.js"></script>
</body>

</html>
"""


def main():
    post_paths = sorted(POSTS_DIR.glob("*.md"))
    if not post_paths:
        print("No posts found in content/posts/.")
        return

    posts = []
    for path in post_paths:
        post = parse_post(path)
        content_html = render_markdown(post["body"])
        minutes = reading_minutes(post["body"])
        post["minutes"] = minutes

        out_dir = OUTPUT_DIR / post["slug"]
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / "index.html").write_text(
            render_post_page(post, content_html, minutes), encoding="utf-8"
        )
        posts.append(post)
        print(f"Built {post_url(post['slug'])}")

    posts.sort(key=lambda p: p["date"], reverse=True)
    OUTPUT_DIR.mkdir(exist_ok=True)
    (OUTPUT_DIR / "index.html").write_text(render_index_page(posts), encoding="utf-8")
    print(f"Built /blog/ index with {len(posts)} post(s).")


if __name__ == "__main__":
    main()
