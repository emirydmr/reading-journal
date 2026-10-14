# Master's Research — Research Framework & Literature Management

> **Document:** MASTER - Research Framework  
> **Version:** 1.0  
> **Status:** Living Document  
> **Location:** Masters Research / 06 - Research Notes & Framework
>
> **Research Field:** Connected and Automated Vehicles (CAVs), Intelligent Transportation Systems (ITS), Artificial Intelligence, and related methodologies.

---

# 1. Purpose

This document defines the organizational structure, research taxonomy, annotation conventions, tagging system, and literature review workflow used throughout my Master's research.

The objective is not merely to collect scientific publications, but to progressively develop:

1. A structured understanding of the research field.
2. Knowledge of existing methods, theories, and research problems.
3. The ability to critically evaluate scientific literature.
4. An understanding of relationships between different research directions.
5. Independent research questions and ideas.
6. A foundation for identifying a suitable Master's thesis topic.

The research framework is expected to evolve as my understanding develops.

## 1.1 Research Philosophy

Scientific reading should be an active process.

For each paper, I aim to document:

- **What I learned:** New concepts, methodologies, findings, and perspectives.
- **What I understood:** My interpretation of the authors' reasoning and contributions.
- **What I do not understand:** Unfamiliar concepts, unclear explanations, and unresolved technical questions.
- **What I question:** Assumptions, methodologies, conclusions, or interpretations requiring further examination.
- **What I disagree with:** Claims or methodological choices that I believe may be problematic.
- **What connections I recognize:** Relationships to other publications, theories, and research directions.
- **What ideas emerge:** Potential applications, improvements, alternative approaches, and research questions.

A distinction must always be maintained between:

- Statements made by the authors.
- Results supported by evidence.
- My own interpretations.
- My criticisms.
- My speculative research ideas.

Not understanding an argument does not mean that the argument is incorrect.

The goal is to transform reading into understanding, understanding into critical thinking, and critical thinking into independent research.

---

# 2. Research Taxonomy — The 3 + 1 Framework

The research framework follows the taxonomy introduced by my professor.

It consists of three primary research directions representing different levels of transportation systems, complemented by a fourth, cross-cutting direction.

The framework can be represented as:

```text
                     RESEARCH FRAMEWORK
                            3 + 1
                              |
          +-------------------+-------------------+
          |                   |                   |
    01. Vehicle Level   02. Human–Vehicle   03. Traffic System
          |                   |                   |
    Cooperative Motion    Human-Driven       Traffic-Flow
        Control          Vehicles & ADAS      Modeling &
                                            System Control
          |                   |                   |
          +-------------------+-------------------+
                              |
                  04. Testing, Simulation
                      & Verification
                     (Cross-Cutting)
```

The first three directions describe the **level of the transportation system being investigated**.

The fourth direction describes a **cross-cutting research domain concerned with testing, simulation, and verification**.

These dimensions are not mutually exclusive.

For example, a paper may investigate cooperative vehicle control while evaluating the proposed controller through simulation.

Such a paper primarily belongs to Collection 01, but may also receive simulation-related tags.

---

## 2.1 Cooperative Motion Control of CAVs

**Collection:** `01 - Cooperative Motion Control of CAVs`

**Research Level:** Vehicle

### Scope

Research concerning the motion, coordination, and control of connected and automated vehicles.

Relevant topics include:

- Vehicle platooning
- Longitudinal control
- Lateral control
- Cooperative adaptive cruise control (CACC)
- Cooperative maneuver planning
- Vehicle-to-vehicle communication
- Multi-agent coordination
- Communication delays and constraints
- Learning-based vehicle control
- Cooperative decision-making
- Vehicle trajectory planning
- String stability

### Central Research Question

How can connected and automated vehicles coordinate their behavior to achieve safe, efficient, and reliable motion?

### Foundational Survey

*Platooning Control of Connected Automated Vehicles under Communication Constraints: Advances and Challenges* (2026)

### Collection Guidelines

Include papers whose primary contribution concerns vehicle-level motion planning, control, or coordination.

Papers involving simulation should remain in this collection when simulation is primarily used to evaluate a vehicle-control method.

If the primary contribution is a simulation or testing methodology itself, Collection 04 may be more appropriate.

