
from fastapi import FastAPI
app = FastAPI()
@app.get("/health")
def health():
    return {"ok": True}

# --- Disco routers ---
from routers.adapters import router as adapters_router
from routers.scrape import router as scrape_router
from routers.suggest import router as suggest_router

try:
    app.include_router(adapters_router)
    app.include_router(scrape_router)
    app.include_router(suggest_router)
except NameError:
    # if app isn't defined yet, define it
    from fastapi import FastAPI
    app = FastAPI()
    app.include_router(adapters_router)
    app.include_router(scrape_router)
    app.include_router(suggest_router)
