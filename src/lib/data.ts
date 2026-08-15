// ---------------------------------------------------------------------------
// Content layer for SKYNET // AI LAB OS
//
// Content notes: the project lineup (Synapse, DeployForge, Omnitrix OS,
// CineVault, Marlboro Red) was rewritten by Pallav in Aug 2026. The research
// log statuses and the sysinfo facts are still open to correction.
// ---------------------------------------------------------------------------

export type SectionId = "research" | "builds" | "systems" | "about" | "contact";

export type FloatingAppId = "terminal" | "files";

export const sections: { id: SectionId; label: string }[] = [
  { id: "research", label: "Research" },
  { id: "builds", label: "Builds" },
  { id: "systems", label: "Systems" },
  { id: "about", label: "About" },
  { id: "contact", label: "Contact" },
];

// ---------------------------------------------------------------------------
// About
// ---------------------------------------------------------------------------

export const about = {
  name: "Pallav Dholariya",
  handle: "skynet@ailab-os",
  role: "CS student \u00b7 AI/ML \u00b7 full-stack \u00b7 creative technologist",
  bio: [
    "I\u2019m a second-year B.Tech CS student specializing in AI/ML at Newton School of Technology, Pune. I learn primarily by building \u2014 exploring the intersection of AI, software engineering, web development, automation, infrastructure, and creative digital experiences.",
    "I\u2019m particularly interested in understanding how modern intelligent systems work \u2014 from LLMs and retrieval systems to agents and automation \u2014 and then turning those ideas into applications that people can actually use.",
    "My philosophy: Learn something. Build something. Break it. Understand why. Build it better.",
  ],
  focus: ["AI/ML", "AI agents", "RAG systems", "full-stack", "creative tech"],
  facts: [
    { label: "status", value: "studying + building" },
    { label: "school", value: "NST \u00d7 ADYPU, Pune" },
    { label: "editor", value: "VS Code / vim" },
    { label: "os", value: "this one" },
  ],
};

// ---------------------------------------------------------------------------
// Research log \u2014 a numbered learning log, not a skills bar
// ---------------------------------------------------------------------------

/** One node in a steppable diagram; same shape as a project pipeline stage. */
export type ResearchStep = {
  label: string;
  blurb: string;
};

export type ResearchEntry = {
  id: number;
  title: string;
  tag: string;
  status: string;
  note: string;
  /** Optional steppable diagram \u2014 only present for topics studied in depth. */
  diagram?: ResearchStep[];
};