---

## 2.2 Connected Human-Driven Vehicles & ADAS

**Collection:** `02 - Human-Driven Vehicles & ADAS`

**Research Level:** Human–Vehicle

### Scope

Research concerning transportation systems in which human drivers remain involved in vehicle operation.

Relevant topics include:

- Advanced Driver Assistance Systems (ADAS)
- Human-in-the-loop control
- Driver behavior modeling
- Driver intention prediction
- Human factors
- Driver acceptance and trust
- Personalized driving assistance
- Connected human-driven vehicles
- Human–machine interaction
- Driver guidance and decision support
- Driver monitoring
- Human–automation cooperation

### Central Research Question

How can connectivity, intelligent systems, and richer information improve human driving behavior, assistance, safety, and decision-making?

### Foundational Survey

*Understanding Human Factors in Advanced Driver Assistance Systems: An Evidence Review* (2026)

### Collection Guidelines

Include papers whose primary contribution concerns human drivers, driver assistance, or interactions between humans and intelligent vehicle systems.

Papers using simulation to investigate human behavior should normally remain in this collection.

Simulation-specific methodological contributions may additionally belong to Collection 04.

---

## 2.3 Traffic-Flow Modeling & System-Level Control

**Collection:** `03 - Traffic-Flow Modeling & System Control`

**Research Level:** Traffic System

### Scope

Research examining traffic behavior and control beyond individual vehicles.

Relevant topics include:

- Traffic-flow theory
- Microscopic traffic modeling
- Macroscopic traffic modeling
- Mixed traffic environments
- Traffic stability
- Traffic congestion
- Network-level traffic control
- Connected vehicle penetration
- System-level optimization
- Human-driven and automated vehicle interactions
- Traffic prediction
- Traffic management
- Traffic-flow simulation
- Car-following models
- Lane-changing models

### Central Research Question

How can connectivity and controllability be leveraged to understand, predict, and influence the behavior of entire traffic systems?

### Foundational Survey

*A Survey on Urban Traffic Control under Mixed Traffic Environment with Connected Automated Vehicles* (2023)

### Collection Guidelines

Include papers whose primary contribution concerns traffic behavior, traffic-flow modeling, or system-level control.

Papers introducing traffic simulation models may belong here when their main contribution is explaining or reproducing traffic behavior.

If the main contribution is a general-purpose simulation, testing, or verification framework, Collection 04 may be more appropriate.

---

## 2.4 Testing, Simulation & Verification

**Collection:** `04 - Testing, Simulation & Verification`

**Research Level:** Cross-Cutting

This direction complements all three preceding research levels.

Unlike Collections 01–03, it does not correspond to a single level of the transportation system.

Instead, it addresses how transportation systems and intelligent driving technologies can be developed, tested, simulated, and evaluated.

### Scope

Relevant topics include:

- Traffic simulation
- Autonomous driving simulation
- Scenario generation
- Safety-critical testing
- Verification and validation
- Simulation-based evaluation
- Digital twins
- Generative simulation methods
- Testing of learning-based systems
- Robustness evaluation
- Generalization evaluation
- Simulation environments
- Test scenario coverage
- Formal verification

### Central Research Question

How can we reliably determine whether vehicle controllers, driver assistance systems, and traffic-control strategies function correctly under realistic, complex, and safety-critical conditions?

### Foundational Survey

*Testing and Verification of Connected and Autonomous Vehicles: A Review* (2025)

### Special Classification Rule

Testing, simulation, and verification are **cross-cutting research domains**.

Therefore, they are represented in two ways:

1. As a dedicated Zotero collection.
2. As methodological tags applicable to papers in any collection.

#### Collection Membership

A paper belongs to Collection 04 when its primary research contribution concerns testing, simulation, verification, or validation.

Examples:

- A new autonomous driving simulation framework.
- A method for generating safety-critical traffic scenarios.
- A verification framework for connected vehicle controllers.
- A general methodology for evaluating autonomous driving systems.

#### Tag Membership

A paper receives testing, simulation, or verification tags whenever those methods constitute a meaningful part of its research.

Examples:

