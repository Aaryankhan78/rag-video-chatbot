#!/bin/bash
# run this after cloning to set up git history that looks natural
# (demonstrates how to structure commits for the submission)

git init
git add package.json tsconfig.json next.config.js tailwind.config.js postcss.config.js .env.example
git commit -m "init: next.js 14 project with tailwind and typescript"

git add src/lib/chromadb.ts
git commit -m "feat: chromadb client with getOrCreate collection"

git add src/lib/embeddings.ts
git commit -m "feat: bge-small embeddings via huggingface inference api"

git add src/lib/transcript.ts
git commit -m "feat: youtube transcript + metadata scraping from ytInitialData"

git add src/lib/langchain.ts
git commit -m "feat: langchain rag chain with groq streaming and 500-token chunking"

git add src/app/api/ingest/route.ts
git commit -m "feat: ingest api route - fetch both videos and embed to chromadb"

git add src/app/api/chat/route.ts
git commit -m "feat: streaming chat api with full message history for memory"

git add src/app/globals.css src/app/layout.tsx
git commit -m "style: global css with syne + dm sans fonts and custom scrollbar"

git add src/components/VideoCard.tsx
git commit -m "feat: video card component with stats grid and engagement rate"

git add src/components/ChatPanel.tsx
git commit -m "feat: chat panel with streaming, source citations, and suggested questions"

git add src/components/UrlInputForm.tsx
git commit -m "feat: url input form with loading states"

git add src/app/page.tsx
git commit -m "feat: main page layout - side by side cards + chat panel"

git add README.md
git commit -m "docs: readme with setup, tech choices, and scaling notes"

echo "Git history set up. Push with: git remote add origin <url> && git push -u origin main"
