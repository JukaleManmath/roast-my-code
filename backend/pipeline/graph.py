import logging
from langgraph.graph import StateGraph, END, START

from pipeline.state import ReviewState
from pipeline.agents.pragmatist import pragmatist_node
from pipeline.agents.paranoid   import paranoid_node
from pipeline.agents.minimalist import minimalist_node
from pipeline.agents.optimizer  import optimizer_node
from pipeline.agents.mentor     import mentor_node
from pipeline.agents.synthesis  import synthesis_node

logger = logging.getLogger(__name__)


def build_graph():
    """
    Build and compile the LangGraph review pipeline.

    Topology:
        START → pragmatist → paranoid → minimalist → optimizer → mentor → synthesis → END

    Agents run sequentially to respect Groq free-tier TPM limits and give the
    frontend a live one-card-at-a-time update experience.
    """
    graph = StateGraph(ReviewState)

    # Register nodes — names must not clash with ReviewState keys (LangGraph constraint)
    graph.add_node('pragmatist_agent', pragmatist_node)
    graph.add_node('paranoid_agent',   paranoid_node)
    graph.add_node('minimalist_agent', minimalist_node)
    graph.add_node('optimizer_agent',  optimizer_node)
    graph.add_node('mentor_agent',     mentor_node)
    graph.add_node('synthesis_agent',  synthesis_node)

    # Sequential chain — one agent at a time to stay within Groq free-tier TPM limits.
    # Each agent completes and broadcasts before the next starts, giving the frontend
    # a live "one card at a time" update experience.
    graph.add_edge(START,              'pragmatist_agent')
    graph.add_edge('pragmatist_agent', 'paranoid_agent')
    graph.add_edge('paranoid_agent',   'minimalist_agent')
    graph.add_edge('minimalist_agent', 'optimizer_agent')
    graph.add_edge('optimizer_agent',  'mentor_agent')
    graph.add_edge('mentor_agent',     'synthesis_agent')

    graph.add_edge('synthesis_agent', END)

    return graph.compile()


# Compiled once at module load — reused for every review
review_graph = build_graph()