export const researchLog: ResearchEntry[] = [
  {
    id: 1,
    title: "Probability & Statistics",
    tag: "foundations",
    status: "studied",
    note: "Bayes, distributions, and the language of uncertainty underneath every model.",
  },
  {
    id: 2,
    title: "Linear Algebra",
    tag: "matrices \u00b7 eigendecomposition",
    status: "studied",
    note: "How vectors and matrices make high-dimensional reasoning tractable.",
  },
  {
    id: 3,
    title: "Regression",
    tag: "linear \u00b7 logistic \u00b7 regularization",
    status: "applied",
    note: "From least squares to decision boundaries \u2014 the first models that shipped.",
    diagram: [
      {
        label: "Data",
        blurb: "Features X and targets y \u2014 a labeled dataset the model learns from.",
      },
      {
        label: "Hypothesis",
        blurb: "A line (or curve) we fit: \u0177 = w\u00b7x + b. The weights are what training adjusts.",
      },
      {
        label: "Loss",
        blurb: "How wrong the line is \u2014 mean squared error for regression, cross-entropy for classification.",
      },
      {
        label: "Optimize",
        blurb: "Gradient descent nudges the weights downhill on the loss surface until predictions stop improving.",
      },
      {
        label: "Predict",
        blurb: "New inputs flow through the fitted model. Regularization keeps the fit honest instead of memorized.",
      },
    ],
  },
  {
    id: 4,
    title: "Neural Networks",
    tag: "backprop \u00b7 optimizers",
    status: "applied",
    note: "Training dynamics, vanishing gradients, and why depth actually helps.",
    diagram: [
      {
        label: "Input",
        blurb: "Features enter as a vector \u2014 one value per dimension, usually normalized first.",
      },
      {
        label: "Hidden layers",
        blurb: "Weighted sums passed through nonlinearities. Depth is what lets simple features compose into abstract ones.",
      },
      {
        label: "Activation",
        blurb: "ReLU, sigmoid or tanh decide what a neuron passes on. Without them, stacked layers collapse into one linear map.",
      },
      {
        label: "Output",
        blurb: "The final layer maps to the prediction \u2014 logits, then softmax for probabilities or a raw value for regression.",
      },
      {
        label: "Backprop",
        blurb: "The loss flows backward through the chain rule, giving every weight a gradient. Optimizers apply the updates.",
      },
    ],
  },
  {
    id: 5,
    title: "Transformers",
    tag: "attention \u00b7 positional encoding",
    status: "deep dive",
    note: "Self-attention as learned routing between tokens \u2014 no recurrence required.",
    diagram: [
      {
        label: "Tokens",
        blurb: "Text is split into tokens \u2014 words or subwords \u2014 the model\u2019s atomic units.",
      },
      {
        label: "Embeddings",
        blurb: "Each token becomes a vector, and positional encoding records where it sits in the sequence.",
      },
      {
        label: "Attention",
        blurb: "Every token queries every other \u2014 learned routing of information across the whole sequence at once.",
      },
      {
        label: "Feed-forward",
        blurb: "A per-token MLP transforms each representation independently after attention has mixed the context.",
      },
      {
        label: "Output",
        blurb: "Stacked blocks end in a probability over the next token \u2014 that\u2019s what makes it a language model.",
      },
    ],
  },
  {
    id: 6,
    title: "LLMs",
    tag: "pretraining \u00b7 alignment \u00b7 context",
    status: "deep dive",
    note: "Scale, RLHF, and the practical art of prompting, eval and context.",
    diagram: [
      {
        label: "Pretraining",
        blurb: "Next-token prediction over massive corpora. Scale is where emergent abilities come from.",
      },
      {
        label: "Alignment",
        blurb: "Instruction tuning and RLHF shape a raw predictor into something helpful, honest and safe.",
      },
      {
        label: "Context",
        blurb: "Everything the model sees before answering \u2014 prompt, retrieved documents, tool output all live here.",
      },
      {
        label: "Generation",
        blurb: "Sampling from the token distribution \u2014 temperature, top-k, and decoding strategies.",
      },
      {
        label: "Evaluation",
        blurb: "Benchmarks and evals measure what the model actually gets right, not just what it sounds like.",
      },
    ],
  },
  {
    id: 7,
    title: "AI Agents",
    tag: "tools \u00b7 orchestration",
    status: "studying",
    note: "Models that act: tool use, memory, and multi-step reasoning.",
    diagram: [
      {
        label: "Task",
        blurb: "A goal decomposed into concrete steps the model can act on.",
      },
      {
        label: "Tools",
        blurb: "Functions the model can call \u2014 search, code, APIs \u2014 that extend what a raw LLM can do.",
      },
      {
        label: "Memory",
        blurb: "Context carried across turns: conversation history, retrieved knowledge, long-term storage.",
      },
      {
        label: "Orchestrate",
        blurb: "A loop of plan \u2192 act \u2192 observe \u2192 reflect, deciding which tool to call next and when to stop.",
      },
      {
        label: "Output",
        blurb: "A synthesized result assembled from everything gathered across the run.",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Builds
// ---------------------------------------------------------------------------

export type ProjectStatus = "live" | "in development" | "concept" | "hobby";

export type ProjectStage = {
  label: string;
  blurb: string;
  /** Longer explanation of what this stage actually does \u2014 shown in the system diagram panel. */
  detail?: string;
};

export type Project = {
  slug: string;
  name: string;
  tagline: string;
  status: ProjectStatus;
  year: string;
  description: string;
  stack: string[];
  pipeline: ProjectStage[];
  source?: string;
  /** Live deployment URL \u2014 placeholder until real links are provided. */
  link?: string;
};

export const projects: Project[] = [
  {
    slug: "synapse",
    name: "Synapse",
    tagline: "Industrial intelligence \u2014 citation-backed answers from complex documents",
    status: "in development",
    year: "2026",
    description:
      "An AI-powered industrial intelligence platform that combines RAG, hybrid search, knowledge graphs, and adaptive LLM routing to extract actionable insights from complex regulatory and operational documents. Provides citation-backed answers with confidence scoring, using semantic caching and intelligent retrieval to improve accuracy and response speed.",
    stack: ["AI/ML", "RAG", "LLMs", "Knowledge Graphs", "Information Retrieval", "FastAPI"],
    // Synapse not deployed yet
    pipeline: [
      {
        label: "Ingest",
        blurb: "Parse regulatory and operational documents into a searchable corpus.",
        detail:
          "PDFs, spreadsheets and raw text land from a document store, get parsed into clean text, split into chunks that preserve structure, and written to the corpus. Metadata \u2014 source, date, document type \u2014 is kept so every answer can cite where it came from.",
      },
      {
        label: "Index",
        blurb: "Hybrid search + knowledge graph structure over the corpus.",
        detail:
          "Chunks are embedded for semantic similarity AND indexed for exact keyword matches, so retrieval isn\u2019t stuck on one style of search. A knowledge graph links entities and clauses across documents, letting queries travel relationships instead of just matching text.",
      },
      {
        label: "Retrieve",
        blurb: "Semantic retrieval with caching for speed.",
        detail:
          "For each query the system pulls the most relevant chunks \u2014 dense vectors for meaning, sparse keywords for precision, and graph neighbors for context. A semantic cache serves repeat questions instantly instead of re-running the whole retrieval pass.",
      },
      {
        label: "Route",
        blurb: "Adaptive LLM routing picks the right model per query.",
        detail:
          "Not every question needs the biggest model. A router scores query complexity and domain, sending simple lookups to a fast model and hard multi-hop reasoning to a stronger one \u2014 trading cost and latency against answer quality per request.",
      },
      {
        label: "Answer",
        blurb: "Citation-backed answers with confidence scoring.",
        detail:
          "The routed model answers strictly from the retrieved chunks, with inline citations back to the source documents. A confidence score says how well the evidence supports the answer \u2014 so a confident-looking claim is never the same as a grounded one.",
      },
    ],
  },
  {
    slug: "deployforge",
    name: "DeployForge",
    tagline: "From GitHub repo to production, automated",
    status: "live",
    year: "2026",
    description:
      "A self-hosted deployment platform that automates the journey from GitHub repository to production. It detects project frameworks, triggers isolated build pipelines through GitHub Actions, processes the generated assets, and deploys them through a Git-backed infrastructure \u2014 a lightweight developer platform built from scratch.",
    stack: ["DevOps", "CI/CD", "GitHub Actions", "Next.js", "Backend Architecture", "Infrastructure"],
    link: "https://deploy-forge-4klc.vercel.app/",
    pipeline: [
      {
        label: "Connect",
        blurb: "Link a GitHub repository to a project.",
        detail:
          "A webhook binds a repository to a DeployForge project. From then on, pushes to the configured branch trigger the pipeline automatically \u2014 no manual \u2018deploy now\u2019 step in the middle.",
      },
      {
        label: "Detect",
        blurb: "Framework detection configures the right build.",
        detail:
          "The repo is inspected for lockfiles, config files and directory layout to identify the framework \u2014 Next.js, Vite, plain static, whatever it is. Detection picks the correct build command and toolchain so nobody hand-writes a CI config.",
      },
      {
        label: "Build",
        blurb: "Isolated build pipelines via GitHub Actions.",
        detail:
          "Each project builds in its own isolated GitHub Actions pipeline, so one failing build can never take down another. Dependencies are installed fresh, the app compiles, and the pipeline reports status back to the repo.",
      },
      {
        label: "Process",
        blurb: "Generated assets prepared for serving.",
        detail:
          "The raw build output is processed into something deployable \u2014 hashed assets, optimized bundles, and the static/server split applied \u2014 so the artifact that ships is exactly what production should serve.",
      },
      {
        label: "Deploy",
        blurb: "Git-backed infrastructure ships it to production.",
        detail:
          "Deployment rides the same deployment-event model GitHub uses: statuses flow back to the repository while the processed artifact goes live through Git-backed infrastructure. Every release is versioned, observable and rollback-able.",
      },
    ],
  },
  {
    slug: "omnitrix-os",
    name: "Omnitrix OS",
    tagline: "A website that feels more like an operating system",
    status: "live",
    year: "2025",
    description:
      "An immersive WebGL-based interface inspired by the iconic Omnitrix, transforming a traditional website into an interactive 3D experience. Real-time 3D rendering, cinematic animations, interactive controls, audio feedback, voice interactions, and dynamic UI systems \u2014 the visual flex project that shows what a web experience can be beyond a conventional site.",
    stack: ["React", "Next.js", "Three.js", "React Three Fiber", "GSAP", "WebGL", "Creative Frontend"],
    link: "https://ben-10-os.vercel.app/",
    pipeline: [
      {
        label: "Render",
        blurb: "Real-time 3D scene with cinematic animation.",
        detail:
          "Three.js renders the interface itself \u2014 camera moves, transitions and object animation are choreographed like a film, not a slideshow. The scene is the OS, and rendering quality is the product.",
      },
      {
        label: "Interact",
        blurb: "Interactive controls and dynamic UI systems.",
        detail:
          "Pointer and keyboard input drive the 3D UI \u2014 draggable panels, selectable nodes, dynamic layouts that reflow inside the scene. Interaction feels like a desktop OS that happens to live in WebGL.",
      },
      {
        label: "Listen",
        blurb: "Audio feedback and voice interactions.",
        detail:
          "Sound design gives actions weight \u2014 UI ticks, transition swells \u2014 and voice commands let you drive the OS hands-free. Audio is opt-in, off by default, and toggleable in the top bar.",
      },
      {
        label: "Transform",
        blurb: "The interface shifts like the Omnitrix itself.",
        detail:
          "Activating an alien mode remaps the entire theme \u2014 palette, motion language, even layout \u2014 the way the Omnitrix shifts its wearer\u2019s form. The same underlying content, re-skinned by intent.",
      },
    ],
  },
  {
    slug: "cinevault",
    name: "CineVault",
    tagline: "Cinematic movie discovery \u2014 immersive browsing, personalized exploration",
    status: "live",
    year: "2025",
    description:
      "A cinematic movie discovery platform built around immersive browsing and personalized exploration. Integrates movie data through external APIs with animated interfaces, infinite discovery, mood-based exploration, watchlists, favorites, and detailed movie experiences \u2014 a conventional movie database turned into a polished consumer product.",
    stack: ["Next.js", "React", "API Integration", "State Management", "Framer Motion", "UI/UX"],
    link: "https://cinevault-eight-red.vercel.app/",
    pipeline: [
      {
        label: "Browse",
        blurb: "Cinematic, animated browsing across the catalogue.",
        detail:
          "The catalogue renders as an animated, film-like surface \u2014 posters glide, rows reflow and hover states preview trailers. Browsing feels like flipping through a cinema, not a grid of rows.",
      },
      {
        label: "Discover",
        blurb: "Infinite discovery powered by movie APIs.",
        detail:
          "Movie data streams in from external APIs as you scroll \u2014 no pagination walls. Discovery surfaces trending, genre-adjacent and serendipitous picks to keep exploration going.",
      },
      {
        label: "Curate",
        blurb: "Watchlists, favorites, and mood-based exploration.",
        detail:
          "Ratings, watchlists and favorites persist locally. Mood-based exploration maps how you feel to what you might want next, turning a database into a personal recommendation surface.",
      },
      {
        label: "Explore",
        blurb: "Detailed movie experiences that pull you in.",
        detail:
          "Each title opens a rich detail view \u2014 synopsis, cast, trailers, related picks \u2014 animated and state-managed so every step feels continuous, the way a streaming product should.",
      },
    ],
  },
  {
    slug: "marlboro-red",
    name: "Marlboro Red",
    tagline: "A cinematic, immersive brand experience",
    status: "hobby",
    year: "2025",
    description:
      "A cinematic, immersive brand experience that transforms a traditional product website into an interactive visual story. Scroll-driven animations, smooth transitions, layered typography, and interactive storytelling built with React, TypeScript, Framer Motion, Lenis, and 3D visuals \u2014 a premium editorial-style experience.",
    stack: ["React", "TypeScript", "Vite", "Framer Motion", "Lenis", "3D/WebGL", "Motion Design", "Interactive UI", "Creative Frontend"],
    link: "https://malboro-rho.vercel.app/",
    pipeline: [
      {
        label: "Story",
        blurb: "Scroll-driven narrative structure.",
        detail:
          "The page is written as a story the visitor scrolls through \u2014 scenes, beats and transitions choreographed to scroll position, like a filmstrip that advances as you move down.",
      },
      {
        label: "Motion",
        blurb: "Smooth transitions and layered typography.",
        detail:
          "Framer Motion and Lenis handle scroll-linked motion \u2014 parallax, reveal timing and easing. Layered typography moves at different rates to build depth while staying readable.",
      },
      {
        label: "Immerse",
        blurb: "3D visuals and interactive storytelling.",
        detail:
          "WebGL visuals ground the experience \u2014 a product presented as an environment rather than a page. Interactive elements reward scrolling and hovering without ever hiding the content.",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Contact
// ---------------------------------------------------------------------------

export const contact = {
  email: "pallavdholariya@gmail.com",
  github: "https://github.com/Shivala-08",
  linkedin: "https://www.linkedin.com/in/pallavdholariya",
  resume: "/resume.pdf",
  note: "Best reached over email or GitHub — I read everything, I just answer slowly.",
};
