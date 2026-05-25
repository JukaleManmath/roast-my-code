from typing import TypedDict


class ReviewState(TypedDict):
    # Inputs — set once before the graph runs, all agents read these
    raw_code:  str
    language:  str
    filename:  str
    review_id: str   # UUID string — used by agents to broadcast WebSocket events

    # Outputs — each agent writes only to its own field (no write collision)
    pragmatist: dict
    paranoid:   dict
    minimalist: dict
    optimizer:  dict
    mentor:     dict
    synthesis:  dict
