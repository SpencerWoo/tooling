# Tooling website

A static field guide to this repository’s tools. The site explains the concepts, links to the implementations and primary sources, and includes an interactive illustration of last-byte synchronization.

## Run locally

From the repository root:

```bash
python3 -m http.server 8000 --bind 127.0.0.1 --directory website
```

Open **http://127.0.0.1:8000**. Stop the server with Ctrl+C. No installation, bundling, or build is required. Choose a different port if 8000 is in use.

You can also open `website/index.html` directly. Clipboard copying may be unavailable in that context; the command is always shown as selectable text.

## What is included

- A collection index, currently featuring last-byte synchronization.
- An explanation of HTTP body framing, connection preparation, final-byte release, and timing measurement.
- A keyboard-accessible lab with 2–12 illustrated connections, stage/release/reset controls, and announced state changes.
- A discussion of worker assignment, proxies, TLS, TCP_NODELAY, and the distinction from HTTP/2 single-packet techniques.
- Commands for running the real Python demo and tests, plus links to source documentation.

The lab is an illustration: it sends no requests and produces no timing measurements. Run the Python demo for real client and server timing observations.

## Files and maintenance

`index.html` holds the content, `styles.css` provides the responsive layout and reduced-motion support, and `app.js` controls the illustration and command copying. There are no external fonts, scripts, images, or runtime dependencies. GitHub and research links open external pages only when clicked.

When adding a tool, add it to the collection in `index.html`, explain its purpose and mechanics, and link to its own README. Keep tool-specific code in the tool’s folder. The website is documentation; it does not execute those tools in the browser.