- A vehicle-control paper evaluated in simulation.
- An ADAS study using a driving simulator.
- A traffic-flow paper investigating simulation-based predictions.
- A controller verified using formal methods.

These papers do not automatically need to be assigned to Collection 04.

### Relevant Tags

```text
method/simulation
method/testing
method/verification
method/validation
method/scenario-generation
```

These tags can be applied across Collections 01–05.

### Important Distinction

Using simulation does not necessarily make a paper a simulation research paper.

For example:

**Paper A:**

Proposes a new cooperative vehicle controller and evaluates it using SUMO.

Classification:

```text
Collection: 01 - Cooperative Motion Control of CAVs
Tags:
  approach/control
  method/simulation
```

**Paper B:**

Proposes a new traffic simulation environment for evaluating cooperative vehicle controllers.

Classification:

```text
Collection: 04 - Testing, Simulation & Verification
Tags:
  approach/testing
  method/simulation
```

The classification depends on the paper's primary scientific contribution.

---

## 2.5 General & Cross-Cutting Research

**Collection:** `05 - General & Cross-Cutting Research`

This collection contains foundational and methodological literature that does not belong exclusively to a specific transportation research direction.

### Scope

Relevant topics include:

- Machine learning
- Deep learning
- Reinforcement learning
- Large language models
- Reasoning and planning
- Knowledge distillation
- Generative modeling
- Multi-agent learning
- Optimization
- Representation learning
- General AI methodologies

### Collection Guidelines

Use this collection for papers whose primary contribution is methodological rather than specific to a transportation research problem.

For example:

A general paper introducing a reinforcement learning algorithm belongs here.

A paper applying reinforcement learning to cooperative vehicle control primarily belongs to Collection 01.

Avoid placing every paper that uses machine learning into Collection 05.

A paper should only receive additional collection membership when that membership is useful for organizing and retrieving the literature.

---

# 3. Research Activity Classification

In addition to research level, papers are classified according to the type of scientific activity they represent.

Three broad research activities are distinguished.

| Activity | Description | Tag |
|---|---|---|
| Modeling & Understanding | Developing representations, explanations, or predictions of system behavior | `approach/modeling` |
| Control & Decision-Making | Designing methods that influence or optimize system behavior | `approach/control` |
| Testing & Evaluation | Developing environments, scenarios, or methods for assessing system performance | `approach/testing` |

These categories are not mutually exclusive.

A paper may involve multiple research activities.

## 3.1 Modeling & Understanding

Examples:

- Traffic-flow modeling
- Driver behavior prediction
- Car-following models
- Learning representations of traffic dynamics
- Modeling interactions between vehicles

Tag:

`approach/modeling`

## 3.2 Control & Decision-Making

Examples:

- Cooperative vehicle control
- Reinforcement learning for driving
- Traffic signal optimization
- Vehicle trajectory optimization
- Intelligent driver assistance

Tag:

`approach/control`

## 3.3 Testing & Evaluation

Examples:

- Simulation framework development
- Test scenario generation
- Verification methodology
- Safety evaluation frameworks
- Benchmark development

Tag:

`approach/testing`

### Distinction Between Approach and Method Tags

`approach/testing` describes the paper's research activity.

`method/testing` describes a methodology employed in the paper.

For example, a paper proposing a new controller and evaluating it through testing would normally receive:

```text
approach/control
method/testing
```

A paper developing a new testing methodology would receive:

```text
approach/testing
method/testing
```

This distinction prevents the research activity taxonomy from becoming confused with the tools used to conduct research.

---

# 4. Zotero Collection Structure

The library is organized as follows:

```text
Masters Research
│
├── 01 - Cooperative Motion Control of CAVs
│   └── Collection Guide
│
├── 02 - Human-Driven Vehicles & ADAS
│   └── Collection Guide
│
├── 03 - Traffic-Flow Modeling & System Control
│   └── Collection Guide
│
├── 04 - Testing, Simulation & Verification
│   └── Collection Guide
│
├── 05 - General & Cross-Cutting Research
│   └── Collection Guide
│
└── 06 - Research Notes & Framework
    ├── MASTER - Research Framework
    ├── Annotation Color Legend
    ├── Paper Reading Template
    └── Research Journal
```

## 4.1 Collection Principles

