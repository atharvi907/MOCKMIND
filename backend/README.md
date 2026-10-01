# MockMind backend

## Run

Configure the project-root `.env` (the supplied value points the React app to port `8001`), ensure MongoDB is running, then install dependencies and start the API:

```powershell
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8001
```

Swagger is available at `http://127.0.0.1:8001/docs`. Configure the frontend with `REACT_APP_BACKEND_URL=http://127.0.0.1:8001`.

The code runner executes local processes for development. Production deployments must run this endpoint in a dedicated sandboxed worker/container with CPU, memory, network and filesystem controls.
