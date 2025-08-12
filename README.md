KB Flask Repo

- Create a venv (python -m venv ./.venv)
- Activate is (python -m venv ./.venv)
- install libs (pip install -r requirements.txt)

- Run `python init_ingest.py docs.zip` to build vectorstore/ from your docs zip.

- Download https://huggingface.co/TheBloke/Llama-2-7B-Chat-GGUF/blob/main/llama-2-7b-chat.Q4_K_M.gguf (and put it in the models folder)

- Set API_KEY in .env or environment and optionally OPENAI_API_KEY/LLAMA_MODEL_PATH.

- Start backend: `python app.py` or `docker compose up --build`.

Frontend exists in frontend/ — run `npm install` and `npm run dev` to use the React UI.