Collections represent relatively stable research areas.

They should not represent:

- Reading progress
- Temporary priorities
- Individual questions
- Every algorithm encountered
- Every methodological detail

These properties are better represented through tags or notes.

## 4.2 Multiple Collection Membership

A paper may belong to multiple collections without duplicating its library entry.

However, multiple membership should be used selectively.

A paper should normally have one primary conceptual home.

Additional memberships are appropriate when the paper makes substantial contributions to multiple research directions.

## 4.3 Collection Guides

Each research collection contains a master note called:

`Collection Guide`

The note should define:

1. Research scope.
2. Central research questions.
3. Relevant subtopics.
4. Inclusion criteria.
5. Exclusion criteria.
6. Recommended foundational literature.
7. Relevant tags.
8. Relationships to other collections.

Collection guides should be updated as the understanding of each research direction develops.

---

# 5. Reading Status System

Reading progress is tracked through Zotero tags.

## 5.1 Status Tags

| Tag | Meaning |
|---|---|
| `status/to-read` | Paper collected but not yet started |
| `status/reading` | Currently being examined |
| `status/read` | Initial reading and documentation completed |
| `status/revisit` | Requires additional examination |

## 5.2 Status Rules

The first three tags represent mutually exclusive reading states.

A paper should normally have exactly one of:

```text
status/to-read
status/reading
status/read
```

The tag:

```text
status/revisit
```

is supplementary.

It may coexist with `status/read` when a paper has been read but contains unresolved questions or material requiring further investigation.

## 5.3 Definition of Completed Reading

A paper is considered initially read when:

1. Its central research question has been identified.
2. Its methodology has been understood conceptually.
3. Its main contributions have been documented.
4. Important uncertainties have been recorded.
5. A structured reading note has been created.

Complete understanding of every technical detail is not required.

---

# 6. Annotation Color System

PDF annotations document the reading and reasoning process directly alongside the scientific literature.

The following conventions apply consistently across all papers.

| Color | Category | Meaning |
|---|---|---|
| 🟨 Yellow | Important Information | Important definitions, claims, explanations, findings, and conclusions |
| 🟥 Red | Criticism & Disagreement | Questionable assumptions, methodological weaknesses, unsupported claims, and disagreements |
| 🟩 Green | Personal Insights & Ideas | Independent observations, possible applications, improvements, and emerging research ideas |
| 🟦 Blue | Questions & Uncertainty | Unfamiliar concepts, unclear reasoning, unresolved questions, and knowledge gaps |
| 🟪 Purple | Literature Connections | Relationships to other papers, theoretical frameworks, methods, or research directions |
| 🟧 Orange | Methods & Technical Details | Algorithms, architectures, mathematical formulations, datasets, experimental designs, and evaluation metrics |

## 6.1 Annotation Principles

### Highlight Selectively

Not every important-looking sentence needs to be highlighted.

Highlights should identify information worth revisiting.

### Annotate Actively

Whenever possible, add a comment explaining why a passage was highlighted.

### Separate Facts from Interpretations

Distinguish between:

- Author claims
- Experimental evidence
- Personal interpretations
- Criticism
- Speculation

### Record Uncertainty

Unanswered questions should be documented rather than silently ignored.

### Separate Misunderstanding from Criticism

Not understanding an argument does not constitute evidence that the argument is incorrect.

## 6.2 Annotation Examples

### Yellow — Important Information

> The authors introduce a new approach for coordinating connected vehicles.

Comment:

> Central contribution of the paper. Relevant to cooperative motion control.

### Red — Criticism

> The proposed approach demonstrates strong generalization.

Comment:

> Does the experimental evaluation cover sufficiently diverse traffic scenarios to support this conclusion?

### Green — Research Idea

> The model generates cooperative driving policies using learned representations.

Comment:

> Could a related approach be applied to generating realistic vehicle behavior in simulation environments?

### Blue — Question

> The controller guarantees string stability under the specified assumptions.

Comment:

> Need to understand the formal definition of string stability and the conditions under which the guarantee holds.

### Purple — Literature Connection

> The proposed framework uses multi-agent reinforcement learning.

Comment:

> Compare with other approaches to decentralized multi-agent decision-making.

