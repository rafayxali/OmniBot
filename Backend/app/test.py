from .retrieval import retrieve

results = retrieve(
    query="what is AI?",
    user_id="demo_user",
    session_id="demo_session",
    top_k=5
)

print("\n===== RETRIEVAL RESULTS =====\n")

if not results:
    print("No results found ❌")
else:
    for i, r in enumerate(results):
        print(f"{i+1}. SCORE: {r['score']}")
        print(f"TEXT: {r['text']}\n")