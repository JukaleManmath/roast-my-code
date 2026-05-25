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
        START → [pragmatist, paranoid, minimalist, optimizer, mentor] → synthesis → END

    All five agents fan out in parallel from START.
    Synthesis waits for all five before running.
    """
    graph = StateGraph(ReviewState)

    # Register nodes
    graph.add_node('pragmatist', pragmatist_node)
    graph.add_node('paranoid',   paranoid_node)
    graph.add_node('minimalist', minimalist_node)
    graph.add_node('optimizer',  optimizer_node)
    graph.add_node('mentor',     mentor_node)
    graph.add_node('synthesis',  synthesis_node)

    # Fan out — START to all 5 agents in parallel (correction #1)
    graph.add_edge(START, 'pragmatist')
    graph.add_edge(START, 'paranoid')
    graph.add_edge(START, 'minimalist')
    graph.add_edge(START, 'optimizer')
    graph.add_edge(START, 'mentor')

    # Fan in — all 5 agents to synthesis
    graph.add_edge('pragmatist', 'synthesis')
    graph.add_edge('paranoid',   'synthesis')
    graph.add_edge('minimalist', 'synthesis')
    graph.add_edge('optimizer',  'synthesis')
    graph.add_edge('mentor',     'synthesis')

    graph.add_edge('synthesis', END)

    return graph.compile()


# Compiled once at module load — reused for every review
review_graph = build_graph()