### Orange — Technical Method

> The policy is optimized using centralized training and decentralized execution.

Comment:

> Examine the training objective, observation space, and information available during inference.

---

# 7. Tagging Conventions

Tags provide searchable metadata independent of collection membership.

Tags should use lowercase names and consistent prefixes.

## 7.1 Reading Status

```text
status/to-read
status/reading
status/read
status/revisit
```

## 7.2 Research Activity

```text
approach/modeling
approach/control
approach/testing
```

## 7.3 Cross-Cutting Methodologies

```text
method/simulation
method/testing
method/verification
method/validation
method/scenario-generation
```

These tags are particularly important because Testing, Simulation & Verification cuts across the entire 3 + 1 research framework.

They may be assigned to papers in any collection.

## 7.4 Research Workflow

```text
meeting/discuss
priority/high
```

### meeting/discuss

Applied when a paper contains questions, criticisms, or ideas worth discussing with my professor.

### priority/high

Applied when a paper is particularly relevant to my current research interests or necessary for understanding subsequent literature.

## 7.5 Tagging Rules

1. Use consistent lowercase naming.
2. Avoid synonyms representing the same concept.
3. Prefer existing tags whenever possible.
4. Do not create tags for every unfamiliar term.
5. Assign multiple tags when justified.
6. Keep reading-status tags mutually exclusive.
7. Review unused or redundant tags periodically.

The purpose of tags is efficient retrieval, not exhaustive classification.

## 7.6 Zotero Colored Tags

Zotero supports assigning colors to a limited number of tags.

Recommended colored tags:

| Tag | Suggested Color |
|---|---|
| `status/to-read` | Gray |
| `status/reading` | Blue |
| `status/read` | Green |
| `status/revisit` | Orange |
| `priority/high` | Red |
| `meeting/discuss` | Purple |

Tag colors and PDF annotation colors serve different purposes.

PDF annotation colors describe the meaning of highlighted passages.

Tag colors describe properties of entire papers.

---

# 8. Paper Reading Workflow

## Stage 1 — Initial Screening

**Objective:** Determine the paper's relevance and central contribution.

Read:

- Title
- Abstract
- Introduction
- Main figures
- Conclusion

Questions:

- What problem is being addressed?
- Why is this problem important?
- What approach is proposed?
- What is the principal contribution?
- Which research direction does the paper belong to?

Assign the appropriate collection and reading-status tag.

## Stage 2 — Conceptual Understanding

**Objective:** Understand the methodology and its relationship to existing research.

Examine:

- Problem formulation
- Assumptions
- Proposed methodology
- Experimental design
- Evaluation criteria
- Main findings

Use PDF annotations to document important information, questions, and technical details.

## Stage 3 — Critical Examination

**Objective:** Evaluate the paper rather than merely summarize it.

Consider:

- Are the assumptions reasonable?
- Are the experimental conditions representative?
- Are the conclusions supported by the results?
- What limitations are acknowledged?
- What limitations might have been overlooked?
- How does the approach compare with existing methods?
- Under what conditions might the proposed method fail?

Document criticism using red annotations.

## Stage 4 — Synthesis

**Objective:** Integrate the paper into my broader understanding.

Create or update the paper's structured reading note.

Identify:

- Main takeaways
- Unresolved questions
- Connections to other publications
- Potential research ideas
- Questions for discussion

Update the reading status accordingly.

---

# 9. Standard Paper Reading Note

Each substantially examined paper should have a structured Zotero child note.

The following template is recommended.

## Paper Information

**Title:**

**Authors:**

**Year:**

**Research Collection:**

**Research Activity:**

**Reading Status:**

---

## 1. Research Question

What problem are the authors attempting to solve?

Why is this problem important?

## 2. Background & Prerequisites

What prior knowledge is required to understand the paper?

Which unfamiliar concepts need further investigation?

## 3. Methodology

How does the proposed approach work?

What assumptions does it rely on?

What algorithms, models, or frameworks are employed?

## 4. Main Contributions & Findings

What are the authors' primary contributions?

What results support their claims?

## 5. What I Learned

What new knowledge or understanding did I gain?

Which concepts became clearer?

## 6. What I Do Not Understand

