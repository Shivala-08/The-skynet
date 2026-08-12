import { SectionShell } from "./section-shell";
import { StepDiagram } from "./step-diagram";

/**
 * Synapse agent architecture — a real, multi-stage pipeline.
 * Each node is a sub-agent in the orchestration pattern.
 */
const synapseArchitecture = [
  {
    label: "Orchestrator",
    blurb: "Receives the query, decomposes intent, and coordinates the pipeline.",
    detail:
      "The central coordinator that sits at the top of the system. It parses the incoming question, identifies whether it needs retrieval, multi-hop reasoning or a simple lookup, and dispatches to the appropriate sub-agents. It tracks progress, handles failures, and assembles the final output.",
  },
  {
    label: "Retrieval Agent",
    blurb: "Runs hybrid search — dense vectors, sparse keywords, knowledge graph traversal.",
    detail:
      "Pulls the most relevant chunks from the corpus using three lanes: dense vector search for semantic similarity, sparse keyword search for exact terms, and knowledge graph traversal for relationships between entities. A semantic cache sits in front, serving repeat queries instantly.",
  },
  {
    label: "Routing Agent",
    blurb: "Scores query complexity and picks the right LLM for this request.",
    detail:
      "Classifies each query by domain and complexity before it hits a model. Simple factual lookups are routed to a fast, lightweight model. Multi-hop reasoning, nuanced analysis and complex synthesis are sent to a stronger model — balancing cost and latency against answer quality.",
  },
  {
    label: "Synthesis Agent",
    blurb: "Generates the answer grounded in retrieved context with inline citations.",
    detail:
      "Takes the assembled context from the retrieval agent and the model choice from the routing agent to produce a clear, grounded answer. Every factual claim is tied to a specific source chunk via inline citations, so nothing is stated without evidence behind it.",
  },
  {
    label: "Confidence Scorer",
    blurb: "Evaluates how well the evidence supports the answer.",
    detail:
      "A final validation pass that compares the generated answer against the retrieved evidence. Claims with strong source backing receive high confidence; weak or unsupported claims are flagged. The score is surfaced to the user alongside the answer, making confidence as visible as content.",
  },
];

export function SystemsSection() {
  return (
    <SectionShell id="systems" title="systems.workflow" tag="// synapse">
      <p className="max-w-2xl text-sm leading-relaxed text-ink-dim">
Synapse&apos;s backend is a multi-agent pipeline, not a single model call. An orchestrator decomposes each
query and coordinates sub-agents for retrieval, routing, synthesis and scoring — the same pattern
behind production RAG systems.
      </p>
      <div className="mt-6">
        <StepDiagram steps={synapseArchitecture} label="Synapse agent architecture" />
      </div>
    </SectionShell>
  );
}
