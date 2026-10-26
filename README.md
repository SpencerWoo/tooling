# Tooling

A collection of independent tools. Each tool lives in its own subfolder and owns its documentation, source code, dependencies, and configuration.

## Tools

- [Last-byte synchronization](last-byte-synchronization/README.md) — coordinate the completion of HTTP/1.1 requests by withholding and releasing their final body byte. Includes a Python client, an instrumented local demo, and protocol notes.

## Website

The [static website](website/README.md) explains the tools and includes an interactive last-byte synchronization illustration. Run it locally from the repository root:

```bash
python3 -m http.server 8000 --bind 127.0.0.1 --directory website
```

Open http://127.0.0.1:8000. No installation or build is required.

## Repository layout

The root contains only this `README.md`, `.gitignore`, and subfolders (alongside Git's internal `.git/` directory). Each tool has its own folder; `website/` contains the shared documentation site.

```text
tooling/
├── README.md
├── .gitignore
├── website/
│   ├── README.md
│   └── ...
└── <tool-name>/
    ├── README.md
    └── ...
```

## Adding a tool

1. Create a subfolder with a descriptive, lowercase, hyphen-separated name.
2. Keep all files needed to build, run, and maintain that tool inside its folder.
3. Add a detailed `README.md` inside the tool folder covering:
   - What the tool does, who it is for, and the problem it solves.
   - Prerequisites, installation, and required configuration or environment variables.
   - How to run it, with concrete commands and usage examples.
   - Inputs, outputs, and any limitations or troubleshooting notes.
   - Development and testing instructions, where applicable.
4. Add a link and a short description to the tool index above.

Keep this README focused on discovery and repository conventions; put each tool's full documentation in its own README. Keep tool-specific ignore rules in that tool's `.gitignore`.