Which concepts, explanations, or derivations remain unclear?

What should I investigate further?

## 7. Critical Evaluation

Which arguments are convincing?

Which assumptions or conclusions do I question?

Are there methodological limitations?

## 8. Connections to Other Literature

Which other papers address related problems?

How do their approaches differ?

## 9. Research Ideas

Does the paper suggest new research questions?

Could its methods be extended, combined, or applied differently?

## 10. Questions for My Professor

Which questions would benefit from discussion?

## 11. Personal Summary

Summarize the paper and its relevance in my own words.

---

# 10. Research Journal

In addition to individual paper notes, a central research journal should document the development of my overall understanding.

The journal is not intended to duplicate paper summaries.

Instead, it should capture broader observations and changes in perspective.

## Suggested Journal Entry

**Date:**

**Papers examined:**

**Research direction:**

**What I learned:**

**How my understanding changed:**

**Questions that emerged:**

**Connections between papers:**

**Potential research directions:**

**Next steps:**

## Periodic Reflection

After reading several papers, revisit the following questions:

1. Which research problems do I find most interesting?
2. Which methodologies do I enjoy studying?
3. Which areas remain difficult to understand?
4. Which recurring limitations appear in the literature?
5. Which open questions seem promising?
6. How have my research interests changed?

These reflections should gradually inform the selection of a Master's research topic.

---

# 11. Literature Review Best Practices

## 11.1 Preserve Bibliographic Metadata

Every reference should contain accurate bibliographic information whenever available:

- Title
- Authors
- Publication year
- Journal or conference
- DOI
- Publication URL
- PDF attachment

Prefer DOI-based metadata retrieval when available.

## 11.2 Avoid Duplicate References

Before importing a paper, check whether it already exists in the library.

Use Zotero's duplicate detection functionality periodically.

Multiple collection memberships should not be implemented by importing the same reference repeatedly.

## 11.3 Maintain Links Between Evidence and Interpretation

Important claims in research notes should remain traceable to their original source.

Use Zotero's annotation links and citations when possible.

Distinguish between:

- Statements made by the authors
- Results demonstrated experimentally
- Personal interpretations
- Speculative research ideas

## 11.4 Prioritize Understanding Over Quantity

The number of papers collected is not a measure of research progress.

Reading fewer papers critically may be more valuable than collecting large quantities without developing a coherent understanding.

## 11.5 Treat the Framework as Evolving

The organizational structure is intended to support research, not constrain it.

New collections, tags, or conventions should be introduced when they solve an identifiable organizational problem.

Avoid unnecessary complexity.

---

# 12. Research Development Roadmap

## Phase 1 — Field Orientation

**Goal:** Develop a broad understanding of the research landscape.

Activities:

- Read the four recommended surveys.
- Examine their taxonomies and figures.
- Identify major research problems.
- Learn essential transportation terminology.
- Document initial interests and questions.

## Phase 2 — Methodological Exploration

**Goal:** Understand the methods employed across different research directions.

Possible areas:

- Traffic-flow modeling
- Reinforcement learning
- Multi-agent systems
- Control theory
- Generative modeling
- Simulation and verification
- LLM-based reasoning and decision-making

## Phase 3 — Research Focus

**Goal:** Identify promising intersections between research problems and methodological interests.

Activities:

- Compare approaches across papers.
- Identify recurring limitations.
- Investigate open research questions.
- Discuss possible directions with my professor.

## Phase 4 — Research Topic Formulation

**Goal:** Develop a feasible and scientifically meaningful Master's research question.

Consider:

- Scientific relevance
- Novelty
- Methodological feasibility
- Available data and computational resources
- Evaluation possibilities
- Personal interests
- Alignment with the research group

---

# 13. Maintenance and Versioning

This document serves as the central reference for my literature management system.

Changes to the taxonomy, annotation colors, or tag definitions should be documented here.

## Version History

| Version | Changes |
|---|---|
| 1.0 | Initial research taxonomy, collection structure, annotation conventions, tagging system, and reading workflow |

## Guiding Principle

> The objective is not to build the most elaborate literature management system, but to establish a consistent and sustainable process that transforms reading into understanding, understanding into critical thinking, and critical thinking into independent research.