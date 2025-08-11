KB Flask Repo

- Run `python init_ingest.py docs.zip` to build vectorstore/ from your docs zip.

- Set API_KEY in .env or environment and optionally OPENAI_API_KEY/LLAMA_MODEL_PATH.

- Start backend: `python app.py` or `docker compose up --build`.

Frontend exists in frontend/ — run `npm install` and `npm run dev` to use the React UI.
